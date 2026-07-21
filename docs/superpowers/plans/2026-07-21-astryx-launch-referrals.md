# Astryx Launch Referrals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the 90-day launch referral loop in which a referred new account gets 30 days of Pro immediately and the inviter earns a banked Pro Month after the new account opens three distinct apps across two UTC dates and 24 elapsed hours.

**Architecture:** Keep referrals and promotional access outside Stripe. A dedicated PostgreSQL-backed referral store owns attribution, activation evidence, idempotent reward issuance, and pass activation; the existing pricing store combines paid and promotional entitlements into one effective Free/Pro result. The API exposes coarse referral state, while signup and app-detail routes invoke referral operations without leaking invited-user activity.

**Tech Stack:** TypeScript, Node.js, Express, PostgreSQL migrations, React 19, Node test runner, `tsx`, Stripe billing already present in the repository.

---

## File map

- Create `migrations/0013_launch_referrals.sql`: referral codes, privacy-safe unique visits, attribution, app activity, banked rewards, and promotional entitlements.
- Create `src/referralStore.ts`: all transactional referral and promotion persistence.
- Create `src/referralStore.test.ts`: PostgreSQL integration coverage for qualification, caps, concurrency, revocation, and activation.
- Modify `src/pricingStore.ts`: resolve paid-first, promotion-second effective entitlements.
- Modify `src/pricingStore.test.ts`: promotional access and paid precedence coverage.
- Modify `services/api/src/config.ts`: parse the launch campaign ID and UTC boundaries.
- Modify `services/api/src/config.test.ts`: campaign configuration validation.
- Modify `services/api/src/index.ts`: provide campaign configuration to the API.
- Modify `services/api/src/app.ts`: referral validation, signup attribution, summary/link/activation endpoints, and app-open recording.
- Modify `services/api/src/app.test.ts`: route-level referral and privacy coverage.
- Create `src/vitrine/referralApi.ts`: typed browser calls for referral validation and account operations.
- Create `src/vitrine/referralApi.test.ts`: request and error behavior.
- Modify `src/vitrine/authApi.ts`: include an optional validated referral token at signup.
- Modify `src/vitrine/authApi.test.ts`: signup request coverage.
- Modify `src/vitrine/AuthProvider.tsx`: forward the optional token through registration.
- Modify `src/vitrine/SignIn.tsx`: retain a valid referral through signup and show the no-card message.
- Modify `src/vitrine/SignIn.test.tsx`: valid, invalid, and ordinary signup rendering.
- Modify `src/vitrine/billingApi.ts`: expose entitlement source and promotion expiry.
- Modify `src/vitrine/billingApi.test.ts`: safe promotional subscription response.
- Modify `src/vitrine/components/SettingsPanel.tsx`: referral sharing, progress, banked pass activation, and promotional billing copy.
- Modify `src/vitrine/components/SettingsPanel.test.tsx`: Free, paid Pro, promotional Pro, and referral card states.
- Modify `src/vitrine/App.tsx`: refresh subscription state after pass activation.
- Modify `src/vitrine/types.ts`: referral campaign metrics returned to administrators.
- Modify `src/vitrine/usersApi.ts`: load referral metrics and submit revocations.
- Modify `src/vitrine/usersApi.test.ts`: administrative referral request coverage.
- Modify `src/vitrine/useUsersInsights.ts`: load referral metrics with existing growth insights.
- Modify `src/vitrine/components/UserUsageInsights.tsx`: render launch referral funnel and retention.
- Modify `src/vitrine/components/UsersPage.test.tsx`: referral dashboard coverage.

### Task 1: Persist the referral lifecycle

**Files:**
- Create: `migrations/0013_launch_referrals.sql`
- Modify: `src/migrations.test.ts`

- [ ] **Step 1: Write the failing migration contract test**

Add a test that reads `0013_launch_referrals.sql`, asserts the six tables below exist, and checks the constraints that make attribution and reward issuance idempotent:

