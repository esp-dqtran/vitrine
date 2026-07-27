# Normalized Flow Import Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every future Apps crawl and import persist current and versioned Flows through migration 0034's normalized hierarchy and mapping tables without touching already migrated data.

**Architecture:** Add a focused `normalizedFlowStore` that validates `DesignFlow[]`, resolves canonical root/child taxonomy rows, and performs transactional replace, merge, and version-snapshot writes. Existing public DB functions become adapters, while direct writers in planned crawl, autonomous crawl, publication, workers, and catalog-import tooling delegate to the same boundary. Active import verification and feature-source reads reconstruct ordered Flows from normalized rows.

**Tech Stack:** TypeScript, Node.js test runner, PostgreSQL 17, `pg`, existing SQL migrations, Docker Compose, Vite.

---

## Execution constraints

- Work directly on `main`; do not create a branch or worktree.
- Preserve the existing uncommitted fixes in `src/db.ts` and
  `src/dbAppDetailQueries.test.ts`.
- Do not run any backfill or repair against the configured application
  database.
- PostgreSQL write verification must use a generated database whose name starts
  with `astryx_flow_import_test_`.
- Do not commit or push unless the user explicitly requests it.

## File map

### Create

- `src/normalizedFlowStore.ts` — validation, normalization, canonical hierarchy
  resolution, normalized readers, and transactional replace/merge functions.
- `src/normalizedFlowStore.test.ts` — pure validation and normalization tests.
- `scripts/verify-normalized-flow-store.ts` — disposable PostgreSQL integration
  verification at migration head without violating the unit-test database boundary.
- `src/normalizedFlowWiring.test.ts` — contract guard proving active producers
  no longer write removed aggregate columns.

### Modify

- `src/db.ts` — adapt public current/version Flow functions, publication,
  analysis, published search, and set-list reads.
- `src/dbAppDetailQueries.test.ts` — update persistence assertions to the
  normalized boundary.
- `src/crawlStore.ts` — planned-run finalization uses current replacement.
- `src/autonomousStore.ts` — autonomous partial updates use current merge.
- `services/import-worker/src/index.ts` — feature-source manifests use normalized
  readers.
- `services/import-worker/src/flowOnlyAnalysisWiring.test.ts` — assert normalized
  reader/writer wiring.
- `src/catalogVerification.ts` — row-count, mapping, and evidence validation.
- `src/catalogVerification.test.ts` — normalized verification expectations.
- `scripts/merge-catalog-databases.ts` — import row-per-flow content and mappings
  through the central boundary.
- `scripts/merge-catalog-databases.test.ts` — normalized source/target import,
  hierarchy, mapping, and evidence-remap coverage.
- `scripts/verify-catalog-import.ts` — verify normalized imported rows directly.

## Task 1: Pure Flow validation and hierarchy identity

**Files:**
- Create: `src/normalizedFlowStore.ts`
- Create: `src/normalizedFlowStore.test.ts`

- [ ] **Step 1: Write failing normalization and validation tests**

```typescript
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canonicalFlowPath,
  validateIncomingFlows,
} from "./normalizedFlowStore.ts";
import type { DesignFlow } from "./designSystem.ts";

const flow = (overrides: Partial<DesignFlow> = {}): DesignFlow => ({
  id: "checkout",
  title: "  Guest   Checkout  ",
  category: "  Checkout ",
  description: "Complete a purchase",
  tags: [],
  steps: [],
  ...overrides,
});

test("normalizes a category into a root and a title into its child", () => {
  assert.deepEqual(canonicalFlowPath(flow()), {
    root: { name: "Checkout", normalizedName: "checkout" },
    child: { name: "Guest Checkout", normalizedName: "guest checkout" },
  });
});

test("uses one root when category and title normalize equally", () => {
  assert.deepEqual(canonicalFlowPath(flow({
    title: " Account ",
    category: "account",
  })), {
    root: { name: "Account", normalizedName: "account" },
  });
});

test("rejects duplicate source ids before persistence", () => {
  assert.throws(
    () => validateIncomingFlows([flow(), flow({ title: "Other" })]),
    /Flow source ids must be unique/,
  );
});

test("rejects malformed required fields and arrays", () => {
  assert.throws(() => validateIncomingFlows([flow({ title: " " })]), /Flow title/);
  assert.throws(
    () => validateIncomingFlows([{ ...flow(), steps: null } as unknown as DesignFlow]),
    /Flow steps must be an array/,
  );
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
node --experimental-strip-types --test src/normalizedFlowStore.test.ts
```

Expected: FAIL because `normalizedFlowStore.ts` does not exist.

- [ ] **Step 3: Implement the pure validation and identity functions**

Add to `src/normalizedFlowStore.ts`:

```typescript
import type pg from "pg";
import type { DesignFlow } from "./designSystem.ts";

export type FlowWriteClient = Pick<pg.PoolClient, "query">;

export interface CanonicalName {
  name: string;
  normalizedName: string;
}

export interface CanonicalFlowPath {
  root: CanonicalName;
  child?: CanonicalName;
}

export function displayFlowName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizedFlowName(value: string): string {
  return displayFlowName(value).toLowerCase();
}

export function canonicalFlowPath(flow: DesignFlow): CanonicalFlowPath {
  const title = displayFlowName(flow.title);
  const titleIdentity = normalizedFlowName(title);
  const category = typeof flow.category === "string"
    ? displayFlowName(flow.category)
    : "";
  const categoryIdentity = normalizedFlowName(category);
  if (!category || categoryIdentity === titleIdentity) {
    return { root: { name: title, normalizedName: titleIdentity } };
  }
  return {
    root: { name: category, normalizedName: categoryIdentity },
    child: { name: title, normalizedName: titleIdentity },
  };
}

export function validateIncomingFlows(flows: DesignFlow[]): void {
  if (!Array.isArray(flows)) throw new Error("App flows must be an array");
  const ids = new Set<string>();
  for (const flow of flows) {
    if (!flow || typeof flow !== "object") throw new Error("Flow must be an object");
    if (typeof flow.id !== "string" || !flow.id.trim()) throw new Error("Flow id is required");
    if (ids.has(flow.id)) throw new Error("Flow source ids must be unique");
    ids.add(flow.id);
    if (typeof flow.title !== "string" || !displayFlowName(flow.title)) {
      throw new Error("Flow title is required");
    }
    if (typeof flow.description !== "string") throw new Error("Flow description must be a string");
    if (!Array.isArray(flow.tags)) throw new Error("Flow tags must be an array");
    if (!Array.isArray(flow.steps)) throw new Error("Flow steps must be an array");
    if (flow.category !== undefined && typeof flow.category !== "string") {
      throw new Error("Flow category must be a string");
    }
  }
  try {
    JSON.stringify(flows);
  } catch {
    throw new Error("App flows must be JSON-serializable");
  }
}
```

- [ ] **Step 4: Run the pure tests and verify GREEN**

Run:

```bash
node --experimental-strip-types --test src/normalizedFlowStore.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit checkpoint only if explicitly requested**

```bash
git add src/normalizedFlowStore.ts src/normalizedFlowStore.test.ts
git commit -m "feat: add normalized flow identity rules"
```

## Task 2: Transactional normalized readers and writers

**Files:**
- Modify: `src/normalizedFlowStore.ts`
- Create: `scripts/verify-normalized-flow-store.ts`

- [ ] **Step 1: Write a disposable PostgreSQL integration test**

The test must:

1. Require `FLOW_IMPORT_TEST_ADMIN_URL`.
2. Generate `astryx_flow_import_test_<uuid-without-dashes>`.
3. Create that database through the maintenance connection.
4. Apply all migrations with `applyMigrations`.
5. Insert two apps, platforms, and one version.
6. Exercise current replacement, merge, empty replacement, and version
   replacement.
7. Close the test pool and always drop the generated database without forcing
   live connections.

Core assertions:

```typescript
await replaceCurrentFlows(client, {
  appId,
  platform: "web",
  flows: [
    flow({ id: "standalone", title: "Onboarding", category: undefined }),
    flow({ id: "child", title: "Create account", category: "Onboarding" }),
  ],
});

assert.deepEqual(
  (await readCurrentFlows(client, { appId, platform: "web" })).map(({ id }) => id),
  ["standalone", "child"],
);

assert.equal(
  Number((await client.query("SELECT count(*) FROM app_flow_mappings")).rows[0].count),
  2,
);

await mergeCurrentFlows(client, {
  appId,
  platform: "web",
  flows: [flow({ id: "third", title: "Verify email", category: "Onboarding" })],
});
assert.deepEqual(
  (await readCurrentFlows(client, { appId, platform: "web" })).map(({ id }) => id),
  ["standalone", "child", "third"],
);

await replaceVersionFlows(client, {
  versionId,
  flows: [flow({ id: "published", title: "Published flow" })],
});
assert.equal((await readVersionFlows(client, { versionId })).length, 1);

await replaceCurrentFlows(client, { appId, platform: "web", flows: [] });
assert.deepEqual(await readCurrentFlows(client, { appId, platform: "web" }), []);
assert.equal((await readVersionFlows(client, { versionId })).length, 1);
```

Also assert:

- re-importing the same payload is idempotent;
- a changed category remaps the same `source_flow_id`;
- reconstructed content preserves every `DesignFlow` field and input order;
- the same child title under two categories resolves to two different children;
- two apps using one normalized category reuse the same root;
- two concurrent inserts reuse one canonical root;
- a forced mapping failure rolls back content and mappings; and
- taxonomy names are not renamed by later casing variants.

- [ ] **Step 2: Run the integration test and verify RED**

Run:

```bash
FLOW_IMPORT_TEST_ADMIN_URL=postgres://postgres:postgres@127.0.0.1:5432/postgres \
  node --experimental-strip-types scripts/verify-normalized-flow-store.ts
