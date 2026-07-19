# Admin Users Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one infinite-scroll admin user directory with real enable/disable controls, global feature-usage insights, and per-user activity drill-down.

**Architecture:** Keep growth statistics in `adminStats.ts`, move directory and account-state responsibilities into a focused `adminUsers.ts` store, and place the stable feature taxonomy plus usage aggregates in `featureUsage.ts`. Expose cursor-based admin APIs and consume them through dedicated frontend API and hook modules; keep `UsersPage.tsx` as orchestration while list, insights, and detail-dialog behavior live in focused components.

**Tech Stack:** TypeScript, React 19, Express, PostgreSQL, Node test runner, `tsx`, Recharts, `@astryxdesign/core`, Vite.

---

## File map

- Create `migrations/0010_feature_usage.sql`: add stable feature keys and bounded metadata to `access_events`.
- Create `src/featureUsage.ts`: feature taxonomy, range parsing, event normalization, global aggregates, and per-user aggregates.
- Create `src/featureUsage.test.ts`: taxonomy and PostgreSQL-backed aggregate coverage.
- Create `src/adminUsers.ts`: cursor codec, filtered directory queries, account-state mutation, and session revocation.
- Create `src/adminUsers.test.ts`: PostgreSQL-backed pagination and account-safety coverage.
- Modify `src/adminStats.ts`: retain growth-only queries and import shared user types where needed.
- Modify `src/pricingStore.ts`: record optional validated feature keys and metadata.
- Modify `services/api/src/app.ts`: mount paginated directory, account-state, and analytics endpoints and instrument core features.
- Modify `services/api/src/app.test.ts`: verify admin authorization, validation, payloads, and event instrumentation.
- Modify `services/api/src/researchProjects.ts`: attach the stable research feature key to existing research events.
- Modify `services/api/src/researchProjects.test.ts`: verify research feature attribution.
- Modify `src/vitrine/types.ts`: add paginated directory and analytics view types.
- Create `src/vitrine/usersApi.ts`: frontend HTTP contract for directory, status, growth, and usage endpoints.
- Create `src/vitrine/usersApi.test.ts`: request/response and error contract coverage.
- Create `src/vitrine/usersDirectoryModel.ts`: page deduplication and query-reset helpers.
- Create `src/vitrine/usersDirectoryModel.test.ts`: pure infinite-page state coverage.
- Create `src/vitrine/useUsersDirectory.ts`: debounced query, cursor loading, stale-request protection, and account updates.
- Create `src/vitrine/useUsersInsights.ts`: growth, global usage, and selected-user usage state.
- Create `src/vitrine/components/UserDirectory.tsx`: unified list, sentinel, fallback Load more, Actions menu, and disable confirmation.
- Create `src/vitrine/components/UserUsageInsights.tsx`: Feature usage/Growth switcher and range controls.
- Create `src/vitrine/components/UserUsageDialog.tsx`: per-user activity drawer-style dialog.
- Modify `src/vitrine/components/UsersPage.tsx`: compose the new hooks and focused components.
- Modify `src/vitrine/components/UsersPage.test.tsx`: verify the unified hierarchy and analytics surfaces.
- Modify `src/vitrine/styles.css`: responsive list, footer, insights, chart, and dialog styling.
- Modify `design-qa.md` and implementation screenshots: record the final visual comparison and interaction checks.

### Task 1: Add the stable feature-event model

**Files:**
- Create: `migrations/0010_feature_usage.sql`
- Create: `src/featureUsage.ts`
- Create: `src/featureUsage.test.ts`
- Modify: `src/pricingStore.ts:331-353`
- Modify: `src/pricingStore.test.ts`

- [ ] **Step 1: Write failing taxonomy and recorder tests**

Add pure expectations to `src/featureUsage.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { featureKeyForLegacyAction, isFeatureKey, parseUsageRange } from "./featureUsage.ts";

test("accepts only the declared feature taxonomy", () => {
  assert.equal(isFeatureKey("exports"), true);
  assert.equal(isFeatureKey("protected-request"), false);
});

test("normalizes supported ranges and rejects arbitrary windows", () => {
  assert.deepEqual(parseUsageRange("30d"), { key: "30d", days: 30 });
  assert.equal(parseUsageRange("365d"), undefined);
});

test("maps useful historical actions without counting generic requests", () => {
  assert.equal(featureKeyForLegacyAction("export-figma"), "exports");
  assert.equal(featureKeyForLegacyAction("research_project_created"), "research");
  assert.equal(featureKeyForLegacyAction("protected-request"), undefined);
});
```

Extend the existing PostgreSQL test in `src/pricingStore.test.ts` so `recordAccessEvent` is called with `featureKey: "exports"` and `metadata: { format: "figma" }`, then assert both columns are stored.

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
node --experimental-strip-types --test src/featureUsage.test.ts src/pricingStore.test.ts
```

Expected: FAIL because `featureUsage.ts`, `feature_key`, and `metadata` do not exist.

- [ ] **Step 3: Add the migration and taxonomy implementation**

Create `migrations/0010_feature_usage.sql`:

```sql
ALTER TABLE access_events ADD COLUMN IF NOT EXISTS feature_key TEXT;
ALTER TABLE access_events ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS access_events_feature_created_idx
  ON access_events(feature_key, created_at DESC)
  WHERE feature_key IS NOT NULL;
```

Start `src/featureUsage.ts` with the complete public taxonomy:

```ts
export const FEATURE_LABELS = {
  library: "App library",
  search: "Search",
  collections: "Collections",
  exports: "Exports",
  research: "Research projects",
  design_systems: "Design systems",
  flows: "Flows",
  ai_analysis: "AI analysis",
} as const;

export type FeatureKey = keyof typeof FEATURE_LABELS;
export type UsageRangeKey = "7d" | "30d" | "90d";

