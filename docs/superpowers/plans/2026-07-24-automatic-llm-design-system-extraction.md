# Automatic LLM Design-System Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically turn every verified app/platform crawl into an evidence-backed, LLM-inferred design-system draft in the existing Design System tab, including approximate tokens, component families and variants, validated specimen crops, design rules, and ordered Flow insights.

**Architecture:** Extend the existing App Knowledge evidence and chunk pipeline so its immutable generated revision is the canonical result. Derive verified crops from normalized LLM regions, project the revision deterministically into the existing `DesignSystemSnapshot`, and seed only empty or replaceable generated working copies. A shared idempotent coordinator creates durable automatic jobs after crawl verification; the existing Design System tab observes those jobs over SSE and reloads its snapshot once on completion.

**Tech Stack:** TypeScript, Node test runner, PostgreSQL/Supabase migrations and `pg`, RabbitMQ, Sharp, S3-compatible object storage, Express, React 19, SSE/EventSource, Vite.

---

## Guardrails

- Work on `main` only because the user explicitly selected it.
- Do not edit an existing migration. Add `migrations/0021_automatic_llm_design_system_extraction.sql` after the current `0020` head.
- Preserve unrelated dirty work, especially the Flow Markdown removal changes already present in overlapping files.
- Do not use the production Supabase database for tests. Use the repository's disposable PostgreSQL verification boundary and restore runtime state after it.
- Do not make LLM generation part of crawl success.
- Do not turn quarantined full-screen `ui_element` images into component specimens.
- Do not overwrite reviewed working copies or immutable published design-system versions.
- Do not add polling. Active generation is observed through the existing App Knowledge SSE channel.
- Every generated token, component variant, rule, and Flow insight remains `needs_review` with `source: "llm_inferred"`.

## Milestones

1. **Extraction contracts and deterministic projection** — Tasks 1–5.
2. **Durable crops, working-copy safety, and automatic handoff** — Tasks 6–10.
3. **API/UI visibility and controlled rollout** — Tasks 11–13.

## File Map

### Create

- `src/appKnowledgeProjector.ts`
- `src/appKnowledgeProjector.test.ts`
- `src/appKnowledgeFlow.ts`
- `src/appKnowledgeFlow.test.ts`
- `src/appKnowledgeCrop.ts`
- `src/appKnowledgeCrop.test.ts`
- `src/appKnowledgeAutomatic.ts`
- `src/appKnowledgeAutomatic.test.ts`
- `src/designSystemWorkingCopy.ts`
- `src/designSystemWorkingCopy.test.ts`
- `src/vitrine/useDesignSystemGeneration.ts`
- `src/vitrine/useDesignSystemGeneration.test.ts`
- `migrations/0021_automatic_llm_design_system_extraction.sql`

### Modify

- `src/appKnowledge.ts`
- `src/appKnowledge.test.ts`
- `src/appKnowledgeService.ts`
- `src/appKnowledgeService.test.ts`
- `src/appKnowledgeProvider.ts`
- `src/appKnowledgeProvider.test.ts`
- `src/appKnowledgeDesignSystem.ts`
- `src/appKnowledgeDesignSystem.test.ts`
- `src/appKnowledgeStore.ts`
- `src/appKnowledgeDesignSystemStore.test.ts`
- `src/designSystem.ts`
- `src/designSystem.test.ts`
- `src/db.ts`
- `src/migrations.test.ts`
- `src/queue.ts`
- `services/api/src/appKnowledge.ts`
- `services/api/src/appKnowledge.test.ts`
- `services/api/src/app.ts`
- `services/api/src/app.test.ts`
- `services/import-worker/src/pipeline.ts`
- `services/import-worker/src/pipeline.test.ts`
- `scripts/catalog-import.ts`
- `src/vitrine/appKnowledgeApi.ts`
- `src/vitrine/appKnowledgeApi.test.ts`
- `src/vitrine/designSystemStore.ts`
- `src/vitrine/designSystemStore.test.ts`
- `src/vitrine/components/DesignSystemPanel.tsx`
- `src/vitrine/components/DesignSystemPanel.test.tsx`
- `src/vitrine/components/ScreenDetail.tsx`
- `scripts/verify-app-knowledge-pilot.ts`
- `docs/operations/app-knowledge-antigravity.md`

## Milestone 1 — Extraction Contracts and Deterministic Projection

### Task 1: Add LLM token and normalized component-occurrence contracts

**Files:**

- Modify: `src/appKnowledgeService.ts`
- Modify: `src/appKnowledge.ts`
- Modify: `src/appKnowledge.test.ts`
- Modify: `src/appKnowledgeService.test.ts`

- [ ] **Step 1: Write failing parser tests**

Add fixtures and assertions covering all six token kinds and one normalized component occurrence:

```ts
const tokenKinds = [
  "color", "typography", "spacing", "radius", "border", "effect",
] as const;

test("parses LLM token candidates and normalized component occurrences", () => {
  const raw = evidenceAnalysisFixture();
  raw.tokenCandidates = tokenKinds.map((kind) => ({
    kind,
    name: `${kind} candidate`,
    value: kind === "color" ? "#F26B38" : "16px",
    role: "Observed visual role",
    confidence: 0.82,
  }));
  raw.componentOccurrences = [{
    family: "Button",
    variant: "Primary",
    category: "Inputs",
    purpose: "Triggers the primary action",
    anatomy: ["container", "label"],
    visibleStates: ["default"],
    observedProperties: ["orange fill", "white label"],
    region: { x: 0.72, y: 0.61, width: 0.18, height: 0.06 },
    confidence: 0.88,
  }];

  const parsed = parseAppKnowledgeEvidenceAnalysis(raw, "SCREEN-1");
  assert.deepEqual(parsed.tokenCandidates.map(({ kind }) => kind), tokenKinds);
  assert.deepEqual(parsed.componentOccurrences[0].region, {
    x: 0.72, y: 0.61, width: 0.18, height: 0.06,
  });
});

test("rejects unsupported tokens and out-of-bounds normalized regions", () => {
  const token = evidenceAnalysisFixture();
  token.tokenCandidates = [{
    kind: "opacity",
    name: "Disabled",
    value: "0.5",
    role: "Disabled content",
    confidence: 0.8,
  }];
  assert.throws(
    () => parseAppKnowledgeEvidenceAnalysis(token, "SCREEN-1"),
    /token kind is invalid/,
  );

  const region = evidenceAnalysisFixture();
  region.componentOccurrences = [{
    family: "Button",
    variant: "Primary",
    category: "Inputs",
    purpose: "Submit",
    anatomy: [],
    visibleStates: ["default"],
    observedProperties: [],
    region: { x: 0.9, y: 0.9, width: 0.2, height: 0.2 },
    confidence: 0.8,
  }];
  assert.throws(
    () => parseAppKnowledgeEvidenceAnalysis(region, "SCREEN-1"),
    /normalized region exceeds source bounds/,
  );
});
```

- [ ] **Step 2: Run the tests and verify RED**

```bash
node --experimental-strip-types --test \
  src/appKnowledge.test.ts \
  src/appKnowledgeService.test.ts
```

Expected: FAIL because the new candidate fields and parser validation do not exist.

- [ ] **Step 3: Add the exact domain types**

In `src/appKnowledgeService.ts`, add:

```ts
export type AppKnowledgeTokenKind =
  | "color"
  | "typography"
  | "spacing"
  | "radius"
  | "border"
  | "effect";

export interface AppKnowledgeTokenCandidate {
  kind: AppKnowledgeTokenKind;
  name: string;
  value: string;
  role: string;
  confidence: number;
}

export interface AppKnowledgeNormalizedRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AppKnowledgeComponentOccurrence {
  family: string;
  variant: string;
  category: string;
  purpose: string;
  anatomy: string[];
  visibleStates: string[];
  observedProperties: string[];
  region: AppKnowledgeNormalizedRegion;
  confidence: number;
}
```

