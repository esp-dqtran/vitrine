# Unit-Only Database Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every real PostgreSQL integration test and make `npm test` run only deterministic unit tests backed by recording fakes.

**Architecture:** Add a shared recording query/client/pool helper for unit tests, enforce a source boundary that prohibits test-owned PostgreSQL runtime access, and replace database integration fixtures with dependency-injected or pool-injected unit coverage. Production APIs keep their existing live defaults; only modules that currently hard-wire `db.ts` receive narrow factory seams.

**Tech Stack:** TypeScript, Node test runner, `pg` type definitions only, existing Astryx store factories

---

## File Map

- Create `src/testSupport/recordingDatabase.ts`: reusable scripted query, transaction, client, and pool fakes.
- Create `src/unitTestBoundary.test.ts`: repository rule prohibiting real database access from tests.
- Modify `src/adminUsers.ts`, `src/authStore.ts`, `src/featureUsage.ts`, `src/pricingStore.ts`, and `src/referralStore.ts`: add dependency-injected factories while preserving live exports.
- Rewrite `src/adminUsers.test.ts`, `src/authStore.test.ts`, `src/featureUsage.test.ts`, `src/pricingStore.test.ts`, and `src/referralStore.test.ts` as unit tests.
- Rewrite `src/appKnowledgeStore.test.ts`, `src/autonomousStore.test.ts`, and `src/featureDocumentStore.test.ts` to use their existing factories with recording dependencies.
- Rewrite `src/getdesignImportStore.test.ts`, `src/searchIndexStore.test.ts`, and `src/searchStore.test.ts` to use recording pool/client fakes.
- Trim real-database cases from `src/mediaMigration.test.ts` and `src/migrations.test.ts`, retaining fake-backed orchestration coverage.
- Delete integration-only `src/crawlStore.test.ts` and `src/db.test.ts`; their production modules are SQL infrastructure without an infrastructure-free behavioral seam.
- Preserve existing mock-based tests that use only `pg` or project types.

### Task 1: Enforce the Unit-Test Boundary

**Files:**
- Create: `src/unitTestBoundary.test.ts`

- [ ] **Step 1: Write the failing boundary test**

Create `src/unitTestBoundary.test.ts`:

```ts
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

async function testFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) return testFiles(target);
    return /\.test\.tsx?$/.test(entry.name) ? [target] : [];
  }));
  return nested.flat();
}

test("unit tests never open or configure a real database", async () => {
  const files = [
    ...(await testFiles("src")),
    ...(await testFiles("services")),
    ...(await testFiles("scripts")),
  ];
  const violations: string[] = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    const checks: Array<[RegExp, string]> = [
      [/\bnew\s+pg\.(?:Client|Pool)\s*\(/, "constructs pg client/pool"],
      [/process\.env\.(?:DATABASE_URL|SEARCH_[A-Z_]*DATABASE_URL)\s*=/, "mutates database URL"],
      [/\bCREATE\s+DATABASE\b/i, "creates a database"],
      [/await\s+import\(["']\.\/db\.ts["']\)/, "imports the live database dynamically"],
    ];
    for (const [pattern, reason] of checks) {
      if (pattern.test(source)) violations.push(`${file}: ${reason}`);
    }
  }
  assert.deepEqual(violations, []);
});
```

- [ ] **Step 2: Run the boundary test and verify RED**

Run:

```bash
node --experimental-strip-types --test src/unitTestBoundary.test.ts
```

Expected: FAIL listing the current PostgreSQL-backed tests.

- [ ] **Step 3: Keep the red boundary uncommitted until the violations are removed**

Do not create a deliberately failing commit. Commit the boundary with the first
green conversion batch.

### Task 2: Add Recording Database Test Support

**Files:**
- Create: `src/testSupport/recordingDatabase.ts`
- Create: `src/testSupport/recordingDatabase.test.ts`

- [ ] **Step 1: Write failing helper tests**

