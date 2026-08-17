import { createHmac, timingSafeEqual } from "node:crypto";
import type { AuthUser } from "../../../src/authStore.ts";
import { effectivePlan, type BillingInterval, type OrganizationSubscriptionRecord, type SubscriptionRecord, type SubscriptionStatus } from "../../../src/pricing.ts";
import type { PaddleOrganizationSubscriptionInput, PaddleSubscriptionInput, TeamBillingOrganization } from "../../../src/pricingStore.ts";
import type { BillingConfig } from "./config.ts";

interface PaddleSubscription {
  id: string;
  customer_id: string;
  custom_data: Record<string, unknown> | null;
  status: string;
  scheduled_change?: { action?: string } | null;
  current_billing_period?: { starts_at?: string; ends_at?: string } | null;
  items: Array<{ price: { id: string }; quantity?: number | null }>;
}

interface PaddleEvent {
  event_id: string;
  event_type: string;
  data: PaddleSubscription;
}

export interface PaddlePort {
  transactions: {
    create(input: Record<string, unknown>): Promise<{ id: string; checkout: { url: string | null } | null }>;
  };
  customers: {
    createPortalSession(customerId: string, subscriptionId: string): Promise<{ url: string | null }>;
  };
  webhooks: {
    unmarshal(rawBody: Buffer, secret: string, signature: string): PaddleEvent;
  };
}

export interface BillingService {
  createCheckout(user: AuthUser, interval: BillingInterval): Promise<
    | { status: "created"; transactionId: string }
    | { status: "already_subscribed" }
  >;
  createTeamCheckout(user: AuthUser, organizationId: number): Promise<
    | { status: "created"; transactionId: string }
    | { status: "already_subscribed" }
    | { status: "not_owner" }
  >;
  createPortal(userId: number, organizationId?: number): Promise<{ url: string } | undefined>;
  /** Kept for old success URLs; Paddle entitlements are webhook-authoritative. */
  reconcileCheckoutSession(userId: number, sessionId: string): Promise<"processed" | "pending" | "not_found">;
  handleWebhook(rawBody: Buffer, signature: string | undefined): Promise<"processed" | "duplicate" | "ignored">;
}

interface BillingStore {
  getSubscription(userId: number): Promise<SubscriptionRecord | undefined>;
  getOrganizationSubscription(organizationId: number): Promise<OrganizationSubscriptionRecord | undefined>;
  getTeamBillingOrganization(organizationId: number, ownerUserId: number): Promise<TeamBillingOrganization | undefined>;
  upsertPaddleSubscription(input: PaddleSubscriptionInput): Promise<void>;
  upsertPaddleOrganizationSubscription(input: PaddleOrganizationSubscriptionInput): Promise<void>;
  hasProcessedPaddleEvent(eventId: string): Promise<boolean>;
  markPaddleEventProcessed(eventId: string): Promise<void>;
}

const supportedEvents = new Set([
  "subscription.created",
  "subscription.activated",
  "subscription.updated",
  "subscription.canceled",
  "subscription.past_due",
  "subscription.paused",
]);

function eventSignatureParts(signature: string): { timestamp: string; hashes: string[] } {
  const pairs = signature.split(";").map((part) => part.trim().split("=", 2));
  const timestamp = pairs.find(([name]) => name === "ts")?.[1];
  const hashes = pairs.filter(([name]) => name === "h1").map(([, value]) => value).filter((value): value is string => Boolean(value));
  if (!timestamp || hashes.length === 0 || !/^\d+$/.test(timestamp)) throw new Error("Invalid Paddle signature");
  return { timestamp, hashes };
}

/** Verify Paddle's signed raw payload without parsing or normalizing it first. */
export function unmarshalPaddleWebhook(rawBody: Buffer, secret: string, signature: string, now = Date.now()): PaddleEvent {
  const { timestamp, hashes } = eventSignatureParts(signature);
  if (Math.abs(now - Number(timestamp) * 1000) > 5 * 60_000) throw new Error("Expired Paddle signature");
  const expected = createHmac("sha256", secret).update(`${timestamp}:${rawBody.toString("utf8")}`).digest("hex");
  const expectedBytes = Buffer.from(expected, "hex");
  const valid = hashes.some((hash) => {
    if (!/^[a-f0-9]{64}$/i.test(hash)) return false;
    const received = Buffer.from(hash, "hex");
    return received.length === expectedBytes.length && timingSafeEqual(received, expectedBytes);
  });
  if (!valid) throw new Error("Invalid Paddle signature");
  const parsed = JSON.parse(rawBody.toString("utf8")) as Partial<PaddleEvent>;
  if (!parsed.event_id || !parsed.event_type || !parsed.data || typeof parsed.data.id !== "string") {
    throw new Error("Invalid Paddle event");
  }
  return parsed as PaddleEvent;
}

