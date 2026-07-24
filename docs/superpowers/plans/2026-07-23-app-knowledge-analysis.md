# App Knowledge Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the 15five-first, evidence-backed App Knowledge analysis pipeline and App-detail experience for Screens, Flow steps, component candidates, and Designer/Developer/Product projections.

**Architecture:** Extract the reusable integrity, retry, provider, and progress behavior from the existing Feature Document engine into shared multimodal evidence-analysis primitives. Add an App Knowledge domain with its own immutable manifests, normalized-visual cache, durable jobs, revisions, review events, and approved pointer. Run it through the existing RabbitMQ/import-worker transport, expose admin mutations and entitlement-protected approved reads through Express, and render progress with SSE in a new App-detail Analysis tab.

**Tech Stack:** TypeScript, Node.js, PostgreSQL migrations, Express, RabbitMQ/amqplib, Sharp, React 19, EventSource/SSE, Node test runner, React DOM server tests, Vite.

---

## Scope Guardrails

- The first executable target is `15five` on Web.
- Do not expose a catalog-wide queue or bulk-analysis API.
- Do not repair or reclassify the existing Mobbin UI Element corpus in this work.
- In strict evidence mode, UI Elements are quarantined unless an explicit human evidence override marks the capture as an isolated component.
- A full-page Screen can create a component candidate, never a trusted component.
- Do not add App Knowledge work to `src/caption.ts`, `src/synthesize.ts`, or the `caption-app`/`synthesize-app` queue path.
- Do not add interval polling to the App screen. Initial reads use one HTTP request and job progress uses EventSource.
- Do not overwrite an approved revision or a human-edited revision. Regeneration always creates another revision.
- Preserve unrelated changes already present in `src/vitrine/App.tsx`, `src/vitrine/useApps.ts`, and `src/vitrine/App.boundary.test.ts`.

## Public Contracts

Implement these names consistently across domain, store, API, worker, and Vitrine code:

```ts
export type AppKnowledgeReviewStatus =
  | "draft"
  | "in_review"
  | "approved"
  | "superseded";

export type AppKnowledgeJobStatus =
  | "queued"
  | "running"
  | "done"
  | "error"
  | "cancelled"
  | "stale";

export type AppKnowledgeJobStage =
  | "preparing"
  | "validating_evidence"
  | "analyzing"
  | "synthesizing"
  | "validating_output"
  | "saving"
  | "complete";

export type AppKnowledgeEvidenceKind = "screen" | "flow_step" | "ui_element";

export type AppKnowledgeEvidenceReason =
  | "eligible_screen"
  | "eligible_flow_step"
  | "ui_element_full_page_capture"
  | "ui_element_isolation_unverified"
  | "ui_element_human_override"
  | "image_missing"
  | "image_metadata_mismatch"
  | "image_type_unsupported"
  | "image_size_excessive"
  | "duplicate_visual";
```

The HTTP surface is:

```text
GET    /apps/:app/analysis?platform=web&version=1
POST   /apps/:app/analysis-jobs
GET    /app-knowledge-jobs/:jobId
GET    /app-knowledge-jobs/:jobId/events
POST   /app-knowledge-jobs/:jobId/cancel
POST   /app-knowledge-jobs/:jobId/resume
POST   /app-knowledge-jobs/:jobId/retry
POST   /app-knowledge/:snapshotId/regenerations
PATCH  /app-knowledge/:snapshotId/revisions
POST   /app-knowledge/:snapshotId/review-status
```

Admin reads may return the current draft plus job diagnostics. Non-admin reads return only the current approved revision and never expose provider diagnostics, job errors, review notes, or quarantined object metadata.

## Task 1: Define and Validate the Canonical App Knowledge Model

**Files:**

- Create: `src/appKnowledge.ts`
- Create: `src/appKnowledge.test.ts`
- Reference: `src/featureDocument.ts`
- Reference: `src/screenAnalysis.ts`
- Reference: `src/designSystem.ts`

- [ ] **Step 1: Write failing parser and projection tests**

Cover:

- observed/inferred claims without evidence are rejected;
- unknown evidence IDs are rejected;
- duplicate claim, Screen, component-candidate, and Flow IDs are rejected;
- confidence outside `[0, 1]` is rejected;
- trusted components supported only by quarantined or Screen-only evidence are rejected;
- empty required sections are rejected;
- Designer, Developer, and Product projections are deterministic and make no model calls;
- role projections retain claim IDs, kinds, confidence, and evidence IDs.

Use this fixture shape:

```ts
const observed = (id: string, text: string, evidenceIds: string[]) => ({
  id,
  kind: "observed" as const,
  text,
  evidenceIds,
  confidence: 0.9,
});

const proposed = (id: string, text: string) => ({
  id,
  kind: "proposed" as const,
  text,
  evidenceIds: [],
  confidence: 0.6,
});

test("rejects an observed claim without allowlisted evidence", () => {
  const raw = validSnapshotFixture();
  raw.productKnowledge.capabilities[0].evidenceIds = [];
  assert.throws(
    () => parseAppKnowledgeSnapshot(raw, new Set(["SCREEN-1"])),
    /requires evidence/,
  );
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
node --experimental-strip-types --test src/appKnowledge.test.ts
```

Expected: FAIL because `src/appKnowledge.ts` does not exist.

- [ ] **Step 3: Implement the canonical types and strict parser**

`src/appKnowledge.ts` must export:

```ts
export type AppKnowledgeClaimKind =
  | "observed"
  | "inferred"
  | "proposed"
  | "unknown";

export interface AppKnowledgeClaim {
  id: string;
  kind: AppKnowledgeClaimKind;
  text: string;
  evidenceIds: string[];
  confidence: number;
}

export interface AppKnowledgeCoverage {
  total: number;
  eligible: number;
  analyzed: number;
  cached: number;
  quarantined: number;
  skipped: number;
  failed: number;
  duplicateVisuals: number;
  byKind: Record<AppKnowledgeEvidenceKind, {
    total: number;
    eligible: number;
    analyzed: number;
    cached: number;
    quarantined: number;
    failed: number;
  }>;
  flowReferences: { total: number; resolved: number; uniqueImages: number };
}

export interface AppKnowledgeSnapshot {
  identity: {
    app: string;
    platform: "ios" | "android" | "web";
    captureVersionId: number;
    sourceSha256: string;
    providerModel: string;
    promptVersion: number;
    generatedAt: string;
  };
  coverage: AppKnowledgeCoverage;
  screens: AppKnowledgeScreen[];
  componentCandidates: AppKnowledgeComponentCandidate[];
  designLanguage: AppKnowledgeDesignLanguage;
  flows: AppKnowledgeFlow[];
  productKnowledge: AppKnowledgeProductKnowledge;
}
```

Use bounded text/list parsers like `src/featureDocument.ts`. Require `confidence` on every claim. Reuse `FeatureClaimKind` only as a compatible type import; do not make App Knowledge depend on Feature Document content.

Export:

