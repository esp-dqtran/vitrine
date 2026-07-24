# App Knowledge Design-System Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reuse the 610 completed 15Five screen analyses to generate and persist an evidence-backed design language and component candidates without expanding duplicate flow steps or recrawling images.

**Architecture:** Compact completed screen analyses into design-only signals, partition them into deterministic byte-bounded chunks, persist validated chunk results for resume, and merge only those fragments. Assemble the canonical App Knowledge snapshot locally so the existing store, API, and review panel receive a normal generated draft revision.

**Tech Stack:** TypeScript, Node test runner, PostgreSQL migrations and `pg`, RabbitMQ worker transport, Antigravity browser provider, React/Vite review UI.

---

## File Map

- Create `src/appKnowledgeDesignSystem.ts`: compact signals, chunk planning, fragment parsing, canonical snapshot assembly.
- Create `src/appKnowledgeDesignSystem.test.ts`: deterministic planner, byte ceiling, validation, and assembly tests.
- Create `migrations/0019_app_knowledge_design_system_chunks.sql`: durable resumable chunk results.
- Modify `src/migrations.test.ts`: migration contract test.
- Modify `src/appKnowledgeProvider.ts`: focused chunk and merge prompt contracts.
- Modify `src/appKnowledgeProvider.test.ts`: multimodal adapter coverage for both new provider calls.
- Modify `src/appKnowledgeBrowserProvider.ts`: browser transport for chunk and merge prompts.
- Modify `src/appKnowledgeBrowserProvider.test.ts`: prompt and session serialization coverage.
- Modify `src/appKnowledgeStore.ts`: synthesis-chunk records and persistence methods.
- Modify `src/appKnowledgeStore.test.ts`: durable chunk creation, completion, failure, and resume tests.
- Modify `src/appKnowledgeService.ts`: replace the oversized final request with chunk, merge, assemble, and save.
- Modify `src/appKnowledgeService.test.ts`: 610-screen regression, resume behavior, and saved design-system assertions.
- Modify `services/import-worker/src/index.ts`: production chunk ceiling/concurrency wiring only if defaults are not sufficient.
- Modify `scripts/verify-app-knowledge-pilot.ts`: verify design-language and component output for a completed pilot.
- Modify `docs/operations/app-knowledge-antigravity.md`: document resumable design-system synthesis and recovery.

### Task 1: Add design-system domain primitives

**Files:**
- Create: `src/appKnowledgeDesignSystem.ts`
- Create: `src/appKnowledgeDesignSystem.test.ts`
- Modify: `src/appKnowledge.ts`

- [ ] **Step 1: Write the failing compact-signal and chunk-planner tests**

Add tests that create 610 screen analyses and 754 duplicate manifest entries but pass only the 610 screen analyses to the planner:

```ts
test("plans deterministic byte-bounded chunks from unique screen analyses", () => {
  const analyses = Array.from({ length: 610 }, (_, index) =>
    evidenceAnalysis(`SCREEN-${index + 1}`, {
      productArea: index % 2 ? "Performance Review" : "Home",
      pageType: index % 3 ? "dashboard" : "settings_page",
    }));

  const first = planDesignSystemChunks(analyses, 24_000);
  const second = planDesignSystemChunks([...analyses].reverse(), 24_000);

  assert.deepEqual(first, second);
  assert.equal(first.flatMap(({ signals }) => signals).length, 610);
  assert.ok(first.every((chunk) => serializedDesignSystemChunkBytes(chunk) <= 24_000));
  assert.ok(first.every(({ key }) => /^[0-9a-f]{64}$/.test(key)));
});
```

Add a second test proving one oversized signal is rejected:

```ts
test("rejects a compact signal larger than the provider byte ceiling", () => {
  const analysis = evidenceAnalysis("SCREEN-1", {
    layoutPatterns: ["x".repeat(30_000)],
  });
  assert.throws(
    () => planDesignSystemChunks([analysis], 10_000),
    /design-system signal exceeds/i,
  );
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
node --experimental-strip-types --test src/appKnowledgeDesignSystem.test.ts
```

Expected: FAIL because `appKnowledgeDesignSystem.ts` and its exports do not exist.

- [ ] **Step 3: Add fragment types and parser entry point**

In `src/appKnowledge.ts`, add:

```ts
export interface AppKnowledgeDesignSystemResult {
  componentCandidates: AppKnowledgeComponentCandidate[];
  designLanguage: AppKnowledgeDesignLanguage;
}

export function parseAppKnowledgeDesignSystemResult(
  value: unknown,
  allowedEvidenceIds: ReadonlySet<string>,
): AppKnowledgeDesignSystemResult {
  const root = object(value, "App Knowledge design system");
  const claimIds = new Set<string>();
  const componentIds = new Set<string>();
  const result = {
    componentCandidates: list(root.componentCandidates, "componentCandidates").map((item, index) =>
      parseComponent(item, allowedEvidenceIds, claimIds, componentIds, index)),
    designLanguage: parseDesignLanguage(root.designLanguage, allowedEvidenceIds, claimIds),
  };
  if (Object.values(result.designLanguage).every((claims) => claims.length === 0)) {
    throw new Error("designLanguage must contain at least one claim");
  }
  return result;
}
```

- [ ] **Step 4: Implement compact signals and deterministic chunking**

In `src/appKnowledgeDesignSystem.ts`, define:

```ts
export interface AppKnowledgeDesignSignal {
  evidenceId: string;
  productArea: string;
  pageType: string;
  viewport: AppKnowledgeEvidenceAnalysis["viewport"];
  theme: AppKnowledgeEvidenceAnalysis["theme"];
  visualHierarchy: string[];
  layoutPatterns: string[];
  contentPatterns: string[];
  imagery: string[];
  icons: string[];
  interactionPatterns: string[];
  visibleStates: string[];
  accessibilityObservations: string[];
}

export interface AppKnowledgeDesignSystemChunk {
  key: string;
  ordinal: number;
  signals: AppKnowledgeDesignSignal[];
  evidenceIds: string[];
}
```

Implement `compactDesignSignal`, `serializedDesignSystemChunkBytes`, and
`planDesignSystemChunks`. Sort by normalized product area, page type, theme,
and evidence ID. Add signals greedily while:

```ts
Buffer.byteLength(JSON.stringify({ signals: candidate }), "utf8") <= maximumBytes
```

Calculate each chunk key from the final serialized signal list:

```ts
createHash("sha256").update(JSON.stringify(signals)).digest("hex")
```

- [ ] **Step 5: Add canonical snapshot assembly tests**

Test that `assembleDesignSystemSnapshot`:

- maps each screen analysis to one `AppKnowledgeScreen`;
- generates stable screen IDs;
- creates one observed capability per normalized product area;
- uses the merged component candidates and design language;
- leaves `flows` empty;
- passes `parseAppKnowledgeSnapshot`.

```ts
const snapshot = assembleDesignSystemSnapshot({
  job,
  coverage,
  analyses: [evidenceAnalysis("SCREEN-1")],
  result: designSystemResult("SCREEN-1"),
  generatedAt: "2026-07-24T00:00:00.000Z",
});

assert.equal(snapshot.screens.length, 1);
assert.equal(snapshot.flows.length, 0);
assert.equal(snapshot.productKnowledge.capabilities.length, 1);
assert.equal(snapshot.componentCandidates[0].status, "candidate");
assert.doesNotThrow(() =>
  parseAppKnowledgeSnapshot(snapshot, new Set(["SCREEN-1"])));
```

- [ ] **Step 6: Implement canonical snapshot assembly**

Map screen fields directly from validated `AppKnowledgeEvidenceAnalysis` and
use:

```ts
{
  claims: [],
  reviewStatus: "needs_review",
}
```

Generate stable IDs by hashing canonical identity strings. Create product-area
capabilities as observed claims citing one representative screen from each
area. Keep all other product arrays empty.

- [ ] **Step 7: Run focused tests and verify GREEN**

Run:

```bash
node --experimental-strip-types --test \
  src/appKnowledge.test.ts \
  src/appKnowledgeDesignSystem.test.ts
```

Expected: PASS with zero failures.

- [ ] **Step 8: Commit the domain layer**

```bash
git add src/appKnowledge.ts src/appKnowledgeDesignSystem.ts src/appKnowledgeDesignSystem.test.ts
git commit -m "feat: add app knowledge design system planner"
```

### Task 2: Add focused provider calls