async function paddleRequest<T>(apiKey: string, url: string, init: RequestInit, fetcher: typeof fetch): Promise<T> {
  const response = await fetcher(url, {
    ...init,
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", ...init.headers },
  });
  const payload = await response.json().catch(() => ({})) as { data?: T; error?: { detail?: string } };
  if (!response.ok || !payload.data) throw new Error(payload.error?.detail ?? `Paddle API request failed (${response.status})`);
  return payload.data;
}

/** The server owns API-key operations; browser code only receives a prepared transaction ID. */
export function createPaddleClient(
  apiKey: string,
  environment: "sandbox" | "production",
  fetcher: typeof fetch = fetch,
): PaddlePort {
  const apiBaseUrl = environment === "sandbox" ? "https://sandbox-api.paddle.com" : "https://api.paddle.com";
  const request = <T>(path: string, init: RequestInit) => paddleRequest<T>(apiKey, `${apiBaseUrl}${path}`, init, fetcher);
  return {
    transactions: {
      create: (input) => request("/transactions", {
        method: "POST", body: JSON.stringify(input),
      }, fetcher),
    },
    customers: {
      async createPortalSession(customerId, subscriptionId) {
        const result = await paddleRequest<{
          urls?: { general?: { overview?: string | null } };
        }>(`/customers/${encodeURIComponent(customerId)}/portal-sessions`, {
          method: "POST", body: JSON.stringify({ subscription_ids: [subscriptionId] }),
        }, fetcher);
        return { url: result.urls?.general?.overview ?? null };
      },
    },
    webhooks: { unmarshal: (rawBody, secret, signature) => unmarshalPaddleWebhook(rawBody, secret, signature) },
  };
}

function paddleStatus(status: string): SubscriptionStatus | undefined {
  return ["active", "past_due", "canceled", "paused", "trialing"].includes(status)
    ? status as SubscriptionStatus
    : undefined;
}

function numberFromCustomData(customData: Record<string, unknown> | null, key: string): number | undefined {
  const value = Number(customData?.[key]);
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

function periodDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? undefined : date;
}

function graceFor(
  subscription: Pick<SubscriptionRecord | OrganizationSubscriptionRecord, "status" | "grace_expires_at"> | undefined,
  status: SubscriptionStatus,
  now: Date,
): Date | null {
  if (status !== "past_due") return null;
  const prior = subscription?.grace_expires_at && new Date(subscription.grace_expires_at);
  return prior && prior > now ? prior : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
}