```ts
export function parseAppKnowledgeSnapshot(
  value: unknown,
  allowedEvidenceIds: ReadonlySet<string>,
): AppKnowledgeSnapshot;

export function projectAppKnowledge(
  snapshot: AppKnowledgeSnapshot,
  role: "designer" | "developer" | "product",
): AppKnowledgeRoleProjection;
```

Projection functions must select and group canonical data only. They must not invent new claims or alter evidence.

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```bash
node --experimental-strip-types --test src/appKnowledge.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the domain model**

```bash
git add src/appKnowledge.ts src/appKnowledge.test.ts
git commit -m "feat: define app knowledge model"
```

## Task 2: Extract Shared Multimodal Provider and Retry Primitives

**Files:**

- Create: `src/evidenceAnalysisProvider.ts`
- Create: `src/evidenceAnalysisProvider.test.ts`
- Create: `src/evidenceAnalysisRuntime.ts`
- Create: `src/evidenceAnalysisRuntime.test.ts`
- Modify: `src/featureDocumentProvider.ts`
- Modify: `src/featureDocumentProvider.test.ts`
- Modify: `src/featureDocumentService.ts`
- Modify: `src/featureDocumentService.test.ts`
- Create: `src/appKnowledgeProvider.ts`
- Create: `src/appKnowledgeProvider.test.ts`

- [ ] **Step 1: Write failing shared-runtime tests**

Test:

- OpenAI-compatible JSON requests never expose an API key in thrown errors;
- HTTP 400/401/403/422 classify as `provider_refused`;
- timeout classifies as `provider_timeout`;
- invalid JSON/output retries with a validation error at most three times;
- transient provider errors retry at most three times;
- the shared function returns attempt count;
- Feature Document behavior stays unchanged after delegation.

The runtime contract is:

```ts
export type EvidenceAnalysisFailureCode =
  | "provider_unavailable"
  | "provider_timeout"
  | "provider_refused"
  | "output_invalid";

export class EvidenceAnalysisError extends Error {
  constructor(
    readonly code: EvidenceAnalysisFailureCode,
    message: string,
  ) {
    super(message);
  }
}

export async function runValidatedProviderCall<T>(input: {
  call(validationError: string, signal: AbortSignal): Promise<unknown>;
  parse(value: unknown): T;
  timeoutMs: number;
  retryDelayMs: number;
}): Promise<{ value: T; attemptCount: number }>;
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run:

```bash
node --experimental-strip-types --test \
  src/evidenceAnalysisProvider.test.ts \
  src/evidenceAnalysisRuntime.test.ts
```

Expected: FAIL because the shared modules do not exist.

- [ ] **Step 3: Implement the shared provider transport**

Move the base URL, API key, model validation, JSON parsing, safe HTTP errors, and image data-URL construction from `src/featureDocumentProvider.ts` into `src/evidenceAnalysisProvider.ts`.

Export:

```ts
export interface MultimodalJsonProvider {
  readonly model: string;
  completeJson(input: {
    system: string;
    text: unknown;
    image?: {
      bytes: Buffer;
      contentType: "image/png" | "image/jpeg" | "image/webp";
    };
    signal: AbortSignal;
  }): Promise<unknown>;
}

export function createMultimodalJsonProvider(
  environment: ProviderEnvironment = process.env,
  request: typeof fetch = fetch,
): MultimodalJsonProvider | undefined;
```

Thrown messages must be fixed safe strings such as `Analysis provider request failed (401)` and must never include response bodies, authorization values, object keys, or paths.

- [ ] **Step 4: Implement the shared retry/validation runtime**

Put the three-attempt loop and error classification in `src/evidenceAnalysisRuntime.ts`. Pass parser errors back as `validationError` on the next call. Retry only timeout, temporary unavailability, and invalid structured output. Do not retry refusal.

- [ ] **Step 5: Adapt Feature Documents without behavior changes**

Keep the public `FeatureDocumentProvider` and `createFeatureDocumentProvider()` signatures. Implement them as prompt adapters over `MultimodalJsonProvider`. Change `src/featureDocumentService.ts` to call `runValidatedProviderCall` while preserving:

- object-integrity checks;
- ordered previous-step context;
- existing safe error codes;
- cancellation, resume, and source-drift behavior;
- existing progress stages.

Also export:

```ts
export function featureDocumentProviderFromMultimodalJsonProvider(
  provider: MultimodalJsonProvider,
): FeatureDocumentProvider;
```

The import worker uses this adapter so Feature Documents and App Knowledge
share one configured transport.

- [ ] **Step 6: Add the App Knowledge provider adapter**

`src/appKnowledgeProvider.ts` exports:

```ts
export interface AppKnowledgeProvider {
  readonly model: string;
  analyzeEvidence(
    prompt: AppKnowledgeEvidencePrompt,
    image: RasterImage,
    signal: AbortSignal,
  ): Promise<unknown>;
  synthesize(
    prompt: AppKnowledgeSynthesisPrompt,
    signal: AbortSignal,
  ): Promise<unknown>;
}

export function appKnowledgeProviderFromMultimodalJsonProvider(
  provider: MultimodalJsonProvider,
): AppKnowledgeProvider;
```

The evidence prompt requires visible facts, exact text, visible states/actions/feedback, accessibility observations, likely intent, friction, uncertainty, and confidence. The synthesis prompt requires the exact canonical top-level structure and the claim citation rules from Task 1.

- [ ] **Step 7: Run all focused provider and Feature Document tests**

Run:

```bash
node --experimental-strip-types --test \
  src/evidenceAnalysisProvider.test.ts \
  src/evidenceAnalysisRuntime.test.ts \
  src/featureDocumentProvider.test.ts \
  src/featureDocumentService.test.ts \
  src/appKnowledgeProvider.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit the shared engine extraction**

```bash
git add \
  src/evidenceAnalysisProvider.ts \
  src/evidenceAnalysisProvider.test.ts \
  src/evidenceAnalysisRuntime.ts \
  src/evidenceAnalysisRuntime.test.ts \
  src/featureDocumentProvider.ts \
  src/featureDocumentProvider.test.ts \
  src/featureDocumentService.ts \
  src/featureDocumentService.test.ts \
  src/appKnowledgeProvider.ts \
  src/appKnowledgeProvider.test.ts
git commit -m "refactor: share multimodal evidence analysis runtime"
```

## Task 3: Build Immutable Evidence Manifests and Strict Quality Gates

**Files:**

- Create: `src/appKnowledgeEvidence.ts`
- Create: `src/appKnowledgeEvidence.test.ts`
- Modify: `src/db.ts`
- Create: `src/db.appKnowledgeEvidence.test.ts`
- Reference: `src/objectStoreDb.ts`
- Reference: `src/designSystem.ts`

- [ ] **Step 1: Write failing manifest, quality, and hash tests**

Test:

- canonical ordering is Screens by image ID, Flows by Flow identity and step order, then UI Elements by image ID;
- 754 Flow references may resolve to 610 unique Flow images without losing order;
- missing or cross-app/cross-platform/cross-version images fail with stable reason codes;
- unsupported type, excessive size, corrupt bytes, and metadata mismatch never reach the provider;
- decoded identical PNG/JPEG/WebP pixels have one normalized visual hash;
- near-duplicate pixels have different hashes;
- duplicate visuals remain separate evidence records but only one is provider-eligible;
- Screens and Flow steps are eligible;
- UI Elements default to quarantine;
- a human evidence override may make a proven isolated UI Element eligible;
- the source SHA changes when evidence ownership, Flow ordering, object SHA, capture metadata, or quarantine decision changes.

Use Sharp to generate deterministic fixtures:

```ts
const png = await sharp({
  create: {
    width: 8,
    height: 8,
    channels: 4,
    background: { r: 10, g: 20, b: 30, alpha: 1 },
  },
}).png().toBuffer();