export function isFeatureKey(value: unknown): value is FeatureKey {
  return typeof value === "string" && Object.hasOwn(FEATURE_LABELS, value);
}

export function parseUsageRange(value: unknown): { key: UsageRangeKey; days: number } | undefined {
  if (value === "7d") return { key: value, days: 7 };
  if (value === "30d" || value === undefined) return { key: "30d", days: 30 };
  if (value === "90d") return { key: value, days: 90 };
  return undefined;
}

export function featureKeyForLegacyAction(action: string): FeatureKey | undefined {
  if (action.startsWith("export-")) return "exports";
  if (action === "app-detail") return "library";
  if (action.startsWith("research_project_")) return "research";
  return undefined;
}
```

Extend `recordAccessEvent` in `src/pricingStore.ts`:

```ts
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
    [input.userId ?? null, input.sessionHash ?? null, input.ipPrefix ?? null,
     input.appSlug ?? null, input.featureKey ?? null, input.action,
     input.volume ?? 1, input.outcome, input.metadata ?? {}],
  );
}
```

Import `FeatureKey` and `isFeatureKey` from `featureUsage.ts`.

- [ ] **Step 4: Run the migration and focused tests**

Run:

```bash
npm run migrate
node --experimental-strip-types --test src/featureUsage.test.ts src/pricingStore.test.ts
```

Expected: taxonomy tests pass; PostgreSQL tests either pass or report the existing explicit database-unavailable skip.

- [ ] **Step 5: Commit the event model**

```bash
git add migrations/0010_feature_usage.sql src/featureUsage.ts src/featureUsage.test.ts src/pricingStore.ts src/pricingStore.test.ts
git commit -m "feat: add stable feature usage events"
```

### Task 2: Add cursor-paginated admin user queries

**Files:**
- Create: `src/adminUsers.ts`
- Create: `src/adminUsers.test.ts`
- Modify: `src/adminStats.ts:1-20`

- [ ] **Step 1: Write failing pagination tests**

Use the repository's PostgreSQL skip pattern in `src/adminUsers.test.ts`. Seed 35 users with deterministic timestamps and assert:

```ts
test("paginates users in stable newest-first order", { skip }, async () => {
  const first = await listAdminUsersPage({ limit: 30, filter: "all" });
  assert.equal(first.users.length, 30);
  assert.equal(first.total, 35);
  assert.ok(first.nextCursor);

  const second = await listAdminUsersPage({ limit: 30, cursor: first.nextCursor!, filter: "all" });
  assert.equal(second.users.length, 5);
  assert.equal(second.nextCursor, null);
  assert.equal(new Set([...first.users, ...second.users].map((user) => user.id)).size, 35);
});

test("applies email search and role, plan, and disabled filters before counting", { skip }, async () => {
  assert.equal((await listAdminUsersPage({ query: "pro@", filter: "pro" })).total, 1);
  assert.equal((await listAdminUsersPage({ filter: "admin" })).users.every((user) => user.role === "admin"), true);
  assert.equal((await listAdminUsersPage({ filter: "disabled" })).users.every((user) => !user.active), true);
});