```typescript
test("launch referral migration defines bounded banked Pro months", async () => {
  const sql = await readFile(new URL("../migrations/0013_launch_referrals.sql", import.meta.url), "utf8");
  for (const table of [
    "promotional_entitlements",
    "referral_codes",
    "referral_visits",
    "referrals",
    "referral_activity",
    "referral_rewards",
  ]) assert.match(sql, new RegExp(`CREATE TABLE ${table}\\b`));
  assert.match(sql, /UNIQUE \(invited_user_id\)/);
  assert.match(sql, /UNIQUE \(referral_id\)/);
  assert.match(sql, /CHECK \(inviter_user_id <> invited_user_id\)/);
  assert.match(sql, /CHECK \(state IN \('available', 'activated', 'revoked'\)\)/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --experimental-strip-types --test src/migrations.test.ts`

Expected: FAIL because `migrations/0013_launch_referrals.sql` does not exist.

- [ ] **Step 3: Create the migration**

Use this schema, keeping purchased subscriptions and promotional access separate:

```sql
CREATE TABLE promotional_entitlements (
  id bigserial PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('referral_signup', 'referral_reward')),
  starts_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > starts_at)
);

CREATE INDEX promotional_entitlements_active_idx
  ON promotional_entitlements (user_id, expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE referral_codes (
  id bigserial PRIMARY KEY,
  user_id bigint NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE CHECK (length(token) BETWEEN 32 AND 128),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE TABLE referral_visits (
  code_id bigint NOT NULL REFERENCES referral_codes(id) ON DELETE CASCADE,
  campaign_id text NOT NULL,
  visitor_key_hash bytea NOT NULL,
  first_visited_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (code_id, campaign_id, visitor_key_hash)
);

CREATE TABLE referrals (
  id bigserial PRIMARY KEY,
  campaign_id text NOT NULL,
  code_id bigint NOT NULL REFERENCES referral_codes(id),
  inviter_user_id bigint NOT NULL REFERENCES users(id),
  invited_user_id bigint NOT NULL REFERENCES users(id),
  signup_entitlement_id bigint NOT NULL UNIQUE REFERENCES promotional_entitlements(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invited_user_id),
  CHECK (inviter_user_id <> invited_user_id)
);

CREATE INDEX referrals_inviter_campaign_idx
  ON referrals (inviter_user_id, campaign_id, created_at);

CREATE TABLE referral_activity (
  referral_id bigint NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  app_id bigint NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  first_opened_at timestamptz NOT NULL,
  last_opened_at timestamptz NOT NULL,
  PRIMARY KEY (referral_id, app_id),
  CHECK (last_opened_at >= first_opened_at)
);

CREATE TABLE referral_rewards (
  id bigserial PRIMARY KEY,
  referral_id bigint NOT NULL UNIQUE REFERENCES referrals(id),
  inviter_user_id bigint NOT NULL REFERENCES users(id),
  state text NOT NULL DEFAULT 'available'
    CHECK (state IN ('available', 'activated', 'revoked')),
  entitlement_id bigint UNIQUE REFERENCES promotional_entitlements(id),
  earned_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  revoked_at timestamptz,
  CHECK (
    (state = 'available' AND entitlement_id IS NULL AND activated_at IS NULL AND revoked_at IS NULL)
    OR (state = 'activated' AND entitlement_id IS NOT NULL AND activated_at IS NOT NULL AND revoked_at IS NULL)
    OR (state = 'revoked' AND revoked_at IS NOT NULL)
  )
);

CREATE INDEX referral_rewards_owner_state_idx
  ON referral_rewards (inviter_user_id, state, earned_at);
```

- [ ] **Step 4: Verify migration integrity**

Run: `npm run db:check && node --experimental-strip-types --test src/migrations.test.ts`

Expected: PASS, with migration 13 discovered as the contiguous head.

- [ ] **Step 5: Commit**

```bash
git add migrations/0013_launch_referrals.sql src/migrations.test.ts
git commit -m "feat: add launch referral schema"
```

### Task 2: Implement transactional referral qualification and banked passes

**Files:**
- Create: `src/referralStore.ts`
- Create: `src/referralStore.test.ts`