const jpeg = await sharp(png).jpeg({ quality: 100 }).toBuffer();
assert.equal(
  await normalizedVisualSha256(png),
  await normalizedVisualSha256(jpeg),
);
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run:

```bash
node --experimental-strip-types --test \
  src/appKnowledgeEvidence.test.ts \
  src/db.appKnowledgeEvidence.test.ts
```

Expected: FAIL because the manifest builder and DB query do not exist.

- [ ] **Step 3: Add one DB read model for the complete capture version**

Add to `src/db.ts`:

```ts
export interface AppKnowledgeEvidenceSource {
  appId: number;
  app: string;
  platformId: number;
  platform: "ios" | "android" | "web";
  versionId: number;
  versionNumber: number;
  images: CrawledImage[];
  flows: DesignFlow[];
}

export async function appKnowledgeEvidenceSource(input: {
  app: string;
  platform: string;
  versionNumber: number;
}): Promise<AppKnowledgeEvidenceSource | undefined>;
```

The SQL must constrain every version image and Flow evidence image to the requested app/platform/version. Return all three image kinds in one version-scoped result. Do not call paginated `appEvidencePage()` repeatedly from the worker.

- [ ] **Step 4: Implement evidence decisions and canonical evidence IDs**

Use stable IDs:

```text
SCREEN-{imageId}
FLOW-{encodedFlowId}-STEP-{zeroPaddedStepIndex}-IMAGE-{imageId}
UI-ELEMENT-{imageId}
```

Flow IDs must be encoded deterministically without leaking URLs. Every manifest item records every occurrence, even when multiple occurrences share a normalized visual hash.

Implement:

```ts
export interface AppKnowledgeEvidenceOverride {
  imageId: number;
  decision: "eligible" | "quarantined";
  reason: string;
}

export interface AppKnowledgeEvidenceManifestItem {
  evidenceId: string;
  imageId: number;
  kind: AppKnowledgeEvidenceKind;
  eligibility: "eligible" | "quarantined" | "duplicate";
  reason: AppKnowledgeEvidenceReason;
  normalizedVisualSha256?: string;
  duplicateOfEvidenceId?: string;
  capturedAt?: string;
  viewport?: { width?: number; height?: number };
  flow?: {
    id: string;
    title: string;
    category?: string;
    stepIndex: number;
    stepLabel: string;
    interaction?: string;
  };
  object: {
    sha256: string;
    byteSize: number;
    contentType: "image/png" | "image/jpeg" | "image/webp";
  };
}
```

Strict UI Element behavior:

- `buildAppKnowledgeEvidenceManifest()` receives evidence overrides as an
  explicit input rather than reading persistence itself;
- no override: `quarantined` with `ui_element_full_page_capture` when decoded dimensions substantially match stored viewport dimensions, otherwise `ui_element_isolation_unverified`;
- explicit admin override `eligible`: eligible with `ui_element_human_override`;
- explicit admin override `quarantined`: quarantined with the stored safe reason;
- quarantine is a visible quality result and does not fail the job.

- [ ] **Step 5: Implement normalized pixel hashing**

`normalizedVisualSha256()` must:

1. decode with Sharp;
2. auto-orient;
3. convert to sRGB;
4. ensure alpha;
5. hash a header containing width, height, and channel count plus raw pixels.

Do not resize, quantize, blur, perceptually hash, or merge near duplicates.

- [ ] **Step 6: Implement source canonicalization and hash**

Hash only normalized JSON with explicit `null` for absent optional fields. The manifest hash includes every occurrence and decision. Cache identity uses:

```ts
export function appKnowledgeCacheKey(input: {
  normalizedVisualSha256: string;
  platform: string;
  promptVersion: number;
  providerModel: string;
}): string {
  return createHash("sha256").update(JSON.stringify([
    input.normalizedVisualSha256,
    input.platform,
    input.promptVersion,
    input.providerModel,
  ])).digest("hex");
}
```

- [ ] **Step 7: Run focused tests and verify they pass**

Run:

```bash
node --experimental-strip-types --test \
  src/appKnowledgeEvidence.test.ts \
  src/db.appKnowledgeEvidence.test.ts
```

Expected: PASS. The DB test may skip only when local PostgreSQL is unavailable, matching existing store-test behavior.

- [ ] **Step 8: Commit the evidence layer**

```bash
git add \
  src/appKnowledgeEvidence.ts \
  src/appKnowledgeEvidence.test.ts \
  src/db.ts \
  src/db.appKnowledgeEvidence.test.ts
git commit -m "feat: build strict app knowledge evidence manifests"
```

## Task 4: Add Durable App Knowledge Persistence

**Files:**

- Create: `migrations/0018_app_knowledge_analysis.sql`
- Create: `src/appKnowledgeStore.ts`
- Create: `src/appKnowledgeStore.test.ts`
- Modify: `src/migrations.test.ts`

- [ ] **Step 1: Write a failing store integration test**

Cover:

- unique snapshot identity `(app_id, platform_id, capture_version_id)`;
- queued job creation before manifest preparation;
- manifest freeze exactly once;
- job claim is idempotent and safe under concurrent claim attempts;
- progress, cache hits, failures, cancellation, resume, and retry persist;
- one global cache entry per cache key;
- generated revisions start `draft`;
- editing creates a new revision;
- approving sets the approved pointer;
- approved revisions cannot be edited;
- approving another revision supersedes the previous approved revision;
- review events are append-only;
- admin draft reads and approved-only customer reads;
- stale jobs cannot save or approve.

- [ ] **Step 2: Run the store test and verify it fails**

Run:

```bash
node --experimental-strip-types --test src/appKnowledgeStore.test.ts
```

Expected: FAIL because the migration and store do not exist.

- [ ] **Step 3: Create migration `0018_app_knowledge_analysis.sql`**

Create:

```text
app_knowledge_snapshots
app_knowledge_revisions
app_knowledge_jobs
app_knowledge_job_evidence
app_knowledge_evidence_cache
app_knowledge_review_events
app_knowledge_evidence_overrides
```

Required constraints:

- review status enum checks;
- job status and seven-stage checks;
- 64-character lowercase SHA-256 checks;
- JSON object/array shape checks;
- `done_count <= total_count`;
- approved pointer references a revision belonging to the same snapshot;
- current pointer references a revision belonging to the same snapshot;
- cache key is unique;
- evidence ID is unique within a job;
- one override per `(version_id, image_id)`;
- an approved revision cannot be mutated by SQL store methods.