export function createBillingService(input: {
  paddle: PaddlePort;
  config: BillingConfig;
  store: BillingStore;
  now?: () => Date;
}): BillingService {
  const { paddle, config, store } = input;
  const now = input.now ?? (() => new Date());

  const createTransaction = async (priceId: string, quantity: number, customData: Record<string, string>): Promise<{ transactionId: string }> => {
    const transaction = await paddle.transactions.create({
      collection_mode: "automatic",
      items: [{ price_id: priceId, quantity }],
      custom_data: customData,
      // This must be an approved live domain before Paddle can open checkout.
      checkout: { url: `${config.appUrl}/billing/success` },
    });
    if (!transaction.id) throw new Error("Paddle did not return a transaction ID");
    return { transactionId: transaction.id };
  };

  const syncSubscription = async (subscription: PaddleSubscription): Promise<"processed" | "ignored"> => {
    const item = subscription.items[0];
    const status = paddleStatus(subscription.status);
    if (!item || !status || !subscription.customer_id) return "ignored";
    const organizationId = numberFromCustomData(subscription.custom_data, "vitrinesOrganizationId");
    if (config.teamYearlyPriceId && item.price.id === config.teamYearlyPriceId && organizationId) {
      const existing = await store.getOrganizationSubscription(organizationId);
      const periodStart = periodDate(subscription.current_billing_period?.starts_at)
        ?? (existing?.current_period_start ? new Date(existing.current_period_start) : now());
      const periodEnd = periodDate(subscription.current_billing_period?.ends_at)
        ?? (existing?.current_period_end ? new Date(existing.current_period_end) : now());
      await store.upsertPaddleOrganizationSubscription({
        organizationId,
        customerId: subscription.customer_id,
        subscriptionId: subscription.id,
        priceId: item.price.id,
        seatCount: Math.max(3, item.quantity ?? 3),
        status,
        periodStart,
        periodEnd,
        cancelAtPeriodEnd: subscription.scheduled_change?.action === "cancel",
        graceExpiresAt: graceFor(existing, status, now()),
      });
      return "processed";
    }

    const interval = item.price.id === config.monthlyPriceId ? "month" : item.price.id === config.yearlyPriceId ? "year" : undefined;
    const userId = numberFromCustomData(subscription.custom_data, "vitrinesUserId");
    if (!interval || !userId) return "ignored";
    const existing = await store.getSubscription(userId);
    const periodStart = periodDate(subscription.current_billing_period?.starts_at)
      ?? (existing?.current_period_start ? new Date(existing.current_period_start) : now());
    const periodEnd = periodDate(subscription.current_billing_period?.ends_at)
      ?? (existing?.current_period_end ? new Date(existing.current_period_end) : now());
    await store.upsertPaddleSubscription({
      userId,
      customerId: subscription.customer_id,
      subscriptionId: subscription.id,
      priceId: item.price.id,
      interval,
      status,
      periodStart,
      periodEnd,
      cancelAtPeriodEnd: subscription.scheduled_change?.action === "cancel",
      graceExpiresAt: graceFor(existing, status, now()),
    });
    return "processed";
  };

  return {
    async createCheckout(user, interval) {
      if (effectivePlan(await store.getSubscription(user.id), now()) === "pro") return { status: "already_subscribed" };
      return { status: "created", ...await createTransaction(
        interval === "month" ? config.monthlyPriceId : config.yearlyPriceId,
        1,
        { vitrinesUserId: String(user.id) },
      ) };
    },

    async createTeamCheckout(user, organizationId) {
      if (!config.teamYearlyPriceId) throw new Error("Team billing is not configured");
      const organization = await store.getTeamBillingOrganization(organizationId, user.id);
      if (!organization) return { status: "not_owner" };
      if (effectivePlan(await store.getOrganizationSubscription(organizationId), now()) === "pro") return { status: "already_subscribed" };
      return { status: "created", ...await createTransaction(
        config.teamYearlyPriceId,
        Math.max(3, organization.memberCount),
        { vitrinesOrganizationId: String(organization.id), vitrinesBillingOwnerId: String(user.id) },
      ) };
    },

    async createPortal(userId, organizationId) {
      let subscription: SubscriptionRecord | OrganizationSubscriptionRecord | undefined;
      if (organizationId) {
        if (!(await store.getTeamBillingOrganization(organizationId, userId))) return undefined;
        subscription = await store.getOrganizationSubscription(organizationId);
      } else {
        subscription = await store.getSubscription(userId);
      }
      if (!subscription?.paddle_customer_id || !subscription.paddle_subscription_id) return undefined;
      const portal = await paddle.customers.createPortalSession(subscription.paddle_customer_id, subscription.paddle_subscription_id);
      return portal.url ? { url: portal.url } : undefined;
    },

    async reconcileCheckoutSession() {
      return "not_found";
    },

    async handleWebhook(rawBody, signature) {
      if (!signature) throw new Error("Paddle signature is required");
      const event = paddle.webhooks.unmarshal(rawBody, config.paddleWebhookSecret, signature);
      if (await store.hasProcessedPaddleEvent(event.event_id)) return "duplicate";
      if (!supportedEvents.has(event.event_type)) { await store.markPaddleEventProcessed(event.event_id); return "ignored"; }
      const result = await syncSubscription(event.data);
      await store.markPaddleEventProcessed(event.event_id);
      return result;
    },
  };
}