**Files:**
- Modify: `src/appKnowledgeProvider.ts`
- Modify: `src/appKnowledgeProvider.test.ts`
- Modify: `src/appKnowledgeBrowserProvider.ts`
- Modify: `src/appKnowledgeBrowserProvider.test.ts`

- [ ] **Step 1: Write failing provider-contract tests**

Extend the provider adapter test with:

```ts
await provider.synthesizeDesignSystemChunk({
  app: "15five",
  platform: "web",
  signals: [{ evidenceId: "SCREEN-1" }],
  allowedEvidenceIds: ["SCREEN-1"],
  validationError: "",
}, AbortSignal.timeout(1_000));

await provider.mergeDesignSystem({
  app: "15five",
  platform: "web",
  fragments: [{ componentCandidates: [], designLanguage: emptyDesignLanguage() }],
  allowedEvidenceIds: ["SCREEN-1"],
  validationError: "",
}, AbortSignal.timeout(1_000));
```

Assert that the adapter sends the design-system instructions, no image
attachment, and the exact payload.

- [ ] **Step 2: Run provider tests and verify RED**

Run:

```bash
node --experimental-strip-types --test \
  src/appKnowledgeProvider.test.ts \
  src/appKnowledgeBrowserProvider.test.ts
```

Expected: FAIL because the focused provider methods and prompts are missing.

- [ ] **Step 3: Add prompt contracts and instructions**

In `src/appKnowledgeProvider.ts`, add:

```ts
export interface AppKnowledgeDesignSystemChunkPrompt {
  app: string;
  platform: "ios" | "android" | "web";
  signals: unknown[];
  allowedEvidenceIds: string[];
  validationError: string;
}

export interface AppKnowledgeDesignSystemMergePrompt {
  app: string;
  platform: "ios" | "android" | "web";
  fragments: unknown[];
  allowedEvidenceIds: string[];
  validationError: string;
}
```

Extend `AppKnowledgeProvider`:

```ts
synthesizeDesignSystemChunk(
  prompt: AppKnowledgeDesignSystemChunkPrompt,
  signal: AbortSignal,
): Promise<unknown>;
mergeDesignSystem(
  prompt: AppKnowledgeDesignSystemMergePrompt,
  signal: AbortSignal,
): Promise<unknown>;
```

Add JSON-only instructions requiring canonical categories, evidence citations,
candidate-only components, and no invented tokens or evidence IDs.

- [ ] **Step 4: Implement multimodal and browser adapters**

Route both methods through `completeJson` in the generic adapter and through
`useSession` plus `requestBrowserJson` in the browser provider. Both calls use
no attachment.

- [ ] **Step 5: Run focused provider tests and verify GREEN**

Run:

```bash
node --experimental-strip-types --test \
  src/appKnowledgeProvider.test.ts \
  src/appKnowledgeBrowserProvider.test.ts \
  services/import-worker/src/appKnowledgeWorker.test.ts
```

Expected: PASS with zero failures.

- [ ] **Step 6: Commit the provider layer**

```bash
git add \
  src/appKnowledgeProvider.ts \
  src/appKnowledgeProvider.test.ts \
  src/appKnowledgeBrowserProvider.ts \
  src/appKnowledgeBrowserProvider.test.ts
git commit -m "feat: add focused design system provider calls"
```

### Task 3: Persist resumable design-system chunks

**Files:**
- Create: `migrations/0019_app_knowledge_design_system_chunks.sql`
- Modify: `src/migrations.test.ts`
- Modify: `src/appKnowledgeStore.ts`
- Modify: `src/appKnowledgeStore.test.ts`

- [ ] **Step 1: Write the failing migration test**

Add:

```ts
test("design-system chunk migration defines resumable validated fragments", async () => {
  const migration = await readFile(
    new URL("../migrations/0019_app_knowledge_design_system_chunks.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /CREATE TABLE app_knowledge_design_system_chunks/);
  assert.match(migration, /UNIQUE \\(job_id, chunk_key\\)/);
  assert.match(migration, /status IN \\('pending', 'complete', 'failed'\\)/);
  assert.match(migration, /fragment JSONB/);
});
```

- [ ] **Step 2: Run migration test and verify RED**

Run:

```bash
node --experimental-strip-types --test src/migrations.test.ts
```

Expected: FAIL with `ENOENT` for migration `0019`.