Add:

```sql
CREATE OR REPLACE FUNCTION notify_app_knowledge_job() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('app_knowledge_jobs', NEW.id::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER app_knowledge_job_notify
AFTER INSERT OR UPDATE ON app_knowledge_jobs
FOR EACH ROW EXECUTE FUNCTION notify_app_knowledge_job();
```

- [ ] **Step 4: Implement the store**

`src/appKnowledgeStore.ts` must expose one `AppKnowledgeStore` interface and `createAppKnowledgeStore()`.

Required worker methods:

```ts
createJob(requestedBy, target, transportJobId, model, promptVersion)
claimJob(jobId)
freezeManifest(jobId, manifest, sourceSha256)
workerJob(jobId)
updateProgress(jobId, stage, doneCount)
cachedAnalysis(cacheKey)
saveCachedAnalysis(input)
recordEvidenceResult(jobId, input)
recordEvidenceFailure(jobId, input)
requestCancel(jobId)
resumeJob(jobId, transportJobId)
retryFailedEvidence(jobId, transportJobId)
markStale(jobId)
completeGeneration(jobId, snapshot)
failJob(jobId, code, safeMessage)
```

Required API/review methods:

```ts
getAdminSnapshot(snapshotId)
getApprovedSnapshotForApp(app, platform, versionNumber)
getJob(jobId)
saveRevision(snapshotId, baseRevisionId, content, userId)
setReviewStatus(snapshotId, revisionId, status, userId)
recordReviewEvent(input)
setEvidenceOverride(input)
evidenceOverrides(versionId)
```

Use transactions and row locks for freeze, complete, edit, and approval transitions.

- [ ] **Step 5: Run migration and store tests**

Run:

```bash
npm run db:check
node --experimental-strip-types --test \
  src/migrations.test.ts \
  src/appKnowledgeStore.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit persistence**

```bash
git add \
  migrations/0018_app_knowledge_analysis.sql \
  src/appKnowledgeStore.ts \
  src/appKnowledgeStore.test.ts \
  src/migrations.test.ts
git commit -m "feat: persist app knowledge analysis"
```

## Task 5: Implement the Durable App Knowledge Service

**Files:**

- Create: `src/appKnowledgeService.ts`
- Create: `src/appKnowledgeService.test.ts`
- Modify: `src/evidenceAnalysisRuntime.ts`
- Modify: `src/evidenceAnalysisRuntime.test.ts`

- [ ] **Step 1: Write failing service tests**

Cover:

- preparation freezes one immutable manifest;
- all quarantined UI Elements remain in coverage but never call the provider;
- duplicate visuals call the provider once and reuse the result for all occurrences;
- cached entries skip provider calls on a repeated manifest;
- independent Screens run with bounded concurrency;
- steps within one Flow are sequential and receive only that Flow's previous analyzed step;
- different Flows may run concurrently up to the configured bound;
- an evidence failure is persisted and synthesis may produce a partial draft;
- cancellation stops between evidence items and before synthesis/save;
- resume reuses completed job evidence and global cache entries;
- retry processes only failed evidence;
- invalid synthesis retries and never saves unparsed output;
- source drift before save marks the job stale;
- generated revision is draft;
- safe failure messages contain no provider body, API key, object key, or local path.

Use a concurrency probe:

```ts
let active = 0;
let maximum = 0;
const provider = {
  model: "test-model",
  async analyzeEvidence(prompt: AppKnowledgeEvidencePrompt) {
    active += 1;
    maximum = Math.max(maximum, active);
    await Promise.resolve();
    active -= 1;
    return analysisFixture(prompt.evidenceId);
  },
  async synthesize() {
    return validSnapshotFixture();
  },
};
```

- [ ] **Step 2: Run the service test and verify it fails**

Run:

```bash
node --experimental-strip-types --test src/appKnowledgeService.test.ts
```

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Add a small bounded mapper to the shared runtime**

Export:

```ts
export async function mapBounded<T, R>(
  items: readonly T[],
  concurrency: number,
  operation: (item: T, index: number) => Promise<R>,
): Promise<R[]>;
```

Reject concurrency below 1. Preserve input order in output. Do not add a dependency.

- [ ] **Step 4: Implement job preparation**

`createAppKnowledgeService()` dependencies:

```ts
export function createAppKnowledgeService(deps: {
  store: AppKnowledgeStore;
  provider: AppKnowledgeProvider;
  objectStore: ObjectStore;
  evidenceSource(target: AppKnowledgeTarget): Promise<AppKnowledgeEvidenceSource | undefined>;
  evidenceOverrides(versionId: number): Promise<AppKnowledgeEvidenceOverride[]>;
  imageObjectById(imageId: number): Promise<ObjectMetadata | undefined>;
  currentSourceSha256(target: AppKnowledgeTarget): Promise<string | undefined>;
  screenConcurrency?: number;
  flowConcurrency?: number;
  timeoutMs?: number;
  retryDelayMs?: number;
  maxImageBytes?: number;
}): {
  generate(jobId: string): Promise<AppKnowledgeJobStatus | undefined>;
};
```

At `preparing`, resolve the target version and load overrides from the App
Knowledge store. At `validating_evidence`, fetch and integrity-check objects,
decode normalized pixels, decide eligibility, deduplicate, compute coverage,
and freeze the manifest.

- [ ] **Step 5: Implement cache-first analysis scheduling**

For every unique eligible cache key:

1. use a persisted job result when resuming;
2. otherwise use the global evidence cache;
3. otherwise invoke the provider;
4. validate the result;
5. save the cache result and job occurrence result;
6. update durable progress.

Analyze independent Screens with `screenConcurrency` default `3`. Analyze each Flow in order; allow at most `flowConcurrency` default `2` Flows at once. A Flow step receives the previous successful result from the same Flow, never a Screen or another Flow.

- [ ] **Step 6: Implement partial synthesis and strict output validation**

Pass eligible successes, ordered Flow structure, and complete coverage statistics to synthesis. Failed items remain explicit in coverage. Parse with `parseAppKnowledgeSnapshot()`. Validate that synthesized coverage exactly matches service-computed coverage; do not trust provider-supplied counts.

Before saving:

1. check cancellation;
2. recompute current source SHA;
3. mark stale on mismatch;
4. set computed identity and coverage;
5. save a generated draft revision.

- [ ] **Step 7: Run service and shared-runtime tests**

Run:

```bash
node --experimental-strip-types --test \
  src/evidenceAnalysisRuntime.test.ts \
  src/appKnowledgeService.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit the service**

```bash
git add \
  src/evidenceAnalysisRuntime.ts \
  src/evidenceAnalysisRuntime.test.ts \
  src/appKnowledgeService.ts \
  src/appKnowledgeService.test.ts
git commit -m "feat: generate resumable app knowledge snapshots"
```

## Task 6: Wire the Queue and Import Worker

**Files:**

