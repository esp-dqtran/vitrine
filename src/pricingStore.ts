import type { QueryResultRow } from "pg";
import type { AuthUser } from "./authStore.ts";
import { query, withTransaction, type ResearchCollection } from "./db.ts";
import { isFeatureKey, type FeatureKey } from "./featureUsage.ts";
import { activePromotionalEntitlement } from "./referralStore.ts";
import { exportObjectKey, validateObjectMetadata, type ObjectMetadata, type StoredContentType } from "./objectStore.ts";
import {
  effectivePlan,
  exportWindow,
  type BillingInterval,
  type OrganizationSubscriptionRecord,
  type SubscriptionRecord,
  type SubscriptionStatus,
} from "./pricing.ts";

const FREE_APP_LIMIT = 3;
const EXPORT_LIMIT = 20;

export type UnlockResult =
  | { status: "unlocked" | "already_unlocked"; remaining: number }
  | { status: "limit_reached" | "app_not_found"; remaining: number };

export interface PaddleSubscriptionInput {
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

export interface PaddleOrganizationSubscriptionInput {
  organizationId: number;
  customerId: string;
  subscriptionId: string;
  priceId: string;
  seatCount: number;
  status: SubscriptionStatus;
  periodStart: Date;
  periodEnd: Date;
  cancelAtPeriodEnd: boolean;
  graceExpiresAt: Date | null;
}

export interface TeamBillingOrganization {
  id: number;
  name: string;
  memberCount: number;
}

export interface TeamEntitlement {
  organization: TeamBillingOrganization;
  subscription: OrganizationSubscriptionRecord;
}

export interface AccountEntitlements {
  plan: "free" | "pro";
  entitlementSource: "paid" | "team" | "promotion" | "admin_grant" | "free";
  promotionExpiresAt: string | null;
  subscription: SubscriptionRecord | null;
  freeUnlocks: string[];
  freeUnlocksRemaining: number;
  team?: { organizationId: number; organizationName: string; seats: number } | null;
  exportUsage: { used: number; limit: number; resetAt: string | null };
}

const subscriptionColumns = `user_id, stripe_customer_id, stripe_subscription_id, stripe_price_id,
  paddle_customer_id, paddle_subscription_id, paddle_price_id, billing_interval, status, current_period_start::text,
  current_period_end::text, cancel_at_period_end, grace_expires_at::text`;

const organizationSubscriptionColumns = `organization_id, stripe_customer_id, stripe_subscription_id, stripe_price_id,
  paddle_customer_id, paddle_subscription_id, paddle_price_id, seat_count, status, current_period_start::text,
  current_period_end::text, cancel_at_period_end, grace_expires_at::text`;

export async function getSubscription(userId: number): Promise<SubscriptionRecord | undefined> {
  const result = await query<SubscriptionRecord & QueryResultRow>(
    `SELECT ${subscriptionColumns} FROM subscriptions WHERE user_id = $1`,
    [userId],
  );
  return result.rows[0];
}

export async function getOrganizationSubscription(
  organizationId: number,
): Promise<OrganizationSubscriptionRecord | undefined> {
  const result = await query<OrganizationSubscriptionRecord & QueryResultRow>(
    `SELECT ${organizationSubscriptionColumns} FROM organization_subscriptions WHERE organization_id = $1`,
    [organizationId],
  );
  return result.rows[0];
}

/** Returns the Team subscription that currently entitles this member, if any. */
export async function getTeamEntitlement(userId: number, now = new Date()): Promise<TeamEntitlement | undefined> {
  const result = await query<TeamEntitlement["subscription"] & QueryResultRow & {
    organization_name: string;
    member_count: number;
  }>(
    `SELECT s.organization_id, s.stripe_customer_id, s.stripe_subscription_id, s.stripe_price_id,
            s.paddle_customer_id, s.paddle_subscription_id, s.paddle_price_id, s.seat_count, s.status,
            s.current_period_start::text, s.current_period_end::text, s.cancel_at_period_end, s.grace_expires_at::text,
            o.name AS organization_name,
            (SELECT count(*)::integer FROM organization_members m2 WHERE m2.organization_id = o.id) AS member_count
     FROM organization_members m
     JOIN organizations o ON o.id = m.organization_id
     JOIN organization_subscriptions s ON s.organization_id = o.id
     WHERE m.user_id = $1
     ORDER BY s.updated_at DESC, o.id DESC`,
    [userId],
  );
  const row = result.rows.find((candidate) => effectivePlan(candidate, now) === "pro");
  return row && {
    organization: { id: row.organization_id, name: row.organization_name, memberCount: Number(row.member_count) },
    subscription: row,
  };
}

/** Only an organization owner may start or manage its Team billing. */
export async function getTeamBillingOrganization(
  organizationId: number,
  ownerUserId: number,
): Promise<TeamBillingOrganization | undefined> {
  const result = await query<{ id: number; name: string; member_count: number }>(
    `SELECT o.id, o.name,
            (SELECT count(*)::integer FROM organization_members m WHERE m.organization_id = o.id) AS member_count
     FROM organizations o
     JOIN organization_members owner ON owner.organization_id = o.id
     WHERE o.id = $1 AND owner.user_id = $2 AND owner.role = 'owner'`,
    [organizationId, ownerUserId],
  );
  const row = result.rows[0];
  return row && { id: Number(row.id), name: row.name, memberCount: Number(row.member_count) };
}

export async function hasAdminProGrant(userId: number): Promise<boolean> {
  const result = await query(
    "SELECT 1 FROM admin_pro_grants WHERE user_id = $1 AND revoked_at IS NULL",
    [userId],
  );
  return result.rowCount === 1;
}

export async function isProUser(userId: number, now = new Date()): Promise<boolean> {
  const [subscription, promotion, adminGrant, team] = await Promise.all([
    getSubscription(userId),
    activePromotionalEntitlement(userId, now),
    hasAdminProGrant(userId),
    getTeamEntitlement(userId, now),
  ]);
  return effectivePlan(subscription, now) === "pro" || Boolean(promotion) || adminGrant || Boolean(team);
}

export async function countUserCollections(userId: number): Promise<number> {
  const result = await query<{ count: string }>(
    "SELECT count(*)::text AS count FROM collections WHERE user_id = $1",
    [userId],
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function createFreeCollection(
  userId: number,
  name: string,
): Promise<ResearchCollection | undefined> {
  return withTransaction(async (client) => {
    await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [userId]);
    const count = await client.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM collections WHERE user_id = $1",
      [userId],
    );
    if (Number(count.rows[0]?.count ?? 0) >= 1) return undefined;
    const inserted = await client.query<Omit<ResearchCollection, "items"> & QueryResultRow>(
      `INSERT INTO collections (user_id, name, description) VALUES ($1, $2, '')
       RETURNING id, name, description, created_at, updated_at`,
      [userId, name],
    );
    return { ...inserted.rows[0], items: [] };
  });
}

export async function canAccessApp(
  user: Pick<AuthUser, "id" | "role">,
  appSlug: string,
  now = new Date(),
): Promise<boolean> {
  if (user.role === "admin") return true;
  if (await isProUser(user.id, now)) return true;
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

export async function upsertPaddleSubscription(input: PaddleSubscriptionInput): Promise<void> {
  await query(
    `INSERT INTO subscriptions (
       user_id, paddle_customer_id, paddle_subscription_id, paddle_price_id,
       billing_interval, status, current_period_start, current_period_end,
       cancel_at_period_end, grace_expires_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
     ON CONFLICT (user_id) DO UPDATE SET
       paddle_customer_id = EXCLUDED.paddle_customer_id,
       paddle_subscription_id = EXCLUDED.paddle_subscription_id,
       paddle_price_id = EXCLUDED.paddle_price_id,
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

export async function upsertPaddleOrganizationSubscription(
  input: PaddleOrganizationSubscriptionInput,
): Promise<void> {
  await query(
    `INSERT INTO organization_subscriptions (
       organization_id, paddle_customer_id, paddle_subscription_id, paddle_price_id,
       seat_count, status, current_period_start, current_period_end,
       cancel_at_period_end, grace_expires_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
     ON CONFLICT (organization_id) DO UPDATE SET
       paddle_customer_id = EXCLUDED.paddle_customer_id,
       paddle_subscription_id = EXCLUDED.paddle_subscription_id,
       paddle_price_id = EXCLUDED.paddle_price_id,
       seat_count = EXCLUDED.seat_count,
       status = EXCLUDED.status,
       current_period_start = EXCLUDED.current_period_start,
       current_period_end = EXCLUDED.current_period_end,
       cancel_at_period_end = EXCLUDED.cancel_at_period_end,
       grace_expires_at = EXCLUDED.grace_expires_at,
       updated_at = now()`,
    [
      input.organizationId,
      input.customerId,
      input.subscriptionId,
      input.priceId,
      Math.max(3, Math.floor(input.seatCount)),
      input.status,
      input.periodStart,
      input.periodEnd,
      input.cancelAtPeriodEnd,
      input.graceExpiresAt,
    ],
  );
}

function usageWindow(
  subscription: Pick<SubscriptionRecord, "current_period_start">,
  now: Date,
): { start: Date; end: Date } | undefined {
  return subscription.current_period_start
    ? exportWindow(new Date(subscription.current_period_start), now)
    : undefined;
}

export async function getAccountEntitlements(userId: number, now = new Date()): Promise<AccountEntitlements> {
  const [subscription, promotion, adminGrant, freeUnlocks, team] = await Promise.all([
    getSubscription(userId),
    activePromotionalEntitlement(userId, now),
    hasAdminProGrant(userId),
    listFreeUnlocks(userId),
    getTeamEntitlement(userId, now),
  ]);
  const paid = effectivePlan(subscription, now) === "pro";
  const plan = paid || team || promotion || adminGrant ? "pro" : "free";
  const entitlementSource = paid
    ? "paid"
    : team
      ? "team"
      : promotion
        ? "promotion"
        : adminGrant
          ? "admin_grant"
          : "free";
  const window = paid && subscription
    ? usageWindow(subscription, now)
    : team
      ? usageWindow(team.subscription, now)
    : promotion
      ? { start: new Date(promotion.startsAt), end: new Date(promotion.expiresAt) }
      : adminGrant
        ? calendarMonthWindow(now)
      : undefined;
  let used = 0;
  if (window && team && !paid) {
    const result = await query<{ operation_count: number }>(
      "SELECT operation_count FROM organization_export_usage WHERE organization_id = $1 AND window_start = $2",
      [team.organization.id, window.start],
    );
    used = result.rows[0]?.operation_count ?? 0;
  } else if (window) {
    const result = await query<{ operation_count: number }>(
      "SELECT operation_count FROM export_usage WHERE user_id = $1 AND window_start = $2",
      [userId, window.start],
    );
    used = result.rows[0]?.operation_count ?? 0;
  }
  return {
    plan,
    entitlementSource,
    promotionExpiresAt: promotion?.expiresAt ?? null,
    subscription: subscription ?? null,
    freeUnlocks,
    freeUnlocksRemaining: Math.max(0, FREE_APP_LIMIT - freeUnlocks.length),
    team: team ? {
      organizationId: team.organization.id,
      organizationName: team.organization.name,
      seats: team.subscription.seat_count,
    } : null,
    exportUsage: {
      used,
      limit: team && !paid ? team.subscription.seat_count * EXPORT_LIMIT : EXPORT_LIMIT,
      resetAt: window?.end.toISOString() ?? null,
    },
  };
}

function calendarMonthWindow(now: Date): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  };
}

export async function reserveExportOperation(
  userId: number,
  now = new Date(),
): Promise<
  | { status: "reserved"; used: number; limit: number; resetAt: string }
  | { status: "not_pro"; used: 0; limit: number; resetAt: null }
  | { status: "limit_reached"; used: number; limit: number; resetAt: string }
> {
  return withTransaction(async (client) => {
    const result = await client.query<SubscriptionRecord & QueryResultRow>(
      `SELECT ${subscriptionColumns} FROM subscriptions WHERE user_id = $1 FOR UPDATE`,
      [userId],
    );
    const subscription = result.rows[0];
    const promotionResult = await client.query<{ starts_at: string; expires_at: string }>(
      `SELECT starts_at::text, expires_at::text FROM promotional_entitlements
       WHERE user_id = $1 AND revoked_at IS NULL AND starts_at <= $2 AND expires_at > $2
       ORDER BY expires_at DESC LIMIT 1 FOR UPDATE`,
      [userId, now],
    );
    const promotion = promotionResult.rows[0];
    const adminGrantResult = await client.query(
      "SELECT 1 FROM admin_pro_grants WHERE user_id = $1 AND revoked_at IS NULL FOR UPDATE",
      [userId],
    );
    const adminGrant = adminGrantResult.rowCount === 1;
    const paid = Boolean(subscription && effectivePlan(subscription, now) === "pro");
    const teamResult = !paid && !promotion && !adminGrant
      ? await client.query<OrganizationSubscriptionRecord & QueryResultRow>(
        `SELECT ${organizationSubscriptionColumns}
         FROM organization_members m
         JOIN organization_subscriptions s ON s.organization_id = m.organization_id
         WHERE m.user_id = $1
         ORDER BY s.updated_at DESC, s.organization_id DESC
         FOR UPDATE`,
        [userId],
      )
      : undefined;
    const team = teamResult?.rows.find((candidate) => effectivePlan(candidate, now) === "pro");
    if (!paid && !promotion && !adminGrant && !team) {
      return { status: "not_pro", used: 0, limit: EXPORT_LIMIT, resetAt: null };
    }
    const window = paid && subscription
      ? usageWindow(subscription, now)
      : team
        ? usageWindow(team, now)
      : promotion
        ? { start: new Date(promotion.starts_at), end: new Date(promotion.expires_at) }
        : adminGrant
          ? calendarMonthWindow(now)
        : undefined;
    if (!window) return { status: "not_pro", used: 0, limit: EXPORT_LIMIT, resetAt: null };
    if (team) {
      const limit = team.seat_count * EXPORT_LIMIT;
      if (!window) return { status: "not_pro", used: 0, limit, resetAt: null };
      const reserved = await client.query<{ operation_count: number }>(
        `INSERT INTO organization_export_usage (organization_id, window_start, operation_count) VALUES ($1, $2, 1)
         ON CONFLICT (organization_id, window_start) DO UPDATE
           SET operation_count = organization_export_usage.operation_count + 1
           WHERE organization_export_usage.operation_count < $3
         RETURNING operation_count`,
        [team.organization_id, window.start, limit],
      );
      if (!reserved.rows[0]) {
        return { status: "limit_reached", used: limit, limit, resetAt: window.end.toISOString() };
      }
      return { status: "reserved", used: reserved.rows[0].operation_count, limit, resetAt: window.end.toISOString() };
    }
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
    "text/markdown": "md",
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

export async function hasProcessedPaddleEvent(eventId: string): Promise<boolean> {
  return (await query("SELECT 1 FROM paddle_events WHERE event_id = $1", [eventId])).rowCount === 1;
}

export async function markPaddleEventProcessed(eventId: string): Promise<void> {
  await query("INSERT INTO paddle_events (event_id) VALUES ($1) ON CONFLICT DO NOTHING", [eventId]);
}

export async function recordAccessEvent(input: {
  userId?: number;
  sessionHash?: string;
  ipPrefix?: string;
  appSlug?: string;
  featureKey?: FeatureKey;
  action: string;
  volume?: number;
  outcome: string;
  metadata?: Record<string, string | number | boolean | null>;
}): Promise<void> {
  if (input.featureKey !== undefined && !isFeatureKey(input.featureKey)) {
    throw new Error(`Unknown feature key: ${String(input.featureKey)}`);
  }
  await query(
    `INSERT INTO access_events
       (user_id, session_hash, ip_prefix, app_slug, feature_key, action, volume, outcome, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      input.userId ?? null,
      input.sessionHash ?? null,
      input.ipPrefix ?? null,
      input.appSlug ?? null,
      input.featureKey ?? null,
      input.action,
      input.volume ?? 1,
      input.outcome,
      input.metadata ?? {},
    ],
  );
}