Create `src/testSupport/recordingDatabase.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { createRecordingDatabase } from "./recordingDatabase.ts";

test("returns scripted rows and records SQL with parameters", async () => {
  const db = createRecordingDatabase([
    { rows: [{ id: 7 }], rowCount: 1 },
  ]);
  const result = await db.query<{ id: number }>("SELECT id FROM users WHERE id = $1", [7]);
  assert.deepEqual(result.rows, [{ id: 7 }]);
  assert.deepEqual(db.calls, [{ sql: "SELECT id FROM users WHERE id = $1", params: [7] }]);
});

test("records transaction control and releases clients", async () => {
  const db = createRecordingDatabase([]);
  const client = await db.pool.connect();
  await client.query("BEGIN");
  await client.query("COMMIT");
  client.release();
  assert.deepEqual(db.calls.map(({ sql }) => sql), ["BEGIN", "COMMIT"]);
  assert.equal(db.releases, 1);
});
```

- [ ] **Step 2: Run helper tests and verify RED**

Run:

```bash
node --experimental-strip-types --test src/testSupport/recordingDatabase.test.ts
```

Expected: FAIL because `recordingDatabase.ts` does not exist.

- [ ] **Step 3: Implement the recording fake**

Create `src/testSupport/recordingDatabase.ts`:

```ts
export interface RecordedQuery {
  sql: string;
  params: readonly unknown[];
}

export interface ScriptedResult {
  rows?: unknown[];
  rowCount?: number | null;
  error?: Error;
}

export function createRecordingDatabase(script: ScriptedResult[]) {
  const calls: RecordedQuery[] = [];
  let releases = 0;
  const query = async <Row>(sql: string, params: readonly unknown[] = []) => {
    calls.push({ sql, params });
    if (/^\s*(?:BEGIN|COMMIT|ROLLBACK)\s*;?\s*$/i.test(sql)) {
      return { rows: [] as Row[], rowCount: 0 };
    }
    const next = script.shift() ?? { rows: [], rowCount: 0 };
    if (next.error) throw next.error;
    return {
      rows: (next.rows ?? []) as Row[],
      rowCount: next.rowCount ?? next.rows?.length ?? 0,
    };
  };
  const client = { query, release: () => { releases += 1; } };
  const pool = { query, connect: async () => client };
  return {
    calls,
    query,
    client,
    pool,
    get releases() { return releases; },
  };
}
```

- [ ] **Step 4: Run helper tests and verify GREEN**

Run:

```bash
node --experimental-strip-types --test src/testSupport/recordingDatabase.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit the helper**

```bash
git add src/testSupport/recordingDatabase.ts src/testSupport/recordingDatabase.test.ts
git commit -m "test: add recording database fake"
```

### Task 3: Convert Admin and Auth Stores

**Files:**
- Modify: `src/adminUsers.ts`
- Modify: `src/adminUsers.test.ts`
- Modify: `src/authStore.ts`
- Modify: `src/authStore.test.ts`

- [ ] **Step 1: Replace integration fixtures with failing factory-based tests**

In `src/adminUsers.test.ts`, remove `pg`, `DATABASE_URL`, hooks, and seed SQL. Test:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { createAdminUsersStore, decodeAdminUserCursor } from "./adminUsers.ts";
import { createRecordingDatabase } from "./testSupport/recordingDatabase.ts";

test("lists a mapped page and creates the stable next cursor", async () => {
  const rows = Array.from({ length: 3 }, (_, index) => ({
    id: 3 - index,
    email: `user-${index}@example.com`,
    role: "user" as const,
    active: true,
    created_at: new Date(`2026-07-0${3 - index}T00:00:00.000Z`),
    subscription_status: null,
  }));
  const db = createRecordingDatabase([
    { rows, rowCount: 3 },
    { rows: [{ total: 3 }], rowCount: 1 },
  ]);
  const store = createAdminUsersStore({ query: db.query, connect: async () => db.client });
  const page = await store.listAdminUsersPage({ limit: 2, query: "user-", filter: "all" });
  assert.equal(page.users.length, 2);
  assert.equal(page.total, 3);
  assert.deepEqual(decodeAdminUserCursor(page.nextCursor!), {
    createdAt: "2026-07-02T00:00:00.000Z",
    id: 2,
  });
});
```

In `src/authStore.test.ts`, remove the PostgreSQL fixture and test `createAuthStore` with scripted results for normalized registration, authentication failure, session creation/revocation, and resolution.

