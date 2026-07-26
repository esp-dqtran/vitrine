# Visual Flow and Document Flow Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every selected Astryx Flow synchronized Visual Flow and Document Flow modes inside the persistent app-detail Flow workspace.

**Architecture:** Keep `DesignFlow` as the Flow identity and visual source. Resolve the existing evidence-backed Feature Document lazily by app, platform, version, and Flow ID when Document Flow is selected; render a deterministic text narrative from its current revision while retaining generation, revision, evidence, review, export, and share behavior. Move the selected Flow out of the body portal and into the right pane so the directory tree remains mounted.

**Tech Stack:** TypeScript, React 19, Express 5, PostgreSQL, Node test runner, `tsx`, Vite, `@astryxdesign/core`.

---

## Execution constraints

- Work directly on `main`; do not create a branch or worktree.
- The repository already contains extensive unrelated and overlapping changes.
  Inspect `git diff -- <file>` before every edit and preserve those changes.
- Do not commit or push unless the user explicitly requests it. Commit commands
  below are optional checkpoints and must be skipped without that permission.
- Use `apply_patch` for manual file edits.
- Follow TDD: add a focused failing test, run it, implement the smallest
  behavior, and rerun the test before widening scope.

## File map

### Create

- `src/vitrine/documentFlowModel.ts`
  - pure conversion from a `DesignFlow` plus Feature Document revision to the
    five-section Document Flow narrative.
- `src/vitrine/documentFlowModel.test.ts`
  - deterministic step/evidence mapping and fallback tests.
- `src/vitrine/components/SelectedFlowWorkspace.tsx`
  - shared selected-Flow header, accessible top-level mode tabs, and mode
    switching.
- `src/vitrine/components/VisualFlowPanel.tsx`
  - current Screens/Prototype visual behavior without a body portal.
- `src/vitrine/components/DocumentFlowPanel.tsx`
  - lazy source lookup, empty/progress/error/ready states, text narrative, and
    entry into the existing editable revision workspace.
- `src/vitrine/FlowModes.test.tsx`
  - integrated Flow tree, right-pane mode, synchronization, and responsive
    markup coverage.
- `src/featureDocumentSourceLookup.test.ts`
  - store query coverage for exact source lookup and private/catalog
    precedence.

### Modify

- `src/vitrine/router.ts`
  - parse and serialize `flowView=visual|document`.
- `src/vitrine/router.test.ts`
  - route round-trip and invalid-value coverage.
- `src/vitrine/App.tsx`
  - preserve `flowView` when app-detail Flow state changes.
- `src/vitrine/components/ScreenDetail.tsx`
  - pass `flowView` through the Flows section callback boundary.
- `src/vitrine/components/FlowsPanel.tsx`
  - accept and forward shared mode state and the current user role.
- `src/vitrine/components/FlowsWorkspace.tsx`
  - keep the Flow tree mounted and render the selected Flow in the right pane.
- `src/vitrine/components/FlowViewer.tsx`
  - remove after its visual behavior has moved into `VisualFlowPanel`.
- `src/vitrine/components/FlowsPanel.test.tsx`
  - replace modal-specific assertions with Visual/Document mode assertions.
- `src/featureDocument.ts`
  - add the exact source lookup input type.
- `src/featureDocumentStore.ts`
  - add `getDocumentBySource`.
- `services/api/src/featureDocuments.ts`
  - add the authenticated source-scoped lookup endpoint.
- `services/api/src/featureDocuments.test.ts`
  - verify validation, authorization, pending documents, and exact source
    lookup.
- `src/vitrine/featureDocumentsApi.ts`
  - add `getFeatureDocumentByFlow`.
- `src/vitrine/featureDocumentsApi.test.ts`
  - verify encoded query construction and stable errors.
- `src/vitrine/components/FeatureDocumentPage.tsx`
  - become a compatibility wrapper around the reusable Document Flow
    lifecycle workspace instead of a Markdown-only renderer.
- `src/vitrine/FeatureDocumentWorkspace.test.tsx`
  - preserve initial-job, immutable revision, editor, evidence, and share
    behavior.
- `src/vitrine/styles.css`
  - right-pane selected Flow layout, mode tabs, Visual Flow stage, Document
    Flow narrative, responsive drawer behavior, and focus states.

## Task 1: Add canonical Flow-mode route state

**Files:**

- Modify: `src/vitrine/router.ts`
- Modify: `src/vitrine/router.test.ts`
- Modify: `src/vitrine/App.tsx`
- Modify: `src/vitrine/components/ScreenDetail.tsx`

- [ ] **Step 1: Write failing router round-trip tests**

Add this case to `src/vitrine/router.test.ts`:

```typescript
test('round-trips the selected Flow representation and drops invalid values', () => {
  const documentFlow = {
    name: 'app' as const,
    appId: 'linear',
    section: 'flows',
    platform: 'web' as const,
    version: 3,
    flow: 'checkout',
    step: 2,
    flowView: 'document' as const,
  };
  assert.equal(
    routeToPath(documentFlow),
    '/apps/linear/flows?platform=web&version=3&flow=checkout&step=2&flowView=document',
  );
  assert.deepEqual(
    parseRouteLocation(
      '/apps/linear/flows',
      '?platform=web&version=3&flow=checkout&step=2&flowView=document',
    ),
    documentFlow,
  );
  assert.deepEqual(
    parseRouteLocation(
      '/apps/linear/flows',
      '?platform=web&version=3&flow=checkout&flowView=split',
    ),
    {
      name: 'app',
      appId: 'linear',
      section: 'flows',
      platform: 'web',
      version: 3,
      flow: 'checkout',
    },
  );
});
```

- [ ] **Step 2: Run the router test and verify it fails**

Run:

```bash
node --experimental-strip-types --test src/vitrine/router.test.ts
```

Expected: FAIL because `Route` has no `flowView` field and
`routeToPath()` does not serialize it.

- [ ] **Step 3: Implement the route type and allowlisted parsing**

In `src/vitrine/router.ts`, add and use this exported type:

```typescript
export type FlowRepresentation = 'visual' | 'document';
```

Add the field to the app route:

```typescript
flowView?: FlowRepresentation;
```

In `parseRouteLocation()`:

```typescript
const rawFlowView = params.get('flowView');
const flowView: FlowRepresentation | undefined =
  rawFlowView === 'visual' || rawFlowView === 'document'
    ? rawFlowView
    : undefined;
```

Include it in the returned route only when valid:

```typescript
...(flowView ? { flowView } : {}),
```

In the app branch of `routeToPath()`:

```typescript
if (route.flowView) params.set('flowView', route.flowView);
```

- [ ] **Step 4: Thread `flowView` through app-detail callbacks**

In `src/vitrine/components/ScreenDetail.tsx`, import
`FlowRepresentation`, add:

```typescript
initialFlowView?: FlowRepresentation;
```

and change the callback signature to:

```typescript
onFlowChange?: (
  flow: string | undefined,
  step: number | undefined,
  flowView: FlowRepresentation | undefined,
  platform: Platform,
  version?: number,
) => void;
```