- [ ] **Step 1: Write failing PostgreSQL integration tests**

Follow the disposable Postgres setup in `src/pricingStore.test.ts`. Cover these exact cases with fixed UTC timestamps:

```typescript
test("attributes a new account once and grants immediate 30-day Pro", { skip }, async () => {
  const code = await createReferralCode(inviterId, () => "a".repeat(48));
  const result = await attributeReferralSignup({
    token: code.token,
    invitedUserId,
    campaign,
    now: new Date("2026-07-21T10:00:00Z"),
  });
  assert.equal(result.status, "attributed");
  assert.equal(result.promotionExpiresAt, "2026-08-20T10:00:00.000Z");
  assert.equal((await attributeReferralSignup({ token: code.token, invitedUserId, campaign, now })).status, "already_attributed");
});

test("earns once after three apps, two UTC dates, and 24 elapsed hours", { skip }, async () => {
  await recordReferralAppOpen(invitedUserId, apps[0], new Date("2026-07-21T10:00:00Z"), campaign.id);
  await recordReferralAppOpen(invitedUserId, apps[1], new Date("2026-07-22T09:59:59Z"), campaign.id);
  assert.equal((await referralSummary(inviterId, campaign)).earnedCount, 0);
  await Promise.all([
    recordReferralAppOpen(invitedUserId, apps[2], new Date("2026-07-22T10:00:00Z"), campaign.id),
    recordReferralAppOpen(invitedUserId, apps[2], new Date("2026-07-22T10:00:00Z"), campaign.id),
  ]);
  assert.equal((await referralSummary(inviterId, campaign)).availableMonths, 1);
});

test("caps an inviter at three rewards", { skip }, async () => {
  for (const invitedId of invitedIds) await qualifyReferral(inviterId, invitedId);
  const summary = await referralSummary(inviterId, campaign);
  assert.equal(summary.earnedCount, 3);
  assert.equal(summary.availableMonths, 3);
});

test("activates one banked month atomically and blocks paid overlap", { skip }, async () => {
  assert.deepEqual(await activateProMonth(paidInviterId, now), { status: "paid_active" });
  const results = await Promise.all([
    activateProMonth(freeInviterId, now),
    activateProMonth(freeInviterId, now),
  ]);
  assert.equal(results.filter(({ status }) => status === "activated").length, 1);
  assert.equal((await referralSummary(freeInviterId, campaign)).availableMonths, 0);
});
```

Also assert invalid, revoked, self-referral, pre-start, and closed-campaign tokens return a non-attributed status without creating an entitlement.

- [ ] **Step 2: Run the focused store tests and verify they fail**

Run: `node --experimental-strip-types --test --test-concurrency=1 src/referralStore.test.ts`

Expected: FAIL because `src/referralStore.ts` does not exist.

- [ ] **Step 3: Define the public store contract**

Create these exported types and functions in `src/referralStore.ts`:

```typescript
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

export function createReferralCode(
  userId: number,
  tokenFactory?: () => string,
): Promise<{ token: string }>;

export function validateReferralToken(
  token: string,
  campaign: ReferralCampaign,
  visitorKey?: string,
  now?: Date,
): Promise<boolean>;

export function attributeReferralSignup(input: {
  token: string;
  invitedUserId: number;
  campaign: ReferralCampaign;
  now?: Date;
}): Promise<
  | { status: "attributed"; promotionExpiresAt: string }
  | { status: "invalid" | "closed" | "self_referral" | "already_attributed" }
>;

export function recordReferralAppOpen(
  userId: number,
  appSlug: string,
  now: Date,
  campaign: ReferralCampaign,
): Promise<{ rewardIssued: boolean }>;

export function referralSummary(
  userId: number,
  campaign: ReferralCampaign,
  now?: Date,
): Promise<ReferralSummary>;

export function activateProMonth(
  userId: number,
  now?: Date,
): Promise<
  | { status: "activated"; expiresAt: string; availableMonths: number }
  | { status: "none_available" | "paid_active" | "promotion_active" }
>;

export function activePromotionalEntitlement(
  userId: number,
  now?: Date,
): Promise<{ startsAt: string; expiresAt: string } | undefined>;
```