- [ ] **Step 2: Run the two tests and verify RED**

Run:

```bash
node --experimental-strip-types --test src/adminUsers.test.ts src/authStore.test.ts
```

Expected: FAIL because `createAdminUsersStore` and `createAuthStore` do not exist.

- [ ] **Step 3: Add factories while preserving live exports**

In each production module:

```ts
export function create...Store(deps = liveDependencies) {
  return {
    // existing functions, replacing direct query/pool access with deps
  };
}

const liveStore = create...Store();
export const existingFunction = liveStore.existingFunction;
```

For auth, inject password/token operations as well as query so unit tests can use deterministic tokens and hashes. For admin users, inject `query` and `connect`; preserve BEGIN/COMMIT/ROLLBACK/release ordering.

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```bash
node --experimental-strip-types --test src/adminUsers.test.ts src/authStore.test.ts
```

Expected: all admin/auth unit tests pass without PostgreSQL.

- [ ] **Step 5: Commit**

```bash
git add src/unitTestBoundary.test.ts src/adminUsers.ts src/adminUsers.test.ts src/authStore.ts src/authStore.test.ts
git commit -m "test: unit test admin and auth stores"
```

### Task 4: Convert Existing Factory-Based Stores

**Files:**
- Rewrite: `src/appKnowledgeStore.test.ts`
- Rewrite: `src/autonomousStore.test.ts`
- Rewrite: `src/featureDocumentStore.test.ts`

- [ ] **Step 1: Rewrite each test around its existing factory**

Use `createRecordingDatabase` to script rows and transactions:

```ts
const db = createRecordingDatabase(script);
const store = createAppKnowledgeStore(db.query, async (work) => work(db.query));
```

```ts
const db = createRecordingDatabase(script);
const store = createAutonomousStore({
  query: db.query,
  withTransaction: async (work) => work(db.client),
});
```

```ts
const db = createRecordingDatabase(script);
const store = createFeatureDocumentStore(db.query, async (work) => work(db.query));
```

Retain representative unit coverage for validation, row mapping, successful transaction behavior, missing records, conflict handling, and failure propagation. Remove database creation, migrations, truncation, and fixture INSERT statements.

- [ ] **Step 2: Run converted tests**

Run:

```bash
node --experimental-strip-types --test src/appKnowledgeStore.test.ts src/autonomousStore.test.ts src/featureDocumentStore.test.ts
```

Expected: all tests pass with recording fakes and no skips.

- [ ] **Step 3: Commit**

```bash
git add src/appKnowledgeStore.test.ts src/autonomousStore.test.ts src/featureDocumentStore.test.ts
git commit -m "test: mock durable store persistence"
```

### Task 5: Convert Direct Query Stores

**Files:**
- Modify: `src/featureUsage.ts`
- Rewrite: `src/featureUsage.test.ts`
- Modify: `src/pricingStore.ts`
- Rewrite: `src/pricingStore.test.ts`
- Modify: `src/referralStore.ts`
- Rewrite: `src/referralStore.test.ts`

- [ ] **Step 1: Write factory-based unit tests**

Add `createFeatureUsageStore`, `createPricingStore`, and `createReferralStore` expectations to the tests. Use scripted rows to cover:

- usage range parsing, overview mapping, percentages, and user-not-found;
- subscription mapping, Free/Pro access decisions, unlock limits, export reservation, and transaction rollback;
- referral token validation, attribution status, activation, summary, and revocation.

- [ ] **Step 2: Run and verify RED**

Run:

```bash
node --experimental-strip-types --test src/featureUsage.test.ts src/pricingStore.test.ts src/referralStore.test.ts
```

Expected: FAIL because the three factories do not exist.

- [ ] **Step 3: Add narrow dependency factories**

Move current functions into returned objects using injected `query`, `withTransaction`, and cross-store dependencies. Bind the existing named exports to a live default instance so application imports do not change.

- [ ] **Step 4: Run and verify GREEN**

Run:

```bash
node --experimental-strip-types --test src/featureUsage.test.ts src/pricingStore.test.ts src/referralStore.test.ts
```