Extend `AppKnowledgeEvidenceAnalysis` with:

```ts
tokenCandidates: AppKnowledgeTokenCandidate[];
componentOccurrences: AppKnowledgeComponentOccurrence[];
```

- [ ] **Step 4: Validate candidates at the existing analysis parser boundary**

Require every field, trim all strings, reject empty `name`, `value`, `role`, `family`, `variant`, `category`, and `purpose`, and enforce:

```ts
Number.isFinite(value)
0 <= confidence && confidence <= 1
0 <= x && x <= 1
0 <= y && y <= 1
0 < width && width <= 1
0 < height && height <= 1
x + width <= 1
y + height <= 1
```

Do not apply pixel-size or full-screen crop rejection here; those rules require decoded source dimensions and belong to `appKnowledgeCrop.ts`.

- [ ] **Step 5: Run focused tests and verify GREEN**

```bash
node --experimental-strip-types --test \
  src/appKnowledge.test.ts \
  src/appKnowledgeService.test.ts
```

Expected: PASS with zero failures.

- [ ] **Step 6: Commit the evidence contracts**

```bash
git add \
  src/appKnowledge.ts \
  src/appKnowledge.test.ts \
  src/appKnowledgeService.ts \
  src/appKnowledgeService.test.ts
git commit -m "feat: add LLM design evidence contracts"
```

### Task 2: Make the provider request the new evidence instead of semantic summaries only

**Files:**

- Modify: `src/appKnowledgeProvider.ts`
- Modify: `src/appKnowledgeProvider.test.ts`

- [ ] **Step 1: Write a failing prompt-contract test**

Extend the existing adapter test:

```ts
assert.match(calls[0].system, /"tokenCandidates": TokenCandidate\[\]/);
assert.match(calls[0].system, /"componentOccurrences": ComponentOccurrence\[\]/);
assert.match(calls[0].system, /normalized top-left coordinates/i);
assert.match(calls[0].system, /approximate screenshot observations/i);
assert.match(calls[0].system, /do not claim original CSS/i);
assert.match(calls[0].system, /at most 24 token candidates/i);
assert.match(calls[0].system, /at most 24 component occurrences/i);
```

Add parser-retry coverage proving a validation error is included in only the retried evidence request.

- [ ] **Step 2: Run the provider test and verify RED**

```bash
node --experimental-strip-types --test src/appKnowledgeProvider.test.ts
```

Expected: FAIL because the evidence prompt does not mention either collection.

- [ ] **Step 3: Replace the evidence shape in `APP_KNOWLEDGE_EVIDENCE_INSTRUCTIONS`**

Keep every existing semantic field and append this exact JSON vocabulary:

```ts
type TokenCandidate = {
  kind: "color" | "typography" | "spacing" | "radius" | "border" | "effect";
  name: string;
  value: string;
  role: string;
  confidence: number;
};

type ComponentOccurrence = {
  family: string;
  variant: string;
  category: string;
  purpose: string;
  anatomy: string[];
  visibleStates: string[];
  observedProperties: string[];
  region: { x: number; y: number; width: number; height: number };
  confidence: number;
};
```

Tell the provider:

- values are approximate screenshot observations;
- never claim original CSS, source tokens, or Figma values;
- coordinates are normalized, top-left origin, and bounded by the image;
- use empty arrays when evidence is insufficient;
- keep each new array to at most 24 items.

- [ ] **Step 4: Run provider tests and verify GREEN**

```bash
node --experimental-strip-types --test \
  src/appKnowledgeProvider.test.ts \
  src/appKnowledgeBrowserProvider.test.ts
```

Expected: PASS with zero failures and no browser transport changes beyond the shared prompt.

- [ ] **Step 5: Commit the provider contract**

```bash
git add src/appKnowledgeProvider.ts src/appKnowledgeProvider.test.ts
git commit -m "feat: request design tokens and component regions"
```

### Task 3: Carry candidates through compact signals and bounded synthesis

**Files:**

- Modify: `src/appKnowledgeDesignSystem.ts`
- Modify: `src/appKnowledgeDesignSystem.test.ts`
- Modify: `src/appKnowledge.ts`
- Modify: `src/appKnowledge.test.ts`
- Modify: `src/appKnowledgeProvider.ts`
- Modify: `src/appKnowledgeProvider.test.ts`

- [ ] **Step 1: Write failing compact-signal and merge-parser tests**

In `src/appKnowledgeDesignSystem.test.ts`:

```ts
test("keeps token candidates and component occurrences in bounded signals", () => {
  const source = analysis("SCREEN-1", {
    tokenCandidates: [{
      kind: "color",
      name: "Primary action",
      value: "#F26B38",
      role: "Primary action fill",
      confidence: 0.82,
    }],
    componentOccurrences: [{
      family: "Button",
      variant: "Primary",
      category: "Inputs",
      purpose: "Submit",
      anatomy: ["container", "label"],
      visibleStates: ["default"],
      observedProperties: ["orange fill"],
      region: { x: 0.7, y: 0.6, width: 0.2, height: 0.08 },
      confidence: 0.88,
    }],
  });

  const [chunk] = planDesignSystemChunks([source], 24_000);
  assert.deepEqual(chunk.signals[0].tokenCandidates, source.tokenCandidates);
  assert.deepEqual(
    chunk.signals[0].componentOccurrences,
    source.componentOccurrences,
  );
});
```

In `src/appKnowledge.test.ts`, add a merged-result fixture with:

- consolidated token candidates;
- component families with variants and occurrence evidence;
- candidate rules;
- confidence and unresolved conflicts;
- only allowlisted evidence IDs.

Assert unknown evidence is rejected and differing values survive as separate candidates.

- [ ] **Step 2: Run the focused tests and verify RED**

```bash
node --experimental-strip-types --test \
  src/appKnowledge.test.ts \
  src/appKnowledgeDesignSystem.test.ts \
  src/appKnowledgeProvider.test.ts
```

Expected: FAIL because compact signals and synthesis results omit the new collections.

- [ ] **Step 3: Extend `AppKnowledgeDesignSignal`**

Add:

```ts
tokenCandidates: AppKnowledgeEvidenceAnalysis["tokenCandidates"];
componentOccurrences: AppKnowledgeEvidenceAnalysis["componentOccurrences"];
```

Copy both fields in `compactDesignSignal`. Keep the existing deterministic sort and byte calculation unchanged so the larger payload naturally produces more chunks.

- [ ] **Step 4: Define the canonical synthesized result**

In `src/appKnowledge.ts`, replace the purely semantic design result with:

```ts
export interface AppKnowledgeDesignSystemResult {
  tokenCandidates: AppKnowledgeSynthesizedToken[];
  componentCandidates: AppKnowledgeComponentCandidate[];
  rules: AppKnowledgeDesignRule[];
  designLanguage: AppKnowledgeDesignLanguage;
  unresolvedConflicts: AppKnowledgeDesignConflict[];
}
```

Each synthesized token and rule must include `evidenceIds`, `confidence`, and:

```ts
source: "llm_inferred";
reviewStatus: "needs_review";
```

Each component variant must retain normalized occurrences as:

```ts
{
  evidenceId: string;
  region: AppKnowledgeNormalizedRegion;
  confidence: number;
}
```

Update `parseAppKnowledgeDesignSystemResult` to validate the new arrays, reject unknown evidence, and reject any generated item whose `source` or `reviewStatus` differs from the required literals.

- [ ] **Step 5: Update chunk and merge prompts**

Require the same exact result shape from `synthesizeDesignSystemChunk` and `mergeDesignSystem`. The merge prompt must:

- consolidate semantic aliases;
- keep materially different values and variants separate;
- never manufacture precision;
- retain allowlisted evidence only;
- keep every item `llm_inferred` and `needs_review`;
- cap representative evidence while preserving at least one evidence ID per item.