```

Expected: FAIL because the normalized database functions are not implemented.

- [ ] **Step 3: Implement canonical resolution**

Add these internal functions to `src/normalizedFlowStore.ts`:

```typescript
async function rootFlowId(client: FlowWriteClient, identity: CanonicalName): Promise<number> {
  const inserted = await client.query<{ id: number }>(
    `INSERT INTO flows (name, normalized_name)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [identity.name, identity.normalizedName],
  );
  if (inserted.rows[0]) return Number(inserted.rows[0].id);
  const existing = await client.query<{ id: number }>(
    `SELECT id FROM flows
     WHERE parent_id IS NULL AND normalized_name = $1`,
    [identity.normalizedName],
  );
  if (!existing.rows[0]) throw new Error("Canonical root Flow could not be resolved");
  return Number(existing.rows[0].id);
}

async function childFlowId(
  client: FlowWriteClient,
  parentId: number,
  identity: CanonicalName,
): Promise<number> {
  const inserted = await client.query<{ id: number }>(
    `INSERT INTO flows (parent_id, name, normalized_name)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [parentId, identity.name, identity.normalizedName],
  );
  if (inserted.rows[0]) return Number(inserted.rows[0].id);
  const existing = await client.query<{ id: number }>(
    `SELECT id FROM flows
     WHERE parent_id = $1 AND normalized_name = $2`,
    [parentId, identity.normalizedName],
  );
  if (!existing.rows[0]) throw new Error("Canonical child Flow could not be resolved");
  return Number(existing.rows[0].id);
}

async function canonicalFlowId(client: FlowWriteClient, flow: DesignFlow): Promise<number> {
  const path = canonicalFlowPath(flow);
  const rootId = await rootFlowId(client, path.root);
  return path.child ? childFlowId(client, rootId, path.child) : rootId;
}
```

- [ ] **Step 4: Implement row reconstruction**

```typescript
interface StoredFlowRow {
  source_flow_id: string;
  title: string;
  source_category: string | null;
  description: string;
  tags: string[];
  steps: DesignFlow["steps"];
  provenance: DesignFlow["provenance"] | null;
  insights: DesignFlow["insights"] | null;
}

function designFlow(row: StoredFlowRow): DesignFlow {
  return {
    id: row.source_flow_id,
    title: row.title,
    ...(row.source_category ? { category: row.source_category } : {}),
    description: row.description,
    tags: row.tags,
    steps: row.steps,
    ...(row.provenance ? { provenance: row.provenance } : {}),
    ...(row.insights ? { insights: row.insights } : {}),
  };
}

export async function readCurrentFlows(
  client: FlowWriteClient,
  input: { appId: number; platform: string },
): Promise<DesignFlow[]> {
  const rows = await client.query<StoredFlowRow>(
    `SELECT source_flow_id, title, source_category, description,
       tags, steps, provenance, insights
     FROM app_flows
     WHERE app_id = $1 AND platform = $2
     ORDER BY position`,
    [input.appId, input.platform],
  );
  return rows.rows.map(designFlow);
}

export async function readVersionFlows(
  client: FlowWriteClient,
  input: { versionId: number },
): Promise<DesignFlow[]> {
  const rows = await client.query<StoredFlowRow>(
    `SELECT source_flow_id, title, source_category, description,
       tags, steps, provenance, insights
     FROM app_flow_versions
     WHERE version_id = $1
     ORDER BY position`,
    [input.versionId],
  );
  return rows.rows.map(designFlow);
}
```

- [ ] **Step 5: Implement current replacement**

```typescript
async function writeCurrentRows(
  client: FlowWriteClient,
  input: { appId: number; platform: string; flows: DesignFlow[] },
): Promise<void> {
  for (const [index, flow] of input.flows.entries()) {
    const canonicalId = await canonicalFlowId(client, flow);
    const saved = await client.query<{ id: number }>(
      `INSERT INTO app_flows (
         app_id, platform, source_flow_id, position, title, source_category,
         description, tags, steps, provenance, insights
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb)
       ON CONFLICT (app_id, platform, source_flow_id) DO UPDATE SET
         position = EXCLUDED.position,
         title = EXCLUDED.title,
         source_category = EXCLUDED.source_category,
         description = EXCLUDED.description,
         tags = EXCLUDED.tags,
         steps = EXCLUDED.steps,
         provenance = EXCLUDED.provenance,
         insights = EXCLUDED.insights,
         updated_at = now()
       RETURNING id`,
      [
        input.appId, input.platform, flow.id, index + 1, flow.title,
        flow.category ?? null, flow.description, JSON.stringify(flow.tags),
        JSON.stringify(flow.steps), JSON.stringify(flow.provenance ?? null),
        JSON.stringify(flow.insights ?? null),
      ],
    );
    const appFlowId = Number(saved.rows[0].id);
    await client.query("DELETE FROM app_flow_mappings WHERE app_flow_id = $1", [appFlowId]);
    await client.query(
      "INSERT INTO app_flow_mappings (app_flow_id, flow_id) VALUES ($1, $2)",
      [appFlowId, canonicalId],
    );
  }
}

async function replaceCurrentFlowsLocked(
  client: FlowWriteClient,
  input: { appId: number; platform: string; flows: DesignFlow[] },
): Promise<void> {
  // Move every existing position above the incoming range before upserting.
  // This makes swaps such as [A, B] -> [B, A] safe with the immediate
  // UNIQUE (app_id, platform, position) constraint.
  const current = await client.query<{ max_position: number }>(
    `SELECT COALESCE(max(position), 0)::int AS max_position
     FROM app_flows WHERE app_id = $1 AND platform = $2`,
    [input.appId, input.platform],
  );
  const offset = Number(current.rows[0].max_position) + input.flows.length + 1;
  await client.query(
    `UPDATE app_flows SET position = position + $3
     WHERE app_id = $1 AND platform = $2`,
    [input.appId, input.platform, offset],
  );
  await writeCurrentRows(client, input);
  await client.query(
    `DELETE FROM app_flows
     WHERE app_id = $1 AND platform = $2
       AND NOT (source_flow_id = ANY($3::text[]))`,
    [input.appId, input.platform, input.flows.map(({ id }) => id)],
  );
}