test("rejects malformed cursors", () => {
  assert.throws(() => decodeAdminUserCursor("not-a-cursor"), /Invalid user cursor/);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
node --experimental-strip-types --test src/adminUsers.test.ts
```

Expected: FAIL because `adminUsers.ts` does not exist.

- [ ] **Step 3: Implement the directory store**

Create `src/adminUsers.ts` with these public contracts:

```ts
import { pool, query } from "./db.ts";

export type AdminUserFilter = "all" | "admin" | "pro" | "free" | "disabled";
export const ADMIN_USER_FILTERS = new Set<AdminUserFilter>(["all", "admin", "pro", "free", "disabled"]);

export interface AdminUserRow {
  id: number;
  email: string;
  role: "admin" | "user";
  active: boolean;
  created_at: string;
  subscription_status: string | null;
}

interface UserCursor { createdAt: string; id: number }

export function encodeAdminUserCursor(cursor: UserCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeAdminUserCursor(value: string): UserCursor {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (typeof parsed.createdAt !== "string" || !Number.isInteger(parsed.id) || parsed.id < 1) throw new Error();
    if (Number.isNaN(new Date(parsed.createdAt).getTime())) throw new Error();
    return parsed;
  } catch {
    throw new Error("Invalid user cursor");
  }
}

export async function listAdminUsersPage(input: {
  limit?: number;
  cursor?: string;
  query?: string;
  filter?: AdminUserFilter;
}): Promise<{ users: AdminUserRow[]; nextCursor: string | null; total: number }> {
  const limit = Math.min(Math.max(Math.floor(input.limit ?? 30), 1), 50);
  const filter = input.filter ?? "all";
  const cursor = input.cursor ? decodeAdminUserCursor(input.cursor) : undefined;
  const email = input.query?.trim() || null;
  const values = [email, filter, cursor?.createdAt ?? null, cursor?.id ?? null, limit + 1];
  const predicates = `
    ($1::text IS NULL OR u.email ILIKE '%' || $1 || '%')
    AND ($2 = 'all'
      OR ($2 = 'admin' AND u.role = 'admin')
      OR ($2 = 'pro' AND s.status = 'active')
      OR ($2 = 'free' AND s.status IS DISTINCT FROM 'active')
      OR ($2 = 'disabled' AND u.active = false))`;
  const rows = await query<AdminUserRow>(
    `SELECT u.id, u.email, u.role, u.active, u.created_at, s.status AS subscription_status
     FROM users u LEFT JOIN subscriptions s ON s.user_id = u.id
     WHERE ${predicates}
       AND ($3::timestamptz IS NULL OR (u.created_at, u.id) < ($3::timestamptz, $4::int))
     ORDER BY u.created_at DESC, u.id DESC LIMIT $5`, values,
  );
  const count = await query<{ total: number }>(
    `SELECT count(*)::int AS total FROM users u
     LEFT JOIN subscriptions s ON s.user_id = u.id WHERE ${predicates}`,
    values.slice(0, 2),
  );
  const users = rows.rows.slice(0, limit);
  const last = users.at(-1);
  return {
    users,
    total: count.rows[0]?.total ?? 0,
    nextCursor: rows.rows.length > limit && last
      ? encodeAdminUserCursor({ createdAt: last.created_at, id: last.id })
      : null,
  };
}
```

Remove `AdminUserRow` and `listUsersForAdmin` from `adminStats.ts`; it remains responsible only for growth statistics.

- [ ] **Step 4: Run directory tests**

Run:

```bash
node --experimental-strip-types --test src/adminUsers.test.ts
```

Expected: PASS or explicit PostgreSQL skip, with the cursor-codec test always passing.

- [ ] **Step 5: Commit pagination**

```bash
git add src/adminUsers.ts src/adminUsers.test.ts src/adminStats.ts
git commit -m "feat: paginate admin users"
```

### Task 3: Add safe enable and disable mutations

**Files:**
- Modify: `src/adminUsers.ts`
- Modify: `src/adminUsers.test.ts`

- [ ] **Step 1: Write failing account-state tests**

Add PostgreSQL-backed tests for enable, disable, session revocation, self-protection, and last-admin protection:

```ts
test("disables an account and revokes its sessions atomically", { skip }, async () => {
  const result = await setAdminUserActive({ actorUserId: adminId, userId, active: false });
  assert.equal(result.status, "updated");
  assert.equal(result.user?.active, false);
  const sessions = await db.query("SELECT revoked_at, revoked_reason FROM sessions WHERE user_id = $1", [userId]);
  assert.ok(sessions.rows[0].revoked_at);
  assert.equal(sessions.rows[0].revoked_reason, "account_disabled");
});

test("does not allow an administrator to disable itself", { skip }, async () => {
  assert.deepEqual(await setAdminUserActive({ actorUserId: adminId, userId: adminId, active: false }), {
    status: "forbidden", reason: "self_disable",
  });
});

test("does not disable the last active administrator", { skip }, async () => {
  assert.deepEqual(await setAdminUserActive({ actorUserId: secondAdminId, userId: adminId, active: false }), {
    status: "forbidden", reason: "last_active_admin",
  });
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
node --experimental-strip-types --test src/adminUsers.test.ts
```

Expected: FAIL because `setAdminUserActive` is missing.

- [ ] **Step 3: Implement the transaction**

Add to `src/adminUsers.ts`:

```ts
export type SetAdminUserActiveResult =
  | { status: "updated"; user: AdminUserRow }
  | { status: "not_found" }
  | { status: "forbidden"; reason: "self_disable" | "last_active_admin" };

export async function setAdminUserActive(input: {
  actorUserId: number;
  userId: number;
  active: boolean;
}): Promise<SetAdminUserActiveResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const target = await client.query<AdminUserRow>(
      `SELECT u.id, u.email, u.role, u.active, u.created_at, s.status AS subscription_status
       FROM users u LEFT JOIN subscriptions s ON s.user_id = u.id
       WHERE u.id = $1 FOR UPDATE OF u`, [input.userId],
    );
    const user = target.rows[0];
    if (!user) { await client.query("ROLLBACK"); return { status: "not_found" }; }
    if (!input.active && input.actorUserId === input.userId) {
      await client.query("ROLLBACK"); return { status: "forbidden", reason: "self_disable" };
    }
    if (!input.active && user.role === "admin" && user.active) {
      const activeAdmins = await client.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM users WHERE role = 'admin' AND active = true",
      );
      if ((activeAdmins.rows[0]?.count ?? 0) <= 1) {
        await client.query("ROLLBACK"); return { status: "forbidden", reason: "last_active_admin" };
      }
    }
    const updated = await client.query<AdminUserRow>(
      `UPDATE users SET active = $2, updated_at = now() WHERE id = $1
       RETURNING id, email, role, active, created_at,
         (SELECT status FROM subscriptions WHERE user_id = users.id) AS subscription_status`,
      [input.userId, input.active],
    );
    if (!input.active) {
      await client.query(
        `UPDATE sessions SET revoked_at = now(), revoked_reason = 'account_disabled'
         WHERE user_id = $1 AND revoked_at IS NULL`, [input.userId],
      );
    }
    await client.query("COMMIT");
    return { status: "updated", user: updated.rows[0] };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
```

- [ ] **Step 4: Run the account-state tests**

Run:

```bash
node --experimental-strip-types --test src/adminUsers.test.ts
```

Expected: PASS or explicit PostgreSQL skip.

- [ ] **Step 5: Commit account state management**

```bash
git add src/adminUsers.ts src/adminUsers.test.ts
git commit -m "feat: manage admin user status safely"
```

### Task 4: Add global and per-user usage aggregates

**Files:**
- Modify: `src/featureUsage.ts`
- Modify: `src/featureUsage.test.ts`

- [ ] **Step 1: Write failing aggregate tests**

Seed member and admin events across the date boundary and assert:

```ts
test("aggregates member feature usage and excludes administrators", { skip }, async () => {
  const result = await getFeatureUsageOverview({ key: "30d", days: 30 });
  assert.deepEqual(result.summary, { totalEvents: 5, uniqueUsers: 2, usedFeatures: 2 });
  assert.deepEqual(result.features[0], {
    key: "exports", label: "Exports", uses: 3, uniqueUsers: 2, share: 60,
  });
  assert.equal(result.daily.length, 30);
});

test("returns one user's breakdown and recent activity", { skip }, async () => {
  const result = await getUserFeatureUsage(userId, { key: "30d", days: 30 });
  assert.equal(result?.summary.totalEvents, 3);
  assert.ok(result?.summary.lastActiveAt);
  assert.equal(result?.features[0].key, "exports");
  assert.equal(result?.recentEvents[0].featureLabel, "Exports");
});
```

Include one historical `export-figma` row with `feature_key IS NULL` and one `protected-request` row; only the export is mapped.

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
node --experimental-strip-types --test src/featureUsage.test.ts
```

Expected: FAIL because aggregate functions are missing.

- [ ] **Step 3: Implement aggregate types and queries**

Add these contracts to `src/featureUsage.ts`:

```ts
export interface FeatureUsageRow {
  key: FeatureKey;
  label: string;
  uses: number;
  uniqueUsers: number;
  share: number;
}

export interface FeatureUsageOverview {
  summary: { totalEvents: number; uniqueUsers: number; usedFeatures: number };
  features: FeatureUsageRow[];
  daily: Array<{ day: string; uses: number }>;
}

export interface UserFeatureUsage {
  summary: { totalEvents: number; lastActiveAt: string | null };
  features: FeatureUsageRow[];
  recentEvents: Array<{
    id: number; featureKey: FeatureKey; featureLabel: string;
    action: string; outcome: string; appSlug: string | null; createdAt: string;
  }>;
}
```

Implement `normalizedFeatureSql` once and reuse it in both queries:

```ts
const normalizedFeatureSql = `COALESCE(
  ae.feature_key,
  CASE
    WHEN ae.action LIKE 'export-%' THEN 'exports'
    WHEN ae.action = 'app-detail' THEN 'library'
    WHEN ae.action LIKE 'research_project_%' THEN 'research'
    ELSE NULL
  END
)`;
```

`getFeatureUsageOverview(range)` must:

1. join `access_events` to `users`;
2. require `users.role = 'user'`, `outcome IN ('success','created','accepted','completed')`, and the range boundary;
3. group by the normalized non-null feature;
4. count `sum(volume)` and distinct users;
5. calculate share from the total in TypeScript;
6. use `generate_series` for a complete daily series.

`getUserFeatureUsage(userId, range)` must first verify the user exists, then return the same per-feature aggregate plus the newest 20 normalized events.

- [ ] **Step 4: Run aggregate tests**

Run:

```bash
node --experimental-strip-types --test src/featureUsage.test.ts
```

Expected: PASS or explicit PostgreSQL skip.

- [ ] **Step 5: Commit analytics queries**

```bash
git add src/featureUsage.ts src/featureUsage.test.ts
git commit -m "feat: aggregate feature usage analytics"
```

### Task 5: Expose the admin directory and analytics APIs

**Files:**
- Modify: `services/api/src/app.ts:50,294-310,377-388,2009-2020`
- Modify: `services/api/src/app.test.ts:1545-1590`

- [ ] **Step 1: Write failing API contract tests**

Replace the old array assertion with paginated payload coverage and add status and analytics routes:

```ts
test("returns a paginated filtered user directory for an admin", async (t) => {
  let request: unknown;
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => admin,
    listAdminUsersPage: async (input) => {
      request = input;
      return { users: [userRow], nextCursor: "next", total: 42 };
    },
  }));
  t.after(() => close(server));
  const response = await fetch(`${base}/users?limit=30&q=pro&filter=pro`, { headers: adminCookie });
  assert.equal(response.status, 200);
  assert.deepEqual(request, { limit: 30, cursor: undefined, query: "pro", filter: "pro" });
  assert.deepEqual(await response.json(), { users: [userRow], nextCursor: "next", total: 42 });
});

test("updates account state and maps safety errors", async (t) => {
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => admin,
    setAdminUserActive: async () => ({ status: "forbidden", reason: "self_disable" }),
  }));
  t.after(() => close(server));
  const response = await fetch(`${base}/users/${admin.id}/active`, {
    method: "PATCH", headers: { ...adminCookie, "content-type": "application/json" },
    body: JSON.stringify({ active: false }),
  });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "You cannot disable your own account", code: "self_disable" });
});

test("returns global and per-user usage for supported ranges", async (t) => {
  const overview = {
    summary: { totalEvents: 3, uniqueUsers: 1, usedFeatures: 1 },
    features: [{ key: "exports", label: "Exports", uses: 3, uniqueUsers: 1, share: 100 }],
    daily: [{ day: "2026-07-19", uses: 3 }],
  };
  const detail = {
    summary: { totalEvents: 3, lastActiveAt: "2026-07-19T08:00:00.000Z" },
    features: overview.features,
    recentEvents: [],
  };
  const requested: unknown[] = [];
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => admin,
    getFeatureUsageOverview: async (range) => { requested.push(["global", range]); return overview; },
    getUserFeatureUsage: async (userId, range) => { requested.push(["user", userId, range]); return detail; },
  }));
  t.after(() => close(server));

  const global = await fetch(`${base}/users/usage?range=30d`, { headers: adminCookie });
  assert.equal(global.status, 200);
  assert.deepEqual(await global.json(), overview);

  const perUser = await fetch(`${base}/users/2/usage?range=7d`, { headers: adminCookie });
  assert.equal(perUser.status, 200);
  assert.deepEqual(await perUser.json(), detail);
  assert.deepEqual(requested, [
    ["global", { key: "30d", days: 30 }],
    ["user", 2, { key: "7d", days: 7 }],
  ]);
});

test("validates analytics ranges and missing users", async (t) => {
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => admin,
    getUserFeatureUsage: async () => undefined,
  }));
  t.after(() => close(server));
  assert.equal((await fetch(`${base}/users/usage?range=365d`, { headers: adminCookie })).status, 400);
  assert.equal((await fetch(`${base}/users/999/usage?range=30d`, { headers: adminCookie })).status, 404);
});
```

Also assert non-admin access is `403`, malformed cursors and ranges are `400`, and unknown per-user usage is `404`.

- [ ] **Step 2: Run the API tests and verify RED**

Run:

```bash
node --experimental-strip-types --test services/api/src/app.test.ts
```

Expected: FAIL because the new dependency names and routes do not exist.

- [ ] **Step 3: Wire dependencies and routes**

Import `listAdminUsersPage`, `setAdminUserActive`, `ADMIN_USER_FILTERS`, `getFeatureUsageOverview`, `getUserFeatureUsage`, and `parseUsageRange`; add them to `defaults`.

Replace the old users route with:

```ts
app.get("/users", requireAdmin, async (req, res) => {
  const limit = req.query.limit === undefined ? 30 : Number(req.query.limit);
  const filter = req.query.filter === undefined ? "all" : String(req.query.filter);
  if (!Number.isInteger(limit) || !ADMIN_USER_FILTERS.has(filter as AdminUserFilter)) {
    res.status(400).json({ error: "invalid user directory query" }); return;
  }
  try {
    res.json(await deps.listAdminUsersPage({
      limit, cursor: optionalQuery(req.query.cursor), query: optionalQuery(req.query.q),
      filter: filter as AdminUserFilter,
    }));
  } catch (error) {
    if ((error as Error).message === "Invalid user cursor") {
      res.status(400).json({ error: "invalid user cursor" }); return;
    }
    throw error;
  }
});

app.patch("/users/:id/active", requireAdmin, async (req, res) => {
  const userId = positiveId(req.params.id);
  if (!userId || typeof req.body?.active !== "boolean") {
    res.status(400).json({ error: "invalid account state request" }); return;
  }
  const result = await deps.setAdminUserActive({ actorUserId: res.locals.user.id, userId, active: req.body.active });
  if (result.status === "not_found") { res.status(404).json({ error: "user not found" }); return; }
  if (result.status === "forbidden") {
    const error = result.reason === "self_disable"
      ? "You cannot disable your own account" : "The last active administrator cannot be disabled";
    res.status(403).json({ error, code: result.reason }); return;
  }
  res.json(result.user);
});
```

Add `/users/usage` before `/users/:id/usage` and parse the range through `parseUsageRange`. Return `400` for unsupported ranges and `404` when `getUserFeatureUsage` returns `undefined`.

- [ ] **Step 4: Run API tests**

Run:

```bash
node --experimental-strip-types --test services/api/src/app.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit API contracts**

```bash
git add services/api/src/app.ts services/api/src/app.test.ts
git commit -m "feat: expose admin user analytics APIs"
```

### Task 6: Instrument meaningful product features

**Files:**
- Modify: `services/api/src/app.ts`
- Modify: `services/api/src/app.test.ts`
- Modify: `services/api/src/researchProjects.ts`
- Modify: `services/api/src/researchProjects.test.ts`

- [ ] **Step 1: Write failing feature-attribution tests**

In API tests, collect `recordAccessEvent` inputs and exercise one successful request for each existing route seam. Assert stable keys rather than only action strings:

```ts
assert.deepEqual(events.map(({ featureKey, action }) => ({ featureKey, action })), [
  { featureKey: "library", action: "app-detail" },
  { featureKey: "exports", action: "export-reservation" },
]);
```

Add focused tests for catalog search (`search`), collection creation/item mutation (`collections`), design-system view/export (`design_systems`), flow document view (`flows`), and research-project creation/update (`research`). Verify failed requests do not record successful usage.

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
node --experimental-strip-types --test services/api/src/app.test.ts services/api/src/researchProjects.test.ts
```

Expected: FAIL because events lack stable feature keys.

- [ ] **Step 3: Add feature keys after successful operations**

Update existing calls:

```ts
await deps.recordAccessEvent({
  userId: res.locals.user.id,
  appSlug,
  featureKey: "library",
  action: "app-detail",
  outcome: "success",
});
```

Add these exact event writes immediately after the corresponding operation succeeds:

```ts
await deps.recordAccessEvent({ userId: res.locals.user.id, featureKey: "search", action: "catalog-search", outcome: "success" });
await deps.recordAccessEvent({ userId: res.locals.user.id, featureKey: "collections", action: "collection-created", outcome: "created" });
await deps.recordAccessEvent({ userId: res.locals.user.id, featureKey: "collections", action: "collection-item-added", outcome: "created" });
await deps.recordAccessEvent({ userId: res.locals.user.id, featureKey: "collections", action: "collection-item-removed", outcome: "success" });
await deps.recordAccessEvent({ userId: res.locals.user.id, appSlug, featureKey: "exports", action: "export-reservation", outcome: "accepted", metadata: { format } });
await deps.recordAccessEvent({ userId: res.locals.user.id, appSlug, featureKey: "design_systems", action: "design-system-view", outcome: "success" });
await deps.recordAccessEvent({ userId: res.locals.user.id, appSlug, featureKey: "design_systems", action: "design-system-export", outcome: "accepted", metadata: { format } });
await deps.recordAccessEvent({ userId: res.locals.user.id, appSlug, featureKey: "flows", action: "flow-document-view", outcome: "success" });
await deps.recordAccessEvent({ userId: res.locals.user.id, featureKey: "research", action: "research_project_created", outcome: "created" });
await deps.recordAccessEvent({ userId: res.locals.user.id, featureKey: "ai_analysis", action: "research_synthesis_created", outcome: "created" });
```

Place the calls only on the success branches for these route seams:

- catalog response → `featureKey: "search"`, `action: "catalog-search"`;
- collection create/add/remove → `featureKey: "collections"`;
- export reservation/completion → `featureKey: "exports"`;
- design-system read/export → `featureKey: "design_systems"`;
- flow-document read → `featureKey: "flows"`;
- research project create/material update → `featureKey: "research"`.
- successful research synthesis → `featureKey: "ai_analysis"`.

Do not place query text, notes, prompts, or document bodies in metadata. Allowed metadata is bounded categorical data such as export format, entity kind, or platform.

Change the research route dependency to:

```ts
recordEvent?(input: {
  userId: number;
  featureKey: FeatureKey;
  action: string;
  outcome: string;
  volume?: number;
}): Promise<void>;
```

- [ ] **Step 4: Run instrumentation tests**

Run:

```bash
node --experimental-strip-types --test services/api/src/app.test.ts services/api/src/researchProjects.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit instrumentation**

```bash
git add services/api/src/app.ts services/api/src/app.test.ts services/api/src/researchProjects.ts services/api/src/researchProjects.test.ts
git commit -m "feat: track meaningful product usage"
```

### Task 7: Add frontend directory and analytics clients

**Files:**
- Modify: `src/vitrine/types.ts:83-105`
- Create: `src/vitrine/usersApi.ts`
- Create: `src/vitrine/usersApi.test.ts`
- Create: `src/vitrine/usersDirectoryModel.ts`
- Create: `src/vitrine/usersDirectoryModel.test.ts`
- Create: `src/vitrine/useUsersDirectory.ts`
- Create: `src/vitrine/useUsersInsights.ts`
- Modify: `src/vitrine/useUsersGrowth.ts`

- [ ] **Step 1: Write failing client and page-model tests**

Test URL construction with a stubbed `fetch` and page deduplication:

```ts
test("requests a cursor page with encoded query and filter", async () => {
  let requested = "";
  await fetchAdminUsersPage(
    { limit: 30, cursor: "abc", query: "a+b@example.com", filter: "pro" },
    async (input) => { requested = String(input); return Response.json({ users: [], nextCursor: null, total: 0 }); },
  );
  assert.equal(requested, "/api/users?limit=30&cursor=abc&q=a%2Bb%40example.com&filter=pro");
});

test("merges cursor pages without duplicate users", () => {
  assert.deepEqual(mergeUserPages([{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 3 }]).map(({ id }) => id), [1, 2, 3]);
});
```

Also test that non-OK responses use the API error body and that a changed query key starts from an empty page.

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
node --experimental-strip-types --test src/vitrine/usersApi.test.ts src/vitrine/usersDirectoryModel.test.ts
```

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Add shared view types and API functions**

Add to `src/vitrine/types.ts`:

```ts
export type UserFilter = "all" | "admin" | "pro" | "free" | "disabled";
export type UsageRangeKey = "7d" | "30d" | "90d";
export interface AdminUsersPage { users: AdminUser[]; nextCursor: string | null; total: number }
export interface FeatureUsageRow { key: string; label: string; uses: number; uniqueUsers: number; share: number }
export interface FeatureUsageOverview {
  summary: { totalEvents: number; uniqueUsers: number; usedFeatures: number };
  features: FeatureUsageRow[];
  daily: Array<{ day: string; uses: number }>;
}
export interface UserFeatureUsage {
  summary: { totalEvents: number; lastActiveAt: string | null };
  features: FeatureUsageRow[];
  recentEvents: Array<{ id: number; featureKey: string; featureLabel: string; action: string; outcome: string; appSlug: string | null; createdAt: string }>;
}
```

Implement `usersApi.ts` with the complete request helper and functions:

```ts
import type {
  AdminUser, AdminUsersPage, FeatureUsageOverview, GrowthStats,
  DailySignupPoint, UsageRangeKey, UserFeatureUsage, UserFilter,
} from "./types.ts";

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export interface DirectoryRequest { limit: number; cursor?: string; query?: string; filter: UserFilter }
export interface GrowthResponse { stats: GrowthStats; dailySignups: DailySignupPoint[] }

async function apiJson<T>(response: Response): Promise<T> {
  if (response.ok) return response.json() as Promise<T>;
  const body = await response.json().catch(() => ({})) as { error?: string };
  throw new Error(body.error ?? `Request failed with ${response.status}`);
}

export async function fetchAdminUsersPage(input: DirectoryRequest, fetcher: Fetcher = fetch): Promise<AdminUsersPage> {
  const params = new URLSearchParams({ limit: String(input.limit) });
  if (input.cursor) params.set("cursor", input.cursor);
  if (input.query) params.set("q", input.query);
  params.set("filter", input.filter);
  return apiJson<AdminUsersPage>(await fetcher(`/api/users?${params}`));
}

export async function setAdminUserActive(userId: number, active: boolean, fetcher: Fetcher = fetch): Promise<AdminUser> {
  return apiJson<AdminUser>(await fetcher(`/api/users/${userId}/active`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ active }),
  }));
}

export async function fetchGrowth(fetcher: Fetcher = fetch): Promise<GrowthResponse> {
  return apiJson<GrowthResponse>(await fetcher("/api/users/growth"));
}

export async function fetchFeatureUsage(range: UsageRangeKey, fetcher: Fetcher = fetch): Promise<FeatureUsageOverview> {
  return apiJson<FeatureUsageOverview>(await fetcher(`/api/users/usage?range=${range}`));
}

export async function fetchUserFeatureUsage(userId: number, range: UsageRangeKey, fetcher: Fetcher = fetch): Promise<UserFeatureUsage> {
  return apiJson<UserFeatureUsage>(await fetcher(`/api/users/${userId}/usage?range=${range}`));
}
```

`apiJson` must parse `{ error }` from non-OK responses and throw that message.

- [ ] **Step 4: Implement hooks with stale-request protection**

`useUsersDirectory` owns `query`, `filter`, `users`, `total`, `nextCursor`, loading/error state, and exposes `loadMore`, `retry`, and `changeActive`. Debounce the query by 250 ms, increment a request generation whenever query/filter changes, abort the prior first-page request, and ignore page responses from older generations.

`useUsersInsights` independently loads growth and usage, exposes `insight`, `range`, setters, retry methods, and selected-user usage. It must not block directory rendering when analytics fails.

Reduce `useUsersGrowth.ts` to a compatibility re-export or remove it after all call sites move; do not keep two competing fetch paths.

- [ ] **Step 5: Run frontend model tests**

Run:

```bash
node --experimental-strip-types --test src/vitrine/usersApi.test.ts src/vitrine/usersDirectoryModel.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit frontend data flow**

```bash
git add src/vitrine/types.ts src/vitrine/usersApi.ts src/vitrine/usersApi.test.ts src/vitrine/usersDirectoryModel.ts src/vitrine/usersDirectoryModel.test.ts src/vitrine/useUsersDirectory.ts src/vitrine/useUsersInsights.ts src/vitrine/useUsersGrowth.ts
git commit -m "feat: add paginated users data flow"
```

### Task 8: Build the unified infinite-scroll directory and account actions

**Files:**
- Create: `src/vitrine/components/UserDirectory.tsx`
- Modify: `src/vitrine/components/UsersPage.tsx`
- Modify: `src/vitrine/components/UsersPage.test.tsx`
- Modify: `src/vitrine/usersPageModel.ts`
- Modify: `src/vitrine/usersPageModel.test.ts`

- [ ] **Step 1: Write the failing unified-list component test**

Update `UsersPage.test.tsx` so the rendered directory asserts one list, no group headings, and per-row actions:

```ts
assert.equal((html.match(/<ul/g) ?? []).length, 1);
assert.doesNotMatch(html, /admin-users-group|Administrators ·|Members ·/);
assert.match(html, /Actions for admin@gmail\.com/);
assert.match(html, /Actions for pro@example\.com/);
assert.match(html, /Load more users/);
```

Replace the old `groupAdminUsers` test with a test proving `filterAdminUsers` preserves the server order and `userPlanLabel` remains deterministic.

- [ ] **Step 2: Run the component tests and verify RED**

Run:

```bash
node --experimental-strip-types --test src/vitrine/usersPageModel.test.ts
npx tsx --test src/vitrine/components/UsersPage.test.tsx
```

Expected: FAIL because the current page renders grouped sections and has no actions or load-more control.

- [ ] **Step 3: Implement `UserDirectory`**

Build the focused component with this prop boundary:

```ts
interface UserDirectoryProps {
  users: AdminUser[];
  total: number;
  query: string;
  filter: UserFilter;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  pendingUserId: number | null;
  onQueryChange(value: string): void;
  onFilterChange(value: UserFilter): void;
  onLoadMore(): void;
  onRetry(): void;
  onChangeActive(user: AdminUser, active: boolean): Promise<void>;
  onOpenUsage(user: AdminUser): void;
}
```

Render one `<ul>` and one `MemberRow` per user. The identity is a design-system `Button` with a ghost treatment that calls `onOpenUsage`. The menu is:

```tsx
<DropdownMenu
  button={{ label: `Actions for ${user.email}`, isIconOnly: true, icon: <Icon icon="more-horizontal" />, size: "sm", variant: "ghost", isDisabled: pending }}
  items={[{
    label: user.active ? "Disable account" : "Enable account",
    onClick: () => user.active ? setConfirmUser(user) : void onChangeActive(user, true),
    isDisabled: pending,
  }]}
/>
```

Use Astryx `Dialog` for disable confirmation. Name the user email, call `onChangeActive(user, false)` only from the destructive confirmation button, and restore the menu state after completion.

Attach one `IntersectionObserver` to the footer sentinel. If `hasMore && !loadingMore`, call `onLoadMore`; always keep a visible design-system `Load more users` button when more pages exist.

- [ ] **Step 4: Compose the page**

`UsersPage.tsx` calls `useUsersDirectory` and `useUsersInsights`, renders `UserDirectory` in the left column, and stops importing `groupAdminUsers`. The header count uses `directory.total`; loaded-count copy uses `users.length`.

- [ ] **Step 5: Run unified-directory tests**

Run:

```bash
node --experimental-strip-types --test src/vitrine/usersPageModel.test.ts src/vitrine/astryxComponentCompliance.test.ts
npx tsx --test src/vitrine/components/UsersPage.test.tsx
```

Expected: PASS, including zero production native interactive controls.

- [ ] **Step 6: Commit the unified directory**

```bash
git add src/vitrine/components/UserDirectory.tsx src/vitrine/components/UsersPage.tsx src/vitrine/components/UsersPage.test.tsx src/vitrine/usersPageModel.ts src/vitrine/usersPageModel.test.ts
git commit -m "feat: unify admin user directory"
```

### Task 9: Build global insights and per-user drill-down

**Files:**
- Create: `src/vitrine/components/UserUsageInsights.tsx`
- Create: `src/vitrine/components/UserUsageDialog.tsx`
- Modify: `src/vitrine/components/UsersPage.tsx`
- Modify: `src/vitrine/components/UsersPage.test.tsx`

- [ ] **Step 1: Write failing insights tests**

Render the page with usage fixtures and assert:

```ts
assert.match(html, /Feature usage/);
assert.match(html, /Growth/);
assert.match(html, /Last 30 days/);
assert.match(html, /Unique users/);
assert.match(html, /Exports/);
assert.match(html, /60%/);
```

Render `UserUsageDialog` open and assert the email, last-active copy, ranked feature, and recent event are present; assert no event metadata or content body is rendered.

- [ ] **Step 2: Run component tests and verify RED**

Run:

```bash
npx tsx --test src/vitrine/components/UsersPage.test.tsx
```

Expected: FAIL because insights and dialog components do not exist.

- [ ] **Step 3: Implement `UserUsageInsights`**

Use Astryx segmented controls:

```tsx
<SegmentedControl value={view} onChange={(value) => onViewChange(value as InsightView)} label="User insights" layout="fill" size="sm">
  <SegmentedControlItem value="usage" label="Feature usage" />
  <SegmentedControlItem value="growth" label="Growth" />
</SegmentedControl>
```

In usage view, render a second segmented control for `7d`, `30d`, and `90d`, summary metrics, a Recharts daily bar chart, and ranked feature rows. In growth view, move the current `GrowthPulse` chart and metrics unchanged. Keep independent loading, empty, error, and retry states.

- [ ] **Step 4: Implement `UserUsageDialog`**

Use Astryx `Dialog` with `purpose="info"`, `width={420}`, `maxHeight="100vh"`, and `position={{ top: 0, right: 0, bottom: 0 }}`. Render the selected account summary, per-feature rows, and 20 recent events. Close on Escape/backdrop and call `onClose` through `onOpenChange`.

The component boundary is:

```ts
interface UserUsageDialogProps {
  user: AdminUser | null;
  range: UsageRangeKey;
  usage: UserFeatureUsage | null;
  loading: boolean;
  error: string | null;
  onClose(): void;
  onRetry(): void;
}
```

- [ ] **Step 5: Run insights tests**

Run:

```bash
npx tsx --test src/vitrine/components/UsersPage.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit analytics UI**

```bash
git add src/vitrine/components/UserUsageInsights.tsx src/vitrine/components/UserUsageDialog.tsx src/vitrine/components/UsersPage.tsx src/vitrine/components/UsersPage.test.tsx
git commit -m "feat: show admin usage insights"
```

### Task 10: Polish responsive states and complete verification

**Files:**
- Modify: `src/vitrine/styles.css:221-660`
- Modify: `src/vitrine/components/UsersPage.test.tsx`
- Modify: `design-qa.md`
- Modify: `docs/superpowers/specs/assets/2026-07-19-admin-users-implementation.png`
- Modify: `docs/superpowers/specs/assets/2026-07-19-admin-users-comparison.png`

- [ ] **Step 1: Add failing CSS contract assertions**

Assert the unified list footer, actions column, insights switcher, and drawer/mobile rules exist:

```ts
assert.match(css, /\.admin-users-member-row\s*\{[^}]*grid-template-columns:[^;]*auto;/s);
assert.match(css, /\.admin-users-list-footer\s*\{[^}]*justify-content:\s*center;/s);
assert.match(css, /\.admin-users-usage-dialog\s*\{[^}]*height:\s*100vh;/s);
assert.match(css, /@media \(max-width:\s*640px\)[\s\S]*?\.admin-users-member-actions/);
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx tsx --test src/vitrine/components/UsersPage.test.tsx
```

Expected: FAIL because the new scoped style hooks are absent.

- [ ] **Step 3: Implement scoped styles**

Remove `.admin-users-groups` and `.admin-users-group` rules. Add:

- a single list top rule and 82 px row rhythm;
- a fourth actions column on desktop;
- a centered list footer with live-region copy;
- compact insights segmented controls and ranked-feature bars;
- a full-height right-positioned usage dialog surface;
- mobile wrapping that keeps identity, badges, status, and actions visible without horizontal overflow;
- `prefers-reduced-motion` coverage for drawer and loading transitions.

Use only existing Astryx color, border, radius, spacing, and typography tokens; do not add gradients, handcrafted SVGs, or emoji.

- [ ] **Step 4: Run focused tests and build**

Run:

```bash
node --experimental-strip-types --test src/adminUsers.test.ts src/featureUsage.test.ts src/vitrine/usersApi.test.ts src/vitrine/usersDirectoryModel.test.ts src/vitrine/usersPageModel.test.ts src/vitrine/astryxComponentCompliance.test.ts services/api/src/app.test.ts services/api/src/researchProjects.test.ts
npx tsx --test src/vitrine/components/UsersPage.test.tsx
npm run build
```

Expected: all focused tests pass; Vite exits 0. The existing large-chunk warning is non-blocking.

- [ ] **Step 5: Verify the live page in the in-app Browser**

Run the local API and Vite app, sign in as an administrator, and verify:

1. one continuous user list with no group headings;
2. search and every filter reset to the first page;
3. sentinel and `Load more users` append without duplicate rows;
4. disable confirmation names the account and updates status after success;
5. self-disable and last-admin errors are displayed without changing the row;
6. Feature usage range changes update summary, chart, and ranking;
7. clicking a user identity opens the activity dialog and Escape restores focus;
8. 1440 × 1024 and 390 × 844 have no horizontal overflow;
9. browser console has zero errors.

Capture the same 1440 × 1024 state as the implementation screenshot, rebuild the side-by-side comparison with the selected design source, inspect it at native resolution, and record all P0–P3 findings and fixes in `design-qa.md`.

- [ ] **Step 6: Run the complete verification gate**

Run:

```bash
npm test
npm run build
git diff --check
git status --short
```

Expected: complete test suite exits 0, build exits 0, diff check is empty, and status contains only this feature's intended files.

- [ ] **Step 7: Commit final polish and QA evidence**

```bash
git add src/vitrine/styles.css src/vitrine/components/UsersPage.test.tsx design-qa.md docs/superpowers/specs/assets/2026-07-19-admin-users-implementation.png docs/superpowers/specs/assets/2026-07-19-admin-users-comparison.png
git commit -m "style: polish admin user analytics"
```

## Completion checklist

- [ ] One continuous user list replaces administrator/member groups.
- [ ] Search and all filters use the cursor API and reset paging correctly.
- [ ] Infinite scroll and accessible Load more fallback work without duplicates.
- [ ] Actions contains only Enable or Disable.
- [ ] Disable revokes sessions and protects the current/last administrator.
- [ ] Stable server-side events cover the initial feature taxonomy without content capture.
- [ ] Global usage excludes administrator activity and supports 7/30/90-day ranges.
- [ ] Per-user activity opens from identity interaction, not from the Actions menu.
- [ ] Analytics errors never block directory management.
- [ ] Desktop/mobile browser QA, focused tests, full suite, build, and diff checks pass.
