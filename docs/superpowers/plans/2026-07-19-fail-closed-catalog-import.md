# Fail-Closed Catalog Import Implementation Plan

> **For implementation:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent any Mobbin app import with missing Screens, UI Elements, Flows, invalid flow evidence, or missing stored objects from being marked done.

**Architecture:** Use Mobbin's displayed totals as the source of truth for all three crawl stages, then run one shared PostgreSQL persistence gate before changing a job to `done`. A failed stage remains isolated to the current app; its repair flags stay intact and the worker proceeds to the next queued app.

**Tech Stack:** TypeScript, Node.js test runner, Playwright, PostgreSQL/Supabase, S3-compatible object storage.

---

### Task 1: Make UI Element completeness use Mobbin's displayed total

**Files:**
- Modify: `src/catalogImportGate.test.ts`
- Modify: `src/progress.ts:105-108`
- Modify: `src/bulkDownload.ts:608`

- [ ] **Step 1: Write the failing test**

Replace the permissive UI-target test with:

```typescript
test("UI completeness uses Mobbin's displayed total when fewer cards were selected", async () => {
  const progress = await import("./progress.ts") as Record<string, unknown>;
  const target = progress.catalogCaptureTarget as (shown: number) => number;
  assert.equal(target(144), 144);
});
```

- [ ] **Step 2: Run it and verify RED**

Run: `node --experimental-strip-types --test --test-name-pattern="UI completeness" src/catalogImportGate.test.ts`

Expected: FAIL because the current helper accepts the selected-card count as the target.

- [ ] **Step 3: Implement the minimal target rule**

Replace the helper with:

```typescript
export function catalogCaptureTarget(shown: number): number {
  return shown;
}
```

Update `crawlBulkDownload` to call `catalogCaptureTarget(discovered)`. Keep `selectedForDownload` only for diagnostic logging.

- [ ] **Step 4: Verify GREEN**

Run: `node --experimental-strip-types --test src/catalogImportGate.test.ts src/bulkDownload.test.ts`

Expected: PASS; a `136/144` UI import returns an error outcome.

- [ ] **Step 5: Commit**

```bash
git add src/progress.ts src/catalogImportGate.test.ts src/bulkDownload.ts
git commit -m "fix: require full Mobbin UI element totals"
```

### Task 2: Make Flow completeness use Mobbin's displayed total

**Files:**
- Modify: `src/bulkDownload.test.ts`
- Modify: `src/bulkDownload.ts:109-118`
- Modify: `src/bulkDownload.ts:702-859`

- [ ] **Step 1: Write failing flow-total tests**

```typescript
test("flow coverage fails when the crawl sees fewer rows than Mobbin shows", () => {
  const flow = (id: string): DesignFlow => ({ id, title: id, description: "", tags: [], steps: [] });
  assert.deepEqual(flowStageCoverage(4, ["a", "b", "c"], [flow("mobbin-flow-a")], [
    flow("mobbin-flow-b"), flow("mobbin-flow-c"),
  ]), {
    discovered: 4,
    captured: 3,
    complete: false,
    missingRowIds: [],
    undiscovered: 1,
  });
});

test("flow coverage fails when a seen row was not persisted", () => {
  const flow = (id: string): DesignFlow => ({ id, title: id, description: "", tags: [], steps: [] });
  assert.deepEqual(flowStageCoverage(3, ["a", "b", "c"], [flow("mobbin-flow-a")], [flow("mobbin-flow-b")]), {
    discovered: 3,
    captured: 2,
    complete: false,
    missingRowIds: ["c"],
    undiscovered: 0,
  });
});
```

- [ ] **Step 2: Run them and verify RED**

Run: `node --experimental-strip-types --test --test-name-pattern="flow coverage" src/bulkDownload.test.ts`

Expected: FAIL because coverage does not accept Mobbin's displayed total.

- [ ] **Step 3: Implement displayed-total coverage**

```typescript
export function flowStageCoverage(
  expectedTotal: number,
  seenRowIds: Iterable<string>,
  existing: readonly DesignFlow[],
  incoming: readonly DesignFlow[],
): { discovered: number; captured: number; complete: boolean; missingRowIds: string[]; undiscovered: number } {
  const seen = [...new Set(seenRowIds)];
  const available = new Set([...existing, ...incoming].map((flow) => flow.id));
  const missingRowIds = seen.filter((rowId) => !available.has(`mobbin-flow-${rowId}`));
  const captured = seen.length - missingRowIds.length;
  const undiscovered = Math.max(0, expectedTotal - seen.length);
  return {
    discovered: expectedTotal,
    captured,
    complete: seen.length === expectedTotal && captured === expectedTotal,
    missingRowIds,
    undiscovered,
  };
}
```

