# Flow-Only Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the app-level Analysis surface and make the existing durable Antigravity workflow analyze and enrich only ordered Flow evidence.

**Architecture:** Keep the proven App Knowledge job, cache, provider, cancellation, and SSE infrastructure as an internal compatibility seam, but run it in a new `flow-only` mode. A flow-only run builds a manifest containing only referenced Flow-step images, analyzes those images in Flow order, synthesizes validated Flow insights, and atomically writes enriched `DesignFlow` data to the selected version without seeding a Design System. The Flows tab owns the product-facing controls and results.

**Tech Stack:** TypeScript, React 19, Express, PostgreSQL JSONB, Node test runner, React static-render tests, Antigravity browser provider.

**Project constraints:** Work directly on `main`; do not create a worktree; preserve all unrelated dirty-worktree changes; do not commit or push.

---

## File structure

- `src/appKnowledgeEvidence.ts`: add an explicit Flow-only manifest scope.
- `src/appKnowledgeFlow.ts`: project validated synthesis back onto existing `DesignFlow` records.
- `src/designSystem.ts`: add optional per-step inferred analysis fields.
- `src/db.ts`: atomically persist enriched Flows for one app/platform/version.
- `src/appKnowledgeStore.ts`: finish a flow-only job without creating an App Knowledge revision.
- `src/appKnowledgeService.ts`: add the Flow-only execution branch and bypass all screen/design-system work.
- `services/import-worker/src/index.ts`: run production generation in Flow-only mode and persist enriched Flows.
- `src/vitrine/components/ScreenDetail.tsx`: remove the Analysis tab and panel.
- `src/vitrine/useAppSectionData.ts`: remove `analysis` from app detail section types/dependencies.
- `src/vitrine/components/FlowAnalysisControls.tsx`: product-facing Flow job controls.
- `src/vitrine/components/FlowViewer.tsx`: render Flow-level and step-level analysis.
- Existing focused test files: cover each boundary before implementation.

### Task 1: Remove the app-level Analysis surface

**Files:**
- Modify: `src/vitrine/useAppSectionData.ts`
- Modify: `src/vitrine/components/ScreenDetail.tsx`
- Modify: `src/vitrine/ScreenDetail.test.tsx`
- Modify: `src/vitrine/AppKnowledgePanel.test.tsx`

- [ ] **Step 1: Write failing section-boundary tests**

Add assertions that `DetailSection`/`SECTIONS` no longer include `analysis`, the admin tabs do not render `Analysis`, and `ScreenDetail.tsx` no longer imports or renders `AppKnowledgePanel`:

```ts
assert.doesNotMatch(source, /id: 'analysis'/);
assert.doesNotMatch(source, /label: 'Analysis'/);
assert.doesNotMatch(source, /<AppKnowledgePanel/);
assert.match(source, /label: 'Design System'/);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx tsx --test src/vitrine/ScreenDetail.test.tsx
```

Expected: FAIL because the Analysis tab/import/render branch still exists.

- [ ] **Step 3: Remove the Analysis section minimally**

Change the section union and dependency switch:

```ts
export type DetailSection =
  | 'overview'
  | 'screens'
  | 'elements'
  | 'flows'
  | 'design-system'
  | 'export'
  | 'review';
```

Remove the `AppKnowledgePanel` import, `analysis` entry in `SECTIONS`, admin tab entry, and render branch. Preserve all unrelated current edits in `ScreenDetail.tsx`.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npx tsx --test src/vitrine/ScreenDetail.test.tsx
```

Expected: PASS.

### Task 2: Build Flow-only evidence manifests

**Files:**
- Modify: `src/appKnowledgeEvidence.ts`
- Modify: `src/appKnowledgeEvidence.test.ts`

- [ ] **Step 1: Write the failing manifest test**

Add a test that calls the manifest builder with `scope: "flows"` and a source containing standalone Screens, UI Elements, and referenced Flow-step images:

```ts
const result = await buildAppKnowledgeEvidenceManifest({
  source,
  objectStore,
  scope: "flows",
});

assert.ok(result.items.length > 0);
assert.ok(result.items.every(({ kind }) => kind === "flow_step"));
assert.deepEqual(
  [...new Set(result.items.map(({ imageId }) => imageId))].sort(),
  referencedFlowImageIds,
);
```

Also assert that a source with Screens but no Flow references throws `flow_evidence_missing`.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --experimental-strip-types --test src/appKnowledgeEvidence.test.ts
```