Generate default tokens with `randomBytes(32).toString("base64url")`. Hash the optional client-generated visitor key with SHA-256 and insert it into `referral_visits` with `ON CONFLICT DO NOTHING`; never store IP addresses or the raw visitor key in this table. Use `withTransaction`, lock the referral or inviter user row with `FOR UPDATE`, use `INSERT ... ON CONFLICT`, and count rewards inside the same transaction. Qualification requires the open to occur no later than `campaign.endsAt`, `count(*) >= 3`, `count(DISTINCT (first_opened_at AT TIME ZONE 'UTC')::date) >= 2`, and `max(last_opened_at) - min(first_opened_at) >= interval '24 hours'`.

Pass activation must lock the oldest `available` reward, reject active paid or promotional access, insert exactly one 30-day `referral_reward` entitlement, and update that reward to `activated` before commit.

- [ ] **Step 4: Run store tests**

Run: `node --experimental-strip-types --test --test-concurrency=1 src/referralStore.test.ts`

Expected: PASS, including concurrent qualification and activation.

- [ ] **Step 5: Commit**

```bash
git add src/referralStore.ts src/referralStore.test.ts
git commit -m "feat: add referral reward store"
```

### Task 3: Resolve promotional Pro through existing feature gates

**Files:**
- Modify: `src/pricingStore.ts:34-55,86-98,175-230`
- Modify: `src/pricingStore.test.ts`

- [ ] **Step 1: Add failing entitlement tests**

Extend the fixture to insert active, expired, and revoked promotional entitlements. Assert:

```typescript
const promotional = await getAccountEntitlements(userId, new Date("2026-07-25T00:00:00Z"));
assert.equal(promotional.plan, "pro");
assert.equal(promotional.entitlementSource, "promotion");
assert.equal(promotional.promotionExpiresAt, "2026-08-20T10:00:00.000Z");
assert.equal(await canAccessApp({ id: userId, role: "user" }, apps[3]), true);

const paid = await getAccountEntitlements(paidUserId, new Date("2026-07-25T00:00:00Z"));
assert.equal(paid.entitlementSource, "paid");
```

Verify expired/revoked promotions return Free and promotional users receive the existing 20-export allowance bounded by the promotion start/end window.

- [ ] **Step 2: Run the pricing-store tests and verify they fail**

Run: `node --experimental-strip-types --test --test-concurrency=1 src/pricingStore.test.ts`

Expected: FAIL because promotional entitlements are not considered.

- [ ] **Step 3: Extend the effective account view**

Use this shape:

```typescript
export interface AccountEntitlements {
  plan: "free" | "pro";
  entitlementSource: "paid" | "promotion" | "free";
  promotionExpiresAt: string | null;
  subscription: SubscriptionRecord | null;
  freeUnlocks: string[];
  freeUnlocksRemaining: number;
  exportUsage: { used: number; limit: 20; resetAt: string | null };
}
```

In `getAccountEntitlements`, load the Stripe record and `activePromotionalEntitlement` concurrently. Choose paid when `effectivePlan(subscription, now) === "pro"`, otherwise choose promotion when present. Reuse that result in `isProUser` and `canAccessApp`; update `reserveExportOperation` so the locked entitlement determines its usage window.

- [ ] **Step 4: Run pricing and billing tests**

Run: `node --experimental-strip-types --test --test-concurrency=1 src/pricing.test.ts src/pricingStore.test.ts services/api/src/billing.test.ts`

Expected: PASS. Paid checkout behavior remains based only on Stripe subscription state.

- [ ] **Step 5: Commit**

```bash
git add src/pricingStore.ts src/pricingStore.test.ts
git commit -m "feat: include promotional pro entitlements"
```

### Task 4: Add campaign configuration and referral API routes

**Files:**
- Modify: `services/api/src/config.ts`
- Modify: `services/api/src/config.test.ts`
- Modify: `services/api/src/index.ts`
- Modify: `services/api/src/app.ts`
- Modify: `services/api/src/app.test.ts`

