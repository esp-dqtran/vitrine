# Flow-to-Feature-Document Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn one existing Astryx Flow and every ordered evidence image into an editable, versioned, evidence-backed Feature Document through a durable multimodal generation job.

**Architecture:** Persist a source Flow snapshot and evidence manifest before publishing an identifier-only RabbitMQ job. The import worker analyzes each image independently through the existing OpenAI-compatible configuration, persists resumable step results, synthesizes and validates the complete structured document, and creates an immutable revision. Authenticated API routes own creation, editing, review status, export, and share grants; PostgreSQL `LISTEN/NOTIFY` feeds owner-scoped SSE progress to the Vitrine Feature Document workspace.

**Tech Stack:** TypeScript, Node.js, PostgreSQL migrations and `pg`, Express, RabbitMQ/amqplib, S3-compatible `ObjectStore`, OpenAI-compatible `/chat/completions`, React/Vite, `@astryxdesign/core`, Node test runner, `tsx` React tests.

---

## Scope and execution boundary

Implement the approved design in `docs/superpowers/specs/2026-07-22-flow-feature-document-design.md`. This plan covers one source Flow per document, all ordered evidence images, structured analysis and synthesis, revisions, Markdown export, owner-scoped progress, review status, and revocable seven-day read-only sharing.

Do not add multi-Flow documents, comments, collaborative editing, arbitrary uploads, Jira/Linear/Confluence/Notion/GitHub synchronization, or automatic approval. Preserve the existing `FLOW.md` and Research Project behavior.

The source checkout has unrelated untracked `docs/design-extracts/` content. Execute only in this worktree:

```text
/Users/kai/.config/superpowers/worktrees/Astryx/flow-feature-document
```

## File structure

### Domain and persistence

- Create `src/featureDocument.ts`: canonical domain types, strict parsers, claim/citation validation, prompt contracts, and deterministic Markdown rendering.
- Create `src/featureDocumentStore.ts`: owner-scoped documents, immutable revisions, durable generation runs, step analyses, status transitions, share grants, source-staleness checks, and PostgreSQL notifications.
- Create `src/featureDocumentProvider.ts`: focused multimodal OpenAI-compatible adapter using the existing `RESEARCH_LLM_*` configuration.
- Create `src/featureDocumentService.ts`: resumable two-stage generation orchestration over stored evidence and verified object bytes.
- Create `migrations/0015_feature_documents.sql`: documents, revisions, generation jobs, step analyses, and share grants.

### Transport and API

- Modify `src/queue.ts`: add the identifier-only `generate-feature-document` queue contract.
- Modify `services/import-worker/src/pipeline.ts` and `services/import-worker/src/index.ts`: dispatch the new durable generation service.
- Create `services/api/src/featureDocuments.ts`: protected document routes, owner-scoped SSE, and public share/media routes.
- Modify `services/api/src/app.ts`: mount public share routes before authentication and protected routes after authentication; inject the new store and dependencies.

### Vitrine

- Create `src/vitrine/featureDocumentsApi.ts`: typed HTTP and EventSource client.
- Create `src/vitrine/components/FeatureDocumentSetupDialog.tsx`: evidence completeness and focus-instruction submission.
- Create `src/vitrine/components/FeatureDocumentPage.tsx`: progress or completed workspace shell.
- Create `src/vitrine/components/FeatureDocumentEditor.tsx`: section editing and explicit save.
- Create `src/vitrine/components/FeatureDocumentEvidencePanel.tsx`: citation-to-image inspection.
- Create `src/vitrine/components/FeatureDocumentRevisionHistory.tsx`: version selection and restore.
- Create `src/vitrine/components/FeatureDocumentSharePage.tsx`: public read-only presentation.
- Modify `src/vitrine/components/FlowViewer.tsx` and `src/vitrine/components/FlowsPanel.tsx`: add the Flow entry point with app/platform/version context.
- Modify `src/vitrine/router.ts`, `src/vitrine/main.tsx`, and `src/vitrine/App.tsx`: authenticated document and public share routes.

## Task 1: Define the structured Feature Document contract

**Files:**
- Create: `src/featureDocument.ts`
- Create: `src/featureDocument.test.ts`

- [ ] **Step 1: Write failing tests for classifications, citations, complete sections, and Markdown**

Create fixtures that exercise every required section and every claim kind:

```typescript
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseFeatureDocumentContent,
  parseFeatureStepAnalysis,
  renderFeatureDocumentMarkdown,
} from "./featureDocument.ts";

const evidence = new Set(["FLOW-STEP-01", "IMAGE-42"]);

test("accepts a complete document and renders its evidence appendix", () => {
  const content = parseFeatureDocumentContent(completeDocumentFixture(), evidence);
  const markdown = renderFeatureDocumentMarkdown("Checkout recovery", content, {
    sourceFlowTitle: "Recover checkout",
    generatedAt: "2026-07-22T00:00:00.000Z",
  });
  assert.equal(content.requirements[0].kind, "proposed");
  assert.match(markdown, /## Acceptance criteria/);
  assert.match(markdown, /FLOW-STEP-01/);
  assert.match(markdown, /IMAGE-42/);
});

test("rejects an observed claim without evidence", () => {
  const fixture = completeDocumentFixture();
  fixture.flowAnalysis.friction[0] = { kind: "observed", text: "No feedback", evidenceIds: [] };
  assert.throws(() => parseFeatureDocumentContent(fixture, evidence), /requires evidence/);
});

test("rejects citations outside the manifest", () => {
  const fixture = completeDocumentFixture();
  fixture.executiveSummary.recommendation.evidenceIds = ["IMAGE-999"];
  assert.throws(() => parseFeatureDocumentContent(fixture, evidence), /unknown evidence/);
});

test("accepts only one bounded step analysis for its supplied evidence", () => {
  const result = parseFeatureStepAnalysis(stepAnalysisFixture(), "IMAGE-42");
  assert.equal(result.evidenceId, "IMAGE-42");
  assert.equal(result.confidence, 0.82);
});
```

- [ ] **Step 2: Run the domain test to verify it fails**

Run:

```bash
node --experimental-strip-types --test src/featureDocument.test.ts
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/featureDocument.ts`.

- [ ] **Step 3: Implement the canonical types and strict parsers**

Expose this bounded public surface:

```typescript
export type FeatureClaimKind = "observed" | "inferred" | "proposed" | "unknown";

export interface FeatureClaim {
  id: string;
  kind: FeatureClaimKind;
  text: string;
  evidenceIds: string[];
  confidence?: number;
}

export interface FeatureAcceptanceCriterion {
  id: string;
  given: string;
  when: string;
  then: string;
  evidenceIds: string[];
}

export interface FeatureRequirement extends FeatureClaim {
  priority: "must" | "should" | "could" | "later";
  acceptanceCriteria: FeatureAcceptanceCriterion[];
}

export interface FeatureDocumentContent {
  executiveSummary: {
    purpose: FeatureClaim;
    userValue: FeatureClaim;
    recommendation: FeatureClaim;
  };
  observedFlow: {
    userGoal: FeatureClaim;
    entryPoint: FeatureClaim;
    completionPoint: FeatureClaim;
    journey: FeatureClaim[];
    actors: FeatureClaim[];
    visibleStates: FeatureClaim[];
  };
  flowAnalysis: {
    effectivePatterns: FeatureClaim[];
    friction: FeatureClaim[];
    missingStates: FeatureClaim[];
    inconsistencies: FeatureClaim[];
    risksAndAssumptions: FeatureClaim[];
  };
  proposedFeature: {
    problem: FeatureClaim;
    targetUsers: FeatureClaim[];
    goals: FeatureClaim[];
    nonGoals: FeatureClaim[];
    behavior: FeatureClaim[];
    journey: FeatureClaim[];
  };
  requirements: FeatureRequirement[];
  edgeCases: FeatureClaim[];
  successMetrics: FeatureClaim[];
  guardrailMetrics: FeatureClaim[];
  analyticsEvents: FeatureClaim[];
  dependencies: FeatureClaim[];
  openQuestions: FeatureClaim[];
}

export interface FeatureStepAnalysis {
  evidenceId: string;
  visibleUi: string[];
  visibleText: string[];
  likelyIntent: string;
  availableActions: string[];
  systemFeedback: string[];
  friction: string[];
  missingOrUncertainStates: string[];
  accessibility: string[];
  confidence: number;
}

export type FeatureDocumentReviewStatus = "draft" | "in_review" | "approved" | "superseded";
export type FeatureDocumentJobStatus = "queued" | "running" | "done" | "error" | "cancelled" | "stale";
export type FeatureDocumentJobStage = "preparing" | "analyzing" | "synthesizing" | "validating" | "saving" | "complete";

export interface FeatureEvidenceManifestItem {
  stepIndex: number;
  imageIndex: number;
  imageId: number;
  evidenceId: string;
  stepLabel: string;
  interaction?: string;
  description: string | null;
  capturedAt?: string | null;
}

export interface FeatureSourceFlow {
  app: string;
  platform: "ios" | "android" | "web";
  versionId?: number;
  flowId: string;
  title: string;
  description: string;
  category?: string;
  tags: string[];
}

export interface CreateFeatureGenerationInput {
  transportJobId: number;
  source: FeatureSourceFlow;
  evidenceManifest: FeatureEvidenceManifestItem[];
  evidenceManifestSha256: string;
  focusInstruction: string;
  promptVersion: number;
  providerModel: string;
}

export interface FeatureDocumentJobView {
  id: number;
  documentId: number;
  status: FeatureDocumentJobStatus;
  stage: FeatureDocumentJobStage;
  doneCount: number;
  totalCount: number;
  errorCode?: string;
  errorMessage?: string;
  updatedAt: string;
}

export interface FeatureDocumentRevisionView {
  id: number;
  documentId: number;
  revisionNumber: number;
  authorType: "generated" | "user" | "restored";
  content: FeatureDocumentContent;
  source: FeatureSourceFlow;
  evidenceManifest: FeatureEvidenceManifestItem[];
  focusInstruction: string;
  promptVersion: number;
  providerModel: string;
  createdAt: string;
}

export interface FeatureDocumentView {
  id: number;
  title: string;
  reviewStatus: FeatureDocumentReviewStatus;
  sourceChanged: boolean;
  currentRevision?: FeatureDocumentRevisionView;
  revisions: FeatureDocumentRevisionView[];
  currentJob?: FeatureDocumentJobView;
}

export interface FeatureDocumentShareView {
  id: number;
  documentId: number;
  revisionId: number;
  url?: string;
  expiresAt: string;
  revokedAt?: string;
}

export interface FeatureStepPrompt {
  source: FeatureSourceFlow;
  stepIndex: number;
  imageIndex: number;
  evidenceId: string;
  stepLabel: string;
  interaction?: string;
  focusInstruction: string;
  previousStepContext?: FeatureStepAnalysis;
  validationError?: string;
}

export interface FeatureSynthesisPrompt {
  source: FeatureSourceFlow;
  focusInstruction: string;
  analyses: FeatureStepAnalysis[];
  allowedEvidenceIds: string[];
  validationError?: string;
}

export function parseFeatureStepAnalysis(value: unknown, evidenceId: string): FeatureStepAnalysis;
export function parseFeatureDocumentContent(value: unknown, allowedEvidenceIds: ReadonlySet<string>): FeatureDocumentContent;
export function renderFeatureDocumentMarkdown(
  title: string,
  content: FeatureDocumentContent,
  metadata: { sourceFlowTitle: string; generatedAt: string },
): string;
```

Apply these rules in the parser:

```typescript
const requiresEvidence = (kind: FeatureClaimKind) => kind === "observed" || kind === "inferred";
if (requiresEvidence(kind) && evidenceIds.length === 0) {
  throw new Error(`${label} requires evidence`);
}
const unknown = evidenceIds.find((id) => !allowedEvidenceIds.has(id));
if (unknown) throw new Error(`${label} cites unknown evidence: ${unknown}`);
```

Require every top-level section, unique stable IDs, bounded strings, at least one requirement, and at least one acceptance criterion per `must` requirement. Render all sections in deterministic order and append an evidence-reference index.

- [ ] **Step 4: Run the test and verify it passes**

Run:

```bash
node --experimental-strip-types --test src/featureDocument.test.ts
```

Expected: PASS with the four contract tests.

- [ ] **Step 5: Commit the domain contract**

```bash
git add src/featureDocument.ts src/featureDocument.test.ts
git commit -m "feat: define feature document contract"
```

## Task 2: Add the durable database schema

**Files:**
- Create: `migrations/0015_feature_documents.sql`
- Modify: `src/migrations.test.ts`
- Modify: `scripts/verify-migrations.ts`

- [ ] **Step 1: Write a failing migration contract test**

Add:

```typescript
test("feature document migration defines revisions, resumable analyses, and revocable shares", () => {
  const migration = readFileSync("migrations/0015_feature_documents.sql", "utf8");
  assert.match(migration, /CREATE TABLE feature_documents/);
  assert.match(migration, /CREATE TABLE feature_document_revisions/);
  assert.match(migration, /CREATE TABLE feature_document_jobs/);
  assert.match(migration, /CREATE TABLE feature_document_step_analyses/);
  assert.match(migration, /CREATE TABLE feature_document_shares/);
  assert.match(migration, /pg_notify\('feature_document_jobs'/);
});
```

- [ ] **Step 2: Run the migration test and verify it fails**

Run:

```bash
node --experimental-strip-types --test src/migrations.test.ts
```

Expected: FAIL because `migrations/0015_feature_documents.sql` does not exist.

- [ ] **Step 3: Create the migration**

Use this ownership and immutability model:

```sql
CREATE TABLE feature_documents (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE RESTRICT,
  platform_id INTEGER NOT NULL REFERENCES platforms(id) ON DELETE RESTRICT,
  source_flow_id TEXT NOT NULL CHECK (char_length(source_flow_id) BETWEEN 1 AND 240),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  current_revision_id BIGINT,
  source_change_acknowledged_sha256 TEXT
    CHECK (source_change_acknowledged_sha256 IS NULL OR source_change_acknowledged_sha256 ~ '^[0-9a-f]{64}$'),
  source_change_acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE feature_document_revisions (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES feature_documents(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL CHECK (revision_number > 0),
  author_type TEXT NOT NULL CHECK (author_type IN ('generated', 'user', 'restored')),
  review_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (review_status IN ('draft', 'in_review', 'approved', 'superseded')),
  content JSONB NOT NULL CHECK (jsonb_typeof(content) = 'object'),
  source_version_id INTEGER REFERENCES app_versions(id) ON DELETE RESTRICT,
  source_flow JSONB NOT NULL CHECK (jsonb_typeof(source_flow) = 'object'),
  evidence_manifest JSONB NOT NULL CHECK (jsonb_typeof(evidence_manifest) = 'array'),
  evidence_manifest_sha256 TEXT NOT NULL CHECK (evidence_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  focus_instruction TEXT NOT NULL DEFAULT '' CHECK (char_length(focus_instruction) <= 2000),
  prompt_version INTEGER NOT NULL CHECK (prompt_version > 0),
  provider_model TEXT NOT NULL CHECK (char_length(provider_model) BETWEEN 1 AND 160),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, revision_number)
);

ALTER TABLE feature_documents
  ADD CONSTRAINT feature_documents_current_revision_fk
  FOREIGN KEY (current_revision_id) REFERENCES feature_document_revisions(id) ON DELETE RESTRICT;

CREATE TABLE feature_document_jobs (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES feature_documents(id) ON DELETE CASCADE,
  transport_job_id BIGINT NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE RESTRICT,
  requested_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'done', 'error', 'cancelled', 'stale')),
  stage TEXT NOT NULL DEFAULT 'preparing'
    CHECK (stage IN ('preparing', 'analyzing', 'synthesizing', 'validating', 'saving', 'complete')),
  done_count INTEGER NOT NULL DEFAULT 0 CHECK (done_count >= 0),
  total_count INTEGER NOT NULL CHECK (total_count > 0),
  source_version_id INTEGER REFERENCES app_versions(id) ON DELETE RESTRICT,
  source_flow JSONB NOT NULL CHECK (jsonb_typeof(source_flow) = 'object'),
  evidence_manifest JSONB NOT NULL CHECK (jsonb_typeof(evidence_manifest) = 'array'),
  evidence_manifest_sha256 TEXT NOT NULL CHECK (evidence_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  focus_instruction TEXT NOT NULL DEFAULT '' CHECK (char_length(focus_instruction) <= 2000),
  prompt_version INTEGER NOT NULL CHECK (prompt_version > 0),
  provider_model TEXT NOT NULL CHECK (char_length(provider_model) BETWEEN 1 AND 160),
  cancel_requested BOOLEAN NOT NULL DEFAULT false,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE feature_document_step_analyses (
  job_id BIGINT NOT NULL REFERENCES feature_document_jobs(id) ON DELETE CASCADE,
  step_index INTEGER NOT NULL CHECK (step_index >= 0),
  image_index INTEGER NOT NULL CHECK (image_index >= 0),
  image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE RESTRICT,
  evidence_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('complete', 'failed')),
  result JSONB,
  attempt_count INTEGER NOT NULL DEFAULT 1 CHECK (attempt_count BETWEEN 1 AND 3),
  error_code TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (job_id, step_index, image_index),
  UNIQUE (job_id, evidence_id),
  CHECK (
    (status = 'complete' AND result IS NOT NULL AND error_code IS NULL)
    OR (status = 'failed' AND result IS NULL AND error_code IS NOT NULL)
  )
);

CREATE TABLE feature_document_shares (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES feature_documents(id) ON DELETE CASCADE,
  revision_id BIGINT NOT NULL REFERENCES feature_document_revisions(id) ON DELETE CASCADE,
  token_sha256 TEXT NOT NULL UNIQUE CHECK (token_sha256 ~ '^[0-9a-f]{64}$'),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX feature_documents_owner_updated_idx ON feature_documents (user_id, updated_at DESC);
CREATE INDEX feature_document_jobs_document_idx ON feature_document_jobs (document_id, created_at DESC);
CREATE INDEX feature_document_shares_document_idx ON feature_document_shares (document_id, created_at DESC);

CREATE OR REPLACE FUNCTION notify_feature_document_job() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('feature_document_jobs', NEW.id::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER feature_document_job_notify
AFTER INSERT OR UPDATE ON feature_document_jobs
FOR EACH ROW EXECUTE FUNCTION notify_feature_document_job();
```

In `scripts/verify-migrations.ts`, add every new table to the empty-install contract:

```typescript
const FEATURE_DOCUMENT_TABLES = [
  "feature_document_jobs",
  "feature_document_revisions",
  "feature_document_shares",
  "feature_document_step_analyses",
  "feature_documents",
] as const;
```

Spread `FEATURE_DOCUMENT_TABLES` into `expectedTables` beside the other feature-specific table groups. The upgrade snapshot remains limited to pre-existing protected tables, so an upgrade proves they remain unchanged while the new tables start empty.

- [ ] **Step 4: Run migration tests and the disposable migration verifier**

Run:

```bash
node --experimental-strip-types --test src/migrations.test.ts
docker compose up -d postgres
MIGRATION_TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/astryx MIGRATION_TEST_ALLOW_DROP=1 npm run db:verify
```

Expected: both commands PASS; the verifier applies all 15 migrations to its disposable database and reports current checksums.

- [ ] **Step 5: Commit the schema**

```bash
git add migrations/0015_feature_documents.sql src/migrations.test.ts scripts/verify-migrations.ts
git commit -m "feat: add feature document persistence schema"
```

## Task 3: Implement the owner-scoped store and revisions

**Files:**
- Create: `src/featureDocumentStore.ts`
- Create: `src/featureDocumentStore.test.ts`

- [ ] **Step 1: Write failing store tests**

Cover creation, ownership, progress, resumable analyses, immutable edits, restore, status changes, staleness, and hashed shares:

```typescript
test("creates an owner-scoped document and queued generation", async () => {
  const created = await store.createGeneration(userId, generationInput);
  assert.equal(created.document.reviewStatus, "draft");
  assert.equal(created.job.stage, "preparing");
  assert.equal(created.job.totalCount, 3);
});

test("saving and restoring always creates immutable revisions", async () => {
  const generated = await store.completeGeneration(jobId, generatedRevisionInput);
  const edited = await store.saveRevision(userId, generated.documentId, generated.id, editedContent);
  const restored = await store.restoreRevision(userId, generated.documentId, generated.id);
  assert.deepEqual([generated.revisionNumber, edited.revisionNumber, restored.revisionNumber], [1, 2, 3]);
  assert.equal(restored.authorType, "restored");
});

test("never loads another user's document or job", async () => {
  assert.equal(await store.getDocument(otherUserId, documentId), undefined);
  assert.equal(await store.getJob(otherUserId, jobId), undefined);
});

test("stores only a share token hash and enforces seven-day expiry", async () => {
  const grant = await store.createShare(userId, documentId, revisionId, tokenHash, now);
  assert.equal(grant.expiresAt, "2026-07-29T00:00:00.000Z");
  assert.ok(await store.publicShare(tokenHash, new Date("2026-07-28T23:59:59.000Z")));
  assert.equal(await store.publicShare(tokenHash, new Date("2026-07-29T00:00:00.000Z")), undefined);
});
```

- [ ] **Step 2: Run the store test and verify it fails**

Run:

```bash
node --experimental-strip-types --test src/featureDocumentStore.test.ts
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/featureDocumentStore.ts`.

- [ ] **Step 3: Implement the store interface**

Expose a focused interface and map database rows at the boundary:

```typescript
export interface FeatureDocumentWorkerJob extends FeatureDocumentJobView {
  transportJobId: number;
  source: FeatureSourceFlow;
  evidenceManifest: FeatureEvidenceManifestItem[];
  evidenceManifestSha256: string;
  focusInstruction: string;
  promptVersion: number;
  providerModel: string;
  cancelRequested: boolean;
}

export interface FeatureStepAnalysisRecord {
  jobId: number;
  stepIndex: number;
  imageIndex: number;
  imageId: number;
  evidenceId: string;
  result: FeatureStepAnalysis;
  attemptCount: number;
}

export interface RecordedStepAnalysis {
  stepIndex: number;
  imageIndex: number;
  imageId: number;
  evidenceId: string;
  result: FeatureStepAnalysis;
  attemptCount: number;
}

export interface RecordedStepFailure {
  stepIndex: number;
  imageIndex: number;
  imageId: number;
  evidenceId: string;
  errorCode: string;
  attemptCount: number;
}

export interface CompleteFeatureGenerationInput {
  content: FeatureDocumentContent;
  source: FeatureSourceFlow;
  evidenceManifest: FeatureEvidenceManifestItem[];
  evidenceManifestSha256: string;
  focusInstruction: string;
  promptVersion: number;
  providerModel: string;
}

export interface PublicFeatureDocumentShare {
  title: string;
  reviewStatus: FeatureDocumentReviewStatus;
  revision: FeatureDocumentRevisionView;
  expiresAt: string;
}

export interface FeatureDocumentStore {
  createGeneration(userId: number, input: CreateFeatureGenerationInput): Promise<{ document: FeatureDocumentView; job: FeatureDocumentJobView }>;
  createRegeneration(userId: number, documentId: number, input: CreateFeatureGenerationInput): Promise<FeatureDocumentJobView | undefined>;
  getDocument(userId: number, documentId: number): Promise<FeatureDocumentView | undefined>;
  getJob(userId: number, jobId: number): Promise<FeatureDocumentJobView | undefined>;
  workerJob(jobId: number): Promise<FeatureDocumentWorkerJob | undefined>;
  requestCancel(userId: number, jobId: number): Promise<FeatureDocumentJobView | undefined>;
  claimJob(jobId: number): Promise<FeatureDocumentWorkerJob | undefined>;
  updateProgress(jobId: number, stage: FeatureDocumentJobStage, doneCount: number): Promise<void>;
  completedStepAnalyses(jobId: number): Promise<FeatureStepAnalysisRecord[]>;
  recordStepAnalysis(jobId: number, input: RecordedStepAnalysis): Promise<void>;
  recordStepFailure(jobId: number, input: RecordedStepFailure): Promise<void>;
  completeGeneration(jobId: number, input: CompleteFeatureGenerationInput): Promise<FeatureDocumentRevisionView>;
  failJob(jobId: number, code: string, safeMessage: string): Promise<void>;
  markStale(jobId: number): Promise<void>;
  saveRevision(userId: number, documentId: number, expectedRevisionId: number, content: FeatureDocumentContent): Promise<FeatureDocumentRevisionView | undefined>;
  restoreRevision(userId: number, documentId: number, revisionId: number): Promise<FeatureDocumentRevisionView | undefined>;
  setReviewStatus(userId: number, documentId: number, revisionId: number, status: FeatureDocumentReviewStatus): Promise<FeatureDocumentView | undefined>;
  acknowledgeSourceChange(userId: number, documentId: number, currentSourceSha256: string): Promise<FeatureDocumentView | undefined>;
  createShare(userId: number, documentId: number, revisionId: number, tokenSha256: string, now: Date): Promise<FeatureDocumentShareView | undefined>;
  revokeShare(userId: number, documentId: number, shareId: number): Promise<boolean>;
  documentImage(userId: number, documentId: number, revisionId: number, imageId: number): Promise<ObjectMetadata | undefined>;
  publicShare(tokenSha256: string, now: Date): Promise<PublicFeatureDocumentShare | undefined>;
  publicShareImage(tokenSha256: string, imageId: number, now: Date): Promise<ObjectMetadata | undefined>;
}
```

Use transactions with `SELECT ... FOR UPDATE` for current-revision changes. Validate `FeatureDocumentContent` on every generated, edited, and restored revision. Generated, edited, and restored revisions begin as `draft`. A transition to `approved` updates that immutable revision's review status and marks any older approved revision for the same document `superseded` in the same transaction. `FeatureDocumentView.reviewStatus` is the current revision's status.

Compute `sourceChanged` by comparing the current source checksum with the current revision manifest checksum unless that exact current checksum was explicitly acknowledged. Acknowledgement stores the checksum and timestamp; a later source change becomes visible again.

Store `tokenSha256`, never the raw share token. Set `expires_at = now + interval '7 days'`. `publicShareImage` must join the share's revision evidence manifest to `images` and `stored_objects`; never accept an object key from the caller.

- [ ] **Step 4: Run the store test and verify it passes**

Run:

```bash
node --experimental-strip-types --test src/featureDocumentStore.test.ts
```

Expected: PASS, including ownership and immutable revision cases.

- [ ] **Step 5: Commit the store**

```bash
git add src/featureDocumentStore.ts src/featureDocumentStore.test.ts
git commit -m "feat: add feature document store"
```

## Task 4: Add the multimodal provider adapter

**Files:**
- Create: `src/featureDocumentProvider.ts`
- Create: `src/featureDocumentProvider.test.ts`

- [ ] **Step 1: Write failing provider tests**

Verify configuration, image encoding, prompt separation, JSON-only output, safe failures, and cancellation:

```typescript
test("sends one verified image and structured step context", async () => {
  const provider = createFeatureDocumentProvider(environment, requestSpy);
  const result = await provider!.analyzeImage(stepPrompt, {
    bytes: Buffer.from("png"),
    contentType: "image/png",
  }, new AbortController().signal);
  const body = JSON.parse(String(calls[0].init?.body));
  assert.equal(body.model, "research-model");
  assert.equal(body.messages[1].content[1].type, "image_url");
  assert.match(body.messages[1].content[1].image_url.url, /^data:image\/png;base64,/);
  assert.deepEqual(result, providerResultFixture());
});

test("synthesis sends no image bytes and includes the validation repair message", async () => {
  await provider!.synthesize({ ...synthesisPrompt, validationError: "unknown evidence IMAGE-9" }, signal);
  const body = String(calls[0].init?.body);
  assert.doesNotMatch(body, /base64/);
  assert.match(body, /unknown evidence IMAGE-9/);
});
```

- [ ] **Step 2: Run the provider test and verify it fails**

Run:

```bash
node --experimental-strip-types --test src/featureDocumentProvider.test.ts
```

Expected: FAIL because the provider module is absent.

- [ ] **Step 3: Implement the provider**

Reuse `RESEARCH_LLM_BASE_URL`, `RESEARCH_LLM_API_KEY`, and `RESEARCH_LLM_MODEL`. Expose:

```typescript
export interface FeatureDocumentProvider {
  readonly model: string;
  analyzeImage(
    prompt: FeatureStepPrompt,
    image: { bytes: Buffer; contentType: "image/png" | "image/jpeg" | "image/webp" },
    signal: AbortSignal,
  ): Promise<unknown>;
  synthesize(prompt: FeatureSynthesisPrompt, signal: AbortSignal): Promise<unknown>;
}

export function createFeatureDocumentProvider(
  environment: ProviderEnvironment = process.env,
  request: typeof fetch = fetch,
): FeatureDocumentProvider | undefined;
```

Use a multimodal user message for image analysis:

```typescript
content: [
  { type: "text", text: JSON.stringify(prompt) },
  { type: "image_url", image_url: { url: `data:${image.contentType};base64,${image.bytes.toString("base64")}`, detail: "high" } },
]
```

Use `temperature: 0.1`, `response_format: { type: "json_object" }`, a 60-second step signal supplied by the service, and generic errors such as `Feature analysis provider request failed (503)`. Never include the API key, body, image, prompt, or provider response in thrown errors.

- [ ] **Step 4: Run provider and existing research-provider tests**

Run:

```bash
node --experimental-strip-types --test src/featureDocumentProvider.test.ts src/researchSynthesisProvider.test.ts
```

Expected: PASS; the existing research synthesis contract remains unchanged.

- [ ] **Step 5: Commit the provider**

```bash
git add src/featureDocumentProvider.ts src/featureDocumentProvider.test.ts
git commit -m "feat: add multimodal feature document provider"
```

## Task 5: Build the resumable generation service

**Files:**
- Create: `src/featureDocumentService.ts`
- Create: `src/featureDocumentService.test.ts`

- [ ] **Step 1: Write failing orchestration tests**

Use injected store, provider, object store, and metadata lookup fakes:

```typescript
test("analyzes every ordered image then creates one validated revision", async () => {
  await service.generate(String(job.id));
  assert.deepEqual(provider.imageCalls.map((call) => call.prompt.evidenceId), [
    "FLOW-STEP-01-IMAGE-42",
    "FLOW-STEP-01-IMAGE-43",
    "FLOW-STEP-02-IMAGE-44",
  ]);
  assert.equal(store.completed[0].content.requirements.length, 2);
  assert.deepEqual(store.progress, [
    ["preparing", 0], ["analyzing", 0], ["analyzing", 1],
    ["analyzing", 2], ["analyzing", 3], ["synthesizing", 3],
    ["validating", 3], ["saving", 3],
  ]);
});

test("resumes from persisted analyses and retries only the failed image", async () => {
  store.stepAnalyses = [completedAnalysisFor("FLOW-STEP-01-IMAGE-42")];
  await service.generate(String(job.id));
  assert.deepEqual(provider.imageCalls.map((call) => call.prompt.evidenceId), [
    "FLOW-STEP-01-IMAGE-43",
    "FLOW-STEP-02-IMAGE-44",
  ]);
});

test("never saves a partial document after cancellation or source drift", async () => {
  store.cancelAfterFirstImage = true;
  await service.generate(String(job.id));
  assert.equal(store.completed.length, 0);
  assert.equal(store.jobs.get(job.id)?.status, "cancelled");
});
```