After the zero-flow redirect check, call `shownTotalCount(probe)`. Return an error when it is `null`. Pass that value into `flowStageCoverage`, and return it as `StageOutcome.discovered`.

- [ ] **Step 4: Verify GREEN**

Run: `node --experimental-strip-types --test src/bulkDownload.test.ts`

Expected: PASS for missing seen rows, wholly undiscovered rows, transient retries, and retry exhaustion.

- [ ] **Step 5: Commit**

```bash
git add src/bulkDownload.ts src/bulkDownload.test.ts
git commit -m "fix: verify flows against Mobbin totals"
```

### Task 3: Add a shared persisted catalog verification module

**Files:**
- Create: `src/catalogVerification.ts`
- Create: `src/catalogVerification.test.ts`
- Modify: `scripts/verify-catalog-import.ts:20-120`

- [ ] **Step 1: Write failing pure-gate tests**

```typescript
import assert from "node:assert/strict";
import test from "node:test";
import { catalogPersistenceRepair, type CatalogPersistenceSnapshot } from "./catalogVerification.ts";

const complete: CatalogPersistenceSnapshot = {
  app: "airalo", platform: "ios", screens: 89, uiElements: 89, flows: 32,
  invalidFlowReferences: 0, missingScreenObjects: 0,
  missingUiElementObjects: 0, missingFlowObjects: 0,
};

test("persisted verification accepts complete data", () => {
  assert.deepEqual(catalogPersistenceRepair({ screens: 89, uiElements: 89, flows: 32 }, complete),
    { screens: false, uiElements: false, flows: false });
});

test("persisted verification maps gaps to exact repair phases", () => {
  assert.deepEqual(catalogPersistenceRepair(
    { screens: 89, uiElements: 89, flows: 32 },
    { ...complete, screens: 88, missingUiElementObjects: 1, invalidFlowReferences: 1 },
  ), { screens: true, uiElements: true, flows: true });
});

test("missing expected totals are unauditable", () => {
  assert.deepEqual(catalogPersistenceRepair({}, complete),
    { screens: true, uiElements: true, flows: true });
});
```

- [ ] **Step 2: Run them and verify RED**

Run: `node --experimental-strip-types --test src/catalogVerification.test.ts`

Expected: FAIL because the shared module does not exist.

- [ ] **Step 3: Implement the pure repair gate**

```typescript
export interface CatalogPersistenceSnapshot {
  app: string;
  platform: string;
  screens: number;
  uiElements: number;
  flows: number;
  invalidFlowReferences: number;
  missingScreenObjects: number;
  missingUiElementObjects: number;
  missingFlowObjects: number;
}

export function catalogPersistenceRepair(
  expected: CatalogArtifactCounts,
  persisted: CatalogPersistenceSnapshot,
): CatalogRepairPhases {
  const counts = planCatalogRepair({
    expected,
    persisted: { screens: persisted.screens, uiElements: persisted.uiElements, flows: persisted.flows },
    invalidFlowReferences: persisted.invalidFlowReferences,
  });
  return {
    screens: counts.screens || persisted.missingScreenObjects > 0,
    uiElements: counts.uiElements || persisted.missingUiElementObjects > 0,
    flows: counts.flows || persisted.missingFlowObjects > 0,
  };
}
```

- [ ] **Step 4: Implement one parameterized PostgreSQL loader**

Move the existing `persistedCounts` CTE from `scripts/verify-catalog-import.ts` into `loadCatalogPersistence(db, jobs)`. Extend `image_counts` with:

```sql
count(*) FILTER (WHERE i.kind = 'screen' AND so.object_key IS NULL)::int AS missing_screen_objects,
count(*) FILTER (WHERE i.kind = 'ui_element' AND so.object_key IS NULL)::int AS missing_ui_element_objects
```

Join `stored_objects so ON so.object_key = i.object_key`. Extend the evidence CTE with:

```sql
count(*) FILTER (WHERE e IS NOT NULL AND i.id IS NOT NULL AND so.object_key IS NULL)::int AS missing_flow_objects
```

Return `Map<string, CatalogPersistenceSnapshot>` keyed by `${app}\u0000${platform}` and convert every numeric database field with `Number(...)`.

- [ ] **Step 5: Make the audit use the shared loader and verify GREEN**