- [ ] **Step 3: Create the migration**

Create:

```sql
CREATE TABLE app_knowledge_design_system_chunks (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES app_knowledge_jobs(id) ON DELETE CASCADE,
  chunk_key TEXT NOT NULL CHECK (chunk_key ~ '^[0-9a-f]{64}$'),
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'complete', 'failed')),
  fragment JSONB CHECK (fragment IS NULL OR jsonb_typeof(fragment) = 'object'),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  error_code TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, chunk_key),
  UNIQUE (job_id, ordinal)
);

CREATE INDEX app_knowledge_design_system_chunks_job_idx
  ON app_knowledge_design_system_chunks(job_id, ordinal);
```

- [ ] **Step 4: Write failing store tests**

Add tests for:

- `prepareDesignSystemChunks` inserting pending rows idempotently;
- `designSystemChunkRecords` returning ordinal order;
- `recordDesignSystemChunkResult` storing validated JSON and attempts;
- `recordDesignSystemChunkFailure` clearing fragment and storing a sanitized
  code;
- `resumeJob` preserving completed chunk rows.

- [ ] **Step 5: Run store tests and verify RED**

Run:

```bash
node --experimental-strip-types --test src/appKnowledgeStore.test.ts
```

Expected: FAIL because the store methods do not exist.

- [ ] **Step 6: Add store types and methods**

Add:

```ts
export interface AppKnowledgeDesignSystemChunkRecord {
  key: string;
  ordinal: number;
  status: "pending" | "complete" | "failed";
  fragment?: Record<string, unknown>;
  attemptCount: number;
  errorCode?: string;
}
```

Extend `AppKnowledgeStore` with:

```ts
prepareDesignSystemChunks(
  jobId: number,
  chunks: Array<{ key: string; ordinal: number }>,
): Promise<AppKnowledgeDesignSystemChunkRecord[]>;
designSystemChunkRecords(jobId: number): Promise<AppKnowledgeDesignSystemChunkRecord[]>;
recordDesignSystemChunkResult(
  jobId: number,
  input: { key: string; fragment: Record<string, unknown>; attemptCount: number },
): Promise<void>;
recordDesignSystemChunkFailure(
  jobId: number,
  input: { key: string; errorCode: string; attemptCount: number },
): Promise<void>;
```

Use parameterized SQL and only update rows belonging to an active queued or
running job. `prepareDesignSystemChunks` must be idempotent and must reject an
ordinal already associated with a different key.

- [ ] **Step 7: Run migration and store tests and verify GREEN**

Run:

```bash
node --experimental-strip-types --test \
  src/migrations.test.ts \
  src/appKnowledgeStore.test.ts
```

Expected: PASS with zero failures.

- [ ] **Step 8: Commit durable chunk storage**

```bash
git add \
  migrations/0019_app_knowledge_design_system_chunks.sql \
  src/migrations.test.ts \
  src/appKnowledgeStore.ts \
  src/appKnowledgeStore.test.ts
git commit -m "feat: persist app knowledge synthesis chunks"
```

### Task 4: Orchestrate chunk, merge, assemble, and save

**Files:**
- Modify: `src/appKnowledgeService.ts`
- Modify: `src/appKnowledgeService.test.ts`

- [ ] **Step 1: Extend the service harness**

Add separate provider call recordings:

```ts
const designChunkCalls: AppKnowledgeDesignSystemChunkPrompt[] = [];
const designMergeCalls: AppKnowledgeDesignSystemMergePrompt[] = [];
```

Make the harness provider return a fragment citing the first allowed evidence
ID and make the in-memory store retain chunk records.

- [ ] **Step 2: Write the 610-screen regression test**

```ts
test("synthesizes design system in bounded chunks without expanding flow duplicates", async () => {
  const state = await harness({
    screenCount: 610,
    duplicateFlowStepCount: 754,
    designSystemChunkBytes: 24_000,
  });

  assert.equal(await state.service.generate("1"), "done", JSON.stringify(state.failed));
  assert.equal(state.calls.length, 0, "completed screen analyses must be reused");
  assert.equal(
    state.designChunkCalls.flatMap(({ allowedEvidenceIds }) => allowedEvidenceIds).length,
    610,
  );
  assert.ok(state.designChunkCalls.every(
    (prompt) => Buffer.byteLength(JSON.stringify(prompt), "utf8") <= 24_000,
  ));
  assert.equal(state.designMergeCalls.length, 1);
  assert.equal(state.completed?.flows.length, 0);
  assert.ok(state.completed?.designLanguage.layout.length);
});
```