- [ ] **Step 2: Run the service test and verify it fails**

Run:

```bash
node --experimental-strip-types --test src/featureDocumentService.test.ts
```

Expected: FAIL because the service module is absent.

- [ ] **Step 3: Implement preparation, per-image analysis, synthesis, and repair**

Expose:

```typescript
export function createFeatureDocumentService(deps: {
  store: FeatureDocumentStore;
  provider: FeatureDocumentProvider;
  objectStore: ObjectStore;
  imageObjectById(imageId: number): Promise<ObjectMetadata | undefined>;
  currentSourceManifest(input: FeatureSourceFlow): Promise<{ sha256: string }>;
  timeoutMs?: number;
}): { generate(jobId: string): Promise<void> };
```

For each manifest entry in `(stepIndex, imageIndex)` order:

1. Reuse a completed analysis only when the stored evidence ID belongs to this job.
2. Resolve metadata with `imageObjectById(imageId)`.
3. Load bytes through `objectStore.get(metadata.key)`.
4. Verify returned metadata, byte size, SHA-256, and raster content type.
5. Call `provider.analyzeImage()` with `AbortSignal.timeout(timeoutMs ?? 60_000)`.
6. Parse with `parseFeatureStepAnalysis()`.
7. Retry one invalid result with the validation error in the prompt.
8. Persist completion or a stable redacted error code.
9. Re-read cancellation state before starting the next provider call.

After all images succeed, synthesize in manifest order, validate with `parseFeatureDocumentContent()`, and retry once with the exact validation error. Recompute the current source manifest before `completeGeneration()`; call `markStale()` instead if the checksum changed.

Map errors to stable codes: `image_missing`, `image_metadata_mismatch`, `image_type_unsupported`, `provider_unavailable`, `provider_timeout`, `provider_refused`, `step_invalid`, and `document_invalid`. Persist only safe messages.

- [ ] **Step 4: Run service tests and storage regression tests**

Run:

```bash
node --experimental-strip-types --test src/featureDocumentService.test.ts src/objectStoreDb.test.ts src/objectStore.test.ts
```

Expected: PASS, including resume and no-partial-publication cases.

- [ ] **Step 5: Commit the generation service**

```bash
git add src/featureDocumentService.ts src/featureDocumentService.test.ts
git commit -m "feat: generate feature documents from flow evidence"
```

## Task 6: Dispatch generation through RabbitMQ and the import worker

**Files:**
- Modify: `src/queue.ts`
- Modify: `src/queue.test.ts`
- Modify: `services/import-worker/src/pipeline.ts`
- Modify: `services/import-worker/src/pipeline.test.ts`
- Modify: `services/import-worker/src/index.ts`

- [ ] **Step 1: Write failing queue and pipeline tests**

Add the identifier-only contract:

```typescript
test("queue accepts only an identifier-only feature document job", () => {
  assert.deepEqual(parseJob({ type: "generate-feature-document", runId: "27", jobId: 9 }), {
    type: "generate-feature-document", runId: "27", jobId: 9,
  });
  assert.throws(() => parseJob({
    type: "generate-feature-document", runId: "27", image: "base64", jobId: 9,
  }), /Invalid queue job/);
});

test("pipeline dispatches feature document generation and tracks transport status", async () => {
  await handler({ type: "generate-feature-document", runId: "27", jobId: 9 });
  assert.deepEqual(events, ["job:9:running", "feature:27", "job:9:done"]);
});
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run:

```bash
node --experimental-strip-types --test src/queue.test.ts services/import-worker/src/pipeline.test.ts
```

Expected: FAIL because `generate-feature-document` is rejected.

- [ ] **Step 3: Add the queue type and worker dispatch**

Extend `Job`:

```typescript
| { type: "generate-feature-document"; runId: string }
```

Parse exact keys `type`, `runId`, and optional `jobId`; require `/^[1-9]\d*$/`. Do not permit app names, image IDs, prompts, evidence manifests, object keys, or user content in the message.

Add this dependency to `PipelineDeps`:

```typescript
generateFeatureDocument: async (_runId: string): Promise<void> => {
  throw new Error("Feature document service is not configured");
},
```

Dispatch before the existing generic `handle()` branches:

```typescript
if (job.type === "generate-feature-document") {
  await deps.generateFeatureDocument(job.runId);
  if (job.jobId != null) await deps.setJobStatus(job.jobId, "done");
  return;
}
```

In `services/import-worker/src/index.ts`, create the store, provider, and service once. Refuse worker startup with a clear configuration error only when a feature-document job is actually handled; existing import/crawl jobs must continue when the multimodal provider is unconfigured.

- [ ] **Step 4: Run worker and queue tests**

Run:

```bash
node --experimental-strip-types --test src/queue.test.ts services/import-worker/src/pipeline.test.ts services/import-worker/src/startup.test.ts
```

Expected: PASS; existing import, crawl, and synthesis dispatch remains unchanged.

- [ ] **Step 5: Commit transport integration**

```bash
git add src/queue.ts src/queue.test.ts services/import-worker/src/pipeline.ts services/import-worker/src/pipeline.test.ts services/import-worker/src/index.ts
git commit -m "feat: dispatch feature document jobs"
```

## Task 7: Add protected APIs, public shares, and push progress

**Files:**
- Create: `services/api/src/featureDocuments.ts`
- Create: `services/api/src/featureDocuments.test.ts`
- Modify: `services/api/src/app.ts`
- Modify: `services/api/src/app.test.ts`

- [ ] **Step 1: Write failing route tests**

Cover creation, exact Flow selection, all-image completeness, ownership, save conflict, regenerate, cancellation, SSE, export, share hashing, public access, and public media:

```typescript
test("creates a durable generation only after every Flow image is object-backed", async () => {
  const response = await post("/feature-documents", {
    app: "linear", platform: "web", version: 3, flowId: "create-issue", focusInstruction: "Focus on recovery",
  });
  assert.equal(response.status, 201);
  assert.deepEqual(published[0], { type: "generate-feature-document", runId: "31", jobId: 72 });
  assert.equal(created.manifest.length, 4);
});

test("rejects an incomplete Flow without publishing", async () => {
  imageObjectById.set(44, undefined);
  const response = await post("/feature-documents", requestBody);
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    error: "Flow evidence is incomplete", code: "flow_evidence_incomplete", missing: ["FLOW-STEP-02-IMAGE-44"],
  });
  assert.equal(published.length, 0);
});

test("streams only the owner's durable job updates", async () => {
  const response = await fetch(`${base}/feature-document-jobs/31/events`);
  assert.equal(response.headers.get("content-type"), "text/event-stream");
  assert.match(await firstEvent(response), /"stage":"analyzing"/);
});