Pass `initialFlowView` to `FlowsPanel` and include it in
`onSelectionChange`.

In `src/vitrine/App.tsx`, pass:

```tsx
initialFlowView={route.flowView}
```

and serialize the callback value:

```tsx
onFlowChange={(flow, step, flowView, platform, version) => navigate({
  name: 'app',
  appId: detail.id,
  section: 'flows',
  platform,
  version,
  ...(flow ? { flow } : {}),
  ...(step ? { step } : {}),
  ...(flowView ? { flowView } : {}),
})}
```

- [ ] **Step 5: Rerun focused routing tests**

Run:

```bash
node --experimental-strip-types --test src/vitrine/router.test.ts
```

Expected: PASS.

- [ ] **Step 6: Optional commit checkpoint**

Only with explicit user approval:

```bash
git add src/vitrine/router.ts src/vitrine/router.test.ts src/vitrine/App.tsx src/vitrine/components/ScreenDetail.tsx
git commit -m "feat: add Flow representation route state"
```

## Task 2: Resolve Feature Documents by exact source Flow

**Files:**

- Modify: `src/featureDocument.ts`
- Modify: `src/featureDocumentStore.ts`
- Create: `src/featureDocumentSourceLookup.test.ts`
- Modify: `services/api/src/featureDocuments.ts`
- Modify: `services/api/src/featureDocuments.test.ts`

- [ ] **Step 1: Define the source lookup contract**

Add to `src/featureDocument.ts`:

```typescript
export interface FeatureDocumentSourceLookup {
  app: string;
  platform: 'ios' | 'android' | 'web';
  sourceVersionId: number;
  flowId: string;
}
```

Add this method to `FeatureDocumentStore`:

```typescript
getDocumentBySource(
  userId: number,
  source: FeatureDocumentSourceLookup,
): Promise<FeatureDocumentView | undefined>;
```

- [ ] **Step 2: Write the failing store lookup test**

Create `src/featureDocumentSourceLookup.test.ts` with a fake query that records
SQL and returns a selected document ID:

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';
import { createFeatureDocumentStore } from './featureDocumentStore.ts';

test('resolves a Document Flow by exact source and prefers the owned document', async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const query = async (sql: string, values?: readonly unknown[]) => {
    calls.push({ sql, values });
    if (sql.includes('source_document_id')) return { rows: [{ source_document_id: 12 }] };
    if (sql.includes('FROM feature_documents d') && sql.includes('WHERE d.id = $1')) {
      return {
        rows: [{
          id: 12,
          title: 'Checkout',
          visibility: 'private',
          current_revision_id: null,
          source_change_acknowledged_sha256: null,
          revision_source_sha256: null,
          current_source_sha256: null,
        }],
      };
    }
    return { rows: [] };
  };
  const store = createFeatureDocumentStore(query);

  const document = await store.getDocumentBySource(7, {
    app: 'linear',
    platform: 'web',
    sourceVersionId: 5,
    flowId: 'checkout',
  });

  assert.equal(document?.id, 12);
  assert.match(calls[0].sql, /COALESCE\(r\.source_version_id, latest_job\.source_version_id\) = \$5/);
  assert.match(calls[0].sql, /ORDER BY \(d\.user_id = \$1\) DESC/);
  assert.deepEqual(calls[0].values, [7, 'linear', 'web', 'checkout', 5]);
});
```

- [ ] **Step 3: Run the store test and verify it fails**

Run:

```bash
node --experimental-strip-types --test src/featureDocumentSourceLookup.test.ts
```

Expected: FAIL because `getDocumentBySource` does not exist.

- [ ] **Step 4: Implement exact source lookup**

Import `FeatureDocumentSourceLookup` in `src/featureDocumentStore.ts` and add:

```typescript
async getDocumentBySource(userId, rawSource) {
  const source: FeatureDocumentSourceLookup = {
    app: text(rawSource.app, 'source app'),
    platform: rawSource.platform,
    sourceVersionId: positiveInteger(rawSource.sourceVersionId, 'source version'),
    flowId: text(rawSource.flowId, 'source Flow'),
  };
  if (!source.app.trim() || !source.flowId.trim()) {
    throw new Error('Invalid Feature Document source');
  }
  if (!['ios', 'android', 'web'].includes(source.platform)) {
    throw new Error('Invalid Feature Document platform');
  }
  const result = await runQuery(
    `SELECT d.id AS source_document_id
     FROM feature_documents d
     JOIN apps a ON a.id = d.app_id
     JOIN platforms p ON p.id = d.platform_id
     LEFT JOIN feature_document_revisions r ON r.id = d.current_revision_id
     LEFT JOIN LATERAL (
       SELECT j.source_version_id
       FROM feature_document_jobs j
       WHERE j.document_id = d.id
       ORDER BY j.created_at DESC, j.id DESC
       LIMIT 1
     ) latest_job ON true
     WHERE (d.user_id = $1 OR d.visibility = 'catalog')
       AND a.name = $2
       AND p.name = $3
       AND d.source_flow_id = $4
       AND COALESCE(r.source_version_id, latest_job.source_version_id) = $5
     ORDER BY (d.user_id = $1) DESC, d.updated_at DESC, d.id DESC
     LIMIT 1`,
    [userId, source.app, source.platform, source.flowId, source.sourceVersionId],
  );
  const documentId = result.rows[0]?.source_document_id;
  return documentId == null
    ? undefined
    : loadDocument(runQuery, userId, positiveInteger(documentId));
},
```

This deliberately chooses the user's private document before the canonical
catalog document, then the latest updated candidate.

- [ ] **Step 5: Write failing API source-route tests**

Extend the fake store in `services/api/src/featureDocuments.test.ts` with:

```typescript
async getDocumentBySource(userId: number, source: {
  app: string;
  platform: string;
  sourceVersionId: number;
  flowId: string;
}) {
  return userId === 7 && source.app === 'linear' && source.platform === 'web'
    && source.sourceVersionId === 5 && source.flowId === 'checkout'
    ? {
        id: 12,
        title: 'Checkout',
        visibility: 'catalog' as const,
        reviewStatus: 'draft' as const,
        sourceChanged: false,
        revisions: [],
        shares: [],
        currentJob: job,
      }
    : undefined;
},
```

Add:

```typescript
test('loads a pending Document Flow by exact app platform version and Flow identity', async () => {
  const response = await fetch(
    `${base}/feature-documents/source?app=linear&platform=web&version=3&flowId=checkout`,
  );
  assert.equal(response.status, 200);
  const body = await response.json() as { id: number; currentJob: { id: number } };
  assert.equal(body.id, 12);
  assert.equal(body.currentJob.id, 31);
});

