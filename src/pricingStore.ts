import type { QueryResultRow } from "pg";
import type { AuthUser } from "./authStore.ts";
import { query, withTransaction } from "./db.ts";
import { exportObjectKey, validateObjectMetadata, type ObjectMetadata, type StoredContentType } from "./objectStore.ts";
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

export async function createExport(
  userId: number,
  app: string,
  versionId: number | undefined,
  scope: unknown,
  format: string,
  filename: string,
): Promise<number> {
  const result = await query<{ id: number }>(
    `INSERT INTO exports (user_id, app_id, version_id, scope, format, status, output_filename)
     SELECT $1, a.id, $3, $4::jsonb, $5, 'generating', $6 FROM apps a WHERE a.name = $2
     RETURNING id`,
    [userId, app, versionId ?? null, JSON.stringify(scope), format, filename],
  );
  if (!result.rows[0]) throw new Error("Export app not found");
  return Number(result.rows[0].id);
}

export async function completeExport(exportId: number, metadata: ObjectMetadata): Promise<void> {
  if (!Number.isSafeInteger(exportId) || exportId <= 0) throw new Error("Invalid export ID");
  validateObjectMetadata(metadata);
  const extensionByType: Partial<Record<StoredContentType, string>> = {
    "application/zip": "zip",
    "application/json": "json",
    "text/css": "css",
    "text/javascript": "js",
    "text/typescript": "tsx",
  };
  const extension = extensionByType[metadata.contentType];
  if (
    !extension
    || metadata.accessClass !== "protected"
    || metadata.key !== exportObjectKey(String(exportId), metadata.sha256, extension)
  ) {
    throw new Error("Object metadata does not match export");
  }
  await withTransaction(async (client) => {
    const stored = await client.query(
      `INSERT INTO stored_objects (object_key, sha256, byte_size, content_type, access_class)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (object_key) DO UPDATE SET object_key = EXCLUDED.object_key
       WHERE stored_objects.sha256 = EXCLUDED.sha256
         AND stored_objects.byte_size = EXCLUDED.byte_size
         AND stored_objects.content_type = EXCLUDED.content_type
         AND stored_objects.access_class = EXCLUDED.access_class
       RETURNING object_key`,
      [metadata.key, metadata.sha256, metadata.byteSize, metadata.contentType, metadata.accessClass],
    );
    if (stored.rowCount !== 1) throw new Error("Object key already exists with different metadata");
    const completed = await client.query(
      `UPDATE exports SET object_key = $2, status = 'complete', completed_at = COALESCE(completed_at, now()), error = NULL
       WHERE id = $1
         AND status IN ('generating', 'failed', 'complete')
         AND (object_key IS NULL OR object_key = $2)
       RETURNING id`,
      [exportId, metadata.key],
    );
    if (completed.rowCount !== 1) throw new Error("Export not found or already attached to another object");
  });
}

export async function failExport(exportId: number): Promise<void> {
  await query(
    `UPDATE exports SET status = 'failed', error = $2, completed_at = NULL
     WHERE id = $1 AND status <> 'complete'`,
    [exportId, "artifact storage failed"],
  );
}

export async function authorizedExportObject(input: {
  userId: number;
  exportId: number;
}): Promise<{ metadata: ObjectMetadata; filename: string } | undefined> {
  if (!Number.isSafeInteger(input.userId) || input.userId <= 0) throw new Error("Invalid user ID");
  if (!Number.isSafeInteger(input.exportId) || input.exportId <= 0) throw new Error("Invalid export ID");
  const result = await query<{
    object_key: string;
    sha256: string;
    byte_size: string | number;
    content_type: StoredContentType;
    access_class: ObjectMetadata["accessClass"];
    output_filename: string;
  }>(
    `SELECT so.object_key, so.sha256, so.byte_size, so.content_type, so.access_class, e.output_filename
     FROM exports e
     JOIN stored_objects so ON so.object_key = e.object_key
     JOIN users requester ON requester.id = $1 AND requester.active = true
     WHERE e.id = $2 AND e.status = 'complete' AND e.completed_at IS NOT NULL
       AND (e.user_id = requester.id OR requester.role = 'admin')
     LIMIT 1`,
    [input.userId, input.exportId],
  );
  const row = result.rows[0];
  if (!row) return undefined;
  const metadata: ObjectMetadata = {
    key: row.object_key,
    sha256: row.sha256,
    byteSize: Number(row.byte_size),
    contentType: row.content_type,
    accessClass: row.access_class,
  };
  validateObjectMetadata(metadata);
  if (!row.output_filename) throw new Error("Completed export has no filename");
  return { metadata, filename: row.output_filename };
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