- [ ] **Step 3: Run the regression test and verify RED**

Run:

```bash
node --experimental-strip-types --test \
  --test-name-pattern="bounded chunks" \
  src/appKnowledgeService.test.ts
```

Expected: FAIL because the service still calls the oversized full synthesis
method.

- [ ] **Step 4: Implement chunk orchestration**

Replace the duplicate-analysis expansion and full `provider.synthesize` call
with:

```ts
const screenAnalyses = manifest
  .filter((item) => item.kind === "screen" && item.eligibility === "eligible")
  .flatMap((item) => {
    const analysis = analyses.get(item.evidenceId);
    return analysis ? [analysis] : [];
  });
const chunks = planDesignSystemChunks(screenAnalyses, designSystemChunkBytes);
const persisted = new Map(
  (await deps.store.prepareDesignSystemChunks(
    jobId,
    chunks.map(({ key, ordinal }) => ({ key, ordinal })),
  )).map((record) => [record.key, record]),
);
```

For each chunk, reuse a complete validated fragment or call
`provider.synthesizeDesignSystemChunk` through `runValidatedProviderCall`.
Persist success or failure immediately. Use bounded concurrency and retain the
existing cancellation/rate-limit behavior.

- [ ] **Step 5: Implement compact merge and snapshot assembly**

Call `provider.mergeDesignSystem` with only validated fragments. Parse the
merged result with `parseAppKnowledgeDesignSystemResult`, then call
`assembleDesignSystemSnapshot`. Recheck source SHA-256 and save through
`completeGeneration`.

- [ ] **Step 6: Add resume and failure tests**

Add tests proving:

- completed fragments are reused after an interrupted run;
- failed chunks retry while completed chunks do not;
- a merge failure leaves `completed` undefined;
- invalid evidence citations fail before persistence;
- source drift still marks the job stale;
- rate limiting cancels outstanding chunk calls;
- quarantined UI elements never appear as trusted components.

- [ ] **Step 7: Run service tests and verify GREEN**

Run:

```bash
node --experimental-strip-types --test \
  src/appKnowledgeService.test.ts \
  src/appKnowledgeDesignSystem.test.ts \
  src/appKnowledgeStore.test.ts
```

Expected: PASS with zero failures.

- [ ] **Step 8: Commit service orchestration**

```bash
git add src/appKnowledgeService.ts src/appKnowledgeService.test.ts
git commit -m "fix: chunk app knowledge design system synthesis"
```

### Task 5: Wire worker configuration and pilot verification

**Files:**
- Modify: `services/import-worker/src/index.ts`
- Modify: `scripts/verify-app-knowledge-pilot.ts`
- Modify: `docs/operations/app-knowledge-antigravity.md`

- [ ] **Step 1: Add a failing pilot verification assertion**

Extend the verifier to fail when the current revision is missing, every
design-language category is empty, or a component has a non-candidate status:

```ts
assert.ok(snapshot.currentRevision, "App Knowledge revision is missing");
assert.ok(
  Object.values(snapshot.currentRevision.content.designLanguage)
    .some((claims) => claims.length > 0),
  "Design language is empty",
);
assert.ok(
  snapshot.currentRevision.content.componentCandidates
    .every(({ status }) => status === "candidate"),
  "Full-page evidence produced a trusted component",
);
```

- [ ] **Step 2: Run verifier tests and verify RED**

Run:

```bash
node --experimental-strip-types --test scripts/verify-app-knowledge-pilot.test.ts
```

Expected: FAIL until the new verifier behavior and fixtures are implemented.

- [ ] **Step 3: Wire explicit production limits**

Pass conservative defaults from `services/import-worker/src/index.ts`:

```ts
designSystemChunkBytes: 120_000,
designSystemChunkConcurrency: 1,
```

Keep the existing six-minute call timeout. The fix must depend on bounded
payloads, not a larger timeout.

- [ ] **Step 4: Document resume behavior**

Document:

- completed screen analyses are reused;
- chunk results persist across job resume;
- the run does not require a new login while the Antigravity session remains
  authenticated;