test("public share exposes only the selected revision and allowlisted image", async () => {
  assert.equal((await fetch(`${base}/feature-document-shares/${token}`)).status, 200);
  assert.equal((await fetch(`${base}/feature-document-shares/${token}/media/42`)).status, 200);
  assert.equal((await fetch(`${base}/feature-document-shares/${token}/media/999`)).status, 404);
});
```

- [ ] **Step 2: Run API tests and verify they fail**

Run:

```bash
node --experimental-strip-types --test services/api/src/featureDocuments.test.ts services/api/src/app.test.ts
```

Expected: FAIL because the new routes are not mounted.

- [ ] **Step 3: Implement the route module**

Export two mounting functions so public routes remain before the session middleware:

```typescript
export function mountPublicFeatureDocumentRoutes(app: express.Express, deps: PublicFeatureDocumentRouteDeps): void;
export function mountFeatureDocumentRoutes(app: express.Express, deps: FeatureDocumentRouteDeps): void;
```

Protected routes:

```text
POST   /feature-documents
GET    /feature-documents/:documentId
GET    /feature-documents/:documentId/revisions/:revisionId/media/:imageId
PATCH  /feature-documents/:documentId/revisions
POST   /feature-documents/:documentId/regenerations
POST   /feature-documents/:documentId/revisions/:revisionId/restore
POST   /feature-documents/:documentId/review-status
POST   /feature-documents/:documentId/source-change/acknowledge
GET    /feature-documents/:documentId/export.md
POST   /feature-documents/:documentId/shares
DELETE /feature-documents/:documentId/shares/:shareId
GET    /feature-document-jobs/:jobId
POST   /feature-document-jobs/:jobId/cancel
GET    /feature-document-jobs/:jobId/events
```

Public routes:

```text
GET /feature-document-shares/:token
GET /feature-document-shares/:token/media/:imageId
```

Creation must:

1. Validate exact body keys and bounds.
2. Require `canAccessApp()`.
3. Resolve the requested published version for normal users and permitted draft/version for admins through `getVersionFlows()` and `flowEvidenceImages()`.
4. Select exactly one Flow by `flowId`.
5. Flatten every evidence image in step/image order.
6. Require a stored object for every image ID.
7. Build stable evidence IDs `FLOW-STEP-${NN}-IMAGE-${imageId}`.
8. Create the generic `jobs` row and dedicated generation row.
9. Publish only `{ type, runId, jobId }`.
10. Mark both rows failed and return `503` when publish fails.

Generate share tokens with `randomBytes(32).toString("base64url")`, persist only `createHash("sha256").update(token).digest("hex")`, and return the raw token once in the share URL. Bound tokens to 43 characters before hashing on public reads.

Record privacy-safe feature events for generation requested/completed/failed, revision saved/restored, review transition, export, share creation, and revocation. Event metadata may contain IDs, counts, stage, duration, status, and error code only; it must exclude Flow text, image content, prompts, focus instructions, generated content, edits, tokens, and URLs.

For SSE, acquire a dedicated `pg` client, `LISTEN feature_document_jobs`, filter notification payloads to the authorized `jobId`, reload the owner-scoped job, and emit:

```text
event: feature-document-progress
data: {serialized job view}

```

Send an initial snapshot and a 25-second heartbeat. Release the client on connection close. Do not add browser or server interval polling.

- [ ] **Step 4: Mount routes at the correct authentication boundaries**

In `createApiApp()`:

```typescript
mountPublicFeatureDocumentRoutes(app, publicFeatureDocumentDeps);
// existing session middleware follows
mountFeatureDocumentRoutes(app, protectedFeatureDocumentDeps);
```

Add store/provider state and exact existing dependencies to `defaults`; do not add new logic to the already-large `app.ts` beyond construction and route mounting.

- [ ] **Step 5: Run API tests**

Run:

```bash
node --experimental-strip-types --test services/api/src/featureDocuments.test.ts services/api/src/app.test.ts
```

Expected: PASS, including unauthenticated public share access and authenticated ownership isolation.

- [ ] **Step 6: Commit API integration**

```bash
git add services/api/src/featureDocuments.ts services/api/src/featureDocuments.test.ts services/api/src/app.ts services/api/src/app.test.ts
git commit -m "feat: expose feature document APIs"
```

## Task 8: Add the Vitrine API client and routes

**Files:**
- Create: `src/vitrine/featureDocumentsApi.ts`
- Create: `src/vitrine/featureDocumentsApi.test.ts`
- Modify: `src/vitrine/router.ts`
- Modify: `src/vitrine/router.test.ts`
- Modify: `src/vitrine/main.tsx`
- Modify: `src/vitrine/App.tsx`

- [ ] **Step 1: Write failing HTTP and route tests**

```typescript
test("round-trips authenticated documents and public share routes", () => {
  assert.deepEqual(parseRoutePath("/feature-documents/12"), { name: "feature-document", documentId: 12 });
  assert.equal(routeToPath({ name: "feature-document", documentId: 12 }), "/feature-documents/12");
  assert.deepEqual(parseRoutePath("/feature-document-shares/token_abc"), { name: "feature-document-share", token: "token_abc" });
});

test("creates a generation with exact source identity", async () => {
  await createFeatureDocument({ app: "linear", platform: "web", version: 3, flowId: "create-issue", focusInstruction: "Recovery" }, request);
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
    app: "linear", platform: "web", version: 3, flowId: "create-issue", focusInstruction: "Recovery",
  });
});
```

- [ ] **Step 2: Run focused frontend tests and verify they fail**

Run:

```bash
node --experimental-strip-types --test src/vitrine/featureDocumentsApi.test.ts src/vitrine/router.test.ts
```

Expected: FAIL because the client and routes are absent.

- [ ] **Step 3: Implement typed requests and EventSource subscription**

Expose:

```typescript
export function createFeatureDocument(input: CreateFeatureDocumentRequest): Promise<{ documentId: number; jobId: number }>;
export function getFeatureDocument(documentId: number): Promise<FeatureDocumentView>;
export function saveFeatureDocumentRevision(documentId: number, revisionId: number, content: FeatureDocumentContent): Promise<FeatureDocumentRevisionView>;
export function regenerateFeatureDocument(documentId: number, focusInstruction: string): Promise<FeatureDocumentJobView>;
export function restoreFeatureDocumentRevision(documentId: number, revisionId: number): Promise<FeatureDocumentRevisionView>;
export function setFeatureDocumentReviewStatus(documentId: number, revisionId: number, status: FeatureDocumentReviewStatus): Promise<FeatureDocumentView>;
export function acknowledgeFeatureDocumentSourceChange(documentId: number): Promise<FeatureDocumentView>;
export function cancelFeatureDocumentJob(jobId: number): Promise<FeatureDocumentJobView>;
export function createFeatureDocumentShare(documentId: number, revisionId: number): Promise<FeatureDocumentShareView>;
export function revokeFeatureDocumentShare(documentId: number, shareId: number): Promise<void>;
export function subscribeFeatureDocumentJob(jobId: number, onUpdate: (job: FeatureDocumentJobView) => void, onError: (error: Error) => void): () => void;
```

The EventSource subscription listens only for `feature-document-progress`, validates the parsed job ID/status/stage/counts, and closes itself on terminal status or caller cleanup.

- [ ] **Step 4: Add route types and app boundaries**

Extend `Route` with:

```typescript
| { name: "feature-document"; documentId: number }
| { name: "feature-document-share"; token: string }
```

Render the public share route in `Root` before the authentication/loading branches. Treat `feature-document` as an authenticated deep link. Add the authenticated `FeatureDocumentPage` branch in `App` after Projects and before app-detail loading.

- [ ] **Step 5: Run frontend client and route tests**

Run:

```bash
node --experimental-strip-types --test src/vitrine/featureDocumentsApi.test.ts src/vitrine/router.test.ts src/vitrine/mainBoundary.test.ts
```

Expected: PASS and existing route boundaries remain stable.

- [ ] **Step 6: Commit routing and API client**

```bash
git add src/vitrine/featureDocumentsApi.ts src/vitrine/featureDocumentsApi.test.ts src/vitrine/router.ts src/vitrine/router.test.ts src/vitrine/main.tsx src/vitrine/App.tsx
git commit -m "feat: route feature document workspaces"
```

## Task 9: Add Flow setup and durable progress UI

**Files:**
- Create: `src/vitrine/components/FeatureDocumentSetupDialog.tsx`
- Create: `src/vitrine/components/FeatureDocumentProgress.tsx`
- Modify: `src/vitrine/components/FlowViewer.tsx`
- Modify: `src/vitrine/components/FlowsPanel.tsx`
- Modify: `src/vitrine/components/FlowsPanel.test.tsx`
- Create: `src/vitrine/FeatureDocumentGeneration.test.tsx`

- [ ] **Step 1: Write failing component tests**

```tsx
test("shows every evidence image count and blocks an empty Flow", () => {
  const html = renderToStaticMarkup(<FeatureDocumentSetupDialog {...props} flow={flowWithThreeImages()} />);
  assert.match(html, /3 images across 2 steps/);
  assert.match(html, /Focus instruction/);
});