test('validates and authorizes Document Flow source lookup', async () => {
  assert.equal(
    (await fetch(`${base}/feature-documents/source?app=linear&platform=windows&version=3&flowId=checkout`)).status,
    400,
  );
  allowApp = false;
  const denied = await fetch(
    `${base}/feature-documents/source?app=linear&platform=web&version=3&flowId=checkout`,
  );
  allowApp = true;
  assert.equal(denied.status, 403);
});
```

- [ ] **Step 6: Run the API test and verify the new cases fail**

Run:

```bash
node --experimental-strip-types --test services/api/src/featureDocuments.test.ts
```

Expected: FAIL with 400/404 because the source route does not exist.

- [ ] **Step 7: Implement the source route before `/:documentId`**

In `services/api/src/featureDocuments.ts`, add a parser:

```typescript
function sourceLookupRequest(query: express.Request['query']): GenerationRequest | undefined {
  const version = positiveId(query.version);
  const app = boundedText(query.app, 240);
  const flowId = boundedText(query.flowId, 240);
  const platform = query.platform;
  if (!app || !flowId || !version) return undefined;
  if (platform !== 'ios' && platform !== 'android' && platform !== 'web') return undefined;
  return { app, platform, version, flowId, focusInstruction: '' };
}
```

Register this route before `/feature-documents/:documentId`:

```typescript
app.get('/feature-documents/source', asyncRoute(async (req, res) => {
  const input = sourceLookupRequest(req.query);
  if (!input) {
    res.status(400).json({ error: 'Invalid Document Flow source' });
    return;
  }
  if (!(await deps.canAccessApp(res.locals.user, input.app))) {
    res.status(403).json({ error: 'Upgrade required', code: 'upgrade_required' });
    return;
  }
  const versions = await deps.listAppVersions(
    input.app,
    input.platform,
    res.locals.user.role !== 'admin',
  );
  const version = versions.find(({ version_number }) => version_number === input.version);
  if (!version) {
    res.status(404).json({ error: 'Document Flow unavailable', code: 'document_flow_unavailable' });
    return;
  }
  const document = await deps.store.getDocumentBySource(res.locals.user.id, {
    app: input.app,
    platform: input.platform,
    sourceVersionId: version.id,
    flowId: input.flowId,
  });
  if (!document) {
    res.status(404).json({ error: 'Document Flow unavailable', code: 'document_flow_unavailable' });
    return;
  }
  res.json(document);
}));
```

In the same task, extract the existing source-drift enrichment from the
document-ID route into this helper and call it from both read routes:

```typescript
async function withCurrentSourceState(
  deps: FeatureDocumentRouteDependencies,
  user: FeatureDocumentUser,
  document: FeatureDocumentView,
): Promise<FeatureDocumentView> {
  if (!document.currentRevision) return document;
  const current = await prepareFromSource(
    deps,
    user,
    document.currentRevision.source,
    document.currentRevision.focusInstruction,
  );
  if (!current || current.missing.length > 0) {
    return { ...document, sourceChanged: true };
  }
  return await deps.store.getDocument(
    user.id,
    document.id,
    current.evidenceManifestSha256,
  ) ?? document;
}
```

Import `FeatureDocumentView` into the API module. The helper deliberately
returns pending documents unchanged and marks a completed document changed when
current evidence cannot be reconstructed.

- [ ] **Step 8: Rerun focused store and API tests**

Run:

```bash
node --experimental-strip-types --test \
  src/featureDocumentSourceLookup.test.ts \
  services/api/src/featureDocuments.test.ts
```

Expected: PASS.

- [ ] **Step 9: Optional commit checkpoint**

Only with explicit user approval:

```bash
git add src/featureDocument.ts src/featureDocumentStore.ts src/featureDocumentSourceLookup.test.ts services/api/src/featureDocuments.ts services/api/src/featureDocuments.test.ts
git commit -m "feat: resolve Document Flows by source"
```

## Task 3: Add the client lookup and deterministic Document Flow model

**Files:**

- Modify: `src/vitrine/featureDocumentsApi.ts`
- Modify: `src/vitrine/featureDocumentsApi.test.ts`
- Create: `src/vitrine/documentFlowModel.ts`
- Create: `src/vitrine/documentFlowModel.test.ts`

- [ ] **Step 1: Write the failing client lookup test**

Add to `src/vitrine/featureDocumentsApi.test.ts`:

```typescript
test('loads a Document Flow by encoded source identity', async () => {
  const calls: string[] = [];
  const request = async (url: string | URL | Request) => {
    calls.push(String(url));
    return response({
      id: 12,
      title: 'Checkout',
      reviewStatus: 'draft',
      sourceChanged: false,
      revisions: [],
      shares: [],
    });
  };
  await getFeatureDocumentByFlow({
    app: 'Linear & Co',
    platform: 'web',
    version: 3,
    flowId: 'checkout/recovery',
  }, request as typeof fetch);
  assert.equal(
    calls[0],
    '/api/feature-documents/source?app=Linear+%26+Co&platform=web&version=3&flowId=checkout%2Frecovery',
  );
});
```

- [ ] **Step 2: Run the client test and verify it fails**

Run:

```bash
node --experimental-strip-types --test src/vitrine/featureDocumentsApi.test.ts
```

Expected: FAIL because `getFeatureDocumentByFlow` is not exported.

- [ ] **Step 3: Implement the client lookup**

Add to `src/vitrine/featureDocumentsApi.ts`:

```typescript
export interface FeatureDocumentFlowSource {
  app: string;
  platform: 'ios' | 'android' | 'web';
  version: number;
  flowId: string;
}