export async function replaceCurrentFlows(
  client: FlowWriteClient,
  input: { appId: number; platform: string; flows: DesignFlow[] },
): Promise<void> {
  validateIncomingFlows(input.flows);
  const locked = await client.query(
    "SELECT id FROM apps WHERE id = $1 FOR UPDATE",
    [input.appId],
  );
  if (!locked.rowCount) throw new Error("Flow target app was not found");
  await replaceCurrentFlowsLocked(client, input);
}

export async function mergeCurrentFlows(
  client: FlowWriteClient,
  input: { appId: number; platform: string; flows: DesignFlow[] },
): Promise<DesignFlow[]> {
  validateIncomingFlows(input.flows);
  const locked = await client.query(
    "SELECT id FROM apps WHERE id = $1 FOR UPDATE",
    [input.appId],
  );
  if (!locked.rowCount) throw new Error("Flow target app was not found");
  const existing = await readCurrentFlows(client, input);
  const incoming = new Map(input.flows.map((flow) => [flow.id, flow]));
  const merged = existing.map((flow) => incoming.get(flow.id) ?? flow);
  const seen = new Set(existing.map(({ id }) => id));
  merged.push(...input.flows.filter(({ id }) => !seen.has(id)));
  await replaceCurrentFlowsLocked(client, { ...input, flows: merged });
  return merged;
}
```

- [ ] **Step 6: Implement version replacement**

Use the same validation, canonical resolution, position-shifted upsert, mapping
replacement, and stale-row deletion against `app_flow_versions` and
`app_flow_version_mappings`:

```typescript
export async function replaceVersionFlows(
  client: FlowWriteClient,
  input: { versionId: number; flows: DesignFlow[] },
): Promise<void> {
  validateIncomingFlows(input.flows);
  const locked = await client.query(
    "SELECT id FROM app_versions WHERE id = $1 FOR UPDATE",
    [input.versionId],
  );
  if (!locked.rowCount) throw new Error("Flow target version was not found");
  const current = await client.query<{ max_position: number }>(
    `SELECT COALESCE(max(position), 0)::int AS max_position
     FROM app_flow_versions WHERE version_id = $1`,
    [input.versionId],
  );
  const offset = Number(current.rows[0].max_position) + input.flows.length + 1;
  await client.query(
    "UPDATE app_flow_versions SET position = position + $2 WHERE version_id = $1",
    [input.versionId, offset],
  );
  for (const [index, flow] of input.flows.entries()) {
    const canonicalId = await canonicalFlowId(client, flow);
    const saved = await client.query<{ id: number }>(
      `INSERT INTO app_flow_versions (
         version_id, source_flow_id, position, title, source_category,
         description, tags, steps, provenance, insights
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb)
       ON CONFLICT (version_id, source_flow_id) DO UPDATE SET
         position = EXCLUDED.position,
         title = EXCLUDED.title,
         source_category = EXCLUDED.source_category,
         description = EXCLUDED.description,
         tags = EXCLUDED.tags,
         steps = EXCLUDED.steps,
         provenance = EXCLUDED.provenance,
         insights = EXCLUDED.insights
       RETURNING id`,
      [
        input.versionId, flow.id, index + 1, flow.title,
        flow.category ?? null, flow.description, JSON.stringify(flow.tags),
        JSON.stringify(flow.steps), JSON.stringify(flow.provenance ?? null),
        JSON.stringify(flow.insights ?? null),
      ],
    );
    const versionFlowId = Number(saved.rows[0].id);
    await client.query(
      "DELETE FROM app_flow_version_mappings WHERE app_flow_version_id = $1",
      [versionFlowId],
    );
    await client.query(
      `INSERT INTO app_flow_version_mappings (app_flow_version_id, flow_id)
       VALUES ($1, $2)`,
      [versionFlowId, canonicalId],
    );
  }
  await client.query(
    `DELETE FROM app_flow_versions
     WHERE version_id = $1 AND NOT (source_flow_id = ANY($2::text[]))`,
    [input.versionId, input.flows.map(({ id }) => id)],
  );
}
```

- [ ] **Step 7: Run disposable PostgreSQL verification**

Run:

```bash
FLOW_IMPORT_TEST_ADMIN_URL=postgres://postgres:postgres@127.0.0.1:5432/postgres \
  node --experimental-strip-types scripts/verify-normalized-flow-store.ts
```

Expected: all integration cases PASS and the generated database is absent after
the test.

- [ ] **Step 8: Commit checkpoint only if explicitly requested**

```bash
git add src/normalizedFlowStore.ts src/normalizedFlowStore.test.ts scripts/verify-normalized-flow-store.ts
git commit -m "feat: persist normalized app flows"
```

## Task 3: Rewire public DB adapters, analysis, and publication

**Files:**
- Modify: `src/db.ts`
- Modify: `src/dbAppDetailQueries.test.ts`

- [ ] **Step 1: Write failing DB adapter contract tests**

Update `src/dbAppDetailQueries.test.ts` so the `saveAppFlows`,
`saveAnalyzedAppFlows`, and `publishAppVersion` source slices assert calls to
the normalized boundary and reject aggregate writes:

```typescript
assert.match(saveAppFlowsBody, /replaceCurrentFlows/);
assert.doesNotMatch(saveAppFlowsBody, /INSERT INTO app_flows[\s\S]*\bflows\b/);

