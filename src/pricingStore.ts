import type { QueryResultRow } from "pg";
import type { AuthUser } from "./authStore.ts";
import { query, withTransaction } from "./db.ts";
import {
  effectivePlan,
  exportWindow,
  type BillingInterval,
  type SubscriptionRecord,
  type SubscriptionStatus,
} from "./pricing.ts";

const FREE_APP_LIMIT = 3;
const EXPORT_LIMIT = 20 as const;

export type UnlockResult =
  | { status: "unlocked" | "already_unlocked"; remaining: number }
  | { status: "limit_reached" | "app_not_found"; remaining: number };

export interface StripeSubscriptionInput {
  userId: number;
  customerId: string;
  subscriptionId: string;
  priceId: string;
  interval: BillingInterval;
  status: SubscriptionStatus;
  periodStart: Date;
  periodEnd: Date;
  cancelAtPeriodEnd: boolean;
  graceExpiresAt: Date | null;
}

export interface AccountEntitlements {
  plan: "free" | "pro";
  subscription: SubscriptionRecord | null;
  freeUnlocks: string[];
  freeUnlocksRemaining: number;
  exportUsage: { used: number; limit: 20; resetAt: string | null };
}

const subscriptionColumns = `user_id, stripe_customer_id, stripe_subscription_id,
  stripe_price_id, billing_interval, status, current_period_start::text,
  current_period_end::text, cancel_at_period_end, grace_expires_at::text`;

export async function getSubscription(userId: number): Promise<SubscriptionRecord | undefined> {
  const result = await query<SubscriptionRecord & QueryResultRow>(
    `SELECT ${subscriptionColumns} FROM subscriptions WHERE user_id = $1`,
    [userId],
  );
  return result.rows[0];
}

export async function canAccessApp(
  user: Pick<AuthUser, "id" | "role">,
  appSlug: string,
): Promise<boolean> {
  if (user.role === "admin") return true;
  if (effectivePlan(await getSubscription(user.id)) === "pro") return true;
  const result = await query(
    `SELECT 1 FROM free_app_unlocks u JOIN apps a ON a.id = u.app_id
     WHERE u.user_id = $1 AND a.name = $2`,
    [user.id, appSlug],
  );
  return result.rowCount === 1;
}

export async function listFreeUnlocks(userId: number): Promise<string[]> {
  const result = await query<{ name: string }>(
    `SELECT a.name FROM free_app_unlocks u JOIN apps a ON a.id = u.app_id
     WHERE u.user_id = $1 ORDER BY u.unlocked_at, u.app_id`,
    [userId],
  );
  return result.rows.map(({ name }) => name);
}

export async function unlockFreeApp(userId: number, appSlug: string): Promise<UnlockResult> {
  return withTransaction(async (client) => {
    await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [userId]);
    const app = await client.query<{ id: number }>("SELECT id FROM apps WHERE name = $1", [appSlug]);
    if (!app.rows[0]) return { status: "app_not_found", remaining: 0 };
    const existing = await client.query(
      "SELECT 1 FROM free_app_unlocks WHERE user_id = $1 AND app_id = $2",
      [userId, app.rows[0].id],
    );
    const count = await client.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM free_app_unlocks WHERE user_id = $1",
      [userId],
    );
    const used = Number(count.rows[0].count);
    if (existing.rowCount) return { status: "already_unlocked", remaining: FREE_APP_LIMIT - used };
    if (used >= FREE_APP_LIMIT) return { status: "limit_reached", remaining: 0 };
    await client.query("INSERT INTO free_app_unlocks (user_id, app_id) VALUES ($1, $2)", [
      userId,
      app.rows[0].id,
    ]);
    return { status: "unlocked", remaining: FREE_APP_LIMIT - used - 1 };
  });
}

export async function upsertStripeCustomer(userId: number, customerId: string): Promise<void> {
  await query(
    `INSERT INTO subscriptions (user_id, stripe_customer_id) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET stripe_customer_id = EXCLUDED.stripe_customer_id,
       updated_at = now()`,
    [userId, customerId],
  );
}