- a final merge failure is retried with existing chunk results;
- flow synthesis remains out of scope for this pass.

- [ ] **Step 5: Run worker and verifier tests and verify GREEN**

Run:

```bash
node --experimental-strip-types --test \
  services/import-worker/src/appKnowledgeWorker.test.ts \
  scripts/verify-app-knowledge-pilot.test.ts
```

Expected: PASS with zero failures.

- [ ] **Step 6: Commit worker and operations changes**

```bash
git add \
  services/import-worker/src/index.ts \
  scripts/verify-app-knowledge-pilot.ts \
  scripts/verify-app-knowledge-pilot.test.ts \
  docs/operations/app-knowledge-antigravity.md
git commit -m "docs: verify resumable design system extraction"
```

### Task 6: Verify the implementation

**Files:**
- No new files.

- [ ] **Step 1: Run the focused App Knowledge suite**

```bash
node --experimental-strip-types --test \
  src/appKnowledge.test.ts \
  src/appKnowledgeDesignSystem.test.ts \
  src/appKnowledgeProvider.test.ts \
  src/appKnowledgeBrowserProvider.test.ts \
  src/appKnowledgeService.test.ts \
  src/appKnowledgeStore.test.ts \
  src/migrations.test.ts \
  services/import-worker/src/appKnowledgeWorker.test.ts \
  scripts/verify-app-knowledge-pilot.test.ts
```

Expected: PASS with zero failures.

- [ ] **Step 2: Run the full test suite**

```bash
npm test
```

Expected: PASS with zero failures.

- [ ] **Step 3: Run the production build**

```bash
npm run build
```

Expected: exit code `0`.

- [ ] **Step 4: Verify migration state**

Use only the configured disposable migration database:

```bash
npm run db:verify
```

Expected: all migrations apply cleanly to empty and upgrade verification
databases. Do not point this command at the Vitrine application database.

- [ ] **Step 5: Inspect the final diff**

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; unrelated pre-existing working-tree changes
remain unstaged.

### Task 7: Apply migration, resume job 2, and verify the extracted result

**Files:**
- No code changes expected.

- [ ] **Step 1: Back up the application database**

```bash
npm run db:backup
```

Expected: a timestamped backup completes before the migration.

- [ ] **Step 2: Apply the new migration**

```bash
npm run db:check
npm run db:migrate
```

Expected: migration `0019_app_knowledge_design_system_chunks` is applied once.

- [ ] **Step 3: Ensure the durable worker is healthy**

```bash
npm run service:antigravity-worker:status
docker exec astryx-rabbitmq-1 rabbitmqctl list_queues \
  name messages_ready messages_unacknowledged consumers
```

Expected: LaunchAgent state is running and `mobbin-jobs` has one consumer.

- [ ] **Step 4: Resume job 2 through the normal authenticated API**

Call:

```http
POST /api/app-knowledge/jobs/2/resume
Content-Type: application/json

{}
```

Expected: HTTP `202` and job status `queued`. Do not update job rows or publish
RabbitMQ messages manually.

- [ ] **Step 5: Observe bounded progress**

Verify:

- the 610 evidence rows remain complete;
- no image-analysis provider calls occur;
- chunk rows progress from pending to complete;
- retries reuse completed chunks;
- one compact merge request runs after all chunks complete.

- [ ] **Step 6: Verify persistence**

Run the read-only pilot verifier:

```bash
npm run analysis:pilot:verify
```

Expected:

- job `2` is `done`;
- snapshot `1` has a generated draft revision;
- `designLanguage` has evidence-backed claims;
- component candidates cite valid `SCREEN-*` evidence;
- all generated components have `candidate` status;
- flows are empty for this pass.

- [ ] **Step 7: Verify the current review UI**

Open the 15Five App Knowledge panel and confirm:

- Design language categories render;
- Components render as review candidates;
- evidence links resolve to the captured screens;
- the revision remains a draft until explicitly reviewed.

- [ ] **Step 8: Commit any verification-only documentation correction**

If no correction is needed, skip this commit. If a command or operational note
was inaccurate, edit only `docs/operations/app-knowledge-antigravity.md`, then:

```bash
git add docs/operations/app-knowledge-antigravity.md
git commit -m "docs: correct design system recovery steps"
```