- [ ] **Step 6: Run focused tests and verify GREEN**

```bash
node --experimental-strip-types --test \
  src/appKnowledge.test.ts \
  src/appKnowledgeDesignSystem.test.ts \
  src/appKnowledgeProvider.test.ts \
  src/appKnowledgeBrowserProvider.test.ts
```

Expected: PASS with zero failures.

- [ ] **Step 7: Commit bounded synthesis**

```bash
git add \
  src/appKnowledge.ts \
  src/appKnowledge.test.ts \
  src/appKnowledgeDesignSystem.ts \
  src/appKnowledgeDesignSystem.test.ts \
  src/appKnowledgeProvider.ts \
  src/appKnowledgeProvider.test.ts
git commit -m "feat: synthesize evidence-backed design candidates"
```

### Task 4: Project App Knowledge deterministically into `DesignSystemSnapshot`

**Files:**

- Create: `src/appKnowledgeProjector.ts`
- Create: `src/appKnowledgeProjector.test.ts`
- Modify: `src/designSystem.ts`
- Modify: `src/designSystem.test.ts`

- [ ] **Step 1: Write failing projection tests**

Create a fixture with two equivalent token names in reversed input order, one component variant with two occurrences, and one rule:

```ts
test("projects a stable LLM-inferred design-system snapshot", () => {
  const first = projectAppKnowledgeDesignSystem(revisionFixture());
  const second = projectAppKnowledgeDesignSystem(
    reverseCandidateOrder(revisionFixture()),
  );

  assert.deepEqual(first, second);
  assert.equal(first.tokens[0].source, "llm_inferred");
  assert.equal(first.tokens[0].reviewStatus, "needs_review");
  assert.deepEqual(first.components[0].variants[0].occurrences?.[0], {
    imageId: 101,
    region: { x: 0.7, y: 0.6, width: 0.2, height: 0.08 },
    coordinateSpace: "normalized",
    confidence: 0.88,
  });
  assert.equal(first.rules?.[0].source, "llm_inferred");
});
```

Add a test that the same canonical input always produces the same IDs and that every referenced App Knowledge evidence ID resolves to a numeric source image ID.

- [ ] **Step 2: Run projection tests and verify RED**

```bash
node --experimental-strip-types --test \
  src/designSystem.test.ts \
  src/appKnowledgeProjector.test.ts
```

Expected: FAIL because the projector and provenance fields do not exist.

- [ ] **Step 3: Extend the existing design-system schema**

In `src/designSystem.ts`, add:

```ts
export type DesignInferenceSource = "llm_inferred";

export interface EvidenceOccurrence {
  imageId: number;
  region?: { x: number; y: number; width: number; height: number };
  coordinateSpace?: "normalized";
  cropImageId?: number;
  confidence?: number;
}
```

Add optional `source?: DesignInferenceSource` to tokens, component variants, and rules. Existing curated/imported snapshots remain valid because the field is optional.

- [ ] **Step 4: Implement deterministic projection**

Export:

```ts
export function projectAppKnowledgeDesignSystem(
  revision: AppKnowledgeRevisionView,
  crops: ReadonlyMap<string, number> = new Map(),
): DesignSystemSnapshot
```

Implementation rules:

- sort every input collection by canonical normalized identity before assigning output order;
- derive IDs from a SHA-256 digest of kind, normalized name, normalized role, and value;
- map evidence IDs through the frozen revision manifest, never by database lookup;
- emit normalized occurrences with explicit `coordinateSpace`;
- add `cropImageId` only when the crop map contains the occurrence key;
- keep every generated review status at `needs_review`;
- preserve all valid conflicting token values as separate stable candidates;
- map component anatomy, states, observed properties, responsive evidence, and associated tokens;
- map rules to existing `layout`, `icon`, `imagery`, `responsive`, `content`, and `interaction` kinds.

- [ ] **Step 5: Run projection tests and verify GREEN**

```bash
node --experimental-strip-types --test \
  src/designSystem.test.ts \
  src/appKnowledgeProjector.test.ts
```

Expected: PASS with zero failures.

- [ ] **Step 6: Commit the projector**

```bash
git add \
  src/designSystem.ts \
  src/designSystem.test.ts \
  src/appKnowledgeProjector.ts \
  src/appKnowledgeProjector.test.ts
git commit -m "feat: project app knowledge into design systems"
```

### Task 5: Enrich ordered Flows without changing crawled identity or evidence

**Files:**

- Create: `src/appKnowledgeFlow.ts`
- Create: `src/appKnowledgeFlow.test.ts`
- Modify: `src/appKnowledge.ts`
- Modify: `src/appKnowledge.test.ts`
- Modify: `src/appKnowledgeProvider.ts`
- Modify: `src/appKnowledgeProvider.test.ts`
- Modify: `src/designSystem.ts`
- Modify: `src/appKnowledgeProjector.ts`

- [ ] **Step 1: Write failing Flow-order tests**

```ts
test("restores duplicate visuals to every original Flow occurrence", () => {
  const raw = flowFixture([
    step("step-1", 1, "FLOW-a-STEP-01-IMAGE-9"),
    step("step-2", 2, "FLOW-a-STEP-02-IMAGE-9"),
    step("step-3", 3, "FLOW-a-STEP-03-IMAGE-10"),
  ]);
  const enriched = enrichOrderedFlows([raw], analysesByVisualHash(), providerResult());

  assert.deepEqual(
    enriched[0].steps.map(({ id }) => id),
    ["step-1", "step-2", "step-3"],
  );
  assert.deepEqual(
    enriched[0].steps.map(({ evidenceId }) => evidenceId),
    [
      "FLOW-a-STEP-01-IMAGE-9",
      "FLOW-a-STEP-02-IMAGE-9",
      "FLOW-a-STEP-03-IMAGE-10",
    ],
  );
});

test("does not replace a non-empty crawled interaction", () => {
  const projected = projectFlow(
    crawledFlow({ interaction: "Tap Continue" }),
    inferredFlow({ interaction: "Submit form" }),
  );
  assert.equal(projected.steps[0].interaction, "Tap Continue");
});
```

Add rejection tests for unknown Flow IDs, unknown step IDs, reordered steps, and changed evidence arrays.

- [ ] **Step 2: Run the tests and verify RED**

```bash
node --experimental-strip-types --test \
  src/appKnowledgeFlow.test.ts \
  src/appKnowledge.test.ts \
  src/appKnowledgeProvider.test.ts
```

Expected: FAIL because ordered enrichment and Flow insights are absent.

- [ ] **Step 3: Add Flow insight types**

In `src/designSystem.ts`, add:

```ts
export interface DesignFlowInsights<T = number> {
  purpose: string;
  feedback: string[];
  openQuestions: string[];
  confidence: number;
  reviewStatus: "needs_review";
  source: "llm_inferred";
  evidence: T[];
}
```

Extend `DesignFlow<T>` with:

```ts
insights?: DesignFlowInsights<T>;
```

- [ ] **Step 4: Implement ordered Flow planning and validation**

In `src/appKnowledgeFlow.ts`:

- construct provider payloads from raw Flow ID, category, ordered step IDs, current labels/interactions, and cached visual analysis;
- cache analysis by visual hash but restore it to each original occurrence;
- validate provider Flow and step IDs against the exact allowlist;
- require returned step order to equal source order;
- preserve source evidence arrays byte-for-byte;
- use LLM interaction only when the crawled interaction is empty;
- emit optional insights with `llm_inferred` and `needs_review`.

- [ ] **Step 5: Add a bounded provider call**

Add `synthesizeFlows` to `AppKnowledgeProvider`. Chunk by serialized bytes without splitting a Flow inside a chunk. If one Flow exceeds the ceiling, segment its ordered steps with stable overlap context, then merge only insight text while restoring the original ordered steps.

