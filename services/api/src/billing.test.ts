import { test } from "node:test";
import assert from "node:assert/strict";
import { createBillingService, type StripePort } from "./billing.ts";
import type { BillingConfig } from "./config.ts";
import type { SubscriptionRecord } from "../../../src/pricing.ts";
import type { StripeSubscriptionInput } from "../../../src/pricingStore.ts";

const config: BillingConfig = {
  stripeSecretKey: "sk_test_x",
  stripeWebhookSecret: "whsec_x",
  monthlyPriceId: "price_month",
  yearlyPriceId: "price_year",
  appUrl: "https://astryx.example",
  mediaSigningSecret: "0123456789abcdef0123456789abcdef",
  crawlSessionEncryptionKey: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
  generalRateLimit: 300,
  mediaRateLimit: 500,
  appTraversalLimit: 20,
};
const user = { id: 2, email: "user@example.com", role: "user" as const };

function fixture(input: {
  existing?: SubscriptionRecord;
  status?: "active" | "past_due";
  eventType?: string;
} = {}) {
  const calls = { checkout: [] as Record<string, unknown>[], subscriptions: [] as StripeSubscriptionInput[] };
  const processed = new Set<string>();
  const stripe: StripePort = {
    customers: { create: async () => ({ id: "cus_123" }) },
    checkout: { sessions: { create: async (params) => {
      calls.checkout.push(params);
      return { url: "https://checkout.stripe.test/session" };
    } } },
    billingPortal: { sessions: { create: async () => ({ url: "https://billing.stripe.test/portal" }) } },
    subscriptions: { retrieve: async () => ({
      id: "sub_123",
      customer: "cus_123",
      metadata: { astryxUserId: String(user.id) },
      status: input.status ?? "active",
      cancel_at_period_end: false,
      items: { data: [{
        price: { id: "price_month" },
        current_period_start: 1_783_036_800,
        current_period_end: 1_785_715_200,
      }] },
    }) },
    webhooks: { constructEvent: () => ({
      id: "evt_123",
      type: input.eventType ?? "customer.subscription.updated",
      data: { object: { id: "sub_123" } },
    }) },
  };
  let subscription = input.existing;
  const service = createBillingService({
    stripe,
    config,
    now: () => new Date("2026-07-10T00:00:00Z"),
    store: {
      getSubscription: async () => subscription,
      upsertStripeCustomer: async (_userId, customerId) => {
        subscription = { ...(subscription ?? emptySubscription()), stripe_customer_id: customerId };
      },
      upsertSubscription: async (value) => {
        calls.subscriptions.push(value);
      },
      hasProcessedStripeEvent: async (eventId) => processed.has(eventId),
      markStripeEventProcessed: async (eventId) => { processed.add(eventId); },
    },
  });
  return { service, stripe, calls };
}

function emptySubscription(): SubscriptionRecord {
  return {
    user_id: user.id,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    stripe_price_id: null,
    billing_interval: null,
    status: null,
    current_period_start: null,
    current_period_end: null,
    cancel_at_period_end: false,
    grace_expires_at: null,
  };
}

test("creates monthly Checkout with a server-selected Price", async () => {
  const { service, calls } = fixture();
  assert.deepEqual(await service.createCheckout(user, "month"), {
    status: "created",
    url: "https://checkout.stripe.test/session",
  });
  assert.deepEqual(calls.checkout[0].line_items, [{ price: "price_month", quantity: 1 }]);
  assert.equal(calls.checkout[0].mode, "subscription");
});

test("does not create a second Checkout for active Pro", async () => {
  const existing = { ...emptySubscription(), status: "active" as const, stripe_customer_id: "cus_123" };
  const { service, calls } = fixture({ existing });
  assert.deepEqual(await service.createCheckout(user, "year"), { status: "already_subscribed" });
  assert.equal(calls.checkout.length, 0);
});

test("synchronizes authoritative past-due state once with seven-day grace", async () => {
  const { service, calls } = fixture({ status: "past_due" });
  assert.equal(await service.handleWebhook(Buffer.from("event"), "signature"), "processed");
  assert.equal(await service.handleWebhook(Buffer.from("event"), "signature"), "duplicate");
  assert.equal(calls.subscriptions.length, 1);
  assert.equal(calls.subscriptions[0].status, "past_due");
  assert.equal(calls.subscriptions[0].graceExpiresAt?.toISOString(), "2026-07-17T00:00:00.000Z");
});

test("requires a webhook signature", async () => {
  const { service } = fixture();
  await assert.rejects(() => service.handleWebhook(Buffer.from("event"), undefined), /signature/i);
});

test("ignores invoice events and waits for authoritative subscription updates", async () => {
  const { service, calls } = fixture({ eventType: "invoice.payment_failed" });
  assert.equal(await service.handleWebhook(Buffer.from("event"), "signature"), "ignored");
  assert.equal(calls.subscriptions.length, 0);
});