Expected: FAIL because `scope` is not supported and standalone image occurrences remain.

- [ ] **Step 3: Implement the manifest scope**

Extend the input:

```ts
export async function buildAppKnowledgeEvidenceManifest(input: {
  source: AppKnowledgeEvidenceSource;
  objectStore: ObjectStore;
  overrides?: AppKnowledgeEvidenceOverride[];
  maxImageBytes?: number;
  scope?: "all" | "flows";
}): Promise<AppKnowledgeEvidenceManifest>
```

When `scope === "flows"`:

- do not add standalone `SCREEN-*` occurrences;
- do not add `UI-ELEMENT-*` occurrences;
- add only ordered Flow-step references;
- verify and hash only images reached by those references;
- throw `flow_evidence_missing` when there are no Flow references.

Keep the default `all` behavior unchanged for historical callers and tests.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
node --experimental-strip-types --test src/appKnowledgeEvidence.test.ts
```

Expected: PASS.

### Task 3: Project and persist enriched Flow results

**Files:**
- Modify: `src/designSystem.ts`
- Modify: `src/appKnowledgeFlow.ts`
- Modify: `src/appKnowledgeFlow.test.ts`
- Modify: `src/db.ts`
- Modify: `src/db.appKnowledgeEvidence.test.ts`

- [ ] **Step 1: Write the failing projection test**

Define the optional step analysis shape:

```ts
analysis?: {
  interaction: string;
  visibleStates: string[];
  systemFeedback: string[];
  source: "llm_inferred";
};
```

Add a test for a new `projectFlowSynthesis` helper:

```ts
const projected = projectFlowSynthesis(sourceFlows, planned, synthesized);

assert.equal(projected[0].id, sourceFlows[0].id);
assert.deepEqual(projected[0].steps.map(({ label }) => label), ["Open", "Save"]);
assert.equal(projected[0].description, "Configure and save a review cycle");
assert.deepEqual(projected[0].steps[1].analysis?.systemFeedback, ["Success toast"]);
assert.equal(projected[0].insights?.source, "llm_inferred");
```

Assert the source Flow identity, category, evidence IDs, labels, and curator-authored interactions are preserved.

- [ ] **Step 2: Run the projection test and verify RED**

Run:

```bash
node --experimental-strip-types --test src/appKnowledgeFlow.test.ts
```

Expected: FAIL because `projectFlowSynthesis` and step analysis do not exist.

- [ ] **Step 3: Implement projection**

Add `projectFlowSynthesis` to `src/appKnowledgeFlow.ts`. Index the source, planned, and synthesized Flows by the same source Flow ID; reject missing or extra IDs; preserve order; and return:

```ts
{
  ...sourceFlow,
  description: synthesis.purpose,
  tags: [...new Set([...sourceFlow.tags, ...synthesis.tags])],
  steps: sourceFlow.steps.map((step, index) => ({
    ...step,
    analysis: {
      interaction: synthesis.steps[index].interaction,
      visibleStates: synthesis.steps[index].visibleStates,
      systemFeedback: synthesis.steps[index].systemFeedback,
      source: "llm_inferred",
    },
  })),
  insights: {
    purpose: synthesis.purpose,
    feedback: synthesis.feedback,
    openQuestions: synthesis.openQuestions,
    confidence: synthesis.confidence,
    reviewStatus: "needs_review",
    source: "llm_inferred",
    evidence: sourceFlow.steps.flatMap(({ evidence }) => evidence),
  },
}
```

- [ ] **Step 4: Verify projection GREEN**

Run:

```bash
node --experimental-strip-types --test src/appKnowledgeFlow.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write the failing version-scoped persistence test**

Add a test for:

```ts
saveAnalyzedAppFlows({
  app: "15five",
  platform: "web",
  versionId: 41,
  flows,
});
```

Assert one transaction locks the exact app/platform/version, replaces `app_flow_versions.flows`, updates `app_flows.flows` only for a draft/in-review version, and rejects scope mismatch without writes.

- [ ] **Step 6: Run the persistence test and verify RED**

Run:

```bash
node --experimental-strip-types --test src/db.appKnowledgeEvidence.test.ts
```

Expected: FAIL because `saveAnalyzedAppFlows` does not exist.

- [ ] **Step 7: Implement atomic persistence**

