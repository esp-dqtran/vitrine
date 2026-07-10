import type { AuthUser } from "../../../src/authStore.ts";
import { effectivePlan, type BillingInterval, type SubscriptionRecord, type SubscriptionStatus } from "../../../src/pricing.ts";
import type { StripeSubscriptionInput } from "../../../src/pricingStore.ts";
import type { BillingConfig } from "./config.ts";

interface StripeSubscription {
  id: string;
  customer: string | { id: string };
  metadata: Record<string, string>;
  status: SubscriptionStatus;
  cancel_at_period_end: boolean;
  items: { data: Array<{
    price: { id: string };
    current_period_start: number;
    current_period_end: number;
  }> };
}

interface StripeEvent {
  id: string;
  type: string;
  data: { object: { id: string } };
}

export interface StripePort {
  customers: { create(input: Record<string, unknown>): Promise<{ id: string }> };
  checkout: { sessions: { create(input: Record<string, unknown>): Promise<{ url: string | null }> } };
  billingPortal: { sessions: { create(input: Record<string, unknown>): Promise<{ url: string }> } };
  subscriptions: { retrieve(id: string): Promise<StripeSubscription> };
  webhooks: { constructEvent(body: Buffer, signature: string, secret: string): StripeEvent };
}

export interface BillingService {
  createCheckout(user: AuthUser, interval: BillingInterval): Promise<
    | { status: "created"; url: string }
    | { status: "already_subscribed" }
  >;
  createPortal(userId: number): Promise<{ url: string } | undefined>;
  handleWebhook(
    rawBody: Buffer,
    signature: string | undefined,
  ): Promise<"processed" | "duplicate" | "ignored">;
}

interface BillingStore {
  getSubscription(userId: number): Promise<SubscriptionRecord | undefined>;
  upsertStripeCustomer(userId: number, customerId: string): Promise<void>;
  upsertSubscription(input: StripeSubscriptionInput): Promise<void>;
  hasProcessedStripeEvent(eventId: string): Promise<boolean>;
  markStripeEventProcessed(eventId: string): Promise<void>;
}

const supportedEvents = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

export function createBillingService(input: {
  stripe: StripePort;
  config: BillingConfig;
  store: BillingStore;
  now?: () => Date;
}): BillingService {
  const { stripe, config, store } = input;
  const now = input.now ?? (() => new Date());

  return {
    async createCheckout(user, interval) {
      const existing = await store.getSubscription(user.id);
      if (effectivePlan(existing, now()) === "pro") return { status: "already_subscribed" };
      let customerId = existing?.stripe_customer_id;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { astryxUserId: String(user.id) },
        });
        customerId = customer.id;
        await store.upsertStripeCustomer(user.id, customerId);
      }
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [{
          price: interval === "month" ? config.monthlyPriceId : config.yearlyPriceId,
          quantity: 1,
        }],
        success_url: `${config.appUrl}/billing/success`,
        cancel_url: `${config.appUrl}/pricing`,
        subscription_data: { metadata: { astryxUserId: String(user.id) } },
      });
      if (!session.url) throw new Error("Stripe Checkout did not return a URL");
      return { status: "created", url: session.url };
    },

    async createPortal(userId) {
      const subscription = await store.getSubscription(userId);
      if (!subscription?.stripe_customer_id) return undefined;
      return stripe.billingPortal.sessions.create({
        customer: subscription.stripe_customer_id,
        return_url: `${config.appUrl}/settings/billing`,
      });
    },

    async handleWebhook(rawBody, signature) {
      if (!signature) throw new Error("Stripe signature is required");
      const event = stripe.webhooks.constructEvent(rawBody, signature, config.stripeWebhookSecret);
      if (await store.hasProcessedStripeEvent(event.id)) return "duplicate";
      if (!supportedEvents.has(event.type)) {
        await store.markStripeEventProcessed(event.id);
        return "ignored";
      }
      const subscription = await stripe.subscriptions.retrieve(event.data.object.id);
      const item = subscription.items.data[0];
      const interval = item?.price.id === config.monthlyPriceId
        ? "month"
        : item?.price.id === config.yearlyPriceId
          ? "year"
          : undefined;
      const userId = Number(subscription.metadata.astryxUserId);
      if (!item || !interval || !Number.isInteger(userId) || userId <= 0) {
        await store.markStripeEventProcessed(event.id);
        return "ignored";
      }
      const existing = await store.getSubscription(userId);
      let graceExpiresAt: Date | null = null;
      if (subscription.status === "past_due") {
        const existingGrace = existing?.grace_expires_at && new Date(existing.grace_expires_at);
        graceExpiresAt = existingGrace && existingGrace > now()
          ? existingGrace
          : new Date(now().getTime() + 7 * 24 * 60 * 60 * 1000);
      }
      await store.upsertSubscription({
        userId,
        customerId: typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id,
        subscriptionId: subscription.id,
        priceId: item.price.id,
        interval,
        status: subscription.status,
        periodStart: new Date(item.current_period_start * 1000),
        periodEnd: new Date(item.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        graceExpiresAt,
      });
      await store.markStripeEventProcessed(event.id);
      return "processed";
    },
  };
}