export function getFeatureDocumentByFlow(
  source: FeatureDocumentFlowSource,
  request: typeof fetch = fetch,
): Promise<FeatureDocumentView> {
  if (!Number.isSafeInteger(source.version) || source.version < 1) {
    throw new Error('Invalid Document Flow version');
  }
  const params = new URLSearchParams({
    app: source.app,
    platform: source.platform,
    version: String(source.version),
    flowId: source.flowId,
  });
  return json(`/api/feature-documents/source?${params}`, undefined, request);
}
```

- [ ] **Step 4: Write the failing narrative-model tests**

Create `src/vitrine/documentFlowModel.test.ts`:

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';
import type { DesignFlow, EvidenceView } from '../designSystem.ts';
import type { FeatureDocumentRevisionView } from '../featureDocument.ts';
import { buildDocumentFlowNarrative } from './documentFlowModel.ts';

const flow: DesignFlow<EvidenceView> = {
  id: 'checkout',
  title: 'Checkout',
  category: 'Payments',
  description: '',
  tags: [],
  steps: [
    { label: 'Review cart', evidence: [{ imageId: 42, imageUrl: '/42.png' }] },
    { label: 'Pay', interaction: 'Submit card', evidence: [{ imageId: 43, imageUrl: '/43.png' }] },
  ],
};

const revision = {
  id: 5,
  documentId: 12,
  revisionNumber: 2,
  authorType: 'generated',
  reviewStatus: 'draft',
  source: {
    app: 'linear',
    platform: 'web',
    versionId: 5,
    flowId: 'checkout',
    title: 'Checkout',
    description: '',
    tags: [],
  },
  evidenceManifest: [
    { stepIndex: 0, imageIndex: 0, imageId: 42, evidenceId: 'E-42', stepLabel: 'Review cart', description: 'Cart visible' },
    { stepIndex: 1, imageIndex: 0, imageId: 43, evidenceId: 'E-43', stepLabel: 'Pay', description: 'Card form' },
  ],
  focusInstruction: '',
  promptVersion: 1,
  providerModel: 'research-model',
  createdAt: '2026-07-26T00:00:00.000Z',
  content: {
    executiveSummary: {
      purpose: { id: 'purpose', kind: 'observed', text: 'Complete a purchase', evidenceIds: ['E-42'] },
      userValue: { id: 'value', kind: 'inferred', text: 'Receive an order', evidenceIds: ['E-43'] },
      recommendation: { id: 'recommendation', kind: 'proposed', text: 'Keep progress', evidenceIds: [] },
    },
    observedFlow: {
      userGoal: { id: 'goal', kind: 'observed', text: 'Buy items', evidenceIds: ['E-42'] },
      entryPoint: { id: 'entry', kind: 'observed', text: 'Open cart', evidenceIds: ['E-42'] },
      completionPoint: { id: 'complete', kind: 'unknown', text: 'Order confirmation', evidenceIds: [] },
      journey: [
        { id: 'j1', kind: 'observed', text: 'Review the cart', evidenceIds: ['E-42'] },
      ],
      actors: [],
      visibleStates: [],
    },
    flowAnalysis: {
      effectivePatterns: [],
      friction: [],
      missingStates: [{ id: 'missing', kind: 'unknown', text: 'Declined card state', evidenceIds: [] }],
      inconsistencies: [],
      risksAndAssumptions: [],
    },
    proposedFeature: { problem: { id: 'problem', kind: 'unknown', text: '', evidenceIds: [] }, targetUsers: [], goals: [], nonGoals: [], behavior: [], journey: [] },
    requirements: [],
    edgeCases: [],
    successMetrics: [],
    guardrailMetrics: [],
    analyticsEvents: [],
    dependencies: [],
    openQuestions: [],
  },
} satisfies FeatureDocumentRevisionView;

test('builds one Document Flow row per source step and preserves claim kinds', () => {
  const narrative = buildDocumentFlowNarrative(flow, revision);
  assert.equal(narrative.overview.purpose.text, 'Complete a purchase');
  assert.equal(narrative.trigger.text, 'Open cart');
  assert.deepEqual(narrative.steps.map(({ number, label, text, kind }) => ({
    number, label, text, kind,
  })), [
    { number: 1, label: 'Review cart', text: 'Review the cart', kind: 'observed' },
    { number: 2, label: 'Pay', text: 'Submit card', kind: 'observed' },
  ]);
  assert.equal(narrative.outcome.kind, 'unknown');
  assert.equal(narrative.alternates[0].text, 'Declined card state');
});
```

- [ ] **Step 5: Run the narrative test and verify it fails**

Run:

```bash
node --experimental-strip-types --test src/vitrine/documentFlowModel.test.ts
```

Expected: FAIL because `documentFlowModel.ts` does not exist.

- [ ] **Step 6: Implement deterministic narrative mapping**

Create `src/vitrine/documentFlowModel.ts` with these exported types and
function:

```typescript
import type { DesignFlow, EvidenceView } from '../designSystem.ts';
import type {
  FeatureClaim,
  FeatureClaimKind,
  FeatureDocumentRevisionView,
} from '../featureDocument.ts';

export interface DocumentFlowStep {
  number: number;
  label: string;
  text: string;
  kind: FeatureClaimKind;
  evidenceIds: string[];
}

export interface DocumentFlowNarrative {
  overview: {
    purpose: FeatureClaim;
    userValue: FeatureClaim;
  };
  trigger: FeatureClaim;
  steps: DocumentFlowStep[];
  outcome: FeatureClaim;
  alternates: FeatureClaim[];
}

export function buildDocumentFlowNarrative(
  flow: DesignFlow<EvidenceView>,
  revision: FeatureDocumentRevisionView,
): DocumentFlowNarrative {
  const journey = revision.content.observedFlow.journey;
  const steps = flow.steps.map((step, stepIndex) => {
    const evidenceIds = revision.evidenceManifest
      .filter((item) => item.stepIndex === stepIndex)
      .map((item) => item.evidenceId);
    const claim = journey.find((item) =>
      item.evidenceIds.some((evidenceId) => evidenceIds.includes(evidenceId)));
    return {
      number: stepIndex + 1,
      label: step.label,
      text: claim?.text
        ?? step.analysis?.interaction
        ?? step.interaction
        ?? 'No documented description.',
      kind: claim?.kind ?? (step.analysis || step.interaction ? 'observed' : 'unknown'),
      evidenceIds: claim?.evidenceIds.length ? claim.evidenceIds : evidenceIds,
    };
  });
  return {
    overview: {
      purpose: revision.content.executiveSummary.purpose,
      userValue: revision.content.executiveSummary.userValue,
    },
    trigger: revision.content.observedFlow.entryPoint,
    steps,
    outcome: revision.content.observedFlow.completionPoint,
    alternates: [
      ...revision.content.edgeCases,
      ...revision.content.flowAnalysis.friction,
      ...revision.content.flowAnalysis.missingStates,
      ...revision.content.flowAnalysis.risksAndAssumptions,
    ],
  };
}
```

- [ ] **Step 7: Rerun client and model tests**

Run:

```bash
node --experimental-strip-types --test \
  src/vitrine/featureDocumentsApi.test.ts \
  src/vitrine/documentFlowModel.test.ts
```

Expected: PASS.

- [ ] **Step 8: Optional commit checkpoint**

Only with explicit user approval:

```bash
git add src/vitrine/featureDocumentsApi.ts src/vitrine/featureDocumentsApi.test.ts src/vitrine/documentFlowModel.ts src/vitrine/documentFlowModel.test.ts
git commit -m "feat: model Document Flow narratives"
```

## Task 4: Keep the Flow tree mounted and introduce top-level mode tabs

**Files:**

- Create: `src/vitrine/components/SelectedFlowWorkspace.tsx`
- Create: `src/vitrine/components/VisualFlowPanel.tsx`
- Modify: `src/vitrine/components/FlowsWorkspace.tsx`
- Modify: `src/vitrine/components/FlowsPanel.tsx`
- Modify: `src/vitrine/components/FlowViewer.tsx`
- Create: `src/vitrine/FlowModes.test.tsx`

- [ ] **Step 1: Write the failing selected-workspace test**

Create `src/vitrine/FlowModes.test.tsx`:

```tsx
import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DesignFlow, EvidenceView } from '../designSystem.ts';
import { FlowsPanel } from './components/FlowsPanel.tsx';

const flow: DesignFlow<EvidenceView> = {
  id: 'checkout',
  title: 'Checkout',
  category: 'Payments',
  description: '',
  tags: [],
  steps: [
    { label: 'Review cart', evidence: [{ imageId: 42, imageUrl: '/api/media/42' }] },
    { label: 'Pay', evidence: [{ imageId: 43, imageUrl: '/api/media/43' }] },
  ],
};

test('keeps the Flow directory mounted beside the selected Visual Flow', () => {
  const html = renderToStaticMarkup(
    <FlowsPanel
      flows={[flow]}
      app="linear"
      platform="web"
      version={3}
      selectedFlowId="checkout"
      selectedFlowView="visual"
    />,
  );
  assert.match(html, /class="flow-workspace__rail"/);
  assert.match(html, /role="tablist"/);
  assert.match(html, /Visual Flow/);
  assert.match(html, /Document Flow/);
  assert.match(html, /aria-selected="true"[^>]*>Visual Flow/);
  assert.match(html, /Screens/);
  assert.match(html, /Prototype/);
  assert.doesNotMatch(html, /aria-modal="true"/);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
tsx --test src/vitrine/FlowModes.test.tsx
```

Expected: FAIL because `selectedFlowView` and the top-level tabs do not exist,
and `FlowViewer` still renders an aria-modal body portal.

- [ ] **Step 3: Extract Visual Flow from the portal viewer**

Create `src/vitrine/components/VisualFlowPanel.tsx` by moving the current
`screenItems`, Screens track, Prototype state, navigation, analysis annotations,
footer metadata, and Save/Copy actions from `FlowViewer`.

Its public interface must be:

```typescript
export interface VisualFlowPanelProps {
  flow: DesignFlow<EvidenceView>;
  platform?: Platform;
  selectedStep?: number;
  onStepChange?(step?: number): void;
}
```

It must render:

```tsx
<section className="visual-flow-panel" aria-label={`${flow.title} Visual Flow`}>
  <div className="visual-flow-panel__submodes" role="group" aria-label="Visual Flow view">
    <button type="button" aria-pressed={mode === 'screens'} onClick={() => setMode('screens')}>
      Screens
    </button>
    <button type="button" aria-pressed={mode === 'prototype'} onClick={() => setMode('prototype')}>
      Prototype
    </button>
  </div>
  {mode === 'screens' ? screensPanel : prototypePanel}
</section>
```

Each screenshot must expose a separate source-step selection control so it
does not nest interactive Save/Copy controls:

```tsx
<button
  type="button"
  className="visual-flow-panel__screen-focus"
  aria-label={`Select visual step ${stepNumber}: ${label}`}
  onClick={() => onStepChange?.(stepNumber)}
>
  <PlaceholderImage
    src={evidence?.imageUrl}
    style={{ objectFit: 'contain', background: imageBackground }}
  />
</button>
```

When `selectedStep` changes, synchronize `prototypeIndex` to that one-based
step and scroll the matching Screens card into view. Do not reset the selected
step when switching between Screens and Prototype.

Do not use `createPortal`, `role="dialog"`, `aria-modal`, or a backdrop in this
component.

- [ ] **Step 4: Create the shared selected Flow shell**

Create `src/vitrine/components/SelectedFlowWorkspace.tsx`:

```tsx
import { Button } from '@astryxdesign/core';
import type { DesignFlow, EvidenceView } from '../../designSystem.ts';
import type { Platform } from '../../platformFromUrl.ts';
import type { FlowRepresentation } from '../router.ts';
import { DocumentFlowPanel } from './DocumentFlowPanel.tsx';
import { VisualFlowPanel } from './VisualFlowPanel.tsx';

export interface SelectedFlowWorkspaceProps {
  flow: DesignFlow<EvidenceView>;
  app?: string;
  platform?: Platform;
  version?: number;
  userRole: 'admin' | 'user';
  view: FlowRepresentation;
  selectedStep?: number;
  onViewChange(view: FlowRepresentation, step?: number): void;
  onStepChange(step?: number): void;
  onBack(): void;
}

export function SelectedFlowWorkspace(props: SelectedFlowWorkspaceProps) {
  const { flow, view } = props;
  const panelId = `flow-${flow.id}-${view}-panel`;
  return (
    <section className="selected-flow-workspace" aria-labelledby={`flow-${flow.id}-title`}>
      <header className="selected-flow-workspace__header">
        <div>
          <h2 id={`flow-${flow.id}-title`}>{flow.title}</h2>
          <p>{flow.category ?? 'Flow'} · {flow.steps.length} {flow.steps.length === 1 ? 'step' : 'steps'}</p>
        </div>
        <Button label="Back to flows" variant="ghost" clickAction={props.onBack} />
      </header>
      <div role="tablist" aria-label="Flow representation" className="selected-flow-workspace__tabs">
        {(['visual', 'document'] as const).map((candidate) => (
          <button
            key={candidate}
            type="button"
            role="tab"
            aria-selected={view === candidate}
            aria-controls={`flow-${flow.id}-${candidate}-panel`}
            onClick={() => props.onViewChange(candidate, props.selectedStep)}
          >
            {candidate === 'visual' ? 'Visual Flow' : 'Document Flow'}
          </button>
        ))}
      </div>
      <div id={panelId} role="tabpanel">
        {view === 'visual'
          ? <VisualFlowPanel flow={flow} platform={props.platform} selectedStep={props.selectedStep} onStepChange={props.onStepChange} />
          : <DocumentFlowPanel
              flow={flow}
              app={props.app}
              platform={props.platform}
              version={props.version}
              userRole={props.userRole}
              selectedStep={props.selectedStep}
              onOpenVisualStep={(step) => props.onViewChange('visual', step)}
            />}
      </div>
    </section>
  );
}
```

The `DocumentFlowPanel` import will fail until Task 5; add a temporary minimal
component file exporting an unavailable state so Task 4 can pass independently:

```tsx
export function DocumentFlowPanel() {
  return <section aria-label="Document Flow">Document Flow unavailable</section>;
}
```

- [ ] **Step 5: Render the selected Flow inside the right pane**

Update `FlowsPanel` and `FlowsWorkspace` props with:

```typescript
selectedFlowView?: FlowRepresentation;
userRole?: 'admin' | 'user';
onSelectionChange?(
  flowId?: string,
  step?: number,
  flowView?: FlowRepresentation,
): void;
```

Default a selected Flow to `visual`. In `FlowsWorkspace`, render exactly one
right-pane branch:

```tsx
{selectedFlow ? (
  <SelectedFlowWorkspace
    flow={selectedFlow}
    app={app}
    platform={platform}
    version={version}
    userRole={userRole}
    view={selectedFlowView ?? 'visual'}
    selectedStep={selectedStep}
    onViewChange={(flowView, step) =>
      onSelectionChange(selectedFlow.id, step, flowView)}
    onStepChange={(step) =>
      onSelectionChange(selectedFlow.id, step, selectedFlowView ?? 'visual')}
    onBack={() => onSelectionChange(undefined, undefined, undefined)}
  />
) : visibleGroups.length ? (
  <FlowGallery groups={visibleGroups} onSelectFlow={selectFlow} />
) : (
  <EmptyState
    title="No flows match your search"
    description={`Nothing found for "${query}".`}
  />
)}
```