- [ ] **Step 1: Write failing configuration and route tests**

Add configuration coverage for:

```typescript
assert.deepEqual(referralCampaignFromEnv({
  REFERRAL_CAMPAIGN_ID: "launch-2026",
  REFERRAL_CAMPAIGN_START: "2026-07-21T00:00:00Z",
  REFERRAL_CAMPAIGN_END: "2026-10-19T00:00:00Z",
}), {
  id: "launch-2026",
  startsAt: new Date("2026-07-21T00:00:00Z"),
  endsAt: new Date("2026-10-19T00:00:00Z"),
  rewardCap: 3,
});
```

Reject a missing ID, non-ISO boundaries, and an end not later than the start. In `app.test.ts`, cover:

- `GET /referrals/validate?token=...&visitor=...` is public and returns only `{ valid: boolean }`; the visitor value is a random browser UUID used only for unique-visit counting.
- signup forwards a valid optional token to `attributeReferralSignup`; attribution failure still returns the new session.
- authenticated `POST /referrals/link`, `GET /referrals/summary`, and `POST /referrals/rewards/activate` return safe views.
- invalid activation maps to `409` with `paid_active`, `promotion_active`, or `none_available`.
- an authorized app-detail request records the app open, while a blocked request does not.
- the summary contains no invited email, app names, timestamps, or per-user activity details.

- [ ] **Step 2: Run the focused API tests and verify they fail**

Run: `node --experimental-strip-types --test --test-concurrency=1 services/api/src/config.test.ts services/api/src/app.test.ts`

Expected: FAIL because campaign parsing and referral dependencies/routes do not exist.

- [ ] **Step 3: Parse and wire the campaign**

Add:

```typescript
export function referralCampaignFromEnv(env: Record<string, string | undefined>): ReferralCampaign {
  const id = required(env, "REFERRAL_CAMPAIGN_ID");
  const startsAt = new Date(required(env, "REFERRAL_CAMPAIGN_START"));
  const endsAt = new Date(required(env, "REFERRAL_CAMPAIGN_END"));
  if (Number.isNaN(startsAt.valueOf())) throw new Error("REFERRAL_CAMPAIGN_START must be ISO-8601");
  if (Number.isNaN(endsAt.valueOf())) throw new Error("REFERRAL_CAMPAIGN_END must be ISO-8601");
  if (endsAt <= startsAt) throw new Error("REFERRAL_CAMPAIGN_END must be after start");
  return { id, startsAt, endsAt, rewardCap: 3 };
}
```

Parse it once in `services/api/src/index.ts` and pass it to `createApiApp` as `referralCampaign`.

- [ ] **Step 4: Add API dependencies and routes**

Add the five referral-store functions to `defaults`. Mount public validation before session authentication. On signup, normalize `referralToken` to a bounded string and call attribution only after a new user is created; catch attribution errors so account creation still succeeds.

Mount the authenticated routes with these response shapes:

```typescript
// POST /referrals/link
{ url: `${appUrl}/?ref=${encodeURIComponent(token)}` }

// GET /referrals/summary
ReferralSummary

// POST /referrals/rewards/activate
{ status: "activated", expiresAt, availableMonths }
```

After `authorizeAppDetail` verifies access, await `recordReferralAppOpen(user.id, appSlug, new Date(), campaign)` inside a `try/catch`; log only the user ID and generic failure label so referral analytics failure never blocks research access.

- [ ] **Step 5: Run API tests**

Run: `node --experimental-strip-types --test --test-concurrency=1 services/api/src/config.test.ts services/api/src/app.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add services/api/src/config.ts services/api/src/config.test.ts services/api/src/index.ts services/api/src/app.ts services/api/src/app.test.ts
git commit -m "feat: expose launch referral API"
```

### Task 5: Carry a valid referral through signup

