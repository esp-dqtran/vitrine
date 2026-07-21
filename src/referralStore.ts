import { createHash, randomBytes } from "node:crypto";
import { query, withTransaction } from "./db.ts";
import { effectivePlan, type SubscriptionRecord } from "./pricing.ts";

const PRO_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export interface ReferralCampaign {
  id: string;
  startsAt: Date;
  endsAt: Date;
  rewardCap: 3;
}

export interface ReferralSummary {
  campaign: { id: string; active: boolean; endsAt: string };
  referralCount: number;
  activatedCount: number;
  earnedCount: number;
  availableMonths: number;
  referrals: Array<{ id: string; state: "joined" | "active" | "rewarded" }>;
}

type AttributionResult =
  | { status: "attributed"; promotionExpiresAt: string }
  | { status: "invalid" | "closed" | "self_referral" | "already_attributed" };

type ActivationResult =
  | { status: "activated"; expiresAt: string; availableMonths: number }
  | { status: "none_available" | "paid_active" | "promotion_active" };

function campaignActive(campaign: ReferralCampaign, now: Date): boolean {
  return now >= campaign.startsAt && now < campaign.endsAt;
}

function validToken(token: string): boolean {
  return token.length >= 32 && token.length <= 128;
}

export async function createReferralCode(
  userId: number,
  tokenFactory: () => string = () => randomBytes(32).toString("base64url"),
): Promise<{ token: string }> {
  const token = tokenFactory();
  if (!validToken(token)) throw new Error("Referral token must contain 32 to 128 characters");
  const result = await query<{ token: string }>(
    `INSERT INTO referral_codes (user_id, token) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
     RETURNING token`,
    [userId, token],
  );
  return result.rows[0];
}