- [ ] **Step 6: Run focused tests and verify GREEN**

```bash
node --experimental-strip-types --test \
  src/appKnowledgeFlow.test.ts \
  src/appKnowledge.test.ts \
  src/appKnowledgeProvider.test.ts \
  src/appKnowledgeBrowserProvider.test.ts \
  src/appKnowledgeProjector.test.ts
```

Expected: PASS with exact Flow identity, order, and evidence preservation.

- [ ] **Step 7: Commit Flow enrichment**

```bash
git add \
  src/appKnowledgeFlow.ts \
  src/appKnowledgeFlow.test.ts \
  src/appKnowledge.ts \
  src/appKnowledge.test.ts \
  src/appKnowledgeProvider.ts \
  src/appKnowledgeProvider.test.ts \
  src/designSystem.ts \
  src/appKnowledgeProjector.ts
git commit -m "feat: enrich ordered flows with LLM insights"
```

## Milestone 2 — Durable Crops, Working-Copy Safety, and Automatic Handoff

### Task 6: Add nullable automatic actors and provenance schema

**Files:**

- Create: `migrations/0021_automatic_llm_design_system_extraction.sql`
- Modify: `src/migrations.test.ts`
- Modify: `src/appKnowledgeStore.ts`
- Modify: `src/appKnowledgeDesignSystemStore.test.ts`

- [ ] **Step 1: Write failing migration contract tests**

In `src/migrations.test.ts`, assert migration `0021`:

```ts
assert.match(sql, /request_origin TEXT NOT NULL DEFAULT 'manual'/);
assert.match(sql, /ALTER COLUMN requested_by DROP NOT NULL/);
assert.match(sql, /ALTER COLUMN created_by DROP NOT NULL/);
assert.match(sql, /author_type = 'generated'/);
assert.match(sql, /CREATE TABLE app_knowledge_component_crops/);
assert.match(sql, /source_app_knowledge_revision_id/);
assert.match(sql, /app_knowledge_automatic_generation_identity/);
assert.match(sql, /synthesis_done_count INTEGER NOT NULL DEFAULT 0/);
assert.match(sql, /synthesis_total_count INTEGER NOT NULL DEFAULT 0/);
```

Add store tests proving an automatic job parses with `requestedBy: null`, `requestOrigin: "automatic"`, and a generated revision parses with `createdBy: null`.

- [ ] **Step 2: Run migration and store tests and verify RED**

```bash
node --experimental-strip-types --test \
  src/migrations.test.ts \
  src/appKnowledgeDesignSystemStore.test.ts
```

Expected: FAIL because migration `0021` and nullable row parsing do not exist.

- [ ] **Step 3: Add migration `0021`**

The migration must perform these changes:

```sql
ALTER TABLE app_knowledge_jobs
  ALTER COLUMN requested_by DROP NOT NULL,
  ADD COLUMN request_origin TEXT NOT NULL DEFAULT 'manual'
    CHECK (request_origin IN ('manual', 'retry', 'regeneration', 'automatic')),
  ADD COLUMN synthesis_done_count INTEGER NOT NULL DEFAULT 0
    CHECK (synthesis_done_count >= 0),
  ADD COLUMN synthesis_total_count INTEGER NOT NULL DEFAULT 0
    CHECK (synthesis_total_count >= 0),
  ADD CONSTRAINT app_knowledge_synthesis_progress_check
    CHECK (synthesis_done_count <= synthesis_total_count);

ALTER TABLE app_knowledge_revisions
  ALTER COLUMN created_by DROP NOT NULL,
  ADD CONSTRAINT app_knowledge_generated_revision_actor_check
    CHECK (created_by IS NOT NULL OR author_type = 'generated');

ALTER TABLE design_systems
  ADD COLUMN capture_version_id INTEGER REFERENCES app_versions(id) ON DELETE SET NULL,
  ADD COLUMN source_app_knowledge_revision_id BIGINT
    REFERENCES app_knowledge_revisions(id) ON DELETE SET NULL,
  ADD COLUMN generated_at TIMESTAMPTZ;

ALTER TABLE design_systems
  DROP CONSTRAINT design_systems_origin_check;

ALTER TABLE design_systems
  ADD CONSTRAINT design_systems_origin_check
  CHECK (origin IN ('observed', 'automatic', 'imported'));

CREATE UNIQUE INDEX app_knowledge_automatic_generation_identity
  ON app_knowledge_jobs (
    snapshot_id, source_sha256, provider_model, prompt_version
  )
  WHERE request_origin = 'automatic' AND status <> 'cancelled';

ALTER TABLE app_knowledge_jobs
  DROP CONSTRAINT app_knowledge_jobs_stage_check;

ALTER TABLE app_knowledge_jobs
  ADD CONSTRAINT app_knowledge_jobs_stage_check
  CHECK (stage IN (
    'preparing', 'validating_evidence', 'analyzing', 'synthesizing',
    'merging', 'validating_output', 'saving', 'complete'
  ));

CREATE TABLE app_knowledge_component_crops (
  id BIGSERIAL PRIMARY KEY,
  derived_image_id INTEGER NOT NULL UNIQUE REFERENCES images(id) ON DELETE RESTRICT,
  source_image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE RESTRICT,
  job_id BIGINT NOT NULL REFERENCES app_knowledge_jobs(id) ON DELETE CASCADE,
  revision_id BIGINT REFERENCES app_knowledge_revisions(id) ON DELETE SET NULL,
  component_family TEXT NOT NULL CHECK (length(component_family) BETWEEN 1 AND 160),
  component_variant TEXT NOT NULL CHECK (length(component_variant) BETWEEN 1 AND 160),
  region_x DOUBLE PRECISION NOT NULL CHECK (region_x >= 0 AND region_x <= 1),
  region_y DOUBLE PRECISION NOT NULL CHECK (region_y >= 0 AND region_y <= 1),
  region_width DOUBLE PRECISION NOT NULL CHECK (region_width > 0 AND region_width <= 1),
  region_height DOUBLE PRECISION NOT NULL CHECK (region_height > 0 AND region_height <= 1),
  source_sha256 TEXT NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  crop_sha256 TEXT NOT NULL CHECK (crop_sha256 ~ '^[0-9a-f]{64}$'),
  provider_model TEXT NOT NULL CHECK (length(provider_model) BETWEEN 1 AND 160),
  prompt_version INTEGER NOT NULL CHECK (prompt_version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (region_x + region_width <= 1),
  CHECK (region_y + region_height <= 1),
  UNIQUE (
    source_image_id, region_x, region_y, region_width, region_height,
    provider_model, prompt_version
  )
);

CREATE INDEX app_knowledge_component_crops_job_idx
  ON app_knowledge_component_crops(job_id, id);
```

- [ ] **Step 4: Update App Knowledge store contracts**

Add:

```ts
export type AppKnowledgeRequestOrigin =
  | "manual"
  | "retry"
  | "regeneration"
  | "automatic";
```

Change:

```ts
requestedBy: number | null;
createdBy: number | null;
requestOrigin: AppKnowledgeRequestOrigin;
synthesisDoneCount: number;
synthesisTotalCount: number;
```

Update `JOB_COLUMNS`, `REVISION_COLUMNS`, row parsers, `createJob`, and `completeGeneration`. `completeGeneration` must pass null through only for `author_type = 'generated'`. Manual revision and review methods continue requiring positive user IDs.

When design-system and Flow chunk plans are finalized, set `synthesisTotalCount` to their combined count and increment `synthesisDoneCount` only after a chunk result is durably stored. Updating the job row emits the existing PostgreSQL notification, so SSE reports synthesis progress without polling.

- [ ] **Step 5: Verify the migration in the disposable database boundary**

```bash
npm run db:check
npm run db:verify
```

Expected: both commands succeed against the configured disposable verification database; current migration head is `0021`.