test("Flow viewer opens generation with exact source context", async () => {
  render(<FlowsPanel flows={[flow]} app="linear" platform="web" version={3} />);
  await user.click(screen.getByRole("button", { name: "Open Create issue" }));
  await user.click(screen.getByRole("button", { name: "Create Feature Document" }));
  await user.type(screen.getByLabelText("Focus instruction"), "Focus on recovery");
  await user.click(screen.getByRole("button", { name: "Analyze Flow" }));
  assert.deepEqual(createCalls[0], { app: "linear", platform: "web", version: 3, flowId: flow.id, focusInstruction: "Focus on recovery" });
});
```

- [ ] **Step 2: Run component tests and verify they fail**

Run:

```bash
npx tsx --test src/vitrine/components/FlowsPanel.test.tsx src/vitrine/FeatureDocumentGeneration.test.tsx
```

Expected: FAIL because the setup and action do not exist.

- [ ] **Step 3: Implement setup and entry point**

Pass `app`, `platform`, and `version` from `ScreenDetail` through `FlowsPanel` into `FlowViewer`. Add **Create Feature Document** beside the back/header controls. The dialog must display:

```typescript
const stepCount = flow.steps.length;
const imageCount = flow.steps.reduce((sum, step) => sum + step.evidence.length, 0);
const missingSteps = flow.steps.flatMap((step, index) => step.evidence.length ? [] : [index + 1]);
```

Disable **Analyze Flow** when any step has no evidence or the request is in flight. Bound the focus instruction to 2,000 characters and preserve the server error message.

On success, navigate to `{ name: "feature-document", documentId }`; the page loads the returned current job and subscribes to SSE.

- [ ] **Step 4: Implement the progress component**

Render the exact durable stages and counts from the job view:

```typescript
const labels = {
  preparing: "Preparing evidence",
  analyzing: `Analyzing image ${Math.min(job.doneCount + 1, job.totalCount)} of ${job.totalCount}`,
  synthesizing: "Synthesizing requirements",
  validating: "Validating citations",
  saving: "Saving draft",
  complete: "Feature Document ready",
} as const;
```

Show cancel only for queued/running jobs, retry/regenerate after error/stale, and a reconnect action after EventSource failure. Do not add `setInterval`, repeated `GET`, or Apps-screen job reads.

- [ ] **Step 5: Run component tests**

Run:

```bash
npx tsx --test src/vitrine/components/FlowsPanel.test.tsx src/vitrine/FeatureDocumentGeneration.test.tsx
```

Expected: PASS, including the no-polling assertion.

- [ ] **Step 6: Commit generation UI**

```bash
git add src/vitrine/components/FeatureDocumentSetupDialog.tsx src/vitrine/components/FeatureDocumentProgress.tsx src/vitrine/components/FlowViewer.tsx src/vitrine/components/FlowsPanel.tsx src/vitrine/components/FlowsPanel.test.tsx src/vitrine/FeatureDocumentGeneration.test.tsx
git commit -m "feat: start feature documents from flows"
```

## Task 10: Build the editable workspace and evidence inspector

**Files:**
- Create: `src/vitrine/components/FeatureDocumentPage.tsx`
- Create: `src/vitrine/components/FeatureDocumentEditor.tsx`
- Create: `src/vitrine/components/FeatureDocumentEvidencePanel.tsx`
- Create: `src/vitrine/components/FeatureDocumentRevisionHistory.tsx`
- Create: `src/vitrine/FeatureDocumentWorkspace.test.tsx`
- Modify: `src/vitrine/styles.css`

- [ ] **Step 1: Write failing workspace tests**

```tsx
test("opens a citation in the evidence panel", async () => {
  render(<FeatureDocumentPage documentId={12} />);
  await screen.findByText("Checkout recovery");
  await user.click(screen.getByRole("button", { name: "IMAGE-42" }));
  assert.equal(screen.getByRole("img", { name: /Flow step 1 image 1/ }).getAttribute("src"), "/api/feature-documents/12/revisions/4/media/42");
});

test("saves edits as a new revision and never mutates the loaded revision", async () => {
  render(<FeatureDocumentPage documentId={12} />);
  await user.clear(await screen.findByLabelText("Problem statement"));
  await user.type(screen.getByLabelText("Problem statement"), "Users cannot recover checkout");
  await user.click(screen.getByRole("button", { name: "Save new revision" }));
  assert.deepEqual(saveCalls[0], { documentId: 12, revisionId: 4, content: expect.any(Object) });
  assert.equal(await screen.findByText("Revision 5"), true);
});

test("regeneration preserves the selected human revision", async () => {
  render(<FeatureDocumentPage documentId={12} />);
  await user.click(await screen.findByRole("button", { name: "Regenerate" }));
  assert.equal(screen.getByText("Revision 4 · User edit") !== null, true);
});
```

- [ ] **Step 2: Run the workspace test and verify it fails**

Run:

```bash
npx tsx --test src/vitrine/FeatureDocumentWorkspace.test.tsx
```

Expected: FAIL because the workspace components are absent.

- [ ] **Step 3: Implement the page state boundary**

`FeatureDocumentPage` owns remote loading, the selected revision ID, job subscription, save/regenerate/restore/status actions, and error recovery. It delegates editing and evidence display; it must not contain field-by-field document rendering.

Use a three-column desktop grid and responsive single-column order:

```css
.feature-document-workspace {
  display: grid;
  grid-template-columns: minmax(180px, 240px) minmax(0, 1fr) minmax(260px, 340px);
  gap: 16px;
}
@media (max-width: 980px) {
  .feature-document-workspace { grid-template-columns: 1fr; }
}
```

- [ ] **Step 4: Implement structured editing**

Render named fields for all nine document sections. Preserve claim IDs, classifications, evidence IDs, requirement priorities, and acceptance-criterion IDs while editing text. Do not reduce the document to an unconstrained Markdown textarea.

Save only through **Save new revision**. Keep a deep-cloned local draft and show an unsaved-changes guard before selecting another revision or leaving the page.

- [ ] **Step 5: Implement evidence and revision panels**

Evidence buttons use the revision manifest, not arbitrary URLs. The inspector shows step number, image position, image description, capture metadata, and the protected document-media route. Revision history labels generated/user/restored revisions, source version, model, prompt version, focus instruction, and source-changed state.

Restore creates a new revision after confirmation. Regenerate opens the focus instruction dialog and leaves the current revision selected until the new generated revision is complete. Revision history supports selecting a second revision for a side-by-side structured comparison without altering either snapshot. A **Retain current document** action acknowledges the exact current source checksum; a later source change reopens the warning.

- [ ] **Step 6: Run workspace tests**

Run:

```bash
npx tsx --test src/vitrine/FeatureDocumentWorkspace.test.tsx
npm run build
```

Expected: component tests PASS and Vite production build completes without TypeScript/bundling errors.

- [ ] **Step 7: Commit the workspace**

```bash
git add src/vitrine/components/FeatureDocumentPage.tsx src/vitrine/components/FeatureDocumentEditor.tsx src/vitrine/components/FeatureDocumentEvidencePanel.tsx src/vitrine/components/FeatureDocumentRevisionHistory.tsx src/vitrine/FeatureDocumentWorkspace.test.tsx src/vitrine/styles.css
git commit -m "feat: add editable feature document workspace"
```

## Task 11: Add review, Markdown export, and read-only sharing

**Files:**
- Create: `src/vitrine/components/FeatureDocumentSharePage.tsx`
- Create: `src/vitrine/FeatureDocumentSharing.test.tsx`
- Modify: `src/vitrine/components/FeatureDocumentPage.tsx`
- Modify: `src/vitrine/featureDocumentsApi.ts`
- Modify: `src/vitrine/main.tsx`

- [ ] **Step 1: Write failing sharing and lifecycle tests**

```tsx
test("moves one selected revision through draft, review, and approval", async () => {
  render(<FeatureDocumentPage documentId={12} />);
  await user.click(await screen.findByRole("button", { name: "Submit for review" }));
  await user.click(screen.getByRole("button", { name: "Approve revision" }));
  assert.deepEqual(statusCalls, [
    { documentId: 12, revisionId: 5, status: "in_review" },
    { documentId: 12, revisionId: 5, status: "approved" },
  ]);
});