assert.match(saveAnalyzedBody, /replaceVersionFlows/);
assert.match(saveAnalyzedBody, /replaceCurrentFlows/);
assert.doesNotMatch(saveAnalyzedBody, /INSERT INTO app_flow_versions[\s\S]*\bflows\b/);

assert.match(publishBody, /readCurrentFlows/);
assert.match(publishBody, /replaceVersionFlows/);
assert.doesNotMatch(publishBody, /SELECT flows FROM app_flows/);
```

- [ ] **Step 2: Run the focused test and verify RED**

```bash
node --experimental-strip-types --test src/dbAppDetailQueries.test.ts
```

Expected: FAIL on the old aggregate writer SQL.

- [ ] **Step 3: Adapt `saveAppFlows`**

Import `replaceCurrentFlows` and resolve the app under one transaction:

```typescript
export async function saveAppFlows(
  app: string,
  platform: string,
  flows: DesignFlow[],
): Promise<void> {
  await withTransaction(async (client) => {
    const target = await client.query<{ id: number }>(
      "SELECT id FROM apps WHERE name = $1",
      [app],
    );
    if (!target.rows[0]) throw new Error("Flow target app was not found");
    await replaceCurrentFlows(client, {
      appId: Number(target.rows[0].id),
      platform,
      flows,
    });
  });
}
```

- [ ] **Step 4: Adapt App Knowledge analysis**

Inside the existing version lock and scope check:

```typescript
await replaceVersionFlows(client, {
  versionId: input.versionId,
  flows: input.flows,
});
if (selected.status === "draft" || selected.status === "in_review") {
  await replaceCurrentFlows(client, {
    appId: selected.app_id,
    platform: input.platform,
    flows: input.flows,
  });
}
```

Remove JSON serialization and aggregate inserts.

- [ ] **Step 5: Adapt publication**

Within the existing publication transaction:

```typescript
const currentFlows = await readCurrentFlows(client, {
  appId: version.rows[0].app_id,
  platform: version.rows[0].platform,
});
const candidate = {
  images: images.rows,
  snapshot: snapshot.rows[0]?.snapshot,
  flows: currentFlows,
};
// After blockers and run-cancellation checks:
await replaceVersionFlows(client, {
  versionId,
  flows: candidate.flows,
});
```

Keep snapshot review marking and status transition in the same transaction.

- [ ] **Step 6: Normalize remaining DB read helpers required by new imports**

Replace aggregate reads in:

- `appKnowledgeEvidenceSource`;
- `listAppFlowSets`;
- publication candidate helpers;
- `publishedSearchSource`;
- `listPublishedFlowSets`; and
- any versioned flow lookup used by import verification.

Use `readCurrentFlows` or `readVersionFlows`, preserving app and platform
ordering at the adapter level.

- [ ] **Step 7: Run focused DB and API tests**

```bash
node --experimental-strip-types --test \
  src/dbAppDetailQueries.test.ts \
  src/db.appKnowledgeEvidence.test.ts \
  services/api/src/app.test.ts
```

Expected: all tests PASS.

- [ ] **Step 8: Commit checkpoint only if explicitly requested**

```bash
git add src/db.ts src/dbAppDetailQueries.test.ts
git commit -m "refactor: route flow writes through normalized storage"
```

## Task 4: Rewire planned and autonomous crawlers

**Files:**
- Modify: `src/crawlStore.ts`
- Modify: `src/autonomousStore.ts`
- Create: `src/normalizedFlowWiring.test.ts`

- [ ] **Step 1: Write failing producer wiring tests**

`src/normalizedFlowWiring.test.ts` reads the producer sources and asserts:

```typescript
assert.match(crawlStoreSource, /replaceCurrentFlows/);
assert.doesNotMatch(crawlStoreSource, /INSERT INTO app_flows[\s\S]*\bflows\b/);

assert.match(autonomousStoreSource, /mergeCurrentFlows/);
assert.doesNotMatch(autonomousStoreSource, /SELECT flows FROM app_flows/);
assert.doesNotMatch(autonomousStoreSource, /INSERT INTO app_flows[\s\S]*\bflows\b/);
```

- [ ] **Step 2: Run wiring tests and verify RED**

```bash
node --experimental-strip-types --test src/normalizedFlowWiring.test.ts
```

Expected: FAIL on direct aggregate SQL.

- [ ] **Step 3: Update planned-run finalization**

In `saveWorkerAppFlows`, preserve `lockedWorkerRun`, app/run scope checks, and
the surrounding transaction. Replace the aggregate insert with:

```typescript
await replaceCurrentFlows(client, {
  appId: locked.run.app_id,
  platform: locked.run.platform,
  flows: input.flows,
});
```

- [ ] **Step 4: Update autonomous partial merge**

After locking the target version and validating its status:

```typescript
return mergeCurrentFlows(client, {
  appId: target.rows[0].app_id,
  platform: target.rows[0].platform,
  flows: incoming,
});
```

- [ ] **Step 5: Run crawler tests**

```bash
node --experimental-strip-types --test \
  src/normalizedFlowWiring.test.ts \
  src/crawlRun.test.ts \
  src/autonomousAcceptance.test.ts \
  src/autonomousOrchestrator.test.ts
