# Astryx Free/Pro Billing and Entitlements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the backend Free/Pro pricing core for authenticated Astryx users: three permanent Free app unlocks, Stripe subscriptions using server-configured monthly and yearly Price IDs, server-enforced catalog entitlements, protected media, export quota reservation, and anti-scraping controls. The historical $7/$70 assumption was superseded by the approved $8.99/$79.99 launch price on 2026-07-21.

**Architecture:** Keep `admin | user` authorization separate from `free | pro` entitlement. Postgres is authoritative for local subscription, unlock, export-usage, session, and audit state; Stripe Checkout and Customer Portal own payment UI, while verified webhooks synchronize subscription state. Add public paginated previews and entitled paginated app detail beside the existing admin-only `/apps` compatibility route, then place rate limits and signed media delivery around the new customer routes.

**Tech Stack:** TypeScript 5.7, Node.js 22, Express 5, PostgreSQL 17, `stripe` Node SDK, Node test runner.

---

## Scope and prerequisites

This plan is intentionally one executable subsystem: pricing, billing, and
entitlements for already-authenticated users. It does not implement adjacent
product areas that the approved pricing spec left outside its boundary:

1. **Self-service normal-user registration.** The repository supports `role =
   'user'` and authenticates any stored user, but only the administrator is
   provisioned today. A separate identity design must add signup, verification,
   password recovery, and abuse controls before public launch.
2. **Figma/export artifact generation.** This plan implements the server-side
   20-per-month reservation contract that a future exporter must call before
   generating an artifact. It does not claim that an export exists before an
   exporter is built.

The customer-facing React implementation is also outside this plan. The backend
returns stable contracts for catalog previews, app unlocks, billing state,
Checkout/Portal redirects, upgrade errors, signed media, and export reservations.
The existing Vitrine remains an administrator surface and keeps using the
admin-only `/apps` compatibility route until the owner replaces the frontend.

The directory is not currently a Git repository. Task 1 establishes source
control so the frequent commit checkpoints below are executable. If the owner
intends this directory to live inside a different repository, replace Task 1 by
moving it there before making code changes.

## File structure

### Create

- `src/pricing.ts` — shared plan/subscription types and pure entitlement/window helpers.
- `src/pricing.test.ts` — active, grace, and yearly export-window unit tests.
- `src/pricingStore.ts` — Postgres persistence for subscriptions, Free unlocks, export usage, Stripe event receipts, and access events.
- `src/pricingStore.test.ts` — transaction, entitlement, downgrade, and export-window integration tests.
- `src/mediaToken.ts` — HMAC creation and verification for account-bound media URLs.
- `src/mediaToken.test.ts` — expiry, tamper, user, app, and hash binding tests.
- `services/api/src/billing.ts` — Stripe Checkout, Customer Portal, webhook verification, and subscription synchronization.
- `services/api/src/billing.test.ts` — Stripe adapter tests with a fake Stripe client.
- `services/api/src/rateLimit.ts` — in-process fixed-window and distinct-app traversal limiters for the current single API instance.
- `services/api/src/rateLimit.test.ts` — deterministic limiter tests with an injected clock.

### Modify

- `.gitignore` — ignore the local CodeGraph index before the baseline commit.
- `package.json`, `package-lock.json` — add the official `stripe` SDK.
- `.env.example`, `docker-compose.yml` — add Stripe, app URL, signing secret, and rate-limit configuration.
- `src/db.ts` — create pricing tables and expose a transaction helper.
- `src/authStore.ts`, `src/authStore.test.ts` — enforce two active sessions and expose `signed_in_elsewhere` resolution.
- `src/gallery.ts`, `src/gallery.test.ts` — add paginated metadata and app-detail builders while retaining the admin gallery builder.
- `src/designSystem.ts`, `src/designSystem.test.ts` — inject entitled signed evidence URLs during hydration.
- `services/api/src/config.ts`, `services/api/src/config.test.ts` — parse billing/security configuration.
- `services/api/src/app.ts`, `services/api/src/app.test.ts` — public catalog, unlocks, protected detail, signed media, Stripe routes, admin isolation, rate limits, and audit events.
- `services/api/src/index.ts` — instantiate Stripe and pass production dependencies to the app factory.

## Reference contracts

Use current Stripe behavior documented here:

- Checkout Session in subscription mode:
  <https://docs.stripe.com/api/checkout/sessions/create?lang=nodejs>
- Customer Portal server integration:
  <https://docs.stripe.com/customer-management/integrate-customer-portal>
- Express webhook raw-body requirement:
  <https://docs.stripe.com/webhooks/signature?lang=node>
- Subscription webhook/status lifecycle:
  <https://docs.stripe.com/billing/subscriptions/webhooks>

With the current Stripe API, billing period timestamps are read from the single
subscription item (`subscription.items.data[0].current_period_start` and
`current_period_end`), not from legacy top-level subscription fields.

### Task 1: Establish source control

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Verify the missing repository state**

Run:

```bash
git rev-parse --show-toplevel
```

Expected: exit 128 with `fatal: not a git repository`.

- [ ] **Step 2: Ignore local CodeGraph state**

Append this exact line to `.gitignore`:

```gitignore
.codegraph/
```

- [ ] **Step 3: Initialize the repository and capture the existing baseline**

Run:

```bash
git init -b main
git add .
git commit -m "chore: capture Astryx baseline"
```

Expected: one root commit; `git status --short` prints nothing.

### Task 2: Install Stripe and validate billing configuration

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.env.example`
- Modify: `docker-compose.yml`
- Modify: `services/api/src/config.ts`
- Test: `services/api/src/config.test.ts`

- [ ] **Step 1: Add failing configuration tests**

Add to `services/api/src/config.test.ts`:

```typescript
import { billingConfigFromEnv } from "./config.ts";

test("requires all billing and media-security variables", () => {
  assert.throws(() => billingConfigFromEnv({}), /STRIPE_SECRET_KEY/);
  assert.throws(
    () => billingConfigFromEnv({ STRIPE_SECRET_KEY: "sk_test_x" }),
    /STRIPE_WEBHOOK_SECRET/,
  );
});