- [ ] **Step 6: Run focused tests and verify GREEN**

```bash
node --experimental-strip-types --test \
  src/migrations.test.ts \
  src/appKnowledgeDesignSystemStore.test.ts \
  src/db.appKnowledgeEvidence.test.ts
```

Expected: PASS with nullable automatic actors and unchanged authenticated review behavior.

- [ ] **Step 7: Commit the schema and store**

```bash
git add \
  migrations/0021_automatic_llm_design_system_extraction.sql \
  src/migrations.test.ts \
  src/appKnowledgeStore.ts \
  src/appKnowledgeDesignSystemStore.test.ts
git commit -m "feat: persist automatic design generation provenance"
```

### Task 7: Derive, verify, persist, and reuse component crops

**Files:**

- Create: `src/appKnowledgeCrop.ts`
- Create: `src/appKnowledgeCrop.test.ts`
- Modify: `src/appKnowledgeStore.ts`
- Modify: `src/appKnowledgeDesignSystemStore.test.ts`
- Modify: `src/appKnowledgeService.ts`
- Modify: `src/appKnowledgeService.test.ts`

- [ ] **Step 1: Write failing crop geometry tests**

Use a real 1000×500 PNG fixture generated with Sharp in memory:

```ts
test("adds two-percent margin and clamps a valid normalized crop", async () => {
  const crop = await deriveComponentCrop({
    source: await pngFixture(1000, 500),
    region: { x: 0.9, y: 0.8, width: 0.1, height: 0.2 },
  });
  assert.deepEqual(crop.sourceRegionPixels, {
    left: 898,
    top: 398,
    width: 102,
    height: 102,
  });
  assert.equal(crop.contentType, "image/png");
  assert.match(crop.sha256, /^[0-9a-f]{64}$/);
});

test("rejects tiny and near-full-screen component crops", async () => {
  const source = await pngFixture(1000, 500);
  await assert.rejects(
    () => deriveComponentCrop({
      source,
      region: { x: 0, y: 0, width: 0.01, height: 0.02 },
    }),
    /at least 16 by 16/,
  );
  await assert.rejects(
    () => deriveComponentCrop({
      source,
      region: { x: 0, y: 0, width: 0.9, height: 0.9 },
    }),
    /full-screen/,
  );
});
```

Add tests for invalid raster bytes, metadata mismatch, an allowlist miss, object-store post-write verification failure, and content-addressed reuse.

- [ ] **Step 2: Run crop tests and verify RED**

```bash
node --experimental-strip-types --test src/appKnowledgeCrop.test.ts
```

Expected: FAIL because the crop service does not exist.

- [ ] **Step 3: Implement pure geometry and raster derivation**

Export:

```ts
export function validateComponentCropRegion(input: {
  region: AppKnowledgeNormalizedRegion;
  sourceWidth: number;
  sourceHeight: number;
}): PixelRegion

export async function deriveComponentCrop(input: {
  source: Uint8Array;
  region: AppKnowledgeNormalizedRegion;
}): Promise<DerivedComponentCrop>
```

Rules:

- reject when normalized `width >= 0.9 && height >= 0.9`;
- convert the original proposed region to pixels and require at least 16×16 before margin;
- add `0.02 * region.width` horizontally and `0.02 * region.height` vertically on each side;
- clamp to source bounds;
- decode and output PNG with Sharp;
- compute SHA-256 from final bytes.

- [ ] **Step 4: Add a storage coordinator**

Export:

```ts
export async function deriveComponentCrops(
  input: DeriveComponentCropsInput,
): Promise<Map<string, number>>
```

For each occurrence:

1. resolve `evidenceId` from the frozen job manifest;
2. require `kind === "screen"`;
3. load and verify the source object against manifest metadata;
4. reuse a persisted crop with the same source/region/model/prompt identity;
5. otherwise derive PNG bytes and store them under a content-addressed key;
6. verify object metadata after `put`;
7. in one database transaction, upsert the verified object metadata into `stored_objects`;
8. insert an `images` row on the source image's platform with `kind = 'ui_element'`, a protected media URL, and the derived `object_key`;
9. insert `app_knowledge_component_crops`;
10. return an occurrence-key-to-derived-image-ID map.

An invalid region records a bounded occurrence failure and returns no crop mapping; it does not discard the occurrence or fail unrelated evidence.

- [ ] **Step 5: Integrate crops before projection**

In `AppKnowledgeService`, after merged output validation and before working-copy projection:

```ts
const crops = await deriveComponentCrops({
  job,
  manifest,
  analyses,
  result,
  objectStore,
  store,
  signal,
});
const revision = await store.completeGeneration(job.id, snapshot);
await store.attachCropsToRevision(job.id, revision.id);
const candidate = projectAppKnowledgeDesignSystem(revision, crops);
```

If crop derivation rejects one occurrence, continue. If projection fails, retain the immutable revision and do not alter the curated working copy.

- [ ] **Step 6: Run focused tests and verify GREEN**

```bash
node --experimental-strip-types --test \
  src/appKnowledgeCrop.test.ts \
  src/appKnowledgeDesignSystemStore.test.ts \
  src/appKnowledgeService.test.ts \
  src/appKnowledgeProjector.test.ts
```

Expected: PASS with valid crop reuse and invalid occurrence preservation.

- [ ] **Step 7: Commit crop persistence**

```bash
git add \
  src/appKnowledgeCrop.ts \
  src/appKnowledgeCrop.test.ts \
  src/appKnowledgeStore.ts \
  src/appKnowledgeDesignSystemStore.test.ts \
  src/appKnowledgeService.ts \
  src/appKnowledgeService.test.ts
git commit -m "feat: derive verified component specimens"
```

### Task 8: Seed only safe design-system working copies

**Files:**

- Create: `src/designSystemWorkingCopy.ts`
- Create: `src/designSystemWorkingCopy.test.ts`
- Modify: `src/db.ts`
- Modify: `src/appKnowledgeService.ts`
- Modify: `src/appKnowledgeService.test.ts`

- [ ] **Step 1: Write failing replacement-policy tests**

```ts
test("seeds an absent or structurally empty working copy", async () => {
  assert.equal(
    await seedDesignSystemWorkingCopy(candidateInput({ existing: undefined })),
    "seeded",
  );
  assert.equal(
    await seedDesignSystemWorkingCopy(candidateInput({
      existing: emptyAutomaticWorkingCopy(),
    })),
    "replaced",
  );
});

test("does not overwrite reviewed, curated, or published content", async () => {
  assert.equal(
    await seedDesignSystemWorkingCopy(candidateInput({
      existing: reviewedWorkingCopy(),
    })),
    "conflict",
  );
  assert.equal(
    await seedDesignSystemWorkingCopy(candidateInput({
      existing: curatorEditedWorkingCopy(),
    })),
    "conflict",
  );
  assert.equal(await immutablePublishedVersionStillMatches(), true);
});
```

Also prove an automatic unreviewed working copy is replaceable only when the incoming capture version is newer or the same capture identity has a newer source revision.

- [ ] **Step 2: Run tests and verify RED**

```bash
node --experimental-strip-types --test \
  src/designSystemWorkingCopy.test.ts \
  src/appKnowledgeService.test.ts
```

Expected: FAIL because provenance-aware seeding does not exist.

- [ ] **Step 3: Implement explicit working-copy records**

Add database read/write functions returning:

```ts
export interface DesignSystemWorkingCopyRecord {
  snapshot: DesignSystemSnapshot;
  captureVersionId: number | null;
  sourceAppKnowledgeRevisionId: number | null;
  origin: "observed" | "automatic" | "imported";
  generatedAt: string | null;
  updatedAt: string;
}
```

Use a transaction and `SELECT ... FOR UPDATE` for the target app. Determine structural emptiness from zero tokens, components, flows, and rules.

- [ ] **Step 4: Implement replacement safety**

Return one of:

```ts
type SeedDesignSystemResult =
  | "seeded"
  | "replaced"
  | "unchanged"
  | "conflict";
```

Replacement is allowed only when:

- no row exists;
- the existing snapshot is structurally empty; or
- `origin === "automatic"`, every reviewable entity remains `needs_review`, and no curator edit marker or reviewed entity exists.

Never write `design_system_versions`. Record capture version, source revision, origin `automatic`, and generation time on every successful seed.

- [ ] **Step 5: Call seeding after revision and projection**

Store the seed outcome with the generation job. A `conflict` still completes generation successfully because the canonical candidate remains in App Knowledge for curator comparison.

- [ ] **Step 6: Run focused tests and verify GREEN**

```bash
node --experimental-strip-types --test \
  src/designSystemWorkingCopy.test.ts \
  src/appKnowledgeService.test.ts \
  src/designSystem.test.ts
```

Expected: PASS and published snapshots remain byte-identical.

- [ ] **Step 7: Commit working-copy safety**

```bash
git add \
  src/designSystemWorkingCopy.ts \
  src/designSystemWorkingCopy.test.ts \
  src/db.ts \
  src/appKnowledgeService.ts \
  src/appKnowledgeService.test.ts
git commit -m "feat: safely seed generated design drafts"
```

### Task 9: Add an idempotent automatic job coordinator and reconciler

**Files:**

- Create: `src/appKnowledgeAutomatic.ts`
- Create: `src/appKnowledgeAutomatic.test.ts`
- Modify: `src/appKnowledgeStore.ts`
- Modify: `src/queue.ts`
- Modify: `services/api/src/appKnowledge.ts`
- Modify: `services/api/src/appKnowledge.test.ts`

- [ ] **Step 1: Write failing coordinator tests**

```ts
test("creates and publishes one automatic job per unchanged identity", async () => {
  const dependencies = automaticDependencies();
  const first = await ensureAutomaticAppKnowledgeJob(target(), dependencies);
  const second = await ensureAutomaticAppKnowledgeJob(target(), dependencies);

  assert.equal(first.job.id, second.job.id);
  assert.equal(dependencies.createdDurableJobs.length, 1);
  assert.equal(dependencies.publishedJobs.length, 1);
  assert.equal(first.job.requestedBy, null);
  assert.equal(first.job.requestOrigin, "automatic");
});

test("leaves durable work recoverable when queue publication fails", async () => {
  const dependencies = automaticDependencies({ publishFailure: true });
  await assert.rejects(
    () => ensureAutomaticAppKnowledgeJob(target(), dependencies),
    /queue publication failed/,
  );
  assert.equal(dependencies.createdDurableJobs.length, 1);
  assert.equal(dependencies.createdDurableJobs[0].status, "queued");

  dependencies.publishFailure = false;
  const reconciled = await reconcileQueuedAppKnowledgeJobs(dependencies);
  assert.deepEqual(reconciled, { examined: 1, published: 1, skipped: 0, failed: 0 });
});
```

Add tests proving source hash, model, or prompt changes produce a new identity, and cancelled jobs may be regenerated deliberately.

- [ ] **Step 2: Run tests and verify RED**

```bash
node --experimental-strip-types --test \
  src/appKnowledgeAutomatic.test.ts \
  services/api/src/appKnowledge.test.ts
```

Expected: FAIL because the shared coordinator does not exist.

- [ ] **Step 3: Extract shared durable-job creation**

The new service accepts:

```ts
export interface AutomaticAppKnowledgeTarget {
  app: string;
  platform: "ios" | "android" | "web";
  captureVersionId: number;
  sourceSha256: string;
  providerModel: string;
  promptVersion: number;
}
```

It must:

1. return `disabled` when `APP_KNOWLEDGE_AUTO_GENERATE !== "1"`;
2. enforce the optional allowlist before mutation;
3. resolve or create the App Knowledge snapshot;
4. obtain the existing automatic job by unique identity or create one with null requester;
5. create the transport job if missing;
6. commit durable state before RabbitMQ publication;
7. publish `generate-app-knowledge`;
8. mark only transport publication metadata, not crawl state.

Automatic job insertion stores the supplied `sourceSha256` immediately so the partial unique index can enforce identity before evidence preparation. On the database unique-race error, re-read and return the winning job.

- [ ] **Step 4: Implement reconciliation**

`reconcileQueuedAppKnowledgeJobs()` reads bounded queued automatic jobs ordered by creation time, checks whether their transport jobs are active, and republishes only missing/inactive messages. It never resets completed evidence or chunks.

- [ ] **Step 5: Reuse the coordinator from the manual API where appropriate**

Keep authenticated manual request semantics in `POST /app-knowledge/jobs`. Extract shared queue publication helpers, but do not give manual routes nullable actors or automatic origin.

- [ ] **Step 6: Run focused tests and verify GREEN**

```bash
node --experimental-strip-types --test \
  src/appKnowledgeAutomatic.test.ts \
  services/api/src/appKnowledge.test.ts \
  src/queue.test.ts
```

Expected: PASS with one durable identity and recoverable publication failure.

- [ ] **Step 7: Commit automatic coordination**

```bash
git add \
  src/appKnowledgeAutomatic.ts \
  src/appKnowledgeAutomatic.test.ts \
  src/appKnowledgeStore.ts \
  src/queue.ts \
  services/api/src/appKnowledge.ts \
  services/api/src/appKnowledge.test.ts
git commit -m "feat: coordinate automatic app knowledge jobs"
```

### Task 10: Trigger automatic generation from both verified crawl paths

**Files:**

- Modify: `scripts/catalog-import.ts`
- Modify: `services/import-worker/src/pipeline.ts`
- Modify: `services/import-worker/src/pipeline.test.ts`
- Modify: `src/appKnowledgeAutomatic.test.ts`

- [ ] **Step 1: Write failing handoff tests**

For the import-worker pipeline:

```ts
test("enqueues App Knowledge only after all import verification passes", async () => {
  const events: string[] = [];
  await pipeline(importJob(), pipelineDependencies({
    verify: async () => events.push("verified"),
    ensureAutomaticAppKnowledgeJob: async () => {
      events.push("automatic");
      return automaticResult();
    },
  }));
  assert.deepEqual(events, ["verified", "automatic"]);
});

test("keeps crawl success when automatic handoff fails", async () => {
  const result = await pipeline(importJob(), pipelineDependencies({
    ensureAutomaticAppKnowledgeJob: async () => {
      throw new Error("provider queue unavailable");
    },
  }));
  assert.equal(result.status, "done");
  assert.match(result.warning ?? "", /automatic analysis enqueue failed/i);
});
```

For `scripts/catalog-import.ts`, extract the small completion handoff into an exported function and unit-test that `job.status = "done"` occurs before the coordinator call.

- [ ] **Step 2: Run pipeline tests and verify RED**

```bash
node --experimental-strip-types --test \
  src/appKnowledgeAutomatic.test.ts \
  services/import-worker/src/pipeline.test.ts
```

Expected: FAIL because neither verified crawl path calls the coordinator.

- [ ] **Step 3: Add the catalog-import handoff**

Immediately after `assertCatalogPersistenceComplete` and before processing the next queue item:

```ts
delete job.repair;
job.status = "done";
saveState();
log(`Done: ${job.slug} (${job.platform})`);

await ensureAutomaticAppKnowledgeJob(target, dependencies).catch((error) => {
  log(`Automatic analysis enqueue failed: ${boundedError(error)}`);
});
```

Persist the successful crawl before starting the handoff. Await durable job creation/publication so the CLI cannot exit before it finishes, but catch the failure locally and never reopen, requeue, or fail the crawl job.

- [ ] **Step 4: Add the import-worker handoff**

After all Screens/UI Elements/Flows persistence checks pass, call the same coordinator. Do not enqueue the legacy `caption-app`/`synthesize-app` path for this automatic feature.