```

Expected: all tests PASS.

- [ ] **Step 6: Commit checkpoint only if explicitly requested**

```bash
git add src/crawlStore.ts src/autonomousStore.ts src/normalizedFlowWiring.test.ts
git commit -m "fix: persist crawler flows through normalized storage"
```

## Task 5: Update import-worker reads

**Files:**
- Modify: `services/import-worker/src/index.ts`
- Modify: `services/import-worker/src/flowOnlyAnalysisWiring.test.ts`

- [ ] **Step 1: Add a failing worker wiring assertion**

```typescript
assert.match(workerSource, /\bgetAppFlows\b/);
assert.match(workerSource, /\bgetVersionFlowsById\b/);
assert.doesNotMatch(workerSource, /SELECT af\.flows/);
assert.doesNotMatch(workerSource, /\b(?:af|afv)\.flows\b/);
```

- [ ] **Step 2: Run the worker test and verify RED**

```bash
node --experimental-strip-types --test services/import-worker/src/flowOnlyAnalysisWiring.test.ts
```

Expected: FAIL because `currentFeatureSourceManifest` still queries aggregate
columns.

- [ ] **Step 3: Replace manifest Flow lookup**

```typescript
const flows = source.versionId === undefined
  ? await getAppFlows(source.app, source.platform)
  : await getVersionFlowsById({
      app: source.app,
      platform: source.platform,
      versionId: source.versionId,
    });