- Modify: `src/queue.ts`
- Modify: `src/queue.test.ts`
- Modify: `services/import-worker/src/pipeline.ts`
- Modify: `services/import-worker/src/pipeline.test.ts`
- Modify: `services/import-worker/src/index.ts`
- Create: `services/import-worker/src/appKnowledgeWorker.test.ts`

- [ ] **Step 1: Write failing queue and pipeline tests**

Test:

- `{ type: "generate-app-knowledge", runId: "12" }` parses;
- invalid, extra, negative, and non-numeric run IDs fail;
- cancelled transport jobs do not run;
- service outcomes map to transport `done`, `cancelled`, or `error`;
- unexpected worker errors set the transport job to error and rethrow for RabbitMQ retry;
- provider-not-configured failure is safe.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
node --experimental-strip-types --test \
  src/queue.test.ts \
  services/import-worker/src/pipeline.test.ts \
  services/import-worker/src/appKnowledgeWorker.test.ts
```

Expected: FAIL because the job type is unknown.

- [ ] **Step 3: Add the queue job**

Extend `Job` and `parseJob()` in `src/queue.ts`:

```ts
| { type: "generate-app-knowledge"; runId: string }
```

Use the same positive numeric run-ID validation as `generate-feature-document`.

- [ ] **Step 4: Add pipeline dispatch**

Extend `PipelineDeps`:

```ts
generateAppKnowledge: async (
  runId: string,
): Promise<AppKnowledgeJobStatus | undefined> => {
  throw new Error("App Knowledge service is not configured");
},
```

Handle the job beside `generate-feature-document`. Map `done` to transport `done`, `cancelled` to `cancelled`, and `error`/`stale`/missing to `error`.

- [ ] **Step 5: Construct the production service**

In `services/import-worker/src/index.ts`:

- create one shared `MultimodalJsonProvider`;
- adapt it to Feature Documents and App Knowledge;
- create `AppKnowledgeStore`;
- construct `AppKnowledgeService` with the existing object store and `imageObjectById`;
- use `appKnowledgeEvidenceSource()` for preparation and current source SHA calculation;
- inject the service into `createPipelineHandler()`.

Do not initialize or call `caption()`/`synthesize()` for App Knowledge.

- [ ] **Step 6: Run worker tests**

Run:

```bash
node --experimental-strip-types --test \
  src/queue.test.ts \
  services/import-worker/src/pipeline.test.ts \
  services/import-worker/src/appKnowledgeWorker.test.ts \
  services/import-worker/src/startup.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit queue and worker integration**

```bash
git add \
  src/queue.ts \
  src/queue.test.ts \
  services/import-worker/src/pipeline.ts \
  services/import-worker/src/pipeline.test.ts \
  services/import-worker/src/index.ts \
  services/import-worker/src/appKnowledgeWorker.test.ts
git commit -m "feat: process app knowledge jobs"
```

## Task 7: Add Admin Mutations, Approved Reads, and SSE

**Files:**

- Create: `services/api/src/appKnowledge.ts`
- Create: `services/api/src/appKnowledge.test.ts`
- Modify: `services/api/src/app.ts`
- Modify: `services/api/src/app.test.ts`

- [x] **Step 1: Write failing route and authorization tests**

Cover:

- admin can start one app/platform/version job;
- start rejects an unresolved version, inaccessible app, unconfigured provider, and duplicate active job;
- no bulk/catalog endpoint exists;
- ordinary entitled user receives only approved revision and deterministic requested role projection;
- ordinary user receives 404 when only a draft exists;
- ordinary user cannot see quarantine details, provider metadata, job errors, or review events;
- every mutation is admin-only;
- admin can cancel, resume, retry failed evidence, regenerate, edit, submit for review, and approve;
- stale or partial-unreviewed revisions cannot approve;
- SSE verifies admin access, sends one initial event, sends notifications, heartbeats, and closes on terminal state;
- errors use stable safe codes and do not leak provider bodies or storage information.

- [x] **Step 2: Run route tests and verify they fail**

Run:

```bash
node --experimental-strip-types --test services/api/src/appKnowledge.test.ts
```

Expected: FAIL because the router does not exist.

- [x] **Step 3: Implement request parsing and route dependencies**

`services/api/src/appKnowledge.ts` exports:

```ts
export interface AppKnowledgeRouteDependencies {
  store: AppKnowledgeStore;
  canAccessApp(user: ApiUser, app: string): Promise<boolean>;
  resolveAppVersion(
    app: string,
    platform: string,
    version?: number,
    publishedOnly?: boolean,
  ): Promise<AppVersion | undefined>;
  createJob(type: string, payload?: Record<string, unknown>): Promise<number>;
  setJobStatus(jobId: number, status: TransportJobStatus, message?: string): Promise<unknown>;
  publishJob(job: Job): Promise<void>;
  providerModel: string;
  promptVersion: number;
  acquireNotificationClient(): Promise<AppKnowledgeNotificationClient>;
  recordEvent?(input: AppKnowledgeEvent): Promise<void>;
}

export function mountAppKnowledgeRoutes(
  app: express.Express,
  requireAdmin: express.RequestHandler,
  deps: AppKnowledgeRouteDependencies,
): void;
```

Use exact-body allowlists, bounded text, platform allowlists, and positive integer validation as in `services/api/src/featureDocuments.ts`.

- [x] **Step 4: Implement approved and admin reads**

`GET /apps/:app/analysis`:

- calls `canAccessApp`;
- resolves the requested or current published version;
- for admin, returns current snapshot, current job, coverage, quality diagnostics, revisions, and review events;
- for non-admin, returns only the current approved revision and its deterministic role projection;
- accepts `role=designer|developer|product`;
- returns 404 rather than revealing that an inaccessible draft exists.

- [x] **Step 5: Implement admin job lifecycle routes**

Starting a job:

1. validates target;
2. creates transport job `generate-app-knowledge`;
3. creates the durable App Knowledge job;
4. publishes `{ type: "generate-app-knowledge", runId, jobId }`;
5. marks both records with safe `queue_unavailable` failure if publish fails.

Resume retains the frozen manifest when the source hash is unchanged. Retry resets only failed evidence. Regeneration creates another job targeting the same snapshot and never overwrites its current revision.

- [x] **Step 6: Implement revision and review routes**

Require admin for edits and status changes. Allow:

```text
draft -> in_review
in_review -> draft
in_review -> approved
```

Approval must fail with:

- `source_changed` when current source SHA differs;
- `coverage_review_required` when failed evidence exists and no review event acknowledges partial coverage;
- `invalid_review_transition` for other invalid transitions.

Approved revision content is immutable. A later approved revision supersedes the earlier approved revision transactionally.

- [x] **Step 7: Implement SSE using PostgreSQL LISTEN/NOTIFY**

Listen on `app_knowledge_jobs`, filter by job ID, send:

```text
event: app-knowledge-progress
data: {validated job JSON}
```

Send a comment heartbeat every 25 seconds. Close and release the DB client on request close. Do not add browser polling fallback.

- [x] **Step 8: Mount routes after authentication**

In `services/api/src/app.ts`:

- add `appKnowledgeStore`, model, prompt version, and notification-client defaults;
- mount App Knowledge routes after session resolution and rate limiting;
- pass the existing `requireAdmin`;
- use existing `canAccessApp`, `resolveAppVersion`, job transport, and access-event functions.

- [x] **Step 9: Run API tests**

Run:

```bash
node --experimental-strip-types --test \
  services/api/src/appKnowledge.test.ts \
  services/api/src/app.test.ts \
  services/api/src/featureDocuments.test.ts
```

Expected: PASS.

- [x] **Step 10: Commit the API**

```bash
git add \
  services/api/src/appKnowledge.ts \
  services/api/src/appKnowledge.test.ts \
  services/api/src/app.ts \
  services/api/src/app.test.ts
git commit -m "feat: expose app knowledge analysis API"
```

## Task 8: Add the Vitrine Data Client and EventSource Store

**Files:**

- Create: `src/vitrine/appKnowledgeApi.ts`
- Create: `src/vitrine/appKnowledgeApi.test.ts`
- Create: `src/vitrine/appKnowledgeStore.ts`
- Create: `src/vitrine/appKnowledgeStore.test.ts`
- Create: `src/vitrine/useAppKnowledge.ts`
- Create: `src/vitrine/useAppKnowledge.test.ts`
- Modify: `src/vitrine/useAppSectionData.ts`
- Modify: `src/vitrine/useAppSectionData.test.ts`

- [x] **Step 1: Write failing API/store tests**

Test:

- one initial GET loads analysis;
- one EventSource subscribes while a job is non-terminal;
- progress events update the cached job;
- terminal events close EventSource and trigger one final GET;
- component unmount closes EventSource;
- changing app/platform/version aborts the old GET and closes the old stream;
- retry explicitly reloads;
- no `setInterval`, `setTimeout` polling loop, or repeated `GET /api/jobs` exists.

- [x] **Step 2: Run focused tests and verify they fail**

Run:

```bash
node --experimental-strip-types --test \
  src/vitrine/appKnowledgeApi.test.ts \
  src/vitrine/appKnowledgeStore.test.ts \
  src/vitrine/useAppKnowledge.test.ts
```

Expected: FAIL because the client modules do not exist.

- [x] **Step 3: Implement typed HTTP functions**

`src/vitrine/appKnowledgeApi.ts` exports:

```ts
getAppKnowledge(app, platform, version, role, signal?)
startAppKnowledge(app, platform, version)
cancelAppKnowledgeJob(jobId)
resumeAppKnowledgeJob(jobId)
retryAppKnowledgeJob(jobId)
regenerateAppKnowledge(snapshotId)
saveAppKnowledgeRevision(snapshotId, revisionId, content)
setAppKnowledgeReviewStatus(snapshotId, revisionId, status)
subscribeAppKnowledgeJob(jobId, onUpdate, onError, eventSourceFactory?)
```

Validate all progress event fields before accepting them. Close on `done`, `error`, `cancelled`, or `stale`.

- [x] **Step 4: Implement a keyed store**

Cache key:

```ts
`${app}|${platform}|${version ?? "latest"}|${role}`
```

State:

```ts
type AppKnowledgeState =
  | { status: "idle"; data: null; error: null }
  | { status: "loading"; data: AppKnowledgeView | null; error: null }
  | { status: "ready"; data: AppKnowledgeView; error: null }
  | { status: "missing"; data: null; error: null }
  | { status: "error"; data: AppKnowledgeView | null; error: Error };
```

The store owns the EventSource cleanup handle. It performs the final refresh only after a terminal event.

- [x] **Step 5: Add `useAppKnowledge()`**

Return data, load status, error, current job, actions, and invalidation. Actions are present only when the caller role is admin.

- [x] **Step 6: Add Analysis section dependencies**

In `src/vitrine/useAppSectionData.ts`:

```ts
export type DetailSection =
  | "overview"
  | "screens"
  | "elements"
  | "flows"
  | "analysis"
  | "design-system"
  | "export"
  | "review";
```

`sectionDependencies("analysis")` returns `["versions"]`. App Knowledge data remains in its dedicated store rather than `appSectionStore`.

- [x] **Step 7: Run focused Vitrine data tests**

Run:

```bash
node --experimental-strip-types --test \
  src/vitrine/appKnowledgeApi.test.ts \
  src/vitrine/appKnowledgeStore.test.ts \
  src/vitrine/useAppKnowledge.test.ts \
  src/vitrine/useAppSectionData.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit the Vitrine data layer**

```bash
git add \
  src/vitrine/appKnowledgeApi.ts \
  src/vitrine/appKnowledgeApi.test.ts \
  src/vitrine/appKnowledgeStore.ts \
  src/vitrine/appKnowledgeStore.test.ts \
  src/vitrine/useAppKnowledge.ts \
  src/vitrine/useAppKnowledge.test.ts \
  src/vitrine/useAppSectionData.ts \
  src/vitrine/useAppSectionData.test.ts
git commit -m "feat: load app knowledge with sse progress"
```

## Task 9: Build the Analysis Tab and Role Views

**Files:**

- Create: `src/vitrine/components/AppKnowledgePanel.tsx`
- Create: `src/vitrine/AppKnowledgePanel.test.tsx`
- Create: `src/vitrine/components/AppKnowledgeEvidenceLink.tsx`
- Create: `src/vitrine/AppKnowledgeEvidenceLink.test.tsx`
- Modify: `src/vitrine/components/ScreenDetail.tsx`
- Modify: `src/vitrine/ScreenDetail.test.tsx`
- Modify: `src/vitrine/router.ts`
- Modify: `src/vitrine/router.test.ts`
- Modify: `src/vitrine/App.tsx`
- Modify: `src/vitrine/App.boundary.test.ts`

- [ ] **Step 1: Write failing UI tests**

Cover:

- Analysis tab is visible to both roles;
- missing approved analysis shows a neutral empty state to ordinary users;
- admins see Start when missing;
- header shows capture version, source freshness, provider/prompt, job/review status, and all coverage counts;
- admins see only valid lifecycle actions for the current state;
- Designer, Developer, and Product controls render deterministic projections;
- every claim renders kind, confidence, review status, and evidence links;
- quarantine and partial coverage are visible to admins;
- ordinary users cannot see draft/provider/job/quarantine diagnostics;
- evidence links target the Screen or Flow route in the same app/platform/version;
- progress is accessible with `role="status"`;
- error states show safe messages and a retry action.

- [ ] **Step 2: Run UI tests and verify they fail**

Run:

```bash
tsx --test \
  src/vitrine/AppKnowledgePanel.test.tsx \
  src/vitrine/AppKnowledgeEvidenceLink.test.tsx \
  src/vitrine/ScreenDetail.test.tsx