- [ ] **Step 5: Run focused tests and verify GREEN**

```bash
node --experimental-strip-types --test \
  src/appKnowledgeAutomatic.test.ts \
  services/import-worker/src/pipeline.test.ts \
  services/import-worker/src/appKnowledgeWorker.test.ts
```

Expected: PASS; enqueue failures produce warnings while crawl/import remains successful.

- [ ] **Step 6: Commit post-crawl integration**

```bash
git add \
  scripts/catalog-import.ts \
  services/import-worker/src/pipeline.ts \
  services/import-worker/src/pipeline.test.ts \
  src/appKnowledgeAutomatic.test.ts
git commit -m "feat: start design extraction after verified crawls"
```

## Milestone 3 — API/UI Visibility and Controlled Rollout

### Task 11: Expose automatic job fields and hydrate specimen media safely

**Files:**

- Modify: `services/api/src/app.ts`
- Modify: `services/api/src/app.test.ts`
- Modify: `services/api/src/appKnowledge.ts`
- Modify: `services/api/src/appKnowledge.test.ts`
- Modify: `src/designSystem.ts`
- Modify: `src/vitrine/appKnowledgeApi.ts`
- Modify: `src/vitrine/appKnowledgeApi.test.ts`

- [ ] **Step 1: Write failing API authorization and hydration tests**

```ts
test("admin design-system response includes matching generation context", async () => {
  const response = await adminFetch("/apps/linear/analysis?platform=web&version=2");
  const body = await response.json();
  assert.equal(body.job.id, 31);
  assert.equal(body.job.requestedBy, null);
  assert.equal(body.job.requestOrigin, "automatic");
  assert.equal(body.job.status, "running");
  assert.equal(body.job.stage, "analyzing");
  assert.equal(body.job.doneCount, 4);
  assert.equal(body.job.totalCount, 10);
  assert.equal(body.job.synthesisDoneCount, 0);
  assert.equal(body.job.synthesisTotalCount, 3);
});

test("non-admin response omits unreviewed generation state and candidates", async () => {
  const response = await userFetch(
    "/apps/linear/analysis?platform=web&version=2&role=designer",
  );
  const body = await response.json();
  assert.equal("job" in body, false);
  assert.equal(body.revision.reviewStatus, "approved");
});

test("hydrates crop image IDs without exposing object keys", async () => {
  const body = await adminDesignSystem();
  const occurrence = body.snapshot.components[0].variants[0].occurrences[0];
  assert.match(occurrence.crop.imageUrl, /^\/api\/media\//);
  assert.equal("objectKey" in occurrence.crop, false);
});
```

- [ ] **Step 2: Run API tests and verify RED**

```bash
node --experimental-strip-types --test \
  services/api/src/app.test.ts \
  services/api/src/appKnowledge.test.ts \
  src/vitrine/appKnowledgeApi.test.ts
```

Expected: FAIL because frontend job parsing rejects nullable automatic actors/new stages and crop hydration does not exist.

- [ ] **Step 3: Reuse the existing admin App Knowledge response**

Do not change the bare `GET /design-systems/:app` response shape. The existing admin-only:

```text
GET /apps/:app/analysis?platform=<platform>&version=<version>
```

already returns `{ snapshot, job, coverage, qualityDiagnostics }`. Extend its job serialization and `src/vitrine/appKnowledgeApi.ts` validation to accept:

```ts
requestedBy: number | null;
requestOrigin: "manual" | "retry" | "regeneration" | "automatic";
stage:
  | "preparing"
  | "validating_evidence"
  | "analyzing"
  | "synthesizing"
  | "merging"
  | "validating_output"
  | "saving"
  | "complete";
synthesisDoneCount: number;
synthesisTotalCount: number;
```

The Design System tab will make this one admin read when activated and reuse the returned `job` for SSE subscription.

- [ ] **Step 4: Hydrate source evidence and crops**

`imageId` continues hydrating to the source Screen `EvidenceView`. If `cropImageId` exists, hydrate a separate protected crop media view from the image table and signed/proxied object URL. Never serialize an object key, bucket, provider credential, or filesystem path.

- [ ] **Step 5: Keep non-admin publication semantics unchanged**

Non-admin users receive only the approved App Knowledge revision and the published/entitled design-system snapshot selected by existing logic. They do not receive automatic job state or an unreviewed candidate.

- [ ] **Step 6: Run API tests and verify GREEN**

```bash
node --experimental-strip-types --test \
  services/api/src/app.test.ts \
  services/api/src/appKnowledge.test.ts \
  src/designSystem.test.ts \
  src/vitrine/appKnowledgeApi.test.ts
```

Expected: PASS with admin-only generation context and safe crop media.

- [ ] **Step 7: Commit API visibility**

```bash
git add \
  services/api/src/app.ts \
  services/api/src/app.test.ts \
  services/api/src/appKnowledge.ts \
  services/api/src/appKnowledge.test.ts \
  src/designSystem.ts \
  src/vitrine/appKnowledgeApi.ts \
  src/vitrine/appKnowledgeApi.test.ts
git commit -m "feat: expose design generation status to admins"
```

### Task 12: Show generation state in the existing Design System tab using SSE

**Files:**

- Create: `src/vitrine/useDesignSystemGeneration.ts`
- Create: `src/vitrine/useDesignSystemGeneration.test.ts`
- Modify: `src/vitrine/appKnowledgeApi.ts`
- Modify: `src/vitrine/appKnowledgeApi.test.ts`
- Modify: `src/vitrine/designSystemStore.ts`
- Modify: `src/vitrine/designSystemStore.test.ts`
- Modify: `src/vitrine/components/DesignSystemPanel.tsx`
- Modify: `src/vitrine/components/DesignSystemPanel.test.tsx`
- Modify: `src/vitrine/components/ScreenDetail.tsx`

- [ ] **Step 1: Write failing SSE lifecycle tests**

```ts
test("subscribes while active and reloads the snapshot exactly once on completion", async () => {
  const source = new FakeEventSource();
  const loads: string[] = [];
  const invalidations: string[] = [];
  const generation = createDesignSystemGenerationController({
    openEvents: () => source,
    loadGeneration: async () => runningGeneration(),
    invalidateDesignSystem: () => invalidations.push("invalidate"),
    reloadDesignSystem: async () => loads.push("load"),
  });

  await generation.start();
  source.emit("message", doneJobEvent());
  source.emit("message", doneJobEvent());

  assert.deepEqual(invalidations, ["invalidate"]);
  assert.deepEqual(loads, ["load"]);
  generation.stop();
  assert.equal(source.closed, true);
});

test("does not create an interval or poll jobs", async () => {
  const intervalCalls: unknown[] = [];
  const original = globalThis.setInterval;
  globalThis.setInterval = ((...args: unknown[]) => {
    intervalCalls.push(args);
    return 1;
  }) as typeof setInterval;
  try {
    await renderGenerationHook();
    assert.equal(intervalCalls.length, 0);
  } finally {
    globalThis.setInterval = original;
  }
});
```

Add panel tests for queued, analyzing, synthesizing, merging, saving, draft ready, regenerating, partial, failed, stale, and reviewed states. Assert the previous snapshot remains rendered during regeneration.

- [ ] **Step 2: Run Vitrine tests and verify RED**

```bash
node --experimental-strip-types --test \
  src/vitrine/appKnowledgeApi.test.ts \
  src/vitrine/designSystemStore.test.ts \
  src/vitrine/useDesignSystemGeneration.test.ts
tsx --test src/vitrine/components/DesignSystemPanel.test.tsx
```

Expected: FAIL because the generation hook and UI states do not exist.

- [ ] **Step 3: Implement the generation hook**

`useDesignSystemGeneration`:

- loads the matching latest App Knowledge job once when an admin activates Design System;
- opens the existing `/app-knowledge/jobs/:jobId/events` EventSource only for queued/running jobs;
- maps durable stage to display state;
- closes EventSource on terminal state or unmount;
- deduplicates terminal events by job ID and status;
- invalidates the matching design-system store key and performs exactly one reload on `done`;
- leaves the previous snapshot visible while a newer job is active;
- never calls `setInterval` and never repeatedly reads a job endpoint.

- [ ] **Step 4: Add a compact status banner to `DesignSystemPanel`**

Extend props:

```ts
interface DesignSystemPanelProps {
  snapshot: Snapshot | null;
  status: "loading" | "ready" | "missing" | "error";
  generation?: DesignSystemGenerationView;
}
```

Render:

- queued: “Waiting for analysis worker”;
- analyzing: Screen progress;
- synthesizing: design-system chunk progress;
- merging/saving: indeterminate finalization;
- regenerating: banner above the existing snapshot;
- partial: exact failed/quarantined coverage;
- failed/stale: bounded message and admin retry action;
- draft ready: `needs_review` explanation;
- reviewed: no generation warning.

Use validated crop media for component specimens; when absent, keep the current reconstruction fallback and label it “Inferred preview.”

- [ ] **Step 5: Run Vitrine tests and verify GREEN**

```bash
node --experimental-strip-types --test \
  src/vitrine/appKnowledgeApi.test.ts \
  src/vitrine/designSystemStore.test.ts \
  src/vitrine/useDesignSystemGeneration.test.ts
tsx --test src/vitrine/components/DesignSystemPanel.test.tsx
```

Expected: PASS, one completion reload, zero polling, and previous-snapshot retention.

- [ ] **Step 6: Commit the existing-tab experience**

```bash
git add \
  src/vitrine/useDesignSystemGeneration.ts \
  src/vitrine/useDesignSystemGeneration.test.ts \
  src/vitrine/appKnowledgeApi.ts \
  src/vitrine/appKnowledgeApi.test.ts \
  src/vitrine/designSystemStore.ts \
  src/vitrine/designSystemStore.test.ts \
  src/vitrine/components/DesignSystemPanel.tsx \
  src/vitrine/components/DesignSystemPanel.test.tsx \
  src/vitrine/components/ScreenDetail.tsx
git commit -m "feat: show design extraction progress over SSE"
```

### Task 13: Add rollout controls, operational verification, and the 15Five acceptance gate

**Files:**

- Modify: `src/appKnowledgeAutomatic.ts`
- Modify: `src/appKnowledgeAutomatic.test.ts`
- Modify: `scripts/verify-app-knowledge-pilot.ts`
- Modify: `docs/operations/app-knowledge-antigravity.md`
- Modify: `README.md`

- [ ] **Step 1: Write failing feature-flag and allowlist tests**

```ts
test("automatic generation is off unless explicitly enabled", async () => {
  const result = await ensureAutomaticAppKnowledgeJob(
    target(),
    automaticDependencies({ enabled: false }),
  );
  assert.equal(result.status, "disabled");
});

test("limits the first rollout to the configured app/platform allowlist", async () => {
  const dependencies = automaticDependencies({
    enabled: true,
    allowlist: new Set(["15five|web"]),
  });
  assert.equal(
    (await ensureAutomaticAppKnowledgeJob(
      target({ app: "linear" }),
      dependencies,
    )).status,
    "not_allowlisted",
  );
  assert.equal(
    (await ensureAutomaticAppKnowledgeJob(
      target({ app: "15five" }),
      dependencies,
    )).status,
    "created",
  );
});
```

- [ ] **Step 2: Run automatic-coordinator tests and verify RED**

```bash
node --experimental-strip-types --test src/appKnowledgeAutomatic.test.ts
```

Expected: FAIL until explicit flag and allowlist decisions are enforced.

- [ ] **Step 3: Implement rollout configuration**

Use:

```text
APP_KNOWLEDGE_AUTO_GENERATE=1
APP_KNOWLEDGE_AUTO_ALLOWLIST=15five:web
APP_KNOWLEDGE_DESIGN_PROMPT_VERSION=2
APP_KNOWLEDGE_DESIGN_CHUNK_BYTES=24000
APP_KNOWLEDGE_DESIGN_CHUNK_CONCURRENCY=3
APP_KNOWLEDGE_FLOW_CHUNK_BYTES=24000
```

Parse the allowlist once at process start. An empty allowlist means no automatic targets during the pilot; it does not mean all apps.

- [ ] **Step 4: Extend the pilot verifier**

For `--app 15five --platform web`, require:

- one completed automatic job for the selected capture version;
- zero source-hash drift;
- at least one valid token, component, and rule;
- every generated entity has evidence, confidence, `llm_inferred`, and `needs_review`;
- every region is normalized and bounded;
- every referenced crop has verified object metadata;
- raw Flow IDs, order, and evidence match their crawled originals;
- quarantined UI Element count remains unchanged;
- no reviewed/published snapshot was overwritten.

Return non-zero on any failed invariant and print counts only, never prompts, credentials, object keys, or raw provider responses.

- [ ] **Step 5: Document recovery and rollout**

Document:

- queue reconciliation;
- retry of failed evidence/chunks only;
- provider rate-limit pause and resume;
- stale-source regeneration;
- crop rejection interpretation;
- working-copy conflict handling;
- 15Five pilot, small allowlist, new-crawl rollout, and bounded backfill order.

- [ ] **Step 6: Run focused tests and verify GREEN**

```bash
node --experimental-strip-types --test src/appKnowledgeAutomatic.test.ts
```

Expected: PASS with default-off automatic behavior.

- [ ] **Step 7: Run the full repository verification**

```bash
npm run db:check
npm run db:verify
npm test
npm run build
git diff --check
```

Expected:

- migration head is valid and idempotent in the disposable database boundary;
- all tests pass;
- Vite production build succeeds;
- no whitespace errors.

If the repository has pre-existing unrelated failures, record their exact command and error separately, then run and report every focused test from Tasks 1–12. Do not describe the feature as complete while a feature-related failure remains.

- [ ] **Step 8: Run the controlled 15Five Web acceptance**

With the feature flag enabled and allowlist limited to `15five:web`:

```bash
npm run analysis:pilot:verify
```

Expected: successful invariant report for the current 15Five Web capture. Do not expand the allowlist if this command fails.

- [ ] **Step 9: Commit rollout controls and documentation**

```bash
git add \
  src/appKnowledgeAutomatic.ts \
  src/appKnowledgeAutomatic.test.ts \
  scripts/verify-app-knowledge-pilot.ts \
  docs/operations/app-knowledge-antigravity.md \
  README.md
git commit -m "docs: add automatic design extraction rollout"
```

## Final Verification Checklist

- [ ] A verified crawl creates exactly one automatic job for unchanged app/platform/version/source/model/prompt identity.
- [ ] Crawl success is persisted before automatic generation is attempted.
- [ ] Automatic jobs and generated revisions use nullable actors without impersonation.
- [ ] Every generated entity has allowlisted evidence, confidence, `llm_inferred`, and `needs_review`.
- [ ] Every emitted region declares normalized coordinates.
- [ ] Crop validation enforces 16×16 minimum, two-percent margin, bounds clamping, and two-axis 90% full-screen rejection.
- [ ] Crop objects are content-addressed, metadata-verified, and reused.
- [ ] Quarantined full-screen UI Element captures remain quarantined.
- [ ] Raw Flow IDs, step order, interactions, and evidence arrays remain authoritative.
- [ ] App Knowledge revision is canonical and projection is deterministic.
- [ ] Reviewed working copies and published versions remain unchanged.
- [ ] Admins see generation state; non-admins never see unreviewed candidates.
- [ ] The Design System tab uses SSE and performs one completion reload with no polling.
- [ ] The rollout remains default-off and limited to 15Five Web until acceptance passes.