test("parses the launch price and limiter configuration", () => {
  assert.deepEqual(
    billingConfigFromEnv({
      STRIPE_SECRET_KEY: "sk_test_x",
      STRIPE_WEBHOOK_SECRET: "whsec_x",
      STRIPE_PRO_MONTHLY_PRICE_ID: "price_month",
      STRIPE_PRO_YEARLY_PRICE_ID: "price_year",
      APP_URL: "https://astryx.example",
      MEDIA_SIGNING_SECRET: "0123456789abcdef0123456789abcdef",
      GENERAL_RATE_LIMIT: "300",
      MEDIA_RATE_LIMIT: "500",
      APP_TRAVERSAL_LIMIT: "20",
    }),
    {
      stripeSecretKey: "sk_test_x",
      stripeWebhookSecret: "whsec_x",
      monthlyPriceId: "price_month",
      yearlyPriceId: "price_year",
      appUrl: "https://astryx.example",
      mediaSigningSecret: "0123456789abcdef0123456789abcdef",
      generalRateLimit: 300,
      mediaRateLimit: 500,
      appTraversalLimit: 20,
    },
  );
});
```

- [ ] **Step 2: Run the focused test and observe failure**

Run:

```bash
node --experimental-strip-types --test services/api/src/config.test.ts
```

Expected: FAIL because `billingConfigFromEnv` is not exported.

- [ ] **Step 3: Add the configuration parser**

Add to `services/api/src/config.ts`:

```typescript
export interface BillingConfig {
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  monthlyPriceId: string;
  yearlyPriceId: string;
  appUrl: string;
  mediaSigningSecret: string;
  generalRateLimit: number;
  mediaRateLimit: number;
  appTraversalLimit: number;
}