**Files:**
- Create: `src/vitrine/referralApi.ts`
- Create: `src/vitrine/referralApi.test.ts`
- Modify: `src/vitrine/authApi.ts`
- Modify: `src/vitrine/authApi.test.ts`
- Modify: `src/vitrine/AuthProvider.tsx`
- Modify: `src/vitrine/SignIn.tsx`
- Modify: `src/vitrine/SignIn.test.tsx`

- [ ] **Step 1: Write failing browser API and signup tests**

Assert a valid `?ref=` token is checked through `/api/referrals/validate`, retained in `sessionStorage` under `astryx:referral-token`, and included only in signup. Generate and retain a random browser UUID under `astryx:referral-visitor`; send it only to validation for privacy-safe unique-visit counting:

```typescript
assert.deepEqual(JSON.parse(String(signupCall.init?.body)), {
  email: "new@example.com",
  password: "a long enough password",
  referralToken: "valid-token",
});
```

Assert the signup view shows:

```text
Your friend gave you 30 days of Astryx Pro. No card required.
```

Invalid or closed tokens must be removed and render ordinary signup without this claim.

- [ ] **Step 2: Run the focused frontend tests and verify they fail**

Run: `node --experimental-strip-types --test src/vitrine/authApi.test.ts src/vitrine/referralApi.test.ts && tsx --test src/vitrine/SignIn.test.tsx`

Expected: FAIL because the referral browser API and optional registration argument do not exist.

- [ ] **Step 3: Implement the typed referral browser API**

Create:

```typescript
export interface ReferralSummaryView {
  campaign: { id: string; active: boolean; endsAt: string };
  referralCount: number;
  activatedCount: number;
  earnedCount: number;
  availableMonths: number;
  referrals: Array<{ id: string; state: "joined" | "active" | "rewarded" }>;
}

export async function validateReferral(token: string, fetcher: Fetcher = fetch): Promise<boolean>;
export async function createReferralLink(fetcher: Fetcher = fetch): Promise<{ url: string }>;
export async function loadReferralSummary(fetcher: Fetcher = fetch): Promise<ReferralSummaryView>;
export async function activateProMonth(fetcher: Fetcher = fetch): Promise<{
  status: "activated";
  expiresAt: string;
  availableMonths: number;
}>;
```

Use the same `jsonOrError` behavior as `billingApi.ts` and URL-encode tokens.

- [ ] **Step 4: Forward the token through authentication**

Change registration signatures consistently:

```typescript
signup(email: string, password: string, referralToken?: string): Promise<AuthUser>
register(email: string, password: string, referralToken?: string): Promise<AuthUser>
```

In `SignIn`, validate a URL token once, persist only a valid token, automatically select signup mode for a valid referral, pass it to `register`, and remove it after successful signup. Keep the referral banner visible when toggling between sign-in and signup so the invitation survives the whole authentication flow.

- [ ] **Step 5: Run frontend signup tests**

Run: `node --experimental-strip-types --test src/vitrine/authApi.test.ts src/vitrine/referralApi.test.ts && tsx --test src/vitrine/SignIn.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/vitrine/referralApi.ts src/vitrine/referralApi.test.ts src/vitrine/authApi.ts src/vitrine/authApi.test.ts src/vitrine/AuthProvider.tsx src/vitrine/SignIn.tsx src/vitrine/SignIn.test.tsx
git commit -m "feat: carry referrals through signup"
```

### Task 6: Show promotional access and banked Pro Months in Settings

**Files:**
- Modify: `src/vitrine/billingApi.ts`
- Modify: `src/vitrine/billingApi.test.ts`
- Modify: `src/vitrine/components/SettingsPanel.tsx`
- Modify: `src/vitrine/components/SettingsPanel.test.tsx`
- Modify: `src/vitrine/App.tsx`

- [ ] **Step 1: Write failing subscription and Settings tests**

Extend `SubscriptionView` fixtures with:

```typescript
entitlementSource: "paid" | "promotion" | "free";
promotionExpiresAt: string | null;
```

Assert promotional Pro renders `Promotional Pro` and `Access ends Aug 20, 2026`, not `Monthly billing`. Add referral-card render tests for:

- `Copy referral link` and campaign end date.
- coarse `joined`, `active`, and `rewarded` states.
- `1 of 3 rewards earned`.
- `1 Pro Month ready` plus `Activate 1 Pro Month` for a Free account.
- activation disabled with `Available after your paid plan ends` for paid Pro.
- no activation action when `availableMonths` is zero.

- [ ] **Step 2: Run the focused Settings tests and verify they fail**

Run: `node --experimental-strip-types --test src/vitrine/billingApi.test.ts && tsx --test src/vitrine/components/SettingsPanel.test.tsx`

Expected: FAIL because promotional fields and the referral card do not exist.

- [ ] **Step 3: Return promotional fields from the subscription route and client**

In `services/api/src/app.ts`, include only:

```typescript
entitlementSource: view.entitlementSource,
promotionExpiresAt: view.promotionExpiresAt,
```

Mirror them in `SubscriptionView`. Keep all Stripe identifiers private.

- [ ] **Step 4: Build the referral Settings section**

Create an exported `ReferralSettings` component inside `SettingsPanel.tsx` with props for the summary, paid-state boolean, copy action, activate action, loading, and error. `SettingsPanel` loads the summary on open, lazily creates the share URL when Copy is clicked, uses `navigator.clipboard.writeText`, and asks for confirmation before activation with the exact expiry returned by the server.

After successful activation, call a new `onEntitlementsChanged` prop so `App.tsx` increments `entitlementsRevision`; then reload the referral summary to decrement the available count.

- [ ] **Step 5: Run Settings and app-boundary tests**

Run: `node --experimental-strip-types --test src/vitrine/billingApi.test.ts && tsx --test src/vitrine/components/SettingsPanel.test.tsx && node --experimental-strip-types --test src/vitrine/App.boundary.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add services/api/src/app.ts src/vitrine/billingApi.ts src/vitrine/billingApi.test.ts src/vitrine/components/SettingsPanel.tsx src/vitrine/components/SettingsPanel.test.tsx src/vitrine/App.tsx
git commit -m "feat: show banked pro months in settings"
```

### Task 7: Add campaign measurement and revocation controls

**Files:**
- Modify: `src/referralStore.ts`
- Modify: `src/referralStore.test.ts`
- Modify: `services/api/src/app.ts`
- Modify: `services/api/src/app.test.ts`
- Modify: `src/vitrine/types.ts`
- Modify: `src/vitrine/usersApi.ts`
- Modify: `src/vitrine/usersApi.test.ts`
- Modify: `src/vitrine/useUsersInsights.ts`
- Modify: `src/vitrine/components/UserUsageInsights.tsx`
- Modify: `src/vitrine/components/UsersPage.test.tsx`

- [ ] **Step 1: Write failing store, API, and dashboard tests**

Add store fixtures for referred and non-referred cohorts and assert this exact metric shape:

```typescript
export interface ReferralCampaignMetrics {
  linksCreated: number;
  uniqueReferralVisits: number;
  referredSignups: number;
  referredActivations: number;
  rewardsIssued: number;
  signupToActivationRate: number;
  referredPaidConversions: number;
  organicPaidConversions: number;
  referredRetention: { day7: number; day30: number; day60: number };
  revocations: number;
}
```

For retention, count a referred user retained at day N when `access_events.created_at` contains activity on or after `referrals.created_at + interval 'N days'`; divide by referrals old enough to have reached that observation window. Return `0` when the denominator is zero.

Assert `POST /admin/referrals/:id/revoke`, `POST /admin/referral-rewards/:id/revoke`, and `POST /admin/promotional-entitlements/:id/revoke` are admin-only, idempotent, and return `204`. Revoking an activated reward must revoke its linked promotional entitlement in the same transaction. Assert the existing Users growth screen displays the funnel counts and D7/D30/D60 retention.

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `node --experimental-strip-types --test --test-concurrency=1 src/referralStore.test.ts services/api/src/app.test.ts src/vitrine/usersApi.test.ts && tsx --test src/vitrine/components/UsersPage.test.tsx`

Expected: FAIL because metrics and revocation operations do not exist.