export async function upsertSubscription(input: StripeSubscriptionInput): Promise<void> {
  await query(
    `INSERT INTO subscriptions (
       user_id, stripe_customer_id, stripe_subscription_id, stripe_price_id,
       billing_interval, status, current_period_start, current_period_end,
       cancel_at_period_end, grace_expires_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
     ON CONFLICT (user_id) DO UPDATE SET
       stripe_customer_id = EXCLUDED.stripe_customer_id,
       stripe_subscription_id = EXCLUDED.stripe_subscription_id,
       stripe_price_id = EXCLUDED.stripe_price_id,
       billing_interval = EXCLUDED.billing_interval,
       status = EXCLUDED.status,
       current_period_start = EXCLUDED.current_period_start,
       current_period_end = EXCLUDED.current_period_end,
       cancel_at_period_end = EXCLUDED.cancel_at_period_end,
       grace_expires_at = EXCLUDED.grace_expires_at,
       updated_at = now()`,
    [
      input.userId,
      input.customerId,
      input.subscriptionId,
      input.priceId,
      input.interval,
      input.status,
      input.periodStart,
      input.periodEnd,
      input.cancelAtPeriodEnd,
      input.graceExpiresAt,
    ],
  );
}

function usageWindow(subscription: SubscriptionRecord, now: Date): { start: Date; end: Date } | undefined {
  return subscription.current_period_start
    ? exportWindow(new Date(subscription.current_period_start), now)
    : undefined;
}

export async function getAccountEntitlements(userId: number, now = new Date()): Promise<AccountEntitlements> {
  const [subscription, freeUnlocks] = await Promise.all([
    getSubscription(userId),
    listFreeUnlocks(userId),
  ]);
  const plan = effectivePlan(subscription, now);
  const window = subscription && plan === "pro" ? usageWindow(subscription, now) : undefined;
  let used = 0;
  if (window) {
    const result = await query<{ operation_count: number }>(
      "SELECT operation_count FROM export_usage WHERE user_id = $1 AND window_start = $2",
      [userId, window.start],
    );
    used = result.rows[0]?.operation_count ?? 0;
  }
  return {
    plan,
    subscription: subscription ?? null,
    freeUnlocks,
    freeUnlocksRemaining: Math.max(0, FREE_APP_LIMIT - freeUnlocks.length),
    exportUsage: { used, limit: EXPORT_LIMIT, resetAt: window?.end.toISOString() ?? null },
  };
}

export async function reserveExportOperation(
  userId: number,
  now = new Date(),
): Promise<
  | { status: "reserved"; used: number; limit: 20; resetAt: string }
  | { status: "not_pro"; used: 0; limit: 20; resetAt: null }
  | { status: "limit_reached"; used: 20; limit: 20; resetAt: string }
> {
  return withTransaction(async (client) => {
    const result = await client.query<SubscriptionRecord & QueryResultRow>(
      `SELECT ${subscriptionColumns} FROM subscriptions WHERE user_id = $1 FOR UPDATE`,
      [userId],
    );
    const subscription = result.rows[0];
    if (!subscription || effectivePlan(subscription, now) !== "pro") {
      return { status: "not_pro", used: 0, limit: EXPORT_LIMIT, resetAt: null };
    }
    const window = usageWindow(subscription, now);
    if (!window) return { status: "not_pro", used: 0, limit: EXPORT_LIMIT, resetAt: null };
    const reserved = await client.query<{ operation_count: number }>(
      `INSERT INTO export_usage (user_id, window_start, operation_count) VALUES ($1, $2, 1)
       ON CONFLICT (user_id, window_start) DO UPDATE
         SET operation_count = export_usage.operation_count + 1
         WHERE export_usage.operation_count < $3
       RETURNING operation_count`,
      [userId, window.start, EXPORT_LIMIT],
    );
    if (!reserved.rows[0]) {
      return {
        status: "limit_reached",
        used: EXPORT_LIMIT,
        limit: EXPORT_LIMIT,
        resetAt: window.end.toISOString(),
      };
    }
    return {
      status: "reserved",
      used: reserved.rows[0].operation_count,
      limit: EXPORT_LIMIT,
      resetAt: window.end.toISOString(),
    };
  });
}

export async function hasProcessedStripeEvent(eventId: string): Promise<boolean> {
  return (await query("SELECT 1 FROM stripe_events WHERE event_id = $1", [eventId])).rowCount === 1;
}

export async function markStripeEventProcessed(eventId: string): Promise<void> {
  await query("INSERT INTO stripe_events (event_id) VALUES ($1) ON CONFLICT DO NOTHING", [eventId]);
}

export async function recordAccessEvent(input: {
  userId?: number;
  sessionHash?: string;
  ipPrefix?: string;
  appSlug?: string;
  action: string;
  volume?: number;
  outcome: string;
}): Promise<void> {
  await query(
    `INSERT INTO access_events (user_id, session_hash, ip_prefix, app_slug, action, volume, outcome)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      input.userId ?? null,
      input.sessionHash ?? null,
      input.ipPrefix ?? null,
      input.appSlug ?? null,
      input.action,
      input.volume ?? 1,
      input.outcome,
    ],
  );
}