Remove the duplicate local loader from `scripts/verify-catalog-import.ts`. Import `catalogJobKey`, `catalogPersistenceRepair`, and `loadCatalogPersistence`; include missing-object counters in audit output and use `catalogPersistenceRepair` for queue decisions.

Run: `node --experimental-strip-types --test src/catalogVerification.test.ts src/catalogImportGate.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/catalogVerification.ts src/catalogVerification.test.ts scripts/verify-catalog-import.ts
git commit -m "feat: add persisted catalog verification gate"
```

### Task 4: Gate `done` and continue after failed apps

**Files:**
- Modify: `src/catalogVerification.ts`
- Modify: `src/catalogVerification.test.ts`
- Modify: `scripts/catalog-import.ts:169-228`

- [ ] **Step 1: Write a failing persisted-verification error test**

```typescript
test("persisted verification error retains exact repair phases", () => {
  assert.throws(
    () => assertCatalogPersistenceComplete(
    { screens: 144, uiElements: 144, flows: 36 },
    {
      app: "5-minute-journal", platform: "ios", screens: 144, uiElements: 136, flows: 0,
      invalidFlowReferences: 0, missingScreenObjects: 0,
      missingUiElementObjects: 0, missingFlowObjects: 0,
    },
    ),
    (error: unknown) => {
      assert.ok(error instanceof CatalogPersistenceError);
      assert.deepEqual(error.repair, { screens: false, uiElements: true, flows: true });
      assert.match(error.message, /UI elements 136\/144/);
      assert.match(error.message, /flows 0\/36/);
      return true;
    },
  );
});
```

- [ ] **Step 2: Run it and verify RED**

Run: `node --experimental-strip-types --test --test-name-pattern="persisted verification error" src/catalogVerification.test.ts`

Expected: FAIL because `CatalogPersistenceError` and `assertCatalogPersistenceComplete` do not exist.

- [ ] **Step 3: Implement a typed fail-closed assertion**

Add `CatalogPersistenceError`, whose public `repair` field contains the result of `catalogPersistenceRepair`. Add `assertCatalogPersistenceComplete(expected, persisted)`, which returns normally only when all three flags are false and otherwise throws `CatalogPersistenceError` with this exact message shape:

```typescript
`Persisted verification failed: screens ${persisted.screens}/${expected.screens ?? "?"}, `
  + `UI elements ${persisted.uiElements}/${expected.uiElements ?? "?"}, `
  + `flows ${persisted.flows}/${expected.flows ?? "?"}, `
  + `invalid flow references ${persisted.invalidFlowReferences}, `
  + `missing objects ${persisted.missingScreenObjects + persisted.missingUiElementObjects + persisted.missingFlowObjects}`
```

- [ ] **Step 4: Run the persisted gate before setting `done`**

Immediately before `delete job.repair`, build expected counts from `job.verification`, load the current app-platform snapshot, and call `assertCatalogPersistenceComplete`. If it throws `CatalogPersistenceError`, assign `error.repair` to `job.repair` before rethrowing. Delete `job.repair` and set `done` only when the assertion returns normally.

- [ ] **Step 5: Remove worker shutdown after consecutive app failures**

Delete `consecutiveFailures`, `CONSECUTIVE_FAILURE_LIMIT`, and the consecutive-failure `break`. Keep the explicit `stopRequested` check. The existing loop then saves the failed app, waits the inter-app delay, and continues to the next job.

- [ ] **Step 6: Verify GREEN**

Run: `node --experimental-strip-types --test src/catalogImportGate.test.ts src/catalogVerification.test.ts src/bulkDownload.test.ts`

Expected: PASS; partial persisted data retains exact repair flags and no completeness failure can stop the worker.

- [ ] **Step 7: Commit**

```bash
git add src/catalogVerification.ts src/catalogVerification.test.ts scripts/catalog-import.ts
git commit -m "fix: fail catalog jobs on persisted gaps"
```

### Task 5: Run complete verification

**Files:**
- Verify only; no planned source changes.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`

Expected: all Node and TSX tests PASS.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: Vite build completes successfully.

- [ ] **Step 3: Run a read-only live catalog audit**

Run: `CATALOG_WORKERS=2 node --env-file=.env --import tsx scripts/verify-catalog-import.ts`

Expected: exit `0`; Airalo is not queued for flow repair while live data remains 32/32, and global invalid flow references remain `0`.

- [ ] **Step 4: Inspect scope and commits**

```bash
git status --short
git diff --check
git log --oneline -8
```

Expected: no unrelated pre-existing Vitrine, database-pool, diagnostic, or temporary files were staged or committed.