- [ ] **Step 3: Add store metrics and revocation functions**

Export these operations from `src/referralStore.ts`:

```typescript
export function referralCampaignMetrics(
  campaignId: string,
  now?: Date,
): Promise<ReferralCampaignMetrics>;

export function revokeReferral(referralId: number, now?: Date): Promise<boolean>;
export function revokeReferralReward(rewardId: number, now?: Date): Promise<boolean>;
export function revokePromotionalEntitlement(entitlementId: number, now?: Date): Promise<boolean>;
```

`revokeReferral` revokes its signup entitlement and every reward belonging to the referral. `revokeReferralReward` changes an available or activated reward to `revoked` and revokes the linked entitlement when present. Every function locks its target row and returns `true` both for a newly revoked row and an already-revoked row; return `false` only when the ID does not exist.

- [ ] **Step 4: Add administrator routes**

Mount the following behind the existing `requireAdmin` middleware:

```text
GET  /admin/referrals/metrics
POST /admin/referrals/:id/revoke
POST /admin/referral-rewards/:id/revoke
POST /admin/promotional-entitlements/:id/revoke
```

Use `positiveId` for every path ID. Return `400` for malformed IDs, `404` for missing records, and `204` for successful or repeated revocation.

- [ ] **Step 5: Extend the existing Users growth dashboard**

Add to `usersApi.ts`:

```typescript
export function fetchReferralCampaignMetrics(): Promise<ReferralCampaignMetrics> {
  return apiJson('/api/admin/referrals/metrics');
}
```

Load it beside growth and feature usage in `useUsersInsights`. Add a `Referrals` segment to `UserUsageInsights` showing links created, unique visits, signups, activations, rewards, conversion counts, revocations, and D7/D30/D60 retention. Keep individual invited users and their app activity out of the dashboard.

- [ ] **Step 6: Run the focused tests**

Run: `node --experimental-strip-types --test --test-concurrency=1 src/referralStore.test.ts services/api/src/app.test.ts src/vitrine/usersApi.test.ts && tsx --test src/vitrine/components/UsersPage.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/referralStore.ts src/referralStore.test.ts services/api/src/app.ts services/api/src/app.test.ts src/vitrine/types.ts src/vitrine/usersApi.ts src/vitrine/usersApi.test.ts src/vitrine/useUsersInsights.ts src/vitrine/components/UserUsageInsights.tsx src/vitrine/components/UsersPage.test.tsx
git commit -m "feat: add referral campaign operations"
```

### Task 8: Verify the complete launch referral path

**Files:**
- Modify: `docs/superpowers/specs/2026-07-21-astryx-launch-referral-design.md`

- [ ] **Step 1: Run migration verification against a disposable database**

Run: `npm run db:check`

If the disposable migration database is available, also run: `npm run db:verify`

Expected: the migration sequence is valid; database verification either passes or clearly reports that the explicitly configured disposable database is unavailable.

- [ ] **Step 2: Run the full automated suite**

Run: `npm test`

Expected: PASS with zero failures.

- [ ] **Step 3: Run the production frontend build**

Run: `npm run build`

Expected: Vite exits 0 and emits the production bundle.

- [ ] **Step 4: Run a local API smoke scenario**

With a disposable migrated database and the three `REFERRAL_CAMPAIGN_*` variables set, exercise:

```text
inviter creates link
→ new account validates link and signs up
→ subscription response reports promotion with a 30-day expiry
→ invited account opens three different app details across the fixed test clock boundary
→ inviter summary reports one available Pro Month
→ inviter activates it
→ subscription response reports promotional Pro
→ a second activation reports none_available
```

Record the commands and observed statuses in the implementation handoff; do not include cookies, referral tokens, or database credentials.

- [ ] **Step 5: Update the design status and commit**

Change the design header from `Approved concept, pending written-spec review` to `Implemented` only after Steps 1-4 succeed.

```bash
git add docs/superpowers/specs/2026-07-21-astryx-launch-referral-design.md
git commit -m "docs: mark launch referrals implemented"
```