```

Expected: FAIL because the components do not exist and the tab is absent.

- [ ] **Step 3: Implement the Analysis header**

Use Astryx design-system components and existing CSS variables. Render:

- draft/in-review/approved/stale badge;
- coverage percentage and raw counts;
- cache reuse, duplicate visuals, quarantined, skipped, and failed;
- source version/freshness;
- provider and prompt metadata for admins only;
- Start, Cancel, Resume, Retry failed, Regenerate, and Send to review actions when valid.

Do not use browser prompts for core actions. Use inline confirmation text or the existing modal primitives.

- [ ] **Step 4: Implement role projections**

Use a three-option `ToggleButton` or `Selector`:

```text
Designer | Developer | Product
```

Sections:

- Designer: Screen taxonomy, journeys, component candidates, observed states, design-language candidates.
- Developer: component structure, variants/states, dependencies, approximate tokens, accessibility risks, proposed scaffolds.
- Product: capabilities, actors, journeys, business-rule inferences, friction, requirements, acceptance criteria, risks, open questions.

Label approximate numeric design values as `Approximate`. Label screenshot-only components as `Candidate`.

- [ ] **Step 5: Implement evidence links**

Resolve evidence from the revision manifest:

- `SCREEN-*` opens the Screens section and matching lightbox;
- `FLOW-*` opens the Flows section and matching Flow/step;
- quarantined UI Element references open the Elements section only for admins.

Extend the app route with optional selection query fields:

```ts
type AppRoute = {
  name: "app";
  appId: string;
  section?: string;
  platform?: Platform;
  version?: number;
  evidence?: string;
  flow?: string;
  step?: number;
};
```

Add `parseRouteLocation(pathname, search)` and have `useRoute()` subscribe to
both pathname and search. `routeToPath()` appends only allowlisted query
parameters. Update `src/vitrine/App.tsx` to pass the selection fields to
`ScreenDetail`. Verify stable round trips such as:

```text
/apps/15five/screens?platform=web&version=1&evidence=SCREEN-42
/apps/15five/flows?platform=web&version=1&flow=onboarding&step=3
```

Do not add a second evidence/media API.

- [ ] **Step 6: Mount the Analysis tab**

In `src/vitrine/components/ScreenDetail.tsx`:

- add `analysis` to `SECTIONS`;
- add the Analysis tab after Flows;
- accept the optional platform/version/evidence/Flow-step route selection and
  initialize the matching platform, version, lightbox, or Flow viewer;
- call `useAppKnowledge()` only when Analysis or Review is active;
- render `AppKnowledgePanel`;
- invalidate App Knowledge when the selected platform or version changes;
- preserve the existing Design System, Export, and Review behavior.

Because this file may overlap unrelated user work, inspect the current diff immediately before editing and keep the change limited to the tab, hook, and render branch.

- [ ] **Step 7: Run UI tests**

Run:

```bash
tsx --test \
  src/vitrine/AppKnowledgePanel.test.tsx \
  src/vitrine/AppKnowledgeEvidenceLink.test.tsx \
  src/vitrine/ScreenDetail.test.tsx
node --experimental-strip-types --test src/vitrine/router.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit the Analysis UI**

```bash
git add \
  src/vitrine/components/AppKnowledgePanel.tsx \
  src/vitrine/AppKnowledgePanel.test.tsx \
  src/vitrine/components/AppKnowledgeEvidenceLink.tsx \
  src/vitrine/AppKnowledgeEvidenceLink.test.tsx \
  src/vitrine/components/ScreenDetail.tsx \
  src/vitrine/ScreenDetail.test.tsx \
  src/vitrine/router.ts \
  src/vitrine/router.test.ts
git add -p src/vitrine/App.tsx src/vitrine/App.boundary.test.ts
git commit -m "feat: add app knowledge analysis views"
```

At the interactive staging prompt, stage only App Knowledge routing hunks. Leave
all pre-existing Apps gallery changes unstaged.

## Task 10: Extend the Existing Review Workspace

**Files:**

- Create: `src/vitrine/components/AppKnowledgeReviewPanel.tsx`
- Create: `src/vitrine/AppKnowledgeReviewPanel.test.tsx`
- Modify: `src/vitrine/components/CuratorReviewPanel.tsx`
- Modify: `src/vitrine/DesignSystemPanel.test.tsx`
- Modify: `src/vitrine/components/ScreenDetail.tsx`

- [ ] **Step 1: Write failing review tests**

Cover:

- Review remains admin-only;
- Design System review remains available;
- App Knowledge review lists claims by section;
- selecting a claim renders its allowlisted evidence beside it;
- admin can edit, approve, or reject a claim;
- admin can confirm/reject component candidates and approximate tokens;
- rejecting a claim preserves source evidence;
- editing creates a new draft revision;
- approving the snapshot requires in-review status and source freshness;
- partial coverage requires explicit acknowledgement;
- regeneration is available without overwriting edits.

- [ ] **Step 2: Run review tests and verify they fail**

Run:

```bash
tsx --test src/vitrine/AppKnowledgeReviewPanel.test.tsx
```

Expected: FAIL because the review panel does not exist.

- [ ] **Step 3: Implement App Knowledge review**

Render a left claim list, central editable claim/card, and evidence panel. Store edits by submitting the complete parsed snapshot against a base revision ID. The server, not the browser, performs final validation and conflict detection.

Review event actions:

```text
claim_edited
claim_approved
claim_rejected
component_confirmed
component_rejected
token_confirmed
token_rejected
partial_coverage_acknowledged
snapshot_submitted
snapshot_approved
```

Do not delete rejected evidence or claims. Mark review state and preserve audit history.

- [ ] **Step 4: Extend `CuratorReviewPanel`**

Add an internal selector:

```text
Design System | App Knowledge
```

Keep the current Design System review as the default. Pass the current App Knowledge view and action callbacks from `ScreenDetail`.

- [ ] **Step 5: Run review and existing Design System tests**

Run:

```bash
tsx --test \
  src/vitrine/AppKnowledgeReviewPanel.test.tsx \
  src/vitrine/DesignSystemPanel.test.tsx \
  src/vitrine/ScreenDetail.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit the review workspace**

```bash
git add \
  src/vitrine/components/AppKnowledgeReviewPanel.tsx \
  src/vitrine/AppKnowledgeReviewPanel.test.tsx \
  src/vitrine/components/CuratorReviewPanel.tsx \
  src/vitrine/DesignSystemPanel.test.tsx \
  src/vitrine/components/ScreenDetail.tsx
git commit -m "feat: review app knowledge claims"
```

## Task 11: Add the 15five Pilot Gate Without a Bulk Queue

**Files:**

- Create: `scripts/verify-app-knowledge-pilot.ts`
- Create: `scripts/verify-app-knowledge-pilot.test.ts`
- Modify: `package.json`
- Create: `docs/operations/app-knowledge-15five-pilot.md`

- [ ] **Step 1: Write failing verifier tests**

Feed the verifier deterministic records and test failures for:

- UI Element quarantine count not equal to 610;
- Flow reference count not equal to 754;
- unique Flow image count not equal to 610;
- unresolved Flow reference;
- silently missing eligible evidence;
- unknown citation;
- uncited observed/inferred claim;
- cache miss on repeated identical manifest;
- untested resume/cancel/retry/stale/auth/review acceptance flags;
- fewer than five reviewed complete Flows;
- any unreviewed role projection.

- [ ] **Step 2: Run verifier tests and verify they fail**

Run:

```bash
node --experimental-strip-types --test scripts/verify-app-knowledge-pilot.test.ts
```

Expected: FAIL because the verifier does not exist.

- [ ] **Step 3: Implement a read-only pilot verifier**

CLI:

```bash
node --env-file=.env --import tsx scripts/verify-app-knowledge-pilot.ts \
  --app 15five \
  --platform web \
  --version 1