function required(env: Record<string, string | undefined>, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function positiveInt(value: string | undefined, fallback: number, name: string): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

export function billingConfigFromEnv(env: Record<string, string | undefined>): BillingConfig {
  const appUrl = required(env, "APP_URL");
  if (!/^https?:\/\//.test(appUrl)) throw new Error("APP_URL must be an absolute HTTP URL");
  const mediaSigningSecret = required(env, "MEDIA_SIGNING_SECRET");
  if (mediaSigningSecret.length < 32) throw new Error("MEDIA_SIGNING_SECRET must contain at least 32 characters");
  return {
    stripeSecretKey: required(env, "STRIPE_SECRET_KEY"),
    stripeWebhookSecret: required(env, "STRIPE_WEBHOOK_SECRET"),
    monthlyPriceId: required(env, "STRIPE_PRO_MONTHLY_PRICE_ID"),
    yearlyPriceId: required(env, "STRIPE_PRO_YEARLY_PRICE_ID"),
    appUrl: appUrl.replace(/\/$/, ""),
    mediaSigningSecret,
    generalRateLimit: positiveInt(env.GENERAL_RATE_LIMIT, 300, "GENERAL_RATE_LIMIT"),
    mediaRateLimit: positiveInt(env.MEDIA_RATE_LIMIT, 500, "MEDIA_RATE_LIMIT"),
    appTraversalLimit: positiveInt(env.APP_TRAVERSAL_LIMIT, 20, "APP_TRAVERSAL_LIMIT"),
  };
}
```

- [ ] **Step 4: Install the official SDK**

Run:

```bash
npm install stripe
```

Expected: `stripe` appears under `dependencies`; the lockfile changes.

- [ ] **Step 5: Add environment documentation and Compose wiring**

Add to `.env.example` and pass the same names into the `api.environment` block:

```dotenv
STRIPE_SECRET_KEY=sk_test_replace_me
STRIPE_WEBHOOK_SECRET=whsec_replace_me
STRIPE_PRO_MONTHLY_PRICE_ID=price_replace_me
STRIPE_PRO_YEARLY_PRICE_ID=price_replace_me
APP_URL=http://localhost:5173
MEDIA_SIGNING_SECRET=replace-with-at-least-32-random-characters
GENERAL_RATE_LIMIT=300
MEDIA_RATE_LIMIT=500
APP_TRAVERSAL_LIMIT=20
```

- [ ] **Step 6: Verify and commit**

Run:

```bash
node --experimental-strip-types --test services/api/src/config.test.ts
docker compose config --quiet
git add package.json package-lock.json .env.example docker-compose.yml services/api/src/config.ts services/api/src/config.test.ts
git commit -m "feat: configure Free and Pro billing"
```

Expected: tests pass, Compose exits 0, commit succeeds.

### Task 3: Add pricing types, schema, and transaction support

**Files:**
- Create: `src/pricing.ts`
- Modify: `src/db.ts`
- Modify: `src/db.test.ts`

- [ ] **Step 1: Write failing pure pricing tests**

Create `src/pricing.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { effectivePlan, exportWindowStart } from "./pricing.ts";

test("grants Pro only for active or unexpired past-due subscriptions", () => {
  const now = new Date("2026-07-10T00:00:00Z");
  assert.equal(effectivePlan(undefined, now), "free");
  assert.equal(effectivePlan({ status: "active", grace_expires_at: null }, now), "pro");
  assert.equal(
    effectivePlan({ status: "past_due", grace_expires_at: "2026-07-11T00:00:00Z" }, now),
    "pro",
  );
  assert.equal(
    effectivePlan({ status: "past_due", grace_expires_at: "2026-07-09T00:00:00Z" }, now),
    "free",
  );
  assert.equal(effectivePlan({ status: "unpaid", grace_expires_at: null }, now), "free");
});

test("uses the final calendar day for yearly month-end export windows", () => {
  assert.equal(
    exportWindowStart(new Date("2026-01-31T12:00:00Z"), new Date("2026-02-28T18:00:00Z")).toISOString(),
    "2026-02-28T12:00:00.000Z",
  );
  assert.equal(
    exportWindowStart(new Date("2026-01-15T12:00:00Z"), new Date("2026-03-10T18:00:00Z")).toISOString(),
    "2026-02-15T12:00:00.000Z",
  );
});
```

- [ ] **Step 2: Run the test and observe module failure**

Run:

```bash
node --experimental-strip-types --test src/pricing.test.ts
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/pricing.ts`.

- [ ] **Step 3: Create the shared pricing contract**

Create `src/pricing.ts`:

```typescript
export type Plan = "free" | "pro";
export type BillingInterval = "month" | "year";
export type SubscriptionStatus =
  | "incomplete"
  | "incomplete_expired"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "paused";

export interface SubscriptionRecord {
  user_id: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  billing_interval: BillingInterval | null;
  status: SubscriptionStatus | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  grace_expires_at: string | null;
}

export function effectivePlan(
  subscription: Pick<SubscriptionRecord, "status" | "grace_expires_at"> | undefined,
  now = new Date(),
): Plan {
  if (subscription?.status === "active") return "pro";
  if (
    subscription?.status === "past_due" &&
    subscription.grace_expires_at &&
    new Date(subscription.grace_expires_at) > now
  ) return "pro";
  return "free";
}

export function exportWindowStart(anchor: Date, now = new Date()): Date {
  const candidate = (year: number, month: number): Date => {
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return new Date(Date.UTC(
      year,
      month,
      Math.min(anchor.getUTCDate(), lastDay),
      anchor.getUTCHours(),
      anchor.getUTCMinutes(),
      anchor.getUTCSeconds(),
    ));
  };
  const current = candidate(now.getUTCFullYear(), now.getUTCMonth());
  if (current <= now) return current;
  const previousMonth = now.getUTCMonth() - 1;
  return candidate(
    previousMonth < 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear(),
    previousMonth < 0 ? 11 : previousMonth,
  );
}
```

- [ ] **Step 4: Add transaction support and schema**

Export this helper from `src/db.ts`:

```typescript
export async function withTransaction<T>(
  work: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  await ensureSchema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
```

Add these statements to the existing `ensureSchema()` SQL after `sessions`:

```sql
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS revoked_reason TEXT;

CREATE TABLE IF NOT EXISTS subscriptions (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  billing_interval TEXT CHECK (billing_interval IN ('month', 'year')),
  status TEXT CHECK (status IN ('incomplete', 'incomplete_expired', 'active', 'past_due', 'canceled', 'unpaid', 'paused')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  grace_expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS free_app_unlocks (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, app_id)
);
CREATE TABLE IF NOT EXISTS stripe_events (
  event_id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS export_usage (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL,
  operation_count INTEGER NOT NULL DEFAULT 0 CHECK (operation_count >= 0),
  PRIMARY KEY (user_id, window_start)
);
CREATE TABLE IF NOT EXISTS access_events (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  session_hash TEXT,
  ip_prefix TEXT,
  app_slug TEXT,
  action TEXT NOT NULL,
  volume INTEGER NOT NULL DEFAULT 1,
  outcome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS access_events_user_created_idx ON access_events(user_id, created_at DESC);
```

- [ ] **Step 5: Extend the schema smoke test**

In `src/db.test.ts`, after the first `query` call, assert:

```typescript
for (const table of ["subscriptions", "free_app_unlocks", "stripe_events", "export_usage", "access_events"]) {
  assert.equal((await query("SELECT to_regclass($1) AS name", [table])).rows[0].name, table);
}
```

- [ ] **Step 6: Verify and commit**

Run:

```bash
docker compose up -d postgres
npm test
git add src/pricing.ts src/pricing.test.ts src/db.ts src/db.test.ts
git commit -m "feat: add pricing persistence schema"
```

Expected: full test suite passes; commit succeeds.

### Task 4: Implement Free unlocks, Pro entitlement, and export reservations

**Files:**
- Create: `src/pricingStore.ts`
- Create: `src/pricingStore.test.ts`

- [ ] **Step 1: Write failing integration tests**

Create `src/pricingStore.test.ts` using the same `astryx_test` setup pattern as
`src/authStore.test.ts`. The test body must provision one normal user and four
apps, then assert this exact contract:

```typescript
const first = await unlockFreeApp(userId, "app-one");
assert.deepEqual(first, { status: "unlocked", remaining: 2 });
await unlockFreeApp(userId, "app-two");
await unlockFreeApp(userId, "app-three");
assert.deepEqual(await unlockFreeApp(userId, "app-four"), { status: "limit_reached", remaining: 0 });
assert.equal(await canAccessApp({ id: userId, role: "user" }, "app-one"), true);
assert.equal(await canAccessApp({ id: userId, role: "user" }, "app-four"), false);
assert.equal(await canAccessApp({ id: 999, role: "admin" }, "app-four"), true);
```

Add a second test that inserts an active subscription, verifies every app is
accessible, and atomically reserves exports 1 through 20 while reservation 21
returns `{ status: "limit_reached", used: 20, limit: 20 }`.

- [ ] **Step 2: Run the focused test and observe failure**

Run:

```bash
node --experimental-strip-types --test src/pricingStore.test.ts
```

Expected: FAIL because `pricingStore.ts` does not exist.

- [ ] **Step 3: Implement the store interface**

Create `src/pricingStore.ts` with these exports:

```typescript
import type { AuthUser } from "./authStore.ts";
import { query, withTransaction } from "./db.ts";
import { effectivePlan, exportWindowStart, type BillingInterval, type SubscriptionRecord, type SubscriptionStatus } from "./pricing.ts";

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

export async function getSubscription(userId: number): Promise<SubscriptionRecord | undefined> {
  const result = await query<SubscriptionRecord>("SELECT * FROM subscriptions WHERE user_id = $1", [userId]);
  return result.rows[0];
}

export async function canAccessApp(user: Pick<AuthUser, "id" | "role">, appSlug: string): Promise<boolean> {
  if (user.role === "admin") return true;
  if (effectivePlan(await getSubscription(user.id)) === "pro") return true;
  const result = await query(
    `SELECT 1 FROM free_app_unlocks u JOIN apps a ON a.id = u.app_id
     WHERE u.user_id = $1 AND a.name = $2`,
    [user.id, appSlug],
  );
  return result.rowCount === 1;
}

export interface AccountEntitlements {
  plan: "free" | "pro";
  subscription: SubscriptionRecord | null;
  freeUnlocks: string[];
  freeUnlocksRemaining: number;
  exportUsage: { used: number; limit: 20; resetAt: string | null };
}
```

Implement `unlockFreeApp` with `withTransaction`: lock the user row using
`SELECT id FROM users WHERE id = $1 FOR UPDATE`, resolve the app ID, return
`already_unlocked` without incrementing, count existing rows, reject at three,
then insert and return the remaining count. Do not use separate top-level
`query()` calls for this sequence.

Implement these additional exports with parameterized SQL:

```typescript
export async function listFreeUnlocks(userId: number): Promise<string[]>;
export async function getAccountEntitlements(userId: number, now?: Date): Promise<AccountEntitlements>;
export async function upsertStripeCustomer(userId: number, customerId: string): Promise<void>;
export async function upsertSubscription(input: StripeSubscriptionInput): Promise<void>;
export async function hasProcessedStripeEvent(eventId: string): Promise<boolean>;
export async function markStripeEventProcessed(eventId: string): Promise<void>;
export async function recordAccessEvent(input: {
  userId?: number;
  sessionHash?: string;
  ipPrefix?: string;
  appSlug?: string;
  action: string;
  volume?: number;
  outcome: string;
}): Promise<void>;
export async function reserveExportOperation(userId: number, now?: Date): Promise<
  | { status: "reserved"; used: number; limit: 20; resetAt: string }
  | { status: "not_pro"; used: 0; limit: 20; resetAt: null }
  | { status: "limit_reached"; used: 20; limit: 20; resetAt: string }
>;
```

`reserveExportOperation` must lock the user's subscription row, call
`effectivePlan`, derive the monthly window from `current_period_start`, upsert
`export_usage`, and increment only when the stored count is below 20.
`getAccountEntitlements` must use the same window calculation without
incrementing usage, clamp `freeUnlocksRemaining` to `0..3`, and return ISO
timestamps so the API can map the result directly to `SubscriptionView`.

- [ ] **Step 4: Run integration tests**

Run:

```bash
node --experimental-strip-types --test src/pricingStore.test.ts
```

Expected: PASS, including fourth-unlock and twenty-first-export cases.

- [ ] **Step 5: Run all tests and commit**

Run:

```bash
npm test
git add src/pricingStore.ts src/pricingStore.test.ts
git commit -m "feat: enforce Free and Pro entitlements"
```

Expected: full suite passes; commit succeeds.

### Task 5: Enforce two active sessions with a clear eviction reason

**Files:**
- Modify: `src/authStore.ts`
- Modify: `src/authStore.test.ts`
- Modify: `services/api/src/app.ts`
- Modify: `services/api/src/app.test.ts`

- [ ] **Step 1: Add failing session-eviction tests**

Add to `src/authStore.test.ts`:

```typescript
test("keeps two sessions and marks the oldest signed in elsewhere", { skip: skipReason }, async () => {
  const { query } = await import("./db.ts");
  const { hashPassword } = await import("./authCrypto.ts");
  const { createSession, resolveSessionState } = await import("./authStore.ts");
  await query("TRUNCATE sessions, users RESTART IDENTITY CASCADE");
  const inserted = await query<{ id: number }>(
    `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'user') RETURNING id`,
    ["user@example.com", await hashPassword("a sufficiently long user password")],
  );
  const first = await createSession(inserted.rows[0].id);
  await createSession(inserted.rows[0].id);
  await createSession(inserted.rows[0].id);
  assert.deepEqual(await resolveSessionState(first.token), { status: "signed_in_elsewhere" });
});
```

Add an API test whose fake `resolveSessionState` returns
`{ status: "signed_in_elsewhere" }` and assert status 401 with:

```json
{"error":"Signed in on another device","code":"signed_in_elsewhere"}
```

- [ ] **Step 2: Run tests and observe failure**

Run:

```bash
node --experimental-strip-types --test src/authStore.test.ts services/api/src/app.test.ts
```

Expected: FAIL because `resolveSessionState` does not exist.

- [ ] **Step 3: Implement session resolution state**

Add to `src/authStore.ts`:

```typescript
export type SessionResolution =
  | { status: "authenticated"; user: AuthUser }
  | { status: "signed_in_elsewhere" }
  | { status: "invalid" };

export async function resolveSessionState(token: string): Promise<SessionResolution> {
  const tokenHash = hashSessionToken(token);
  const result = await query<StoredUser & { revoked_reason: string | null }>(
    `SELECT u.id, u.email, u.role, u.password_hash, u.active, s.revoked_reason
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [tokenHash],
  );
  const row = result.rows[0];
  if (row?.revoked_reason === "signed_in_elsewhere") return { status: "signed_in_elsewhere" };
  if (!row?.active || row.revoked_reason) return { status: "invalid" };
  return { status: "authenticated", user: safeUser(row) };
}
```

After inserting the new session in `createSession`, load the user's role. Leave
admin sessions unchanged. For `role = 'user'`, mark all but the newest two
active sessions:

```typescript
const account = await query<{ role: UserRole }>("SELECT role FROM users WHERE id = $1", [userId]);
if (account.rows[0]?.role === "user") {
  await query(
    `UPDATE sessions SET revoked_at = now(), revoked_reason = 'signed_in_elsewhere'
     WHERE user_id = $1 AND revoked_at IS NULL AND id NOT IN (
       SELECT id FROM sessions WHERE user_id = $1 AND revoked_at IS NULL
       ORDER BY created_at DESC, id DESC LIMIT 2
     )`,
    [userId],
  );
}
```

Keep `resolveSession(token)` as a compatibility wrapper returning the user only
for `authenticated`.

- [ ] **Step 4: Use stateful resolution in API middleware**

Replace the API dependency and middleware lookup with `resolveSessionState`. Map
`signed_in_elsewhere` to the explicit response above; map `invalid` to the
existing generic authentication response.

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm test
git add src/authStore.ts src/authStore.test.ts services/api/src/app.ts services/api/src/app.test.ts
git commit -m "feat: cap concurrent Pro sessions"
```

Expected: full suite passes; commit succeeds.

### Task 6: Add public previews and entitled detail beside the admin catalog

**Files:**
- Modify: `src/gallery.ts`
- Modify: `src/gallery.test.ts`
- Modify: `services/api/src/app.ts`
- Modify: `services/api/src/app.test.ts`

- [ ] **Step 1: Add failing gallery builder tests**

Add tests that construct 30 apps with four images each and assert:

```typescript
const first = buildCatalogPage(images, undefined, 24);
assert.equal(first.apps.length, 24);
assert.equal(first.apps[0].previewScreens.length, 3);
assert.ok(first.nextCursor);
const detail = buildAppDetailPage(images, "app-01", undefined, 2);
assert.equal(detail?.screens.length, 2);
assert.ok(detail?.nextCursor);
```

Also assert that neither JSON response contains `image_url` source values or
images belonging to apps outside the page.

- [ ] **Step 2: Run the test and observe failure**

Run:

```bash
node --experimental-strip-types --test src/gallery.test.ts
```

Expected: FAIL because the paginated builders do not exist.

- [ ] **Step 3: Implement paginated pure builders**

Replace `buildGalleryApps` with:

```typescript
export interface CatalogScreen {
  id: number;
  type: string;
  productArea: string;
  theme: "light" | "dark" | "mixed";
  visibleStates: string[];
  platform: string;
  description: string | null;
  url: string;
}

export interface CatalogPage {
  apps: Array<{
    id: string;
    app: string;
    cat: string;
    accent: string;
    totalScreens: number;
    previewScreens: CatalogScreen[];
  }>;
  nextCursor: string | null;
}

export function buildCatalogPage(
  images: CrawledImage[],
  cursor?: string,
  limit = 24,
): CatalogPage;

export function buildAppDetailPage(
  images: CrawledImage[],
  appSlug: string,
  cursor?: string,
  limit = 24,
): { app: CatalogPage["apps"][number]; screens: CatalogScreen[]; nextCursor: string | null } | undefined;
```

Use base64url-encoded last app slug for catalog cursors and last image ID for
screen cursors. Clamp catalog limits to 24 and screen limits to 48. Build public
preview URLs as `/api/preview-media/<app>/<hash>` and include only the first three
screens. Never include the stored `image_url` field.

- [ ] **Step 4: Add route tests before route implementation**

Add API tests for:

```text
GET /catalog                         -> 200 without a cookie, max 24 apps
GET /preview-media/linear/<hash>     -> 200 only for one of Linear's first 3 images
GET /apps/linear                     -> 401 without a cookie
GET /apps/linear as locked Free      -> 403 { code: "upgrade_required" }
POST /apps/linear/unlock as Free     -> 201 then GET /apps/linear -> 200
GET /apps/linear as Pro              -> 200
GET /apps as normal user             -> 403
GET /apps as admin                   -> 200 with the existing Vitrine contract
GET /images as normal user           -> 403
GET /jobs and /progress as normal user -> 403
```

- [ ] **Step 5: Implement public and protected routes**

Register `GET /catalog` and `GET /preview-media/:app/:hash` before the required
authentication middleware. For preview media, load `appImages(app)`, take the
first three, and serve the file only when the requested hash belongs to that
set.

After authentication, add:

```typescript
app.post("/apps/:app/unlock", async (req, res) => {
  const result = await deps.unlockFreeApp(res.locals.user.id, req.params.app);
  const status = result.status === "unlocked" ? 201 : result.status === "app_not_found" ? 404 : 200;
  res.status(status).json(result);
});

app.get("/apps/:app", async (req, res) => {
  if (!(await deps.canAccessApp(res.locals.user, req.params.app))) {
    res.status(403).json({ error: "Upgrade required", code: "upgrade_required" });
    return;
  }
  const page = buildAppDetailPage(await deps.allImages(), req.params.app, String(req.query.cursor ?? ""));
  if (!page) res.status(404).json({ error: "app not found" });
  else res.json(page);
});
```

Restrict the existing `/apps`, `/images`, `/jobs`, `/progress`, and all pipeline
mutations with `requireAdmin`. The admin-only `/apps` response remains unchanged
so the current Vitrine keeps working; it is not a customer API. Keep
`/design-systems/:app` authenticated and add `canAccessApp` before loading its
snapshot.

- [ ] **Step 6: Verify and commit**

Run:

```bash
npm test
git add src/gallery.ts src/gallery.test.ts services/api/src/app.ts services/api/src/app.test.ts
git commit -m "feat: gate catalog detail by entitlement"
```

Expected: all tests pass; no protected route returns the full catalog.

### Task 7: Sign protected media and design-system evidence

**Files:**
- Create: `src/mediaToken.ts`
- Create: `src/mediaToken.test.ts`
- Modify: `src/designSystem.ts`
- Modify: `src/designSystem.test.ts`
- Modify: `services/api/src/app.ts`
- Modify: `services/api/src/app.test.ts`

- [ ] **Step 1: Write failing HMAC tests**

Create `src/mediaToken.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { createMediaToken, verifyMediaToken } from "./mediaToken.ts";

test("binds media tokens to user, app, hash, and expiry", () => {
  const secret = "0123456789abcdef0123456789abcdef";
  const expiresAt = 2_000_000_000;
  const token = createMediaToken(secret, { userId: 7, app: "linear", hash: "0123456789abcdef", expiresAt });
  assert.equal(verifyMediaToken(secret, token, { userId: 7, app: "linear", hash: "0123456789abcdef", expiresAt }, 1_999_999_999), true);
  assert.equal(verifyMediaToken(secret, token, { userId: 8, app: "linear", hash: "0123456789abcdef", expiresAt }, 1_999_999_999), false);
  assert.equal(verifyMediaToken(secret, token, { userId: 7, app: "linear", hash: "0123456789abcdef", expiresAt }, 2_000_000_001), false);
});
```

- [ ] **Step 2: Run and observe module failure**

Run:

```bash
node --experimental-strip-types --test src/mediaToken.test.ts
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement constant-time HMAC verification**

Create `src/mediaToken.ts`:

```typescript
import { createHmac, timingSafeEqual } from "node:crypto";

interface MediaClaims { userId: number; app: string; hash: string; expiresAt: number }

function payload(claims: MediaClaims): string {
  return `${claims.userId}:${claims.app}:${claims.hash}:${claims.expiresAt}`;
}

export function createMediaToken(secret: string, claims: MediaClaims): string {
  return createHmac("sha256", secret).update(payload(claims)).digest("base64url");
}

export function verifyMediaToken(
  secret: string,
  token: string,
  claims: MediaClaims,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (claims.expiresAt <= nowSeconds) return false;
  const expected = Buffer.from(createMediaToken(secret, claims));
  const supplied = Buffer.from(token);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}
```

- [ ] **Step 4: Inject URL construction during design-system hydration**

Change `hydrateDesignSystem` to accept:

```typescript
imageUrl: (app: string, source: string) => string = publicImageUrl
```

and call that function instead of `publicImageUrl` directly. Add a unit test
whose injected function returns `/signed/<image-id-source>` and assert every
token, component, and flow evidence URL uses it.

- [ ] **Step 5: Protect the media route**

Generate five-minute URLs in entitled app detail and design-system responses:

```typescript
const expiresAt = Math.floor(Date.now() / 1000) + 300;
const token = createMediaToken(secret, { userId: user.id, app, hash, expiresAt });
return `/api/media/${app}/${hash}?expires=${expiresAt}&token=${encodeURIComponent(token)}`;
```

On `GET /media/:app/:hash`, require the authenticated session, recheck app
entitlement, parse `expires`, verify the HMAC against that user, and return 403
for missing/tampered/cross-user tokens or 410 for expired tokens.

- [ ] **Step 6: Verify and commit**

Run:

```bash
npm test
git add src/mediaToken.ts src/mediaToken.test.ts src/designSystem.ts src/designSystem.test.ts services/api/src/app.ts services/api/src/app.test.ts
git commit -m "feat: sign protected catalog media"
```

Expected: all media binding tests and the full suite pass.

### Task 8: Implement Stripe Checkout, Portal, and webhook synchronization

**Files:**
- Create: `services/api/src/billing.ts`
- Create: `services/api/src/billing.test.ts`
- Modify: `services/api/src/app.ts`
- Modify: `services/api/src/app.test.ts`
- Modify: `services/api/src/index.ts`

- [ ] **Step 1: Write fake-client billing tests**

Define a minimal `StripePort` in the test and assert:

```typescript
const checkout = await service.createCheckout(user, "month");
assert.equal(checkout.url, "https://checkout.stripe.test/session");
assert.deepEqual(fake.checkout.sessions.create.mock.calls[0].arguments[0].line_items, [
  { price: "price_month", quantity: 1 },
]);
```

Add tests that yearly selects `price_year`, an active Pro returns
`already_subscribed`, Portal requires a stored customer, an invalid webhook
signature throws, duplicate events are acknowledged once, and a retrieved
`past_due` subscription stores a seven-day grace expiry.

- [ ] **Step 2: Run and observe module failure**

Run:

```bash
node --experimental-strip-types --test services/api/src/billing.test.ts
```

Expected: FAIL because `billing.ts` does not exist.

- [ ] **Step 3: Create the Stripe adapter**

Create `services/api/src/billing.ts` with this public contract:

```typescript
export interface StripePort {
  customers: Pick<Stripe["customers"], "create">;
  checkout: { sessions: Pick<Stripe["checkout"]["sessions"], "create"> };
  billingPortal: { sessions: Pick<Stripe["billingPortal"]["sessions"], "create"> };
  subscriptions: Pick<Stripe["subscriptions"], "retrieve">;
  webhooks: Pick<Stripe["webhooks"], "constructEvent">;
}

export interface BillingService {
  createCheckout(user: AuthUser, interval: BillingInterval): Promise<
    | { status: "created"; url: string }
    | { status: "already_subscribed" }
  >;
  createPortal(userId: number): Promise<{ url: string } | undefined>;
  handleWebhook(rawBody: Buffer, signature: string | undefined): Promise<"processed" | "duplicate" | "ignored">;
}

export function createBillingService(input: {
  stripe: StripePort;
  config: BillingConfig;
  store: {
    getSubscription: typeof getSubscription;
    upsertStripeCustomer: typeof upsertStripeCustomer;
    upsertSubscription: typeof upsertSubscription;
    hasProcessedStripeEvent: typeof hasProcessedStripeEvent;
    markStripeEventProcessed: typeof markStripeEventProcessed;
  };
  now?: () => Date;
}): BillingService;
```

Add a `disabledBilling` implementation to the API's default dependencies whose
methods throw `Billing is not configured`. Existing unit tests can continue to
construct the app without Stripe; production `index.ts` and billing-specific API
tests must override it with a real or fake `BillingService`.

For Checkout:

```typescript
const session = await stripe.checkout.sessions.create({
  mode: "subscription",
  customer: customerId,
  line_items: [{ price: interval === "month" ? config.monthlyPriceId : config.yearlyPriceId, quantity: 1 }],
  success_url: `${config.appUrl}/billing/success`,
  cancel_url: `${config.appUrl}/pricing`,
  subscription_data: { metadata: { astryxUserId: String(user.id) } },
});
```

Create and persist a Stripe Customer first when the user has none. For Portal,
authenticate locally and call `stripe.billingPortal.sessions.create` with the
stored customer and `${appUrl}/settings/billing` return URL.

For supported subscription and invoice events, retrieve the current
subscription from Stripe before writing local state. Read the single item, map
its configured Price ID to `month | year`, read item period timestamps, and use
subscription metadata `astryxUserId`. Set `graceExpiresAt = now + 7 days` when
the authoritative status is `past_due`, preserve an existing later grace date,
and clear it when status returns to `active`. Mark the event processed only
after the local sync succeeds.

- [ ] **Step 4: Register raw webhook before JSON parsing**

At the start of `createApiApp`, before `app.use(express.json())`, register:

```typescript
app.post("/billing/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const result = await deps.billing.handleWebhook(req.body as Buffer, req.header("stripe-signature"));
    res.json({ received: true, result });
  } catch {
    res.status(400).json({ error: "Invalid Stripe webhook" });
  }
});
```

After authentication, add `POST /billing/checkout`, `POST /billing/portal`, and
`GET /billing/subscription`. Accept only `{ interval: "month" | "year" }`.
The GET route calls `getAccountEntitlements`, converts subscription snake-case
fields to the `SubscriptionView` camel-case contract, and never returns Stripe
customer, subscription, or Price IDs.

- [ ] **Step 5: Instantiate production Stripe dependencies**

In `services/api/src/index.ts`, construct `new Stripe(config.stripeSecretKey)`,
create the billing service, and pass it into `createApiApp`. Keep the admin seed
startup validation intact.

- [ ] **Step 6: Verify and commit**

Run:

```bash
npm test
npx tsc --noEmit
git add services/api/src/billing.ts services/api/src/billing.test.ts services/api/src/app.ts services/api/src/app.test.ts services/api/src/index.ts
git commit -m "feat: add Stripe Pro subscriptions"
```

Expected: billing tests, full tests, and type checking pass.

### Task 9: Add rate limits, traversal detection, and access auditing

**Files:**
- Create: `services/api/src/rateLimit.ts`
- Create: `services/api/src/rateLimit.test.ts`
- Modify: `services/api/src/app.ts`
- Modify: `services/api/src/app.test.ts`

- [ ] **Step 1: Write deterministic limiter tests**

Create tests with an injected `now()` that assert:

```typescript
const limiter = createFixedWindowLimiter({ limit: 2, windowMs: 60_000, now });
assert.equal(limiter.check("user:1").allowed, true);
assert.equal(limiter.check("user:1").allowed, true);
assert.deepEqual(limiter.check("user:1"), { allowed: false, retryAfterSeconds: 60 });
```

For `createDistinctValueLimiter`, assert that revisiting the same app does not
increase coverage, while the twenty-first distinct app inside ten minutes is
blocked. Also assert `ipPrefix("203.0.113.45") === "203.0.113.0/24"` and that an
IPv6 input retains only its first four hextets with a `/64` suffix.

- [ ] **Step 2: Run and observe module failure**

Run:

```bash
node --experimental-strip-types --test services/api/src/rateLimit.test.ts
```

Expected: FAIL because `rateLimit.ts` does not exist.

- [ ] **Step 3: Implement dependency-free limiters**

Create `services/api/src/rateLimit.ts` exporting:

```typescript
export function createFixedWindowLimiter(input: {
  limit: number;
  windowMs: number;
  now?: () => number;
}): { check(key: string): { allowed: true } | { allowed: false; retryAfterSeconds: number } };

export function createDistinctValueLimiter(input: {
  limit: number;
  windowMs: number;
  now?: () => number;
}): { check(key: string, value: string): { allowed: true } | { allowed: false; retryAfterSeconds: number } };
export function ipPrefix(address: string): string;
```

Use `Map` entries containing window start, count, or `Set<string>`. Delete an
entry when its window expires. `ipPrefix` must remove the IPv4 host octet and
retain at most the first four IPv6 hextets. Do not add a rate-limit dependency
for the current single API process.

- [ ] **Step 4: Wire the three configured limits**

Apply:

- general protected requests: 300 per five minutes per user and IP;
- protected media: 500 per ten minutes per user;
- distinct entitled app detail: 20 apps per ten minutes per user.

When blocked, return status 429 with:

```json
{"error":"Security verification required","code":"verification_required","retryAfterSeconds":60}
```

Set `Retry-After`, record an `access_events` row with outcome `blocked`, and do
not load the protected resource. Record aggregate successful app-detail and
export events; do not write one database row per image.

- [ ] **Step 5: Test route enforcement and commit**

Run:

```bash
npm test
git add services/api/src/rateLimit.ts services/api/src/rateLimit.test.ts services/api/src/app.ts services/api/src/app.test.ts
git commit -m "feat: detect catalog scraping"
```

Expected: repeated normal access passes; configured test-limit overflow returns
429 and records one blocked audit event.

### Task 10: Add the export reservation contract

**Files:**
- Modify: `services/api/src/app.ts`
- Modify: `services/api/src/app.test.ts`

- [ ] **Step 1: Write API tests for export reservation**

Assert:

```text
POST /apps/linear/exports/reservations as Free -> 403 { code: "upgrade_required" }
POST /apps/linear/exports/reservations as Pro, reservation 1..20 -> 201
POST /apps/linear/exports/reservations as Pro, reservation 21 -> 429 with resetAt
```

The request body must accept only one of these forms:

```json
{"kind":"component-family","id":"buttons"}
{"kind":"foundation-category","id":"colors"}
{"kind":"screens","ids":[1,2,3]}
```

Reject empty IDs, duplicate screen IDs, more than ten screens, and mixed forms.

- [ ] **Step 2: Implement validation and reservation**

Add a pure `parseExportSelection(value: unknown)` beside the API route. Only
after validation and app entitlement succeeds should the route call
`reserveExportOperation`. Return the reservation receipt; do not create a fake
Figma file or downloadable artifact.

- [ ] **Step 3: Verify and commit**

Run:

```bash
npm test
git add services/api/src/app.ts services/api/src/app.test.ts
git commit -m "feat: reserve controlled Pro exports"
```

Expected: API tests pass.

### Task 11: Backend Stripe and entitlement acceptance

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `.env.example` only if acceptance uncovers a missing documented variable

- [ ] **Step 1: Start dependencies and run every automated check**

Run:

```bash
docker compose up -d postgres rabbitmq
npm test
npx tsc --noEmit
npm run build
npm run build-storybook
docker compose config --quiet
```

Expected: every command exits 0. Frontend build checks remain regression guards;
this plan does not change frontend source.

- [ ] **Step 2: Provision one backend-only test user**

Generate a password hash through the existing code and insert a normal user with
a one-off TypeScript command:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/astryx npx tsx -e 'import { hashPassword } from "./src/authCrypto.ts"; import { query, closePool } from "./src/db.ts"; const run = async () => { const passwordHash = await hashPassword("backend test password 2026"); await query("INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role, active = true", ["backend-user@example.com", passwordHash, "user"]); await closePool(); }; run().catch((error) => { console.error(error); process.exitCode = 1; });'
```

Expected: exit 0 and one active `role = 'user'` row. Do not use this fixed
credential outside local Stripe sandbox acceptance.

- [ ] **Step 3: Forward Stripe sandbox events**

Run in a separate terminal:

```bash
stripe listen --forward-to localhost:3010/billing/webhook
```

Copy the emitted `whsec_` value into `STRIPE_WEBHOOK_SECRET`, then restart the
API. Do not commit the secret.

- [ ] **Step 4: Exercise Free access through HTTP only**

Log in and save the session cookie:

```bash
curl -sS -c /tmp/astryx-cookie.txt \
  -H 'content-type: application/json' \
  -d '{"email":"backend-user@example.com","password":"backend test password 2026"}' \
  http://localhost:3010/auth/login
curl -sS http://localhost:3010/catalog
curl -sS -b /tmp/astryx-cookie.txt -X POST http://localhost:3010/apps/linear/unlock
curl -sS -b /tmp/astryx-cookie.txt http://localhost:3010/apps/linear
```

Expected: login returns the safe user, public catalog returns at most 24 apps and
three previews per app, unlock returns 201, and entitled detail returns 200.
Unlock two more apps, then confirm a fourth unlock returns
`limit_reached`. Confirm a locked app detail returns 403 with
`upgrade_required`.

- [ ] **Step 5: Exercise monthly and yearly Checkout without frontend code**

Create monthly Checkout:

```bash
curl -sS -b /tmp/astryx-cookie.txt \
  -H 'content-type: application/json' \
  -d '{"interval":"month"}' \
  http://localhost:3010/billing/checkout
```

Open the returned Stripe URL directly and pay with sandbox card
`4242 4242 4242 4242`. Poll:

```bash
curl -sS -b /tmp/astryx-cookie.txt http://localhost:3010/billing/subscription
```

Expected: only the verified webhook changes `plan` to `pro`; interval is
`month`; every app detail becomes accessible. Repeat with a fresh user and
`{"interval":"year"}`; confirm the configured yearly Price and `year`
interval are stored.

- [ ] **Step 6: Exercise Portal, cancellation, grace, and downgrade**

Create a Portal session:

```bash
curl -sS -b /tmp/astryx-cookie.txt -X POST http://localhost:3010/billing/portal
```

Open the returned Stripe URL, cancel at period end, and confirm the local
subscription keeps Pro with `cancelAtPeriodEnd = true`. Use Stripe sandbox
fixtures or the fake-client billing test to drive `past_due`, confirm seven-day
grace, then drive `unpaid` and confirm the account returns to its original
three Free app slugs.

- [ ] **Step 7: Exercise signed media, scraping, and export controls**

1. Load an entitled design system and extract one signed media URL.
2. Confirm it succeeds with the owning session, fails with a second account, and
   returns 410 after its five-minute expiry.
3. Request 21 distinct app detail endpoints inside ten minutes and confirm
   request 21 returns 429 with `verification_required`.
4. Confirm repeated browsing of one app remains allowed.
5. Create 20 valid export reservations and confirm reservation 21 returns its
   reset date.
6. Confirm no customer response contains all protected apps or stored
   `image_url` values.
7. Confirm normal users receive 403 from `/apps`, `/images`, `/jobs`, and
   `/progress`, while the seeded admin retains the current Vitrine contract.

- [ ] **Step 8: Document the backend contract**

Update `docs/ARCHITECTURE.md` with:

- public `/catalog` and preview media;
- admin-only compatibility `/apps`;
- entitled app detail, design-system, and signed media routes;
- Free unlock and Pro subscription tables;
- Stripe webhook authority and raw-body ordering;
- Checkout, Portal, billing-state, and export-reservation response contracts;
- configured rate-limit windows;
- the explicit frontend, self-service identity, and export-generator follow-ons.

- [ ] **Step 9: Final verification and commit**

Run:

```bash
npm test
npx tsc --noEmit
npm run build
npm run build-storybook
docker compose config --quiet
git status --short
git add docs/ARCHITECTURE.md .env.example
git commit -m "docs: document Free and Pro backend operations"
git status --short
```

Expected: all checks exit 0 and final status is clean.

## Follow-on work before public launch

Do not label the result public-launch complete until these follow-ons have their
own approved design and plan:

1. Customer-facing Free/Pro frontend using the backend contracts in this plan:
   public catalog, unlock confirmation, upgrade prompt, pricing page, Checkout
   redirect, activation polling, and Billing Settings.
2. Normal-user registration, email verification, password recovery, and signup
   abuse prevention.
3. Editable Figma/export artifact generation that consumes a successful
   `/apps/:app/exports/reservations` receipt, adds account/license metadata, and never
   bypasses the selection-size contract.
4. Personal collections, research notes, and cross-application comparison. The
   pricing page must not claim these benefits until the corresponding product
   features are shipped and receive Free/Pro entitlement tests.