export async function validateReferralToken(
  token: string,
  campaign: ReferralCampaign,
  visitorKey?: string,
  now = new Date(),
): Promise<boolean> {
  if (!validToken(token) || !campaignActive(campaign, now)) return false;
  return withTransaction(async (client) => {
    const code = await client.query<{ id: string }>(
      "SELECT id::text FROM referral_codes WHERE token = $1 AND revoked_at IS NULL",
      [token],
    );
    if (!code.rows[0]) return false;
    if (visitorKey && visitorKey.length <= 128) {
      const visitorHash = createHash("sha256").update(visitorKey).digest();
      await client.query(
        `INSERT INTO referral_visits (code_id, campaign_id, visitor_key_hash, first_visited_at)
         VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
        [code.rows[0].id, campaign.id, visitorHash, now],
      );
    }
    return true;
  });
}

export async function attributeReferralSignup(input: {
  token: string;
  invitedUserId: number;
  campaign: ReferralCampaign;
  now?: Date;
}): Promise<AttributionResult> {
  const now = input.now ?? new Date();
  if (!campaignActive(input.campaign, now)) return { status: "closed" };
  if (!validToken(input.token)) return { status: "invalid" };
  return withTransaction(async (client) => {
    await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [input.invitedUserId]);
    const existing = await client.query(
      "SELECT 1 FROM referrals WHERE invited_user_id = $1",
      [input.invitedUserId],
    );
    if (existing.rowCount) return { status: "already_attributed" } as const;
    const code = await client.query<{ id: string; user_id: number }>(
      `SELECT id::text, user_id FROM referral_codes
       WHERE token = $1 AND revoked_at IS NULL`,
      [input.token],
    );
    if (!code.rows[0]) return { status: "invalid" } as const;
    if (code.rows[0].user_id === input.invitedUserId) return { status: "self_referral" } as const;
    const expiresAt = new Date(now.getTime() + PRO_MONTH_MS);
    const entitlement = await client.query<{ id: string }>(
      `INSERT INTO promotional_entitlements (user_id, source, starts_at, expires_at)
       VALUES ($1, 'referral_signup', $2, $3) RETURNING id::text`,
      [input.invitedUserId, now, expiresAt],
    );
    await client.query(
      `INSERT INTO referrals (
         campaign_id, code_id, inviter_user_id, invited_user_id,
         signup_entitlement_id, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        input.campaign.id,
        code.rows[0].id,
        code.rows[0].user_id,
        input.invitedUserId,
        entitlement.rows[0].id,
        now,
      ],
    );
    return { status: "attributed", promotionExpiresAt: expiresAt.toISOString() } as const;
  });
}

export async function recordReferralAppOpen(
  userId: number,
  appSlug: string,
  now: Date,
  campaign: ReferralCampaign,
): Promise<{ rewardIssued: boolean }> {
  if (!campaignActive(campaign, now)) return { rewardIssued: false };
  return withTransaction(async (client) => {
    const referral = await client.query<{ id: string; inviter_user_id: number }>(
      `SELECT id::text, inviter_user_id FROM referrals
       WHERE invited_user_id = $1 AND campaign_id = $2
       FOR UPDATE`,
      [userId, campaign.id],
    );
    if (!referral.rows[0]) return { rewardIssued: false };
    const app = await client.query<{ id: number }>("SELECT id FROM apps WHERE name = $1", [appSlug]);
    if (!app.rows[0]) return { rewardIssued: false };
    await client.query(
      `INSERT INTO referral_activity (referral_id, app_id, first_opened_at, last_opened_at)
       VALUES ($1, $2, $3, $3)
       ON CONFLICT (referral_id, app_id) DO UPDATE SET
         first_opened_at = LEAST(referral_activity.first_opened_at, EXCLUDED.first_opened_at),
         last_opened_at = GREATEST(referral_activity.last_opened_at, EXCLUDED.last_opened_at)`,
      [referral.rows[0].id, app.rows[0].id, now],
    );
    const existingReward = await client.query(
      "SELECT 1 FROM referral_rewards WHERE referral_id = $1",
      [referral.rows[0].id],
    );
    if (existingReward.rowCount) return { rewardIssued: false };
    const rewardCount = await client.query<{ count: number }>(
      "SELECT count(*)::integer AS count FROM referral_rewards WHERE inviter_user_id = $1",
      [referral.rows[0].inviter_user_id],
    );
    if (rewardCount.rows[0].count >= campaign.rewardCap) return { rewardIssued: false };
    const activity = await client.query<{
      app_count: number;
      day_count: number;
      first_opened_at: Date;
      last_opened_at: Date;
    }>(
      `SELECT count(*)::integer AS app_count,
         count(DISTINCT (first_opened_at AT TIME ZONE 'UTC')::date)::integer AS day_count,
         min(first_opened_at) AS first_opened_at,
         max(last_opened_at) AS last_opened_at
       FROM referral_activity WHERE referral_id = $1`,
      [referral.rows[0].id],
    );
    const evidence = activity.rows[0];
    if (
      evidence.app_count < 3
      || evidence.day_count < 2
      || evidence.last_opened_at.getTime() - evidence.first_opened_at.getTime() < 24 * 60 * 60 * 1000
    ) return { rewardIssued: false };
    const inserted = await client.query(
      `INSERT INTO referral_rewards (referral_id, inviter_user_id, earned_at)
       VALUES ($1, $2, $3) ON CONFLICT (referral_id) DO NOTHING RETURNING id`,
      [referral.rows[0].id, referral.rows[0].inviter_user_id, now],
    );
    return { rewardIssued: inserted.rowCount === 1 };
  });
}

export async function referralSummary(
  userId: number,
  campaign: ReferralCampaign,
  now = new Date(),
): Promise<ReferralSummary> {
  const result = await query<{
    id: string;
    has_activity: boolean;
    reward_state: "available" | "activated" | "revoked" | null;
  }>(
    `SELECT r.id::text,
       EXISTS (SELECT 1 FROM referral_activity a WHERE a.referral_id = r.id) AS has_activity,
       rw.state AS reward_state
     FROM referrals r
     LEFT JOIN referral_rewards rw ON rw.referral_id = r.id
     WHERE r.inviter_user_id = $1 AND r.campaign_id = $2
     ORDER BY r.created_at, r.id`,
    [userId, campaign.id],
  );
  const earned = result.rows.filter(({ reward_state }) => reward_state !== null && reward_state !== "revoked");
  return {
    campaign: { id: campaign.id, active: campaignActive(campaign, now), endsAt: campaign.endsAt.toISOString() },
    referralCount: result.rows.length,
    activatedCount: earned.length,
    earnedCount: earned.length,
    availableMonths: earned.filter(({ reward_state }) => reward_state === "available").length,
    referrals: result.rows.map(({ id, has_activity, reward_state }) => ({
      id,
      state: reward_state && reward_state !== "revoked" ? "rewarded" : has_activity ? "active" : "joined",
    })),
  };
}

export async function activateProMonth(userId: number, now = new Date()): Promise<ActivationResult> {
  return withTransaction(async (client) => {
    await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [userId]);
    const subscription = await client.query<SubscriptionRecord>(
      `SELECT user_id, stripe_customer_id, stripe_subscription_id, stripe_price_id,
         billing_interval, status, current_period_start::text, current_period_end::text,
         cancel_at_period_end, grace_expires_at::text
       FROM subscriptions WHERE user_id = $1`,
      [userId],
    );
    if (effectivePlan(subscription.rows[0], now) === "pro") return { status: "paid_active" };
    const activePromotion = await client.query(
      `SELECT 1 FROM promotional_entitlements
       WHERE user_id = $1 AND revoked_at IS NULL AND starts_at <= $2 AND expires_at > $2
       LIMIT 1 FOR UPDATE`,
      [userId, now],
    );
    if (activePromotion.rowCount) return { status: "promotion_active" };
    const reward = await client.query<{ id: string }>(
      `SELECT id::text FROM referral_rewards
       WHERE inviter_user_id = $1 AND state = 'available'
       ORDER BY earned_at, id LIMIT 1 FOR UPDATE`,
      [userId],
    );
    if (!reward.rows[0]) return { status: "none_available" };
    const expiresAt = new Date(now.getTime() + PRO_MONTH_MS);
    const entitlement = await client.query<{ id: string }>(
      `INSERT INTO promotional_entitlements (user_id, source, starts_at, expires_at)
       VALUES ($1, 'referral_reward', $2, $3) RETURNING id::text`,
      [userId, now, expiresAt],
    );
    await client.query(
      `UPDATE referral_rewards SET state = 'activated', entitlement_id = $2, activated_at = $3
       WHERE id = $1`,
      [reward.rows[0].id, entitlement.rows[0].id, now],
    );
    const remaining = await client.query<{ count: number }>(
      `SELECT count(*)::integer AS count FROM referral_rewards
       WHERE inviter_user_id = $1 AND state = 'available'`,
      [userId],
    );
    return {
      status: "activated",
      expiresAt: expiresAt.toISOString(),
      availableMonths: remaining.rows[0].count,
    };
  });
}

export async function activePromotionalEntitlement(
  userId: number,
  now = new Date(),
): Promise<{ startsAt: string; expiresAt: string } | undefined> {
  const result = await query<{ starts_at: string; expires_at: string }>(
    `SELECT starts_at::text, expires_at::text FROM promotional_entitlements
     WHERE user_id = $1 AND revoked_at IS NULL AND starts_at <= $2 AND expires_at > $2
     ORDER BY expires_at DESC LIMIT 1`,
    [userId, now],
  );
  const row = result.rows[0];
  return row ? {
    startsAt: new Date(row.starts_at).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(),
  } : undefined;
}