```

The script must:

- perform read-only queries;
- load the latest target snapshot, manifest, evidence results, revisions, cache entries, and review events;
- recompute citation and coverage invariants;
- print a concise JSON summary;
- exit `0` only when every automated gate passes;
- exit non-zero with named failed gates;
- never enqueue work or mutate review status.

- [ ] **Step 4: Add the npm script**

```json
"analysis:pilot:verify": "node --env-file=.env --import tsx scripts/verify-app-knowledge-pilot.ts --app 15five --platform web"
```

- [ ] **Step 5: Document the human review checklist**

`docs/operations/app-knowledge-15five-pilot.md` must require:

1. review representative Screen classifications across major product areas;
2. review five complete Flows from start to completion;
3. confirm/reject component candidates;
4. inspect Designer, Developer, and Product views;
5. record reviewer correction notes;
6. approve only after automated verifier success;
7. record duration, provider cost, cache reuse, validation failures, and correction rate.

State explicitly that no catalog-wide queue is available in this release.

- [ ] **Step 6: Run verifier tests**

Run:

```bash
node --experimental-strip-types --test scripts/verify-app-knowledge-pilot.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit the pilot gate**

```bash
git add \
  scripts/verify-app-knowledge-pilot.ts \
  scripts/verify-app-knowledge-pilot.test.ts \
  package.json \
  docs/operations/app-knowledge-15five-pilot.md
git commit -m "test: gate the 15five app knowledge pilot"
```

## Task 12: Run Full Verification and Inspect the Pilot UI

**Files:**

- Modify only if verification finds a defect in files already introduced by Tasks 1-11.

- [ ] **Step 1: Check migration integrity**

Run:

```bash
npm run db:check
npm run db:verify
```

Expected: both commands pass with migration `0018_app_knowledge_analysis.sql`.

- [ ] **Step 2: Run the full automated suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Run the production build**

Run:

```bash
npm run build
```

Expected: PASS with no TypeScript or Vite errors.

- [ ] **Step 4: Verify the App screen does not poll**

Run:

```bash
rg -n "setInterval|GET /api/jobs|/api/jobs" \
  src/vitrine/appKnowledgeApi.ts \
  src/vitrine/appKnowledgeStore.ts \
  src/vitrine/useAppKnowledge.ts \
  src/vitrine/components/AppKnowledgePanel.tsx
```

Expected: no matches.

- [ ] **Step 5: Verify the legacy browser analysis path is untouched**

Run:

```bash
git diff HEAD~11 -- src/caption.ts src/synthesize.ts
```

Expected: empty diff.

- [ ] **Step 6: Run the 15five analysis through the admin UI**

With PostgreSQL, RabbitMQ, object storage, API, import worker, and Vitrine running:

1. open 15five Web;
2. select the target capture version;
3. open Analysis;
4. start the job;
5. verify SSE progress advances without periodic network reads;
6. cancel once and resume;
7. inject one retryable provider failure in the test environment and use Retry failed;
8. regenerate and verify a new revision appears;
9. change source evidence in the test fixture and verify stale behavior;
10. restore source evidence and complete a fresh run.

- [ ] **Step 7: Run the automated pilot verifier**

Run:

```bash
npm run analysis:pilot:verify -- --version 1
```

Expected before human approval: automated evidence/citation/cache gates pass, while human-review gates remain explicitly incomplete.

- [ ] **Step 8: Complete the human pilot review**

Follow `docs/operations/app-knowledge-15five-pilot.md`. Approve the snapshot only after the representative Screens, five Flows, component candidates, and all three role views pass review.

- [ ] **Step 9: Re-run the pilot verifier**

Run:

```bash
npm run analysis:pilot:verify -- --version 1
```

Expected: exit `0`, with:

```text
610 quarantined UI Elements
754 resolved Flow references
610 unique Flow images
0 unknown citations
0 uncited observed/inferred claims
all eligible evidence analyzed, cached, or explicitly failed
pilot approved
```

- [ ] **Step 10: Inspect the UI in Chrome**

Using the signed-in Chrome session:

- inspect the Analysis tab at desktop and narrow widths;
- inspect all three role projections;
- inspect evidence navigation;
- inspect draft, partial, stale, error, in-review, and approved states;
- verify ordinary-user approved-only behavior;
- verify no console errors or failed unexpected requests.

Capture screenshots for the implementation handoff.

- [ ] **Step 11: Final diff and placeholder audit**

Run:

```bash
git diff --check
rg -n "TBD|TODO|implement later|appropriate error|similar to" \
  src/appKnowledge* \
  src/evidenceAnalysis* \
  services/api/src/appKnowledge* \
  src/vitrine/appKnowledge* \
  src/vitrine/components/AppKnowledge* \
  scripts/verify-app-knowledge-pilot.ts \
  docs/operations/app-knowledge-15five-pilot.md
```

Expected: `git diff --check` passes and the placeholder scan returns no matches.

- [ ] **Step 12: Commit verification fixes, if any**

If Tasks 1-11 required no fixes, do not create an empty commit. Otherwise:

```bash
git add <only-files-fixed-during-verification>
git commit -m "fix: complete app knowledge pilot verification"
```

## Spec Coverage Checklist

- [ ] One canonical `AppKnowledgeSnapshot` drives all role views.
- [ ] Strict evidence mode accepts Screens and Flow steps and quarantines invalid UI Elements.
- [ ] Full-page Screens produce candidates, never trusted components.
- [ ] Generated output starts draft and requires human approval.
- [ ] Existing Feature Document execution behavior remains intact after shared-engine extraction.
- [ ] Manifest and source hash are immutable per job.
- [ ] Object integrity, semantic eligibility, normalized-pixel exact dedupe, and no near-duplicate merging are tested.
- [ ] Screens use bounded parallelism; Flow steps preserve per-Flow order and prior-step context.
- [ ] Cache key is visual hash + platform + prompt version + provider model.
- [ ] Every observed/inferred claim has allowlisted evidence.
- [ ] Designer, Developer, and Product views are deterministic.
- [ ] Approved revisions are immutable and later approval supersedes the old approved revision.
- [ ] Source drift marks jobs stale and prevents saving/approval.
- [ ] App Analysis and Review experiences implement the approved lifecycle and evidence navigation.
- [ ] Admin-only mutations and approved-only entitled reads are enforced.
- [ ] SSE is the only live progress mechanism on the App screen.
- [ ] Partial coverage, safe errors, quarantine, retry, resume, cancellation, and stale behavior are explicit.
- [ ] 15five passes the automated and human pilot gates before any broader rollout.