Add `saveAnalyzedAppFlows` to `src/db.ts` using `withTransaction`. Lock the selected `app_versions` row joined to `apps`; verify app/platform/version; upsert `app_flow_versions`; and, for `draft` or `in_review`, upsert the matching `app_flows` working copy in the same transaction.

- [ ] **Step 8: Verify persistence GREEN**

Run:

```bash
node --experimental-strip-types --test src/db.appKnowledgeEvidence.test.ts
```

Expected: PASS.

### Task 4: Execute App Knowledge jobs in Flow-only mode

**Files:**
- Modify: `src/appKnowledgeStore.ts`
- Modify: `src/appKnowledgeDesignSystemStore.test.ts`
- Modify: `src/appKnowledgeService.ts`
- Modify: `src/appKnowledgeService.test.ts`

- [ ] **Step 1: Write the failing store completion test**

Add `completeFlowAnalysis(jobId)` to the store contract and test that it:

- requires a running job;
- sets `status = done`, `stage = complete`, and `completed_at`;
- creates no App Knowledge revision;
- sends the existing job notification.

- [ ] **Step 2: Run the store test and verify RED**

Run:

```bash
node --experimental-strip-types --test src/appKnowledgeDesignSystemStore.test.ts
```

Expected: FAIL because `completeFlowAnalysis` is missing.

- [ ] **Step 3: Implement store completion**

Add:

```ts
completeFlowAnalysis(jobId: number): Promise<AppKnowledgeJobView>;
```

Implement it as a guarded `UPDATE app_knowledge_jobs ... RETURNING *` within the existing store conventions. Do not create or modify revisions.

- [ ] **Step 4: Write the failing Flow-only service test**

Create a service with:

```ts
mode: "flow-only",
saveAnalyzedFlows: async (input) => saved.push(input),
```

Use a source containing standalone Screens/UI Elements plus two Flow steps. Assert:

```ts
assert.deepEqual(
  providerEvidenceCalls.map(({ kind }) => kind),
  ["flow_step", "flow_step"],
);
assert.equal(designSystemChunkCalls, 0);
assert.equal(designSystemMergeCalls, 0);
assert.equal(cropWrites, 0);
assert.equal(seedCalls, 0);
assert.equal(saved.length, 1);
assert.equal(completeFlowAnalysisCalls, 1);
```

Also assert a failed synthesis leaves `saved` empty.

- [ ] **Step 5: Run the service test and verify RED**

Run:

```bash
node --experimental-strip-types --test src/appKnowledgeService.test.ts
```

Expected: FAIL because the service still analyzes Screens and synthesizes a Design System.

- [ ] **Step 6: Implement the Flow-only branch**

Extend dependencies:

```ts
mode?: "full" | "flow-only";
saveAnalyzedFlows?(input: {
  app: string;
  platform: "ios" | "android" | "web";
  versionId: number;
  flows: DesignFlow[];
}): Promise<void>;
```

For `flow-only`:

1. build/freeze a `scope: "flows"` manifest;
2. analyze only eligible ordered Flow-step items;
3. plan and synthesize complete ordered Flows;
4. combine chunk results and call `projectFlowSynthesis`;
5. recheck the source hash;
6. save the complete Flow set once;
7. call `completeFlowAnalysis`;
8. never enter screen-analysis, design-system chunk, merge, crop, revision, or seeding code.

Keep `full` as the default compatibility mode for historical tests; production wiring switches to `flow-only`.

- [ ] **Step 7: Verify service GREEN**

Run:

```bash
node --experimental-strip-types --test src/appKnowledgeService.test.ts src/appKnowledgeDesignSystemStore.test.ts
```

Expected: PASS.

### Task 5: Put Flow-analysis controls and results in Flows

**Files:**
- Create: `src/vitrine/components/FlowAnalysisControls.tsx`
- Create: `src/vitrine/FlowAnalysisControls.test.tsx`
- Modify: `src/vitrine/components/FlowsPanel.tsx`
- Modify: `src/vitrine/components/FlowsWorkspace.tsx`
- Modify: `src/vitrine/components/FlowViewer.tsx`
- Modify: `src/vitrine/components/FlowsPanel.test.tsx`

- [ ] **Step 1: Write failing control tests**

Cover:

- admin + captured Flows + no insights → `Analyze flows`;
- active job → stage/progress and `Cancel`;
- failed job → retry/resume action;
- completed insights → `Regenerate`;
- normal user → no job controls;
- no Flows → no analysis request button.

Use the existing `useAppKnowledge` action/store seam internally, but label every visible string as Flow analysis.

- [ ] **Step 2: Run control tests and verify RED**

Run:

```bash
npx tsx --test src/vitrine/FlowAnalysisControls.test.tsx src/vitrine/components/FlowsPanel.test.tsx
```

Expected: FAIL because the Flow controls do not exist.

- [ ] **Step 3: Implement the controls**

`FlowAnalysisControls` accepts:

```ts
{
  app: string;
  platform: Platform;
  version?: number;
  userRole: "admin" | "user";
  hasFlows: boolean;
  hasInsights: boolean;
}
```

Use `useAppKnowledge` only as an internal durable job client. Render no App Knowledge claims, projections, review actions, or terminology.

- [ ] **Step 4: Write failing FlowViewer result tests**

Render a Flow with `insights` and per-step `analysis`, then assert purpose, confidence, feedback, open questions, visible states, and system feedback appear. Render an unanalyzed Flow and assert the analysis section is absent.

- [ ] **Step 5: Run viewer test and verify RED**

Run:

```bash
npx tsx --test src/vitrine/components/FlowsPanel.test.tsx
```

Expected: FAIL because Flow analysis is not rendered.

- [ ] **Step 6: Implement Flow result rendering**

Add a compact evidence-backed insights area in the selected Flow viewer. In screen and prototype modes, show the current step's inferred interaction, visible states, and system feedback next to the corresponding screenshot. Do not change gallery navigation or screenshot ordering.

- [ ] **Step 7: Verify Flow UI GREEN**

Run:

```bash
npx tsx --test src/vitrine/FlowAnalysisControls.test.tsx src/vitrine/components/FlowsPanel.test.tsx
```

Expected: PASS.

### Task 6: Switch production wiring to Flow-only and verify regressions

**Files:**
- Modify: `services/import-worker/src/index.ts`
- Modify: `services/import-worker/src/pipeline.test.ts`
- Modify: `src/appKnowledgeAutomatic.ts`
- Modify: `src/appKnowledgeAutomatic.test.ts`

- [ ] **Step 1: Write the failing production-wiring test**

Assert the worker constructs the service with `mode: "flow-only"` and supplies:

```ts
saveAnalyzedFlows: ({ app, platform, versionId, flows }) =>
  saveAnalyzedAppFlows({ app, platform, versionId, flows })
```

Assert automatic generation skips apps/versions with no captured Flows instead of queueing screen-analysis work.

- [ ] **Step 2: Run wiring tests and verify RED**

Run:

```bash
node --experimental-strip-types --test \
  services/import-worker/src/pipeline.test.ts \
  src/appKnowledgeAutomatic.test.ts
```

Expected: FAIL because production still starts the full App Knowledge pipeline.

- [ ] **Step 3: Switch production wiring**

Pass `mode: "flow-only"` and the atomic Flow persistence dependency from the import worker. In automatic job preparation, build the Flow-only manifest and return without queueing when no Flow references exist. Preserve existing durable job resume/cancellation behavior.

- [ ] **Step 4: Run focused verification**

Run:

```bash
node --experimental-strip-types --test \
  src/appKnowledgeEvidence.test.ts \
  src/appKnowledgeFlow.test.ts \
  src/appKnowledgeService.test.ts \
  src/appKnowledgeAutomatic.test.ts \
  services/import-worker/src/pipeline.test.ts

npx tsx --test \
  src/vitrine/ScreenDetail.test.tsx \
  src/vitrine/FlowAnalysisControls.test.tsx \
  src/vitrine/components/FlowsPanel.test.tsx
```

Expected: all focused tests PASS.

- [ ] **Step 5: Run full verification**

Run:

```bash
npm test
npm run build
git diff --check
```

Expected: all tests and build PASS; only the existing bundle-size warning may remain.

- [ ] **Step 6: Inspect the final diff**

Confirm:

- no `Analysis` tab or `AppKnowledgePanel` remains in app detail;
- production Flow-only mode makes zero standalone screen/UI-element provider calls;
- no image-derived Design System seed path runs;
- imported Design Systems remain untouched;
- unrelated dirty-worktree changes are preserved;
- no files are staged, committed, or pushed.
