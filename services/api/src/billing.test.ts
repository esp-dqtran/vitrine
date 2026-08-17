import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createBillingService, createPaddleClient, type PaddlePort, unmarshalPaddleWebhook } from "./billing.ts";
import type { BillingConfig } from "./config.ts";
import type { SubscriptionRecord } from "../../../src/pricing.ts";
import type { PaddleSubscriptionInput } from "../../../src/pricingStore.ts";

const config: BillingConfig = {
  paddleApiKey: "pdl_test_x",
  paddleWebhookSecret: "pdl_ntfset_x",
  paddleEnvironment: "sandbox",
  monthlyPriceId: "pri_month",
  yearlyPriceId: "pri_year",
  teamYearlyPriceId: "pri_team",
  appUrl: "https://vitrines.example",
  mediaSigningSecret: "0123456789abcdef0123456789abcdef",
  crawlSessionEncryptionKey: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
  generalRateLimit: 300,
  mediaRateLimit: 500,
  appTraversalLimit: 20,
};
const user = { id: 2, email: "user@example.com", role: "user" as const };

function subscriptionEvent(input: { status?: string; priceId?: string; customData?: Record<string, string> } = {}) {
  return {
    event_id: "evt_123",
    event_type: "subscription.updated",
    data: {
      id: "sub_123",
      customer_id: "ctm_123",
      custom_data: input.customData ?? { vitrinesUserId: String(user.id) },
      status: input.status ?? "active",
      scheduled_change: null,
      current_billing_period: { starts_at: "2026-07-01T00:00:00Z", ends_at: "2026-08-01T00:00:00Z" },
      items: [{ price: { id: input.priceId ?? "pri_month" }, quantity: 1 }],
    },
  };
}

function fixture(input: { existing?: SubscriptionRecord; event?: ReturnType<typeof subscriptionEvent> } = {}) {
  const calls = { transactions: [] as Record<string, unknown>[], subscriptions: [] as PaddleSubscriptionInput[], portal: [] as string[] };
  const processed = new Set<string>();
  const paddle: PaddlePort = {
    transactions: { create: async (params) => {
      calls.transactions.push(params);
      return { id: "txn_123", checkout: { url: "https://checkout.paddle.test/txn_123" } };
    } },
    customers: { createPortalSession: async (customerId, subscriptionId) => {
      calls.portal.push(`${customerId}:${subscriptionId}`);
      return { url: "https://customer-portal.paddle.test/session" };
    } },
    webhooks: { unmarshal: () => input.event ?? subscriptionEvent() },
  };
  const service = createBillingService({
    paddle,
    config,
    now: () => new Date("2026-07-10T00:00:00Z"),
    store: {
      getSubscription: async () => input.existing,
      getOrganizationSubscription: async () => undefined,
      getTeamBillingOrganization: async (organizationId, ownerUserId) => (
        organizationId === 7 && ownerUserId === user.id ? { id: 7, name: "Acme", memberCount: 1 } : undefined
      ),
      upsertPaddleSubscription: async (value) => { calls.subscriptions.push(value); },
      upsertPaddleOrganizationSubscription: async () => undefined,
      hasProcessedPaddleEvent: async (eventId) => processed.has(eventId),
      markPaddleEventProcessed: async (eventId) => { processed.add(eventId); },
    },
  });
  return { service, calls };
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

test("creates a Paddle transaction with a server-selected price and user identity", async () => {
  const { service, calls } = fixture();
  assert.deepEqual(await service.createCheckout(user, "month"), { status: "created", transactionId: "txn_123" });
  assert.deepEqual(calls.transactions[0], {
    collection_mode: "automatic",
    items: [{ price_id: "pri_month", quantity: 1 }],
    custom_data: { vitrinesUserId: "2" },
    checkout: { url: "https://vitrines.example/billing/success" },
  });
});

test("does not create a second checkout for active Pro", async () => {
  const { service, calls } = fixture({ existing: { ...emptySubscription(), status: "active" } });
  assert.deepEqual(await service.createCheckout(user, "year"), { status: "already_subscribed" });
  assert.equal(calls.transactions.length, 0);
});

test("creates a Team transaction with organization-scoped custom data and three-seat minimum", async () => {
  const { service, calls } = fixture();
  assert.deepEqual(await service.createTeamCheckout(user, 7), { status: "created", transactionId: "txn_123" });
  assert.deepEqual(calls.transactions[0].items, [{ price_id: "pri_team", quantity: 3 }]);
  assert.deepEqual(calls.transactions[0].custom_data, { vitrinesOrganizationId: "7", vitrinesBillingOwnerId: "2" });
});

test("synchronizes signed Paddle subscription state exactly once", async () => {
  const { service, calls } = fixture({ event: subscriptionEvent({ status: "past_due" }) });
  assert.equal(await service.handleWebhook(Buffer.from("event"), "signature"), "processed");
  assert.equal(await service.handleWebhook(Buffer.from("event"), "signature"), "duplicate");
  assert.equal(calls.subscriptions.length, 1);
  assert.equal(calls.subscriptions[0].status, "past_due");
  assert.equal(calls.subscriptions[0].graceExpiresAt?.toISOString(), "2026-07-17T00:00:00.000Z");
});

test("verifies Paddle raw-body signatures and rejects replayed payloads", () => {
  const raw = Buffer.from(JSON.stringify(subscriptionEvent()));
  const timestamp = "1783641600";
  const hash = createHmac("sha256", config.paddleWebhookSecret).update(`${timestamp}:${raw.toString("utf8")}`).digest("hex");
  assert.equal(unmarshalPaddleWebhook(raw, config.paddleWebhookSecret, `ts=${timestamp};h1=${hash}`, 1_783_641_600_000).event_id, "evt_123");
  assert.throws(() => unmarshalPaddleWebhook(raw, config.paddleWebhookSecret, `ts=${timestamp};h1=${hash}`, 1_783_642_000_001), /Expired/);
});

test("uses Paddle's sandbox API base URL for server-side transactions", async () => {
  let receivedUrl = "";
  let receivedAuthorization = "";
  const paddle = createPaddleClient("pdl_sdbx_secret", "sandbox", async (input, init) => {
    receivedUrl = String(input);
    receivedAuthorization = new Headers(init?.headers).get("authorization") ?? "";
    return new Response(JSON.stringify({ data: { id: "txn_123", checkout: { url: "https://checkout.paddle.test/txn_123" } } }), { status: 201 });
  });
  await paddle.transactions.create({ items: [{ price_id: "pri_month", quantity: 1 }] });
  assert.equal(receivedUrl, "https://sandbox-api.paddle.com/transactions");
  assert.equal(receivedAuthorization, "Bearer pdl_sdbx_secret");
});