Expected: all converted unit tests pass without PostgreSQL.

- [ ] **Step 5: Commit**

```bash
git add src/featureUsage.ts src/featureUsage.test.ts src/pricingStore.ts src/pricingStore.test.ts src/referralStore.ts src/referralStore.test.ts
git commit -m "test: unit test usage pricing and referrals"
```

### Task 6: Convert Pool-Injected Import and Search Stores

**Files:**
- Rewrite: `src/getdesignImportStore.test.ts`
- Rewrite: `src/searchIndexStore.test.ts`
- Rewrite: `src/searchStore.test.ts`

- [ ] **Step 1: Replace pools with recording fakes**

Cast only at the constructor boundary:

```ts
const db = createRecordingDatabase(script);
const store = new PostgresSearchIndexStore(
  db.pool as never,
  async () => publishedFixture,
);
```

For `PostgresSearchStore`, pass `db.pool as never`. For GetDesign functions, pass the same fake pool. Assert SQL parameters, result mapping, transaction order, vector serialization, retry metadata, and rollback on error.

- [ ] **Step 2: Run converted tests**

Run:

```bash
node --experimental-strip-types --test src/getdesignImportStore.test.ts src/searchIndexStore.test.ts src/searchStore.test.ts
```

Expected: all tests pass without environment variables or PostgreSQL.

- [ ] **Step 3: Commit**

```bash
git add src/getdesignImportStore.test.ts src/searchIndexStore.test.ts src/searchStore.test.ts
git commit -m "test: mock import and search stores"
```

### Task 7: Remove SQL-Infrastructure Integration Cases

**Files:**
- Delete: `src/crawlStore.test.ts`
- Delete: `src/db.test.ts`
- Modify: `src/mediaMigration.test.ts`
- Modify: `src/migrations.test.ts`

- [ ] **Step 1: Remove integration-only files**

Delete `src/crawlStore.test.ts` and `src/db.test.ts`. Their assertions require PostgreSQL semantics and are not unit tests.

- [ ] **Step 2: Trim media migration integration setup**

Remove the PostgreSQL import and the database-backed test block from `src/mediaMigration.test.ts`. Keep the existing `FakeStore` tests for object transfer, deduplication, concurrency, failure handling, and verification.

- [ ] **Step 3: Trim migration execution integration setup**

Remove runtime `pg`, connection strings, database creation, and live-pool cases from `src/migrations.test.ts`. Keep pure tests for discovery, checksums, validation, environment safety, and fake-client orchestration.

- [ ] **Step 4: Run remaining focused tests**

Run:

```bash
node --experimental-strip-types --test src/mediaMigration.test.ts src/migrations.test.ts
```

Expected: all remaining unit tests pass without skips or infrastructure.

- [ ] **Step 5: Commit**

```bash
git add src/crawlStore.test.ts src/db.test.ts src/mediaMigration.test.ts src/migrations.test.ts
git commit -m "test: remove SQL integration coverage"
```

### Task 8: Prove the Repository Is Unit-Only

**Files:**
- Modify only files from Tasks 1-7 if verification exposes a missed runtime database dependency.

- [ ] **Step 1: Run the boundary test**

Run:

```bash
node --experimental-strip-types --test src/unitTestBoundary.test.ts
```

Expected: 1 test passes with zero violations.

- [ ] **Step 2: Search independently for real database test access**

Run:

```bash
rg -n -e 'new pg\\.(Client|Pool)' -e 'process\\.env\\..*DATABASE_URL\\s*=' -e 'CREATE DATABASE' -e 'await import\\(.*/db\\.ts' --glob '*test.ts' --glob '*test.tsx' src services scripts
```

Expected: no matches.

- [ ] **Step 3: Run the complete unit suite**

Run:

```bash
npm test
```

Expected: exit 0 without PostgreSQL, pgvector, Docker, skipped database suites, or connection errors.

- [ ] **Step 4: Build production assets**

Run:

```bash
npm run build
```

Expected: Vite exits successfully; the existing large-chunk warning is acceptable.

- [ ] **Step 5: Check the scoped diff and status**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; unrelated pre-existing worktree files remain untouched.