Selecting a different leaf in the Flow tree must call:

```typescript
onSelectionChange(flowId, undefined, 'visual');
```

This prevents a Document Flow selection from leaking to a newly selected Flow.

Delete the separate `selectedFlow && <FlowViewer ... />` portal branch.

- [ ] **Step 6: Remove the retired portal component**

After all imports and tests use `VisualFlowPanel` or
`SelectedFlowWorkspace`, delete `src/vitrine/components/FlowViewer.tsx`.
Preserve `flowStepItems` by moving it to `VisualFlowPanel.tsx` because its
evidence-to-step mapping test still matters.

- [ ] **Step 7: Run the focused mode and existing Flow tests**

Run:

```bash
tsx --test \
  src/vitrine/FlowModes.test.tsx \
  src/vitrine/components/FlowsPanel.test.tsx \
  src/vitrine/FlowTreeNavigation.test.tsx
```

Expected: PASS after updating modal-specific expectations to the persistent
right-pane contract.

- [ ] **Step 8: Optional commit checkpoint**

Only with explicit user approval:

```bash
git add src/vitrine/components/SelectedFlowWorkspace.tsx src/vitrine/components/VisualFlowPanel.tsx src/vitrine/components/DocumentFlowPanel.tsx src/vitrine/components/FlowsWorkspace.tsx src/vitrine/components/FlowsPanel.tsx src/vitrine/components/FlowViewer.tsx src/vitrine/FlowModes.test.tsx src/vitrine/components/FlowsPanel.test.tsx
git commit -m "feat: add Visual and Document Flow workspace"
```

## Task 5: Implement Document Flow reading, progress, and step synchronization

**Files:**

- Modify: `src/vitrine/components/DocumentFlowPanel.tsx`
- Modify: `src/vitrine/FlowModes.test.tsx`
- Modify: `src/vitrine/FeatureDocumentGeneration.test.tsx`

- [ ] **Step 1: Add failing ready and pending Document Flow tests**

Extend `src/vitrine/FlowModes.test.tsx` using dependency injection on
`DocumentFlowPanel` or a small exported `DocumentFlowPanelView`:

```tsx
test('renders the five-section Document Flow and opens its exact visual step', () => {
  const opened: number[] = [];
  const html = renderToStaticMarkup(
    <DocumentFlowPanelView
      flow={flow}
      state={{ kind: 'ready', document, revision }}
      selectedStep={2}
      userRole="user"
      onOpenVisualStep={(step) => opened.push(step)}
    />,
  );
  for (const label of ['Overview', 'Trigger', 'Ordered steps', 'Outcome', 'Alternate and error paths']) {
    assert.match(html, new RegExp(label));
  }
  assert.match(html, /View visual step 1/);
  assert.match(html, /View visual step 2/);
  assert.match(html, /aria-current="step"/);
});

test('shows generation progress before the first revision exists', () => {
  const html = renderToStaticMarkup(
    <DocumentFlowPanelView
      flow={flow}
      state={{
        kind: 'pending',
        document: {
          id: 12,
          title: 'Checkout',
          reviewStatus: 'draft',
          sourceChanged: false,
          revisions: [],
          shares: [],
          currentJob: {
            id: 31,
            documentId: 12,
            status: 'running',
            stage: 'analyzing',
            doneCount: 1,
            totalCount: 3,
            updatedAt: '2026-07-26T00:00:00.000Z',
          },
        },
      }}
      userRole="admin"
      onOpenVisualStep={() => undefined}
    />,
  );
  assert.match(html, /Analyzing image 2 of 3/);
  assert.doesNotMatch(html, /Document Flow has no revision/);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
tsx --test src/vitrine/FlowModes.test.tsx
```

Expected: FAIL because the temporary Document Flow component has no lifecycle
or narrative.

- [ ] **Step 3: Implement explicit Document Flow states**

In `DocumentFlowPanel.tsx`, define:

```typescript
export interface DocumentFlowPanelProps {
  flow: DesignFlow<EvidenceView>;
  app?: string;
  platform?: Platform;
  version?: number;
  userRole: 'admin' | 'user';
  selectedStep?: number;
  onOpenVisualStep(step: number): void;
}

export type DocumentFlowState =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'pending'; document: FeatureDocumentView }
  | { kind: 'ready'; document: FeatureDocumentView; revision: FeatureDocumentRevisionView }
  | { kind: 'error'; message: string; retryable: boolean };
```

Implement `DocumentFlowPanelView` with an exhaustive `switch`. The ready
branch must call `buildDocumentFlowNarrative(flow, revision)`, render the five
approved sections, label claim kinds, and render each source step:

```tsx
<li
  key={step.number}
  className="document-flow__step"
  aria-current={selectedStep === step.number ? 'step' : undefined}
>
  <div>
    <strong>{String(step.number).padStart(2, '0')} · {step.label}</strong>
    <span className={`document-flow__claim-kind is-${step.kind}`}>{step.kind}</span>
    <p>{step.text}</p>
  </div>
  <Button
    label={`View visual step ${step.number}`}
    variant="ghost"
    size="sm"
    clickAction={() => onOpenVisualStep(step.number)}
  />
</li>
```

Use `FeatureDocumentProgress` for pending jobs. Use a compact
`Document Flow unavailable` empty state for normal users and
`Generate Document Flow` for admins.

- [ ] **Step 4: Implement lazy lookup and SSE lifecycle**

The stateful `DocumentFlowPanel` must:

1. fetch `getFeatureDocumentByFlow()` only when mounted;
2. translate a 404 with `document_flow_unavailable` to `missing`;
3. classify a document with no revision and an active/current job as
   `pending`;
4. subscribe with `subscribeFeatureDocumentJob`;
5. reload by document ID when the job becomes `done`;
6. expose cancel, retry, reconnect, and admin generation actions;
7. keep Visual Flow usable by containing all failures inside the panel.

The central classifier must be a pure function:

```typescript
export function classifyDocumentFlow(document: FeatureDocumentView): DocumentFlowState {
  const revision = document.currentRevision ?? document.revisions[0];
  if (revision) return { kind: 'ready', document, revision };
  if (document.currentJob) return { kind: 'pending', document };
  return { kind: 'error', message: 'Document Flow has no revision or active generation.', retryable: false };
}
```

When generation succeeds, do not navigate to `/feature-documents/:id`; retain
the current app-detail Flow route and set state from
`getFeatureDocument(documentId)`.

- [ ] **Step 5: Add active-step focus without stealing initial focus**

Give each text step:

```tsx
id={`document-flow-step-${step.number}`}
```

When `selectedStep` changes after initial render, call
`scrollIntoView({ block: 'nearest' })` on that row. Do not call `.focus()`;
keyboard focus remains on the tab or button the user activated.

- [ ] **Step 6: Rerun focused generation and mode tests**

Run:

```bash
tsx --test \
  src/vitrine/FlowModes.test.tsx \
  src/vitrine/FeatureDocumentGeneration.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Optional commit checkpoint**

Only with explicit user approval:

```bash
git add src/vitrine/components/DocumentFlowPanel.tsx src/vitrine/FlowModes.test.tsx src/vitrine/FeatureDocumentGeneration.test.tsx
git commit -m "feat: render synchronized Document Flows"
```

## Task 6: Restore the editable revision workspace inside Document Flow

**Files:**

- Modify: `src/vitrine/components/FeatureDocumentPage.tsx`
- Modify: `src/vitrine/components/DocumentFlowPanel.tsx`
- Modify: `src/vitrine/FeatureDocumentWorkspace.test.tsx`
- Modify: `src/vitrine/FeatureDocumentSharing.test.tsx`

- [ ] **Step 1: Write failing lifecycle workspace tests**

Extend `src/vitrine/FeatureDocumentWorkspace.test.tsx`:

```tsx
import type { DesignFlow, EvidenceView } from '../designSystem.ts';
import type { FeatureDocumentView } from '../featureDocument.ts';
import { DocumentFlowPanelView } from './components/DocumentFlowPanel.tsx';

const flow: DesignFlow<EvidenceView> = {
  id: 'checkout',
  title: 'Checkout',
  category: 'Payments',
  description: '',
  tags: [],
  steps: [{ label: 'Cart', evidence: [{ imageId: 42, imageUrl: '/42.png' }] }],
};

const document: FeatureDocumentView = {
  id: 12,
  title: 'Checkout',
  visibility: 'private',
  reviewStatus: 'draft',
  sourceChanged: false,
  currentRevision: revision,
  revisions: [revision],
  shares: [],
};

test('Document Flow exposes revision editing without replacing the narrative by default', () => {
  const reading = renderToStaticMarkup(
    <DocumentFlowPanelView
      flow={flow}
      state={{ kind: 'ready', document, revision }}
      userRole="admin"
      selectedStep={1}
      editing={false}
      onEdit={() => undefined}
      onOpenVisualStep={() => undefined}
    />,
  );
  assert.match(reading, /Overview/);
  assert.match(reading, />Edit Document Flow</);
  assert.doesNotMatch(reading, /Revision history/);

  const editing = renderToStaticMarkup(
    <DocumentFlowPanelView
      flow={flow}
      state={{ kind: 'ready', document, revision }}
      userRole="admin"
      selectedStep={1}
      editing
      onEdit={() => undefined}
      onOpenVisualStep={() => undefined}
    />,
  );
  assert.match(editing, /Revision history/);
  assert.match(editing, /Evidence inspector/);
  assert.match(editing, /Save new revision/);
});
```

- [ ] **Step 2: Run the workspace test and verify it fails**

Run:

```bash
tsx --test src/vitrine/FeatureDocumentWorkspace.test.tsx
```

Expected: FAIL because the current page is Markdown-only and no reusable
editing workspace exists.

- [ ] **Step 3: Extract a reusable lifecycle workspace**

In `FeatureDocumentPage.tsx`, export:

```typescript
export interface FeatureDocumentWorkspaceProps {
  initialDocument: FeatureDocumentView;
  onDocumentChange?(document: FeatureDocumentView): void;
  embedded?: boolean;
}
```

Rebuild `FeatureDocumentWorkspace` from the existing APIs and components:

- `FeatureDocumentRevisionHistory`;
- `FeatureDocumentEditor`;
- `FeatureDocumentEvidencePanel`;
- optimistic `saveFeatureDocumentRevision`;
- `restoreFeatureDocumentRevision`;
- `regenerateFeatureDocument`;
- `setFeatureDocumentReviewStatus`;
- `acknowledgeFeatureDocumentSourceChange`;
- Markdown download;
- create/revoke share;
- cancel/retry/reconnect progress;
- unsaved-change guard.

The top-level render contract is:

```tsx
export function FeatureDocumentWorkspace({
  initialDocument,
  onDocumentChange,
  embedded = false,
}: FeatureDocumentWorkspaceProps) {
  return (
    <section
      className={`feature-document-workspace-shell${embedded ? ' is-embedded' : ''}`}
      aria-label="Document Flow editor"
    >
      {headerAndActions}
      {warningsAndProgress}
      <div className="feature-document-workspace">
        {revisionHistory}
        {editor}
        {evidencePanel}
      </div>
    </section>
  );
}
```

Do not use the Markdown export response as the editable source; structured
`FeatureDocumentContent` remains canonical.

- [ ] **Step 4: Embed editing inside Document Flow**

In `DocumentFlowPanel`, keep `editing` local state. The default ready state
shows the approved narrative. Authorized users see `Edit Document Flow`; when
activated, render:

```tsx
<FeatureDocumentWorkspace
  initialDocument={state.document}
  embedded
  onDocumentChange={(document) => {
    setState(classifyDocumentFlow(document));
  }}
/>
```

Provide `Back to Document Flow` to leave editing without changing Flow,
selected step, or route.

- [ ] **Step 5: Keep the authenticated direct page as a compatibility wrapper**

`FeatureDocumentPage` loads by document ID and renders:

```tsx
<FeatureDocumentWorkspace initialDocument={document} />
```

If the document has no revision, render `FeatureDocumentPendingState` and
subscribe to its current job rather than throwing. Do not restore a separate
document library.

- [ ] **Step 6: Rerun workspace and sharing tests**

Run:

```bash
tsx --test \
  src/vitrine/FeatureDocumentWorkspace.test.tsx \
  src/vitrine/FeatureDocumentSharing.test.tsx \
  src/vitrine/FeatureDocumentGeneration.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Optional commit checkpoint**

Only with explicit user approval:

```bash
git add src/vitrine/components/FeatureDocumentPage.tsx src/vitrine/components/DocumentFlowPanel.tsx src/vitrine/FeatureDocumentWorkspace.test.tsx src/vitrine/FeatureDocumentSharing.test.tsx
git commit -m "feat: embed Document Flow revision workspace"
```

## Task 7: Complete responsive styling and accessibility

**Files:**

- Modify: `src/vitrine/styles.css`
- Modify: `src/vitrine/FlowModes.test.tsx`
- Modify: `src/vitrine/FlowTreeNavigation.test.tsx`

- [ ] **Step 1: Add failing structural and accessibility assertions**

Add assertions covering:

```tsx
assert.match(html, /role="tablist"/);
assert.match(html, /role="tabpanel"/);
assert.match(html, /aria-controls="flow-checkout-document-panel"/);
assert.match(html, /aria-label="Checkout Visual Flow"/);
assert.match(html, /aria-label="Document Flow"/);
assert.match(html, /class="document-flow__claim-kind is-observed"/);
```

Retain the existing source-level responsive assertion and add:

```typescript
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
assert.match(styles, /@media \\(max-width: 760px\\)[\\s\\S]*selected-flow-workspace/);
assert.match(styles, /\\.selected-flow-workspace__tabs button:focus-visible/);
```