const flow = flows.find(({ id }) => id === source.flowId);
```

Add `getVersionFlowsById` to `src/db.ts` as a normalized adapter that validates
the version's app/platform scope and calls `readVersionFlows`:

```typescript
export async function getVersionFlowsById(input: {
  app: string;
  platform: string;
  versionId: number;
}): Promise<DesignFlow[]> {
  return withTransaction(async (client) => {
    const scope = await client.query<{
      id: number;
      app_id: number;
      status: AppVersionStatus;
    }>(
      `SELECT av.id, av.app_id, av.status
       FROM app_versions av
       JOIN apps a ON a.id = av.app_id
       WHERE av.id = $1 AND a.name = $2 AND av.platform = $3`,
      [input.versionId, input.app, input.platform],
    );
    const version = scope.rows[0];
    if (!version) throw new Error("Flow target version was not found");
    return version.status === "draft" || version.status === "in_review"
      ? readCurrentFlows(client, {
          appId: Number(version.app_id),
          platform: input.platform,
        })
      : readVersionFlows(client, { versionId: input.versionId });
  });
}
```

- [ ] **Step 4: Run import-worker tests**

```bash
node --experimental-strip-types --test services/import-worker/src/*.test.ts
```

Expected: all import-worker tests PASS.

- [ ] **Step 5: Commit checkpoint only if explicitly requested**

```bash
git add services/import-worker/src/index.ts services/import-worker/src/flowOnlyAnalysisWiring.test.ts src/db.ts
git commit -m "fix: read normalized flows in import worker"
```

## Task 6: Update catalog import verification

**Files:**
- Modify: `src/catalogVerification.ts`
- Modify: `src/catalogVerification.test.ts`
- Modify: `scripts/verify-catalog-import.ts`

- [ ] **Step 1: Write failing normalized verification tests**

Add cases asserting:

```typescript
assert.equal(result.persistedFlows, expected.flows);
assert.equal(result.unmappedFlows, 0);
assert.equal(result.invalidEvidenceReferences, 0);
```

Capture SQL and assert:

```typescript
assert.match(sql, /COUNT\(af\.id\)/);
assert.match(sql, /app_flow_mappings/);
assert.match(sql, /jsonb_array_elements\(af\.steps\)/);
assert.doesNotMatch(sql, /jsonb_array_elements\(af\.flows\)/);
assert.doesNotMatch(sql, /jsonb_array_length\(af\.flows\)/);
```

- [ ] **Step 2: Run catalog verification tests and verify RED**

```bash
node --experimental-strip-types --test src/catalogVerification.test.ts
```

Expected: FAIL on aggregate flow counting and expansion.

- [ ] **Step 3: Replace catalog verification SQL**

Use:

```sql
COUNT(DISTINCT af.id)::int AS flows
```

Mapping coverage:

```sql
SELECT count(*)::int AS unmapped_flows
FROM (
  SELECT af.id
  FROM app_flows af
  LEFT JOIN app_flow_mappings afm ON afm.app_flow_id = af.id
  WHERE af.app_id = $1 AND af.platform = $2
  GROUP BY af.id
  HAVING count(afm.flow_id) <> 1
) invalid
```

Evidence expansion:

```sql
CROSS JOIN LATERAL jsonb_array_elements(af.steps) step
CROSS JOIN LATERAL jsonb_array_elements_text(step->'evidence') evidence_id
```

Update the CLI verifier with the same normalized checks.

- [ ] **Step 4: Run catalog verification tests**

```bash
node --experimental-strip-types --test src/catalogVerification.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit checkpoint only if explicitly requested**

```bash
git add src/catalogVerification.ts src/catalogVerification.test.ts scripts/verify-catalog-import.ts
git commit -m "fix: verify normalized imported flows"
```

## Task 7: Update catalog database import

**Files:**
- Modify: `scripts/merge-catalog-databases.ts`
- Modify: `scripts/merge-catalog-databases.test.ts`

- [ ] **Step 1: Write a failing normalized import contract test**

Assert the script:

```typescript
assert.match(source, /mergeCurrentFlows/);
assert.doesNotMatch(source, /SELECT a\.name AS app, f\.platform, f\.flows/);
assert.doesNotMatch(source, /INSERT INTO app_flows[\s\S]*\bflows\b/);
```

Add a fixture with one standalone Flow and one categorized child and verify the
target contains two rows and two mappings.

- [ ] **Step 2: Run the script tests and verify RED**

```bash
node --experimental-strip-types --test scripts/merge-catalog-databases.test.ts
```

Expected: FAIL on aggregate source and target SQL.

- [ ] **Step 3: Read source Flows from normalized rows**

Replace `FlowRow` with the row-per-flow shape and reconstruct each
`DesignFlow` from the source columns:

```typescript
interface FlowRow {
  app: string;
  platform: string;
  source_flow_id: string;
  title: string;
  source_category: string | null;
  description: string;
  tags: DesignFlow["tags"];
  steps: DesignFlow["steps"];
  provenance: DesignFlow["provenance"] | null;
  insights: DesignFlow["insights"] | null;
}

const flows = await database.query<FlowRow>(
  `SELECT a.name AS app, f.platform, f.source_flow_id, f.title,
     f.source_category, f.description, f.tags, f.steps, f.provenance, f.insights
   FROM app_flows f
   JOIN apps a ON a.id = f.app_id
   ORDER BY a.name, f.platform, f.position`,
);

function groupSourceFlows(
  rows: FlowRow[],
  remapEvidence?: (row: FlowRow, sourceImageId: number) => number,
): Map<string, {
  app: string;
  platform: string;
  flows: DesignFlow[];
}> {
  const flowSets = new Map<string, {
    app: string;
    platform: string;
    flows: DesignFlow[];
  }>();
  for (const row of rows) {
    const key = naturalKey(row.app, row.platform);
    const set = flowSets.get(key) ?? {
      app: row.app,
      platform: row.platform,
      flows: [],
    };
    const sourceFlow: DesignFlow = {
      id: row.source_flow_id,
      title: row.title,
      ...(row.source_category ? { category: row.source_category } : {}),
      description: row.description,
      tags: row.tags,
      steps: row.steps,
      ...(row.provenance ? { provenance: row.provenance } : {}),
      ...(row.insights ? { insights: row.insights } : {}),
    };
    const translated = remapEvidence
      ? remapFlowEvidence(
          [sourceFlow],
          (sourceImageId) => remapEvidence(row, sourceImageId),
        )[0] as DesignFlow
      : sourceFlow;
    set.flows.push(translated);
    flowSets.set(key, set);
  }
  return flowSets;
}
```

Update catalog snapshots to identify each normalized Flow, not only its
app/platform scope:

```typescript
flows: rows.flows.map(({ app, platform, source_flow_id }) =>
  naturalKey(app, platform, source_flow_id)),
```

Resolve each target app ID and merge each grouped source set within
`applyMerge`'s existing transaction. Do not import `withTransaction` here
because that helper owns the configured application pool, not this script's
explicit target connection:

```typescript
async function mergeFlows(
  client: PoolClient,
  rows: FlowRow[],
  imageIds: Map<string, number>,
): Promise<void> {
  const flowSets = groupSourceFlows(rows, (row, sourceImageId) => {
    const targetId = imageIds.get(
      naturalKey(row.app, row.platform, String(sourceImageId)),
    );
    if (!targetId) {
      throw new Error(
        `Missing target image for flow evidence ${row.app}/${row.platform}/${sourceImageId}`,
      );
    }
    return targetId;
  });
  for (const source of flowSets.values()) {
    const target = await client.query<{ id: number }>(
      "SELECT id FROM apps WHERE name = $1",
      [source.app],
    );
    if (!target.rows[0]) throw new Error(`Target app not found: ${source.app}`);
    await mergeCurrentFlows(client, {
      appId: Number(target.rows[0].id),
      platform: source.platform,
      flows: source.flows,
    });
  }
}
```

Dry-run mode calls `validateIncomingFlows` for every result of
`groupSourceFlows(source.flows)` and opens no write transaction.

Delete the now-redundant `mergeFlowArrays` helper and its isolated unit test;
`mergeCurrentFlows` plus the source/target fixture now covers the same
replacement-by-source-ID and append-new-ID behavior at the real persistence
boundary.

- [ ] **Step 4: Run merge tests**

```bash
node --experimental-strip-types --test scripts/merge-catalog-databases.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit checkpoint only if explicitly requested**

```bash
git add scripts/merge-catalog-databases.ts scripts/merge-catalog-databases.test.ts
git commit -m "fix: import normalized catalog flows"
```

## Task 8: Remove active aggregate-column dependencies

**Files:**
- Modify: `src/normalizedFlowWiring.test.ts`
- Modify active files reported by the guard

- [ ] **Step 1: Expand the guard to active crawl/import paths**

```typescript
const activeFiles = [
  "src/db.ts",
  "src/bulkDownload.ts",
  "src/flows.ts",
  "src/smartCrawler.ts",
  "src/crawlStore.ts",
  "src/autonomousStore.ts",
  "src/catalogVerification.ts",
  "services/api/src/app.ts",
  "services/import-worker/src/index.ts",
  "scripts/catalog-import.ts",
  "scripts/merge-catalog-databases.ts",
  "scripts/verify-catalog-import.ts",
];

for (const path of activeFiles) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  assert.doesNotMatch(source, /INSERT INTO app_flows\s*\([^)]*\bflows\b/);
  assert.doesNotMatch(source, /INSERT INTO app_flow_versions\s*\([^)]*\bflows\b/);
  assert.doesNotMatch(source, /UPDATE app_flows SET flows\b/);
  assert.doesNotMatch(source, /\b(?:af|afv)\.flows\b/);
}
```

In the same test, preserve the already-correct delegation seams:

```typescript
for (const path of [
  "src/bulkDownload.ts",
  "src/flows.ts",
  "src/smartCrawler.ts",
  "services/api/src/app.ts",
]) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  assert.match(source, /\bsaveAppFlows\b/);
}
assert.match(
  readFileSync(new URL("../scripts/catalog-import.ts", import.meta.url), "utf8"),
  /\bcrawlFlowsDownload\b/,
);
```

The guard deliberately excludes migration 0034 and migration tests because
they must describe the legacy source schema.

- [ ] **Step 2: Run the guard and verify RED for any remaining active references**

```bash
node --experimental-strip-types --test src/normalizedFlowWiring.test.ts
```

Expected: FAIL with exact remaining files until each active dependency is
converted.

- [ ] **Step 3: Convert each reported active dependency**

Use only:

- `readCurrentFlows`;
- `readVersionFlows`;
- `replaceCurrentFlows`;
- `mergeCurrentFlows`; or
- `replaceVersionFlows`.

Do not add compatibility views, aggregate JSON columns, or dual writes.

- [ ] **Step 4: Run the guard and verify GREEN**

```bash
node --experimental-strip-types --test src/normalizedFlowWiring.test.ts
```

Expected: PASS with zero active aggregate-column references.

- [ ] **Step 5: Commit checkpoint only if explicitly requested**

```bash
git add src services/import-worker/src scripts
git commit -m "refactor: remove legacy flow persistence paths"
```

## Task 9: Full verification and disposable new-import smoke test

**Files:**
- Modify tests only if a verified regression exposes a real gap

- [ ] **Step 1: Run disposable migration verification**

```bash
MIGRATION_TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/postgres \
  npm run db:verify
```

Expected: empty and upgrade databases reach migration head 34, rerun applies
zero migrations, and cleanup succeeds.

- [ ] **Step 2: Run disposable normalized import verification**

```bash
FLOW_IMPORT_TEST_ADMIN_URL=postgres://postgres:postgres@127.0.0.1:5432/postgres \
  node --experimental-strip-types scripts/verify-normalized-flow-store.ts
```

Expected: all current, merge, version, hierarchy, mapping, concurrency,
idempotency, and rollback cases PASS.

- [ ] **Step 3: Run focused crawl/import suites**

```bash
node --experimental-strip-types --test \
  src/normalizedFlowStore.test.ts \
  src/normalizedFlowWiring.test.ts \
  src/dbAppDetailQueries.test.ts \
  src/db.appKnowledgeEvidence.test.ts \
  src/catalogVerification.test.ts \
  src/crawlRun.test.ts \
  src/autonomousAcceptance.test.ts \
  src/autonomousOrchestrator.test.ts \
  scripts/merge-catalog-databases.test.ts \
  services/import-worker/src/*.test.ts \
  services/api/src/app.test.ts
```

Expected: zero failures.

- [ ] **Step 4: Run the full suite and production build**

```bash
npm test
npm run build
git diff --check
```

Expected: zero test failures, successful Vite build, and no whitespace errors.
If the pre-existing `MediaGridCard` compliance baseline still fails, report it
separately and do not attribute it to normalized Flow persistence.

- [ ] **Step 5: Audit active source references**

```bash
rg -n \
  '(?:af|afv)\\.flows|SELECT flows FROM app_flow|INSERT INTO app_flow[^\\n]*flows|UPDATE app_flows SET flows' \
  src services/import-worker scripts \
  --glob '!*.test.ts' \
  --glob '!*.test.tsx'
```

Expected: no active crawl/import matches. Allowed matches are limited to
migration 0034, migration verification, and explicitly excluded historical
repair tooling.

- [ ] **Step 6: Verify the application database was not mutated**

Confirm the test-created database was dropped and no command targeted the
configured application `DATABASE_URL`.

- [ ] **Step 7: Review the final diff**

```bash
git status --short
git diff --stat
git diff -- src/normalizedFlowStore.ts src/db.ts src/crawlStore.ts src/autonomousStore.ts \
  services/import-worker/src/index.ts src/catalogVerification.ts \
  scripts/merge-catalog-databases.ts
```

Expected: only planned source, test, spec, plan, and the pre-existing app-detail
fix files are modified.

- [ ] **Step 8: Commit and push only if explicitly requested**

```bash
git add -A
git commit -m "feat: persist new imports with hierarchical flows"
git push origin main
```