test("creates a seven-day share and can revoke it", async () => {
  render(<FeatureDocumentPage documentId={12} />);
  await user.click(await screen.findByRole("button", { name: "Create read-only share" }));
  assert.match(screen.getByRole("textbox", { name: "Share URL" }).getAttribute("value") ?? "", /feature-document-shares/);
  await user.click(screen.getByRole("button", { name: "Revoke share" }));
  assert.equal(revokeCalls.length, 1);
});

test("public share renders citations without an authenticated shell", async () => {
  render(<FeatureDocumentSharePage token={token} />);
  assert.equal(await screen.findByText("Read-only Feature Document") !== null, true);
  assert.match(screen.getByRole("img", { name: /Flow step/ }).getAttribute("src") ?? "", new RegExp(token));
});
```

- [ ] **Step 2: Run sharing tests and verify they fail**

Run:

```bash
npx tsx --test src/vitrine/FeatureDocumentSharing.test.tsx
```

Expected: FAIL because public sharing UI is absent.

- [ ] **Step 3: Implement review and export actions**

Show only valid transitions:

```typescript
const nextActions = {
  draft: ["in_review"],
  in_review: ["draft", "approved"],
  approved: [],
  superseded: [],
} as const;
```

Editing an `in_review` or `approved` revision saves a new Draft revision. Download Markdown from `/api/feature-documents/:id/export.md`; use the server `Content-Disposition` filename and export the selected revision recorded by the server.

- [ ] **Step 4: Implement share creation, revocation, and public presentation**

Create one seven-day share for the selected revision, provide copy/open controls, show expiry, and allow revocation. The public page renders the canonical structured model and loads only evidence images from:

```text
/api/feature-document-shares/{token}/media/{imageId}
```

It has no sidebar, account controls, edit actions, internal object references, app entitlement traversal, or links to unpublished catalog content. Expired/revoked/not-found shares use one non-enumerating unavailable state.

- [ ] **Step 5: Run sharing, route, and build verification**

Run:

```bash
npx tsx --test src/vitrine/FeatureDocumentSharing.test.tsx
node --experimental-strip-types --test src/vitrine/router.test.ts src/vitrine/mainBoundary.test.ts
npm run build
```

Expected: all commands PASS.

- [ ] **Step 6: Commit lifecycle and sharing**

```bash
git add src/vitrine/components/FeatureDocumentSharePage.tsx src/vitrine/FeatureDocumentSharing.test.tsx src/vitrine/components/FeatureDocumentPage.tsx src/vitrine/featureDocumentsApi.ts src/vitrine/main.tsx
git commit -m "feat: review and share feature documents"
```

## Task 12: Complete integration, runtime proof, and documentation

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `docker-compose.yml` only if the import worker does not already receive `RESEARCH_LLM_*`
- Modify: focused files from earlier tasks only when verification exposes a defect

- [ ] **Step 1: Document configuration and operational behavior**

Add to `.env.example` and README:

```dotenv
# Used by Research Projects and Flow-to-Feature-Document generation.
RESEARCH_LLM_BASE_URL=https://api.openai.com/v1
RESEARCH_LLM_API_KEY=
RESEARCH_LLM_MODEL=
```

Document that provider configuration is server/worker-only, every image is sent to the configured provider, logs exclude prompts/content, generation is durable and resumable, shares expire after seven days, and incomplete source evidence blocks submission.

- [ ] **Step 2: Run every focused automated suite**

Run:

```bash
node --experimental-strip-types --test \
  src/featureDocument.test.ts \
  src/featureDocumentStore.test.ts \
  src/featureDocumentProvider.test.ts \
  src/featureDocumentService.test.ts \
  src/queue.test.ts \
  services/api/src/featureDocuments.test.ts \
  services/import-worker/src/pipeline.test.ts
npx tsx --test \
  src/vitrine/FeatureDocumentGeneration.test.tsx \
  src/vitrine/FeatureDocumentWorkspace.test.tsx \
  src/vitrine/FeatureDocumentSharing.test.tsx \
  src/vitrine/components/FlowsPanel.test.tsx
```

Expected: all tests PASS with zero failures.

- [ ] **Step 3: Run full static and regression verification**

Run:

```bash
npm test
npm run build
npm run build-storybook
npm run db:check
git diff --check
```

Expected:

- `npm test`: at least the 787 clean-baseline tests plus new Feature Document tests pass.
- Vite and Storybook builds complete.
- Migration checks report all 15 migrations current.
- `git diff --check` reports no whitespace errors.

- [ ] **Step 4: Run a real multimodal provider acceptance**

With configured `RESEARCH_LLM_*`, a migrated disposable/local database, RabbitMQ, object storage, API, worker, and Vitrine:

1. Sign in as an entitled product manager.
2. Open a real Flow containing at least three ordered images and at least two steps.
3. Confirm setup reports every image.
4. Start generation and verify SSE advances without repeated `GET` polling.
5. Leave the page, return, and verify the durable run resumes/displays.
6. Open the result and inspect at least three citations against the correct images.
7. Edit and save a user revision.
8. Regenerate and verify the user revision remains available.
9. Submit and approve the selected revision.
10. Export Markdown and verify all required sections plus the evidence appendix.
11. Create a share in a signed-out browser, open its evidence, revoke it, and verify it becomes unavailable.

Capture browser screenshots and a redacted job/revision record. Do not capture provider credentials, prompts, generated private text, signed URLs, or image bytes in logs.

- [ ] **Step 5: Verify source-change and recovery acceptance**

In a controlled fixture or local database:

1. Interrupt the worker after one completed step analysis.
2. Restart it and verify only remaining images are sent.
3. Start another generation, change the pinned source Flow/version before completion, and verify the job becomes `stale` without replacing the current revision.
4. Cancel a third job and verify no partial revision exists.

- [ ] **Step 6: Commit documentation and final fixes**

```bash
git add .env.example README.md docker-compose.yml
git commit -m "docs: document feature document generation"
```

The import worker currently does not receive `RESEARCH_LLM_*`, so `docker-compose.yml` must pass those three variables into `import-worker`. If verification exposes a defect in an earlier focused file, return to that task, fix its named file, rerun that task's tests, and create a separate exact-path commit before this documentation commit. Never stage all files from the worktree.

- [ ] **Step 7: Review the final branch against the approved specification**

Run:

```bash
git log --oneline --decorate main..HEAD
git diff --stat main...HEAD
git status --short
```

Expected: only Flow-to-Feature-Document implementation, tests, migrations, and documentation are present; the worktree is clean. If real provider credentials or an authorized Flow are unavailable, report that exact acceptance item as externally blocked rather than claiming full end-to-end completion.