- [ ] **Step 2: Run focused UI tests and verify the new style assertions fail**

Run:

```bash
tsx --test \
  src/vitrine/FlowModes.test.tsx \
  src/vitrine/FlowTreeNavigation.test.tsx
```

Expected: FAIL until the new selectors and responsive behavior exist.

- [ ] **Step 3: Add scoped styles**

Add focused selectors to `src/vitrine/styles.css`:

```css
.selected-flow-workspace {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.selected-flow-workspace__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.selected-flow-workspace__tabs {
  display: inline-flex;
  width: fit-content;
  padding: 3px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-background-muted);
}

.selected-flow-workspace__tabs button {
  min-height: 36px;
  padding: 0 14px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--color-text-secondary);
  font: inherit;
  font-weight: 650;
}

.selected-flow-workspace__tabs button[aria-selected="true"] {
  background: var(--color-background-surface);
  color: var(--color-text-primary);
}

.selected-flow-workspace__tabs button:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

.document-flow {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.document-flow__step {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  padding: 16px 0;
  border-top: 1px solid var(--color-border);
}

.document-flow__step[aria-current="step"] {
  border-left: 3px solid var(--color-accent);
  padding-left: 13px;
}

.document-flow__claim-kind {
  margin-left: 8px;
  color: var(--color-text-secondary);
  font-size: 11px;
  text-transform: capitalize;
}

@media (max-width: 760px) {
  .selected-flow-workspace__header {
    align-items: stretch;
    flex-direction: column;
  }

  .selected-flow-workspace__tabs {
    width: 100%;
  }

  .selected-flow-workspace__tabs button {
    flex: 1;
  }

  .document-flow__step {
    grid-template-columns: 1fr;
  }
}
```

Reuse existing Flow-viewer image-stage declarations by renaming them to
Visual-Flow selectors; do not duplicate the large stage rules.

- [ ] **Step 4: Rerun UI tests and build**

Run:

```bash
tsx --test \
  src/vitrine/FlowModes.test.tsx \
  src/vitrine/FlowTreeNavigation.test.tsx \
  src/vitrine/components/FlowsPanel.test.tsx
npm run build
```

Expected: all focused tests PASS and Vite build exits 0. The existing
large-chunk warning is acceptable; new TypeScript or CSS errors are not.

- [ ] **Step 5: Optional commit checkpoint**

Only with explicit user approval:

```bash
git add src/vitrine/styles.css src/vitrine/FlowModes.test.tsx src/vitrine/FlowTreeNavigation.test.tsx
git commit -m "style: finish Flow mode workspace"
```

## Task 8: Run regression verification and inspect the integrated UI

**Files:**

- Verify only unless a failing test reveals a scoped defect.

- [ ] **Step 1: Run all Feature Document tests**

Run:

```bash
node --experimental-strip-types --test \
  src/featureDocument.test.ts \
  src/featureDocumentProvider.test.ts \
  src/featureDocumentService.test.ts \
  src/featureDocumentSourceLookup.test.ts \
  services/api/src/featureDocuments.test.ts
tsx --test \
  src/vitrine/FeatureDocumentGeneration.test.tsx \
  src/vitrine/FeatureDocumentSharing.test.tsx \
  src/vitrine/FeatureDocumentWorkspace.test.tsx \
  src/vitrine/FlowModes.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run all Flow and routing tests**

Run:

```bash
node --experimental-strip-types --test \
  src/vitrine/router.test.ts \
  src/vitrine/routerNavigation.test.ts \
  src/vitrine/routeDecision.test.ts
tsx --test \
  src/vitrine/FlowTreeNavigation.test.tsx \
  src/vitrine/components/FlowsPanel.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run the full repository test suite**

Run:

```bash
npm test
```

Expected: exit 0 with all backend/API/worker and Vitrine tests passing.

- [ ] **Step 4: Run production builds**

Run:

```bash
npm run build
npm run build-storybook
git diff --check
```

Expected: both builds exit 0 and `git diff --check` reports no whitespace
errors. Existing bundle-size warnings may remain unchanged.

- [ ] **Step 5: Perform browser acceptance on exact states**

Run the app locally and inspect one real Flow with a Document Flow:

```bash
npm run dev
```

Verify:

1. the left Flow directory remains visible after selecting a Flow;
2. old Flow URLs open Visual Flow;
3. `flowView=document` opens Document Flow directly;
4. switching modes preserves the selected step;
5. `View visual step` opens the exact screenshot;
6. Document Flow loads only after selecting its tab;
7. a pending document shows progress before revision creation;
8. missing, failed, stale, normal-user, admin, and narrow-screen states;
9. revision edit, review, export, share, and return-to-narrative behavior;
10. public share URLs remain read-only.

- [ ] **Step 6: Review the final diff against scope**

Run:

```bash
git diff --stat
git status --short
```

Confirm:

- no top-level Documents library was added;
- no parent/child Flow schema was added;
- no Flow IDs, categories, ordering, or evidence were mutated;
- unrelated dirty files remain unchanged;
- Visual Flow and Document Flow are user-facing labels;
- Feature Document remains only an internal lifecycle term where necessary.

- [ ] **Step 7: Optional final commit**

Only if the user explicitly requests a commit:

```bash
git add \
  src/featureDocument.ts \
  src/featureDocumentStore.ts \
  src/featureDocumentSourceLookup.test.ts \
  services/api/src/featureDocuments.ts \
  services/api/src/featureDocuments.test.ts \
  src/vitrine/router.ts \
  src/vitrine/router.test.ts \
  src/vitrine/App.tsx \
  src/vitrine/components/ScreenDetail.tsx \
  src/vitrine/components/FlowsPanel.tsx \
  src/vitrine/components/FlowsWorkspace.tsx \
  src/vitrine/components/SelectedFlowWorkspace.tsx \
  src/vitrine/components/VisualFlowPanel.tsx \
  src/vitrine/components/DocumentFlowPanel.tsx \
  src/vitrine/components/FeatureDocumentPage.tsx \
  src/vitrine/featureDocumentsApi.ts \
  src/vitrine/featureDocumentsApi.test.ts \
  src/vitrine/documentFlowModel.ts \
  src/vitrine/documentFlowModel.test.ts \
  src/vitrine/FlowModes.test.tsx \
  src/vitrine/FlowTreeNavigation.test.tsx \
  src/vitrine/components/FlowsPanel.test.tsx \
  src/vitrine/FeatureDocumentGeneration.test.tsx \
  src/vitrine/FeatureDocumentSharing.test.tsx \
  src/vitrine/FeatureDocumentWorkspace.test.tsx \
  src/vitrine/styles.css \
  docs/superpowers/specs/2026-07-26-visual-document-flow-modes-design.md \
  docs/superpowers/plans/2026-07-26-visual-document-flow-modes-implementation.md
git commit -m "feat: add Visual and Document Flow modes"
```

Do not use `git add .`; the worktree contains unrelated changes.
