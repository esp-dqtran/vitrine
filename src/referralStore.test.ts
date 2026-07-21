import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import pg from "pg";
import { hashPassword } from "./authCrypto.ts";
import { applyMigrations } from "./migrations.ts";
import type { ReferralCampaign } from "./referralStore.ts";

const TEST_URL = "postgres://postgres:postgres@localhost:5432/astryx_test";
process.env.DATABASE_URL = TEST_URL;

async function postgresAvailable(): Promise<boolean> {
  const client = new pg.Client({ connectionString: TEST_URL });
  try {
    await client.connect();
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}

const skip = (await postgresAvailable()) ? undefined : "Postgres test database unavailable";
const db = await import("./db.ts");
const store = await import("./referralStore.ts");

const campaign: ReferralCampaign = {
  id: "launch-2026",
  startsAt: new Date("2026-07-21T00:00:00Z"),
  endsAt: new Date("2026-10-19T00:00:00Z"),
  rewardCap: 3,
};

after(async () => db.closePool());
before(async () => { if (!skip) await applyMigrations(db.pool); });

beforeEach(async () => {
  if (skip) return;
  await db.query("DELETE FROM referral_rewards");
  await db.query("DELETE FROM referrals");
  await db.query("DELETE FROM referral_codes");
  await db.query("DELETE FROM promotional_entitlements");
  await db.query("DELETE FROM users WHERE email LIKE 'referral-%@example.com'");
  await db.query("DELETE FROM apps WHERE name LIKE 'referral-%'");
});

async function user(label: string): Promise<number> {
  const result = await db.query<{ id: number }>(
    "INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'user') RETURNING id",
    [`referral-${label}@example.com`, await hashPassword("a sufficiently long referral password")],
  );
  return result.rows[0].id;
}

async function apps(): Promise<string[]> {
  const names = ["referral-one", "referral-two", "referral-three", "referral-four"];
  for (const name of names) await db.query("INSERT INTO apps (name) VALUES ($1)", [name]);
  return names;
}

async function attributed(inviterId: number, invitedUserId: number, suffix: string) {
  const token = `${suffix}${"x".repeat(48 - suffix.length)}`;
  const code = await store.createReferralCode(inviterId, () => token);
  const result = await store.attributeReferralSignup({
    token: code.token,
    invitedUserId,
    campaign,
    now: new Date("2026-07-21T10:00:00Z"),
  });
  assert.equal(result.status, "attributed");
  return result;
}

async function qualify(invitedUserId: number, names: string[], day = 21): Promise<void> {
  await store.recordReferralAppOpen(
    invitedUserId,
    names[0],
    new Date(`2026-07-${day}T10:00:00Z`),
    campaign,
  );
  await store.recordReferralAppOpen(
    invitedUserId,
    names[1],
    new Date(`2026-07-${day + 1}T09:59:59Z`),
    campaign,
  );
  await store.recordReferralAppOpen(
    invitedUserId,
    names[2],
    new Date(`2026-07-${day + 1}T10:00:00Z`),
    campaign,
  );
}

test("attributes a new account once and grants immediate 30-day Pro", { skip }, async () => {
  const inviterId = await user("inviter-once");
  const invitedUserId = await user("invited-once");
  const token = "a".repeat(48);
  await store.createReferralCode(inviterId, () => token);

  assert.equal(await store.validateReferralToken(token, campaign, "visitor-one", new Date("2026-07-21T09:00:00Z")), true);
  assert.equal(await store.validateReferralToken(token, campaign, "visitor-one", new Date("2026-07-21T09:01:00Z")), true);
  const result = await store.attributeReferralSignup({
    token,
    invitedUserId,
    campaign,
    now: new Date("2026-07-21T10:00:00Z"),
  });
  assert.deepEqual(result, {
    status: "attributed",
    promotionExpiresAt: "2026-08-20T10:00:00.000Z",
  });
  assert.equal((await store.attributeReferralSignup({
    token,
    invitedUserId,
    campaign,
    now: new Date("2026-07-21T10:01:00Z"),
  })).status, "already_attributed");
  assert.deepEqual(await store.activePromotionalEntitlement(
    invitedUserId,
    new Date("2026-07-22T00:00:00Z"),
  ), {
    startsAt: "2026-07-21T10:00:00.000Z",
    expiresAt: "2026-08-20T10:00:00.000Z",
  });
  assert.equal((await db.query("SELECT count(*)::integer AS count FROM referral_visits")).rows[0].count, 1);
});

test("rejects invalid, revoked, self, and closed referral attribution", { skip }, async () => {
  const inviterId = await user("inviter-invalid");
  const invitedUserId = await user("invited-invalid");
  const token = "b".repeat(48);
  await store.createReferralCode(inviterId, () => token);

  assert.equal((await store.attributeReferralSignup({ token: "z".repeat(48), invitedUserId, campaign })).status, "invalid");
  assert.equal((await store.attributeReferralSignup({ token, invitedUserId: inviterId, campaign })).status, "self_referral");
  assert.equal((await store.attributeReferralSignup({
    token,
    invitedUserId,
    campaign,
    now: new Date("2026-10-19T00:00:00Z"),
  })).status, "closed");
  await db.query("UPDATE referral_codes SET revoked_at = now() WHERE token = $1", [token]);
  assert.equal((await store.attributeReferralSignup({ token, invitedUserId, campaign })).status, "invalid");
});

test("earns once after three apps, two UTC dates, and 24 elapsed hours", { skip }, async () => {
  const inviterId = await user("inviter-activation");
  const invitedUserId = await user("invited-activation");
  const names = await apps();
  await attributed(inviterId, invitedUserId, "activation");

  await store.recordReferralAppOpen(invitedUserId, names[0], new Date("2026-07-21T10:00:00Z"), campaign);
  await store.recordReferralAppOpen(invitedUserId, names[1], new Date("2026-07-22T09:59:59Z"), campaign);
  await store.recordReferralAppOpen(invitedUserId, names[2], new Date("2026-07-22T09:59:59Z"), campaign);
  assert.equal((await store.referralSummary(inviterId, campaign)).earnedCount, 0);

  const issued = await Promise.all([
    store.recordReferralAppOpen(invitedUserId, names[2], new Date("2026-07-22T10:00:00Z"), campaign),
    store.recordReferralAppOpen(invitedUserId, names[2], new Date("2026-07-22T10:00:00Z"), campaign),
  ]);
  assert.equal(issued.filter(({ rewardIssued }) => rewardIssued).length, 1);
  const summary = await store.referralSummary(inviterId, campaign);
  assert.deepEqual(summary.campaign, {
    id: campaign.id,
    active: true,
    endsAt: campaign.endsAt.toISOString(),
  });
  assert.equal(summary.referralCount, 1);
  assert.equal(summary.activatedCount, 1);
  assert.equal(summary.earnedCount, 1);
  assert.equal(summary.availableMonths, 1);
  assert.equal(summary.referrals.length, 1);
  assert.equal(summary.referrals[0].state, "rewarded");
});

test("caps an inviter at three banked rewards", { skip }, async () => {
  const inviterId = await user("inviter-cap");
  const names = await apps();
  for (let index = 0; index < 4; index += 1) {
    const invitedUserId = await user(`invited-cap-${index}`);
    await attributed(inviterId, invitedUserId, `cap-${index}`);
    await qualify(invitedUserId, names, 21 + index * 2);
  }
  const summary = await store.referralSummary(inviterId, campaign);
  assert.equal(summary.earnedCount, 3);
  assert.equal(summary.availableMonths, 3);
});

test("activates one banked month atomically and blocks paid overlap", { skip }, async () => {
  const inviterId = await user("inviter-activate");
  const invitedUserId = await user("invited-activate");
  const names = await apps();
  await attributed(inviterId, invitedUserId, "activate");
  await qualify(invitedUserId, names);
  const now = new Date("2026-07-25T10:00:00Z");

  const results = await Promise.all([
    store.activateProMonth(inviterId, now),
    store.activateProMonth(inviterId, now),
  ]);
  assert.equal(results.filter(({ status }) => status === "activated").length, 1);
  assert.equal(results.filter(({ status }) => status === "none_available" || status === "promotion_active").length, 1);
  assert.equal((await store.referralSummary(inviterId, campaign, now)).availableMonths, 0);

  const paidInviterId = await user("paid-inviter");
  const paidInvitedId = await user("paid-invited");
  await attributed(paidInviterId, paidInvitedId, "paid");
  await qualify(paidInvitedId, names);
  await db.query(
    `INSERT INTO subscriptions (
       user_id, stripe_customer_id, stripe_subscription_id, stripe_price_id,
       billing_interval, status, current_period_start, current_period_end
     ) VALUES ($1, 'cus_referral', 'sub_referral', 'price_referral', 'month', 'active', $2, $3)`,
    [paidInviterId, new Date("2026-07-01T00:00:00Z"), new Date("2026-08-01T00:00:00Z")],
  );
  assert.deepEqual(await store.activateProMonth(paidInviterId, now), { status: "paid_active" });
  assert.equal((await store.referralSummary(paidInviterId, campaign, now)).availableMonths, 1);
});

test("reports the launch funnel, conversion, and eligible retention", { skip }, async () => {
  const inviterId = await user("metrics-inviter");
  const invitedUserId = await user("metrics-invited");
  const organicUserId = await user("metrics-organic");
  const names = await apps();
  const code = await store.createReferralCode(inviterId, () => "m".repeat(48));
  await store.validateReferralToken(code.token, campaign, "metrics-visitor-1", new Date("2026-07-21T08:00:00Z"));
  await store.validateReferralToken(code.token, campaign, "metrics-visitor-2", new Date("2026-07-21T08:01:00Z"));
  await store.attributeReferralSignup({
    token: code.token,
    invitedUserId,
    campaign,
    now: new Date("2026-07-21T10:00:00Z"),
  });
  await qualify(invitedUserId, names);
  for (const [userId, suffix] of [[invitedUserId, "referred"], [organicUserId, "organic"]] as const) {
    await db.query(
      `INSERT INTO subscriptions (
         user_id, stripe_customer_id, stripe_subscription_id, stripe_price_id,
         billing_interval, status, current_period_start, current_period_end
       ) VALUES ($1, $2, $3, 'price_metrics', 'month', 'active', $4, $5)`,
      [userId, `cus_metrics_${suffix}`, `sub_metrics_${suffix}`, new Date("2026-07-01T00:00:00Z"), new Date("2026-10-01T00:00:00Z")],
    );
  }
  for (const createdAt of [
    "2026-07-28T10:00:00Z",
    "2026-08-20T10:00:00Z",
    "2026-09-19T10:00:00Z",
  ]) await db.query(
    "INSERT INTO access_events (user_id, action, outcome, created_at) VALUES ($1, 'app-detail', 'success', $2)",
    [invitedUserId, new Date(createdAt)],
  );

  assert.deepEqual(await store.referralCampaignMetrics(campaign.id, new Date("2026-10-01T00:00:00Z")), {
    linksCreated: 1,
    uniqueReferralVisits: 2,
    referredSignups: 1,
    referredActivations: 1,
    rewardsIssued: 1,
    signupToActivationRate: 100,
    referredPaidConversions: 1,
    organicPaidConversions: 1,
    referredRetention: { day7: 100, day30: 100, day60: 100 },
    revocations: 0,
  });
});

test("revokes referrals, rewards, and promotional access idempotently", { skip }, async () => {
  const inviterId = await user("revoke-inviter");
  const invitedUserId = await user("revoke-invited");
  const names = await apps();
  await attributed(inviterId, invitedUserId, "revoke");
  await qualify(invitedUserId, names);
  await store.activateProMonth(inviterId, new Date("2026-07-25T00:00:00Z"));
  const rows = await db.query<{ referral_id: number; reward_id: number; entitlement_id: number }>(
    `SELECT r.id AS referral_id, rw.id AS reward_id, rw.entitlement_id
     FROM referrals r JOIN referral_rewards rw ON rw.referral_id = r.id
     WHERE r.invited_user_id = $1`,
    [invitedUserId],
  );
  const ids = rows.rows[0];
  assert.equal(await store.revokeReferralReward(ids.reward_id), true);
  assert.equal(await store.revokeReferralReward(ids.reward_id), true);
  assert.equal(await store.activePromotionalEntitlement(inviterId, new Date("2026-07-26T00:00:00Z")), undefined);
  assert.equal(await store.revokeReferral(ids.referral_id), true);
  assert.equal(await store.activePromotionalEntitlement(invitedUserId, new Date("2026-07-26T00:00:00Z")), undefined);
  assert.equal(await store.revokePromotionalEntitlement(ids.entitlement_id), true);
  assert.equal(await store.revokeReferral(999999), false);
});
