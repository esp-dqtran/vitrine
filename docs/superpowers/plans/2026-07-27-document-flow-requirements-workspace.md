# Document Flow Requirements Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the in-app Markdown reader with a structured requirements-first workspace while preserving Markdown export, stored revisions, and Visual Flow navigation.

**Architecture:** Extend the existing pure `documentFlowModel.ts` seam into a presentation model derived from `FeatureDocumentRevisionView` and the selected Flow. Render that model through focused React components, keep `DocumentFlowPanel` responsible for loading and generation states, and convert zero-based evidence manifest indexes to the existing one-based `onOpenVisualStep(stepNumber)` contract.

**Tech Stack:** TypeScript, React 19, `@astryxdesign/core`, Node test runner, server-rendered React tests, Vite, Chrome CDP.

---

## Repository constraints

- Work directly on `main`; do not create a branch or worktree.
- Preserve unrelated dirty-worktree changes.
- Do not commit or push unless the user separately requests it. The checkpoints below replace the writing workflow's normal commit steps.
- Do not change the Feature Document schema, generation prompt, stored Binance revisions, or Markdown export endpoint.

## File structure

- Modify `src/vitrine/documentFlowModel.ts`
  - Owns pure derivation of summary counts, requirement cards, scenario rows, evidence links, observed journey, and deduplicated missing evidence.
- Modify `src/vitrine/documentFlowModel.test.ts`
  - Verifies the presentation model independently of React.
- Create `src/vitrine/components/DocumentFlowReadyView.tsx`
  - Owns the structured ready-state UI only.
- Modify `src/vitrine/components/DocumentFlowPanel.tsx`
  - Keeps loading, missing, generation, retry, and setup behavior; removes the in-app Markdown fetch and mounts the ready view.
- Modify `src/vitrine/components/VisualFlowPanel.tsx`
  - Focuses the selected visual screen after evidence navigation.
- Modify `src/vitrine/FlowModes.test.tsx`
  - Verifies default requirement rendering, alternate sections, accessible evidence controls, and preserved technical details.
- Modify `src/vitrine/styles.css`
  - Styles the single-column summary, inner navigation, requirement cards, BDD rows, evidence chips, journey, missing-evidence state, and responsive layout.

### Task 1: Build the requirements presentation model

**Files:**
- Modify: `src/vitrine/documentFlowModel.ts`
- Test: `src/vitrine/documentFlowModel.test.ts`

- [ ] **Step 1: Expand the test fixture with requirements, scenarios, and duplicate missing evidence**

Add these fields to the existing `revision.content` fixture:

```ts
requirements: [
  {
    id: 'REQ-01',
    kind: 'observed',
    text: 'The checkout must support card payment.',
    evidenceIds: ['E-42', 'E-missing'],
    userStory: 'As a buyer, I want to pay by card.',
    priority: 'must',
    preconditions: ['The cart contains an item.'],
    acceptanceCriteria: [
      {
        id: 'AC-01',
        given: 'The buyer has reviewed the cart',
        when: 'the buyer submits a valid card',
        then: 'the payment is accepted',
        evidenceIds: ['E-43'],
      },
    ],
  },
],
openQuestions: [
  { id: 'question', kind: 'unknown', text: ' Declined   card state ', evidenceIds: [] },
],
```

Replace the old narrative-only test with imports for `buildDocumentFlowPresentation` and assertions covering:

```ts
test('builds requirements-first presentation data from a revision and Flow', () => {
  const model = buildDocumentFlowPresentation(flow, revision);

  assert.deepEqual(model.summary, {
    goal: 'Buy items',
    entryPoint: 'Open cart',
    completionPoint: 'Order confirmation',
    reviewStatus: 'draft',
    stepCount: 2,
    requirementCount: 1,
    scenarioCount: 1,
    supportedRequirementCount: 1,
    missingEvidenceCount: 1,
  });
  assert.equal(model.requirements[0].text, 'The checkout must support card payment.');
  assert.equal(model.requirements[0].scenarios[0].given, 'The buyer has reviewed the cart');
  assert.deepEqual(
    model.requirements[0].evidence.map(({ evidenceId, stepNumber }) => ({ evidenceId, stepNumber })),
    [
      { evidenceId: 'E-42', stepNumber: 1 },
      { evidenceId: 'E-43', stepNumber: 2 },
      { evidenceId: 'E-missing', stepNumber: undefined },
    ],
  );
  assert.equal(model.journey.length, 2);
  assert.deepEqual(model.missingEvidence.map(({ text }) => text), ['Declined card state']);
});
```

- [ ] **Step 2: Run the model test and verify the new API is missing**

Run:

```bash
node --import tsx --test src/vitrine/documentFlowModel.test.ts
```

Expected: FAIL because `buildDocumentFlowPresentation` is not exported.

- [ ] **Step 3: Replace the unused narrative model with the presentation model**

Implement these public types and pure builder in `src/vitrine/documentFlowModel.ts`:

```ts
import type { DesignFlow, EvidenceView } from '../designSystem.ts';
import type {
  FeatureClaim,
  FeatureClaimKind,
  FeatureDocumentRevisionView,
} from '../featureDocument.ts';

export interface DocumentFlowEvidenceLink {
  evidenceId: string;
  label: string;
  stepNumber?: number;
}

export interface DocumentFlowScenario {
  id: string;
  given: string;
  when: string;
  then: string;
}

export interface DocumentFlowRequirementCard {
  id: string;
  priority: 'must' | 'should' | 'could' | 'later';
  kind: FeatureClaimKind;
  text: string;
  evidence: DocumentFlowEvidenceLink[];
  scenarios: DocumentFlowScenario[];
}

export interface DocumentFlowJourneyItem {
  number: number;
  label: string;
  text: string;
  kind: FeatureClaimKind;
  evidence: DocumentFlowEvidenceLink[];
}

export interface DocumentFlowPresentation {
  summary: {
    goal: string;
    entryPoint: string;
    completionPoint: string;
    reviewStatus: FeatureDocumentRevisionView['reviewStatus'];
    stepCount: number;
    requirementCount: number;
    scenarioCount: number;
    supportedRequirementCount: number;
    missingEvidenceCount: number;
  };
  requirements: DocumentFlowRequirementCard[];
  journey: DocumentFlowJourneyItem[];
  missingEvidence: FeatureClaim[];
}

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function evidenceLinks(
  evidenceIds: string[],
  revision: FeatureDocumentRevisionView,
): DocumentFlowEvidenceLink[] {
  const wanted = unique(evidenceIds);
  const resolved = revision.evidenceManifest
    .filter(({ evidenceId }) => wanted.includes(evidenceId))
    .map((item) => ({
      evidenceId: item.evidenceId,
      label: item.evidenceId,
      stepNumber: item.stepIndex + 1,
    }));
  const resolvedIds = new Set(resolved.map(({ evidenceId }) => evidenceId));
  return [
    ...resolved,
    ...wanted
      .filter((evidenceId) => !resolvedIds.has(evidenceId))
      .map((evidenceId) => ({ evidenceId, label: evidenceId })),
  ];
}

function deduplicateClaims(claims: FeatureClaim[]): FeatureClaim[] {
  const seen = new Set<string>();
  return claims.flatMap((claim) => {
    const text = claim.text.trim().replace(/\s+/g, ' ');
    const key = normalize(text);
    if (!key || seen.has(key)) return [];
    seen.add(key);
    return [{ ...claim, text }];
  });
}

export function buildDocumentFlowPresentation(
  flow: DesignFlow<EvidenceView>,
  revision: FeatureDocumentRevisionView,
): DocumentFlowPresentation {
  const { content } = revision;
  const requirements = content.requirements.map((requirement) => ({
    id: requirement.id,
    priority: requirement.priority,
    kind: requirement.kind,
    text: requirement.text,
    evidence: evidenceLinks([
      ...requirement.evidenceIds,
      ...requirement.acceptanceCriteria.flatMap(({ evidenceIds }) => evidenceIds),
    ], revision),
    scenarios: requirement.acceptanceCriteria.map(({ id, given, when, then }) => ({
      id,
      given,
      when,
      then,
    })),
  }));
  const journey = flow.steps.map((step, stepIndex) => {
    const stepEvidenceIds = revision.evidenceManifest
      .filter((item) => item.stepIndex === stepIndex)
      .map(({ evidenceId }) => evidenceId);
    const claim = content.observedFlow.journey.find((item) =>
      item.evidenceIds.some((evidenceId) => stepEvidenceIds.includes(evidenceId)));
    return {
      number: stepIndex + 1,
      label: step.label,
      text: claim?.text
        ?? step.analysis?.interaction
        ?? step.interaction
        ?? 'No documented description.',
      kind: claim?.kind ?? (step.analysis || step.interaction ? 'observed' : 'unknown'),
      evidence: evidenceLinks(
        claim?.evidenceIds.length ? claim.evidenceIds : stepEvidenceIds,
        revision,
      ),
    };
  });
  const missingEvidence = deduplicateClaims([
    ...content.flowAnalysis.missingStates,
    ...content.openQuestions,
  ]);
  return {
    summary: {
      goal: content.observedFlow.userGoal.text,
      entryPoint: content.observedFlow.entryPoint.text,
      completionPoint: content.observedFlow.completionPoint.text,
      reviewStatus: revision.reviewStatus,
      stepCount: journey.length,
      requirementCount: requirements.length,
      scenarioCount: requirements.reduce(
        (total, requirement) => total + requirement.scenarios.length,
        0,
      ),
      supportedRequirementCount: requirements.filter(
        ({ evidence }) => evidence.length > 0,
      ).length,
      missingEvidenceCount: missingEvidence.length,
    },
    requirements,
    journey,
    missingEvidence,
  };
}
```

- [ ] **Step 4: Run the model test and verify it passes**

Run:

```bash
node --import tsx --test src/vitrine/documentFlowModel.test.ts
```

Expected: 1 test passes.

- [ ] **Step 5: Review checkpoint**

Inspect only the two files changed in this task:

```bash
git diff -- src/vitrine/documentFlowModel.ts src/vitrine/documentFlowModel.test.ts
```

Expected: presentation derivation is pure; no React, API, schema, or provider changes.

### Task 2: Add the structured ready-state renderer

**Files:**
- Create: `src/vitrine/components/DocumentFlowReadyView.tsx`
- Modify: `src/vitrine/FlowModes.test.tsx`

- [ ] **Step 1: Update the React fixture to contain one requirement and one scenario**

In `src/vitrine/FlowModes.test.tsx`, replace the empty `requirements` fixture with:

```ts
requirements: [
  {
    id: 'REQ-01',
    kind: 'observed',
    text: 'The checkout must support card payment.',
    evidenceIds: ['E-42', 'E-43'],
    userStory: 'As a buyer, I want to pay by card.',
    priority: 'must',
    preconditions: ['The cart contains an item.'],
    acceptanceCriteria: [
      {
        id: 'AC-01',
        given: 'The buyer has reviewed the cart',
        when: 'the buyer submits a valid card',
        then: 'the payment is accepted',
        evidenceIds: ['E-43'],
      },
    ],
  },
],
openQuestions: [
  { id: 'question', kind: 'unknown', text: 'How is a declined card recovered?', evidenceIds: [] },
],
```

Import `buildDocumentFlowPresentation` and `DocumentFlowReadyView`. Replace the Markdown-rendering test with:

```tsx
test('renders requirements first with summary, BDD, evidence, and accessible sections', () => {
  const model = buildDocumentFlowPresentation(flow, revision);
  const html = renderToStaticMarkup(
    <DocumentFlowReadyView
      presentation={model}
      revision={revision}
      activeSection="requirements"
      onSectionChange={() => {}}
      onOpenVisualStep={() => {}}
    />,
  );

  assert.match(html, /<dt>Observed steps<\/dt><dd>2<\/dd>/);
  assert.match(html, /<dt>Requirements<\/dt><dd>1<\/dd>/);
  assert.match(html, /<dt>Scenarios<\/dt><dd>1<\/dd>/);
  assert.match(html, /<dt>Evidence<\/dt><dd>1\/1 supported<\/dd>/);
  assert.match(html, /REQ-01/);
  assert.match(html, /The checkout must support card payment/);
  assert.match(html, /Observed/);
  assert.match(html, /GIVEN/);
  assert.match(html, /The buyer has reviewed the cart/);
  assert.match(html, /WHEN/);
  assert.match(html, /THEN/);
  assert.match(html, /Open evidence E-42 in Visual Flow/);
  assert.match(html, /role="tablist"/);
  assert.match(html, /aria-selected="true"/);
  assert.match(html, /<details class="document-flow__details">/);
  assert.doesNotMatch(html, /<details[^>]* open/);
  assert.doesNotMatch(html, /document-flow__markdown/);
});
```

Add controlled-section coverage:

```tsx
test('renders observed journey and missing evidence as selectable sections', () => {
  const model = buildDocumentFlowPresentation(flow, revision);
  const journey = renderToStaticMarkup(
    <DocumentFlowReadyView
      presentation={model}
      revision={revision}
      activeSection="journey"
      onSectionChange={() => {}}
      onOpenVisualStep={() => {}}
    />,
  );
  const missing = renderToStaticMarkup(
    <DocumentFlowReadyView
      presentation={model}
      revision={revision}
      activeSection="missing"
      onSectionChange={() => {}}
      onOpenVisualStep={() => {}}
    />,
  );

  assert.match(journey, /Review cart/);
  assert.match(journey, /Review the cart/);
  assert.match(missing, /How is a declined card recovered/);
});
```

- [ ] **Step 2: Run the component test and verify the new renderer is missing**

Run:

```bash
npx tsx --test src/vitrine/FlowModes.test.tsx
```

Expected: FAIL because `DocumentFlowReadyView.tsx` does not exist.

- [ ] **Step 3: Create the controlled ready-state view**

Create `src/vitrine/components/DocumentFlowReadyView.tsx` with these exports and rendering rules:

```tsx
import type { FeatureClaimKind, FeatureDocumentRevisionView } from '../../featureDocument.ts';
import type {
  DocumentFlowEvidenceLink,
  DocumentFlowPresentation,
} from '../documentFlowModel.ts';

export type DocumentFlowSection = 'requirements' | 'journey' | 'missing';

export interface DocumentFlowReadyViewProps {
  presentation: DocumentFlowPresentation;
  revision: FeatureDocumentRevisionView;
  activeSection: DocumentFlowSection;
  onSectionChange(section: DocumentFlowSection): void;
  onOpenVisualStep(stepNumber: number): void;
}

const statusLabel: Record<FeatureClaimKind, string> = {
  observed: 'Observed',
  inferred: 'Inferred',
  proposed: 'Proposed',
  unknown: 'Missing',
};

function EvidenceChip({
  evidence,
  onOpenVisualStep,
}: {
  evidence: DocumentFlowEvidenceLink;
  onOpenVisualStep(stepNumber: number): void;
}) {
  return evidence.stepNumber === undefined
    ? <span className="document-flow__evidence-chip is-unresolved">{evidence.label}</span>
    : (
        <button
          type="button"
          className="document-flow__evidence-chip"
          aria-label={`Open evidence ${evidence.label} in Visual Flow`}
          onClick={() => onOpenVisualStep(evidence.stepNumber!)}
        >
          {evidence.label}
        </button>
      );
}

function EvidenceList({
  evidence,
  onOpenVisualStep,
}: {
  evidence: DocumentFlowEvidenceLink[];
  onOpenVisualStep(stepNumber: number): void;
}) {
  if (evidence.length === 0) return <span className="document-flow__no-evidence">No evidence</span>;
  return (
    <div className="document-flow__evidence-list" aria-label="Evidence">
      {evidence.map((item) => (
        <EvidenceChip
          key={item.evidenceId}
          evidence={item}
          onOpenVisualStep={onOpenVisualStep}
        />
      ))}
    </div>
  );
}

function TechnicalClaimList({ title, claims }: {
  title: string;
  claims: FeatureDocumentRevisionView['content']['edgeCases'];
}) {
  if (claims.length === 0) return null;
  return (
    <section className="document-flow__detail-group">
      <h3>{title}</h3>
      <ul>{claims.map((claim) => <li key={claim.id}>{claim.text}</li>)}</ul>
    </section>
  );
}

function TechnicalDetails({ revision }: { revision: FeatureDocumentRevisionView }) {
  const { content, evidenceManifest } = revision;
  return (
    <details className="document-flow__details">
      <summary>Technical details</summary>
      <div className="document-flow__details-content">
        <TechnicalClaimList title="Risks and assumptions" claims={content.flowAnalysis.risksAndAssumptions} />
        <TechnicalClaimList title="Edge cases" claims={content.edgeCases} />
        <TechnicalClaimList
          title="Metrics and analytics"
          claims={[...content.successMetrics, ...content.guardrailMetrics, ...content.analyticsEvents]}
        />
        <TechnicalClaimList title="Dependencies" claims={content.dependencies} />
        <section className="document-flow__detail-group">
          <h3>Generation</h3>
          <p>Revision {revision.revisionNumber} · Prompt {revision.promptVersion} · {revision.providerModel}</p>
        </section>
        <section className="document-flow__detail-group">
          <h3>Evidence sources</h3>
          {evidenceManifest.length > 0
            ? (
                <ul>
                  {evidenceManifest.map((item) => (
                    <li key={item.evidenceId}>
                      <strong>{item.evidenceId}</strong>{`: Step ${item.stepIndex + 1} — ${item.stepLabel}`}
                    </li>
                  ))}
                </ul>
              )
            : <p>No evidence sources recorded.</p>}
        </section>
      </div>
    </details>
  );
}

export function DocumentFlowReadyView({
  presentation,
  revision,
  activeSection,
  onSectionChange,
  onOpenVisualStep,
}: DocumentFlowReadyViewProps) {
  const { summary } = presentation;
  const sections: Array<{ id: DocumentFlowSection; label: string }> = [
    { id: 'requirements', label: 'Requirements' },
    { id: 'journey', label: 'Observed journey' },
    { id: 'missing', label: `Missing evidence (${summary.missingEvidenceCount})` },
  ];
  return (
    <section className="document-flow document-flow--ready" aria-label="Document Flow">
      <header className="document-flow__summary">
        <div>
          <p className="document-flow__eyebrow">{summary.reviewStatus}</p>
          <h3>{summary.goal}</h3>
          <p><strong>Starts:</strong> {summary.entryPoint}</p>
          <p><strong>Ends:</strong> {summary.completionPoint}</p>
        </div>
        <dl className="document-flow__counts">
          <div><dt>Observed steps</dt><dd>{summary.stepCount}</dd></div>
          <div><dt>Requirements</dt><dd>{summary.requirementCount}</dd></div>
          <div><dt>Scenarios</dt><dd>{summary.scenarioCount}</dd></div>
          <div><dt>Evidence</dt><dd>{summary.supportedRequirementCount}/{summary.requirementCount} supported</dd></div>
        </dl>
      </header>

      <div role="tablist" aria-label="Document Flow sections" className="document-flow__nav">
        {sections.map((section) => (
          <button
            key={section.id}
            id={`document-flow-${section.id}-tab`}
            type="button"
            role="tab"
            aria-selected={activeSection === section.id}
            aria-controls={`document-flow-${section.id}-panel`}
            onClick={() => onSectionChange(section.id)}
          >
            {section.label}
          </button>
        ))}
      </div>

      <div
        id={`document-flow-${activeSection}-panel`}
        role="tabpanel"
        aria-labelledby={`document-flow-${activeSection}-tab`}
        className="document-flow__content"
      >
        {activeSection === 'requirements' && (
          <div className="document-flow__requirements">
            {presentation.requirements.map((requirement) => (
              <article
                key={requirement.id}
                className="document-flow__requirement"
                aria-labelledby={`document-requirement-${requirement.id}`}
              >
                <header>
                  <div>
                    <p className="document-flow__requirement-meta">
                      {requirement.id} · {requirement.priority.toUpperCase()}
                    </p>
                    <h4 id={`document-requirement-${requirement.id}`}>{requirement.text}</h4>
                  </div>
                  <span className={`document-flow__status is-${requirement.kind}`}>
                    {statusLabel[requirement.kind]}
                  </span>
                </header>
                <EvidenceList evidence={requirement.evidence} onOpenVisualStep={onOpenVisualStep} />
                <div className="document-flow__scenarios">
                  {requirement.scenarios.map((scenario) => (
                    <section key={scenario.id} className="document-flow__scenario">
                      <h5>Scenario: {scenario.id}</h5>
                      <dl>
                        <div><dt>GIVEN</dt><dd>{scenario.given}</dd></div>
                        <div><dt>WHEN</dt><dd>{scenario.when}</dd></div>
                        <div><dt>THEN</dt><dd>{scenario.then}</dd></div>
                      </dl>
                    </section>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}

        {activeSection === 'journey' && (
          <ol className="document-flow__journey">
            {presentation.journey.map((step) => (
              <li key={step.number}>
                <div>
                  <p className="document-flow__requirement-meta">Step {step.number}</p>
                  <h4>{step.label}</h4>
                  <p>{step.text}</p>
                </div>
                <EvidenceList evidence={step.evidence} onOpenVisualStep={onOpenVisualStep} />
              </li>
            ))}
          </ol>
        )}

        {activeSection === 'missing' && (
          presentation.missingEvidence.length > 0
            ? (
                <ul className="document-flow__missing-list">
                  {presentation.missingEvidence.map((claim) => <li key={claim.id}>{claim.text}</li>)}
                </ul>
              )
            : <p>No missing evidence identified in this revision.</p>
        )}
      </div>

      <TechnicalDetails revision={revision} />
    </section>
  );
}
```

- [ ] **Step 4: Run the focused component test and verify it passes**

Run:

```bash
npx tsx --test src/vitrine/FlowModes.test.tsx
```

Expected: all Flow mode tests pass.

- [ ] **Step 5: Review checkpoint**

Run:

```bash
git diff --check -- src/vitrine/components/DocumentFlowReadyView.tsx src/vitrine/FlowModes.test.tsx
```

Expected: no whitespace errors.

### Task 3: Wire the structured view and remove the Markdown dependency

**Files:**
- Modify: `src/vitrine/components/DocumentFlowPanel.tsx`
- Modify: `src/vitrine/components/VisualFlowPanel.tsx`
- Modify: `src/vitrine/FlowModes.test.tsx`

- [ ] **Step 1: Add a regression assertion that ready content does not require Markdown**

Render `DocumentFlowPanelView` without a `markdown` prop:

```tsx
test('ready Document Flow renders structured content without Markdown', () => {
  const html = renderToStaticMarkup(
    <DocumentFlowPanelView
      flow={flow}
      state={{ kind: 'ready', document: featureDocument, revision }}
      userRole="user"
      onOpenVisualStep={() => {}}
    />,
  );
  assert.match(html, /The checkout must support card payment/);
  assert.doesNotMatch(html, /Loading Document Flow Markdown/);
  assert.doesNotMatch(html, /Retry Markdown/);
});
```

- [ ] **Step 2: Run the regression test and verify the existing loading fallback appears**

Run:

```bash
npx tsx --test src/vitrine/FlowModes.test.tsx
```

Expected: FAIL because the current component defaults `markdown` to loading.

- [ ] **Step 3: Simplify `DocumentFlowPanelView` props and ready rendering**

In `src/vitrine/components/DocumentFlowPanel.tsx`:

- Remove imports of `react-markdown`, `remark-gfm`, and `getFeatureDocumentMarkdown`.
- Import `buildDocumentFlowPresentation`, `DocumentFlowReadyView`, and `DocumentFlowSection`.
- Delete `DocumentFlowMarkdownState`.
- Remove `markdown` and `onMarkdownRetry` handling.
- Add `flow` and `onOpenVisualStep` to `DocumentFlowPanelViewProps`.
- Add section state immediately after props destructuring, before any loading, missing, error, or pending early return, so the hook order remains stable when `state.kind` changes:

```tsx
const [activeSection, setActiveSection] = useState<DocumentFlowSection>('requirements');
```

Replace the ready branch with:

```tsx
return (
  <DocumentFlowReadyView
    presentation={buildDocumentFlowPresentation(flow, state.revision)}
    revision={state.revision}
    activeSection={activeSection}
    onSectionChange={setActiveSection}
    onOpenVisualStep={onOpenVisualStep}
  />
);
```

Delete the old `TechnicalClaimList`, `DocumentFlowTechnicalDetails`, Markdown loading branch, Markdown error branch, and Markdown `<article>`.

- [ ] **Step 4: Remove Markdown state and effects from `DocumentFlowPanel`**

Delete:

```ts
const [markdown, setMarkdown] = useState<DocumentFlowMarkdownState>({ kind: 'loading' });
const [markdownReloadVersion, setMarkdownReloadVersion] = useState(0);
```

Delete `readyDocumentId`, `readyRevisionId`, and the `getFeatureDocumentMarkdown` effect.

Pass the structured props:

```tsx
<DocumentFlowPanelView
  flow={flow}
  state={state}
  userRole={props.userRole}
  connectionError={connectionError}
  onGenerate={() => setSetupOpen(true)}
  onCancel={() => void cancel()}
  onRetry={() => void retry()}
  onReconnect={() => setSubscriptionVersion((current) => current + 1)}
  onOpenVisualStep={props.onOpenVisualStep}
/>
```

- [ ] **Step 5: Focus the selected Visual Flow screen after cross-view navigation**

Replace the selected-step effect in `src/vitrine/components/VisualFlowPanel.tsx` with:

```tsx
useEffect(() => {
  if (selectedStep === undefined) return;
  const selectedCard = trackRef.current
    ?.querySelector<HTMLElement>(`[data-flow-step="${selectedStep}"]`);
  selectedCard?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  selectedCard?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
}, [screenItems.length, selectedStep]);
```

The presentation model passes `stepIndex + 1`, matching `data-flow-step` and the existing one-based selected-step route contract.

- [ ] **Step 6: Run the focused model and component tests**

Run:

```bash
node --import tsx --test src/vitrine/documentFlowModel.test.ts
npx tsx --test src/vitrine/FlowModes.test.tsx
```

Expected: both commands pass.

- [ ] **Step 7: Review checkpoint**

Run:

```bash
rg -n "react-markdown|remark-gfm|getFeatureDocumentMarkdown|DocumentFlowMarkdownState|Retry Markdown" src/vitrine/components/DocumentFlowPanel.tsx src/vitrine/FlowModes.test.tsx
```

Expected: no matches. Do not remove `getFeatureDocumentMarkdown` from `featureDocumentsApi.ts`; Markdown remains an export/API format.

### Task 4: Style the requirements workspace and responsive BDD rows

**Files:**
- Modify: `src/vitrine/styles.css`
- Test: `src/vitrine/FlowModes.test.tsx`

- [ ] **Step 1: Assert the new semantic class boundaries**

Add these assertions to the requirements-rendering test:

```ts
for (const className of [
  'document-flow__summary',
  'document-flow__counts',
  'document-flow__nav',
  'document-flow__requirement',
  'document-flow__scenario',
  'document-flow__evidence-chip',
]) {
  assert.match(html, new RegExp(className));
}
```

- [ ] **Step 2: Run the component test**

Run:

```bash
npx tsx --test src/vitrine/FlowModes.test.tsx
```

Expected: PASS because Task 2 introduced the semantic class names.

- [ ] **Step 3: Replace obsolete Markdown styles with workspace styles**

Remove `.document-flow__markdown` rules. Keep and reuse `.document-flow__details` rules. Add:

```css
.document-flow {
  width: min(100%, 920px);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: var(--color-text-primary);
}

.document-flow__summary,
.document-flow__content {
  padding: clamp(20px, 3vw, 32px);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-container);
  background: var(--color-background-surface);
}

.document-flow__summary {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 0.7fr);
  gap: 28px;
}

.document-flow__summary h3,
.document-flow__summary p {
  margin: 0;
}

.document-flow__summary p + p {
  margin-top: 8px;
}

.document-flow__eyebrow,
.document-flow__requirement-meta {
  margin: 0 0 6px;
  color: var(--color-text-secondary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.document-flow__counts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin: 0;
}

.document-flow__counts div {
  padding: 12px;
  border-radius: 10px;
  background: var(--color-background-muted);
}

.document-flow__counts dt {
  color: var(--color-text-secondary);
  font-size: 11px;
}

.document-flow__counts dd {
  margin: 4px 0 0;
  font-weight: 700;
}

.document-flow__nav {
  display: flex;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-background-surface);
}

.document-flow__nav button {
  flex: 1;
  padding: 10px 12px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.document-flow__nav button[aria-selected='true'] {
  background: var(--color-background-muted);
  color: var(--color-text-primary);
  font-weight: 700;
}

.document-flow__requirements {
  display: grid;
  gap: 16px;
}

.document-flow__requirement {
  padding: 20px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
}

.document-flow__requirement > header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.document-flow__requirement h4,
.document-flow__scenario h5,
.document-flow__journey h4,
.document-flow__journey p {
  margin: 0;
}

.document-flow__status {
  flex: 0 0 auto;
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--color-background-muted);
  font-size: 11px;
  font-weight: 700;
}

.document-flow__status.is-observed { color: var(--color-accent); }
.document-flow__status.is-inferred { color: var(--color-text-primary); }
.document-flow__status.is-proposed { color: var(--color-text-secondary); }
.document-flow__status.is-unknown { color: var(--color-text-error); }

.document-flow__evidence-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 14px;
}

.document-flow__evidence-chip {
  padding: 5px 9px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: transparent;
  color: var(--color-text-primary);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.document-flow__evidence-chip.is-unresolved {
  color: var(--color-text-secondary);
  cursor: default;
}

.document-flow__no-evidence {
  display: inline-block;
  margin-top: 14px;
  color: var(--color-text-secondary);
  font-size: 12px;
}

.document-flow__scenarios {
  display: grid;
  gap: 12px;
  margin-top: 18px;
}

.document-flow__scenario {
  padding: 16px;
  border-radius: 10px;
  background: var(--color-background-muted);
}

.document-flow__scenario dl {
  display: grid;
  gap: 8px;
  margin: 12px 0 0;
}

.document-flow__scenario dl div {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  gap: 10px;
}

.document-flow__scenario dt {
  font-size: 11px;
  font-weight: 800;
}

.document-flow__scenario dd {
  margin: 0;
}

.document-flow__journey,
.document-flow__missing-list {
  margin: 0;
}

.document-flow__journey {
  padding: 0;
  list-style: none;
}

.document-flow__journey li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  padding: 16px 0;
  border-top: 1px solid var(--color-border);
}

.document-flow__journey li:first-child {
  padding-top: 0;
  border-top: 0;
}
```

Change `.document-flow__details` to inherit the parent width:

```css
.document-flow__details {
  width: 100%;
  margin: 0;
}
```

Extend the existing `@media (max-width: 760px)` block:

```css
.document-flow__summary {
  grid-template-columns: 1fr;
}

.document-flow__nav {
  align-items: stretch;
  flex-direction: column;
}

.document-flow__requirement > header,
.document-flow__journey li {
  align-items: stretch;
  flex-direction: column;
  grid-template-columns: 1fr;
}

.document-flow__scenario dl div {
  grid-template-columns: 1fr;
  gap: 2px;
}
```

- [ ] **Step 4: Run focused tests and the production build**

Run:

```bash
node --import tsx --test src/vitrine/documentFlowModel.test.ts
npx tsx --test src/vitrine/FlowModes.test.tsx
npm run build
```

Expected: focused tests pass and Vite completes a production build. If the build fails, record the exact error and determine whether it is caused by this task before changing unrelated files.

- [ ] **Step 5: Review checkpoint**

Run:

```bash
git diff --check -- src/vitrine/styles.css
```

Expected: no whitespace errors.

### Task 5: Verify the Binance onboarding workspace in Chrome CDP

**Files:**
- Verify only.

- [ ] **Step 1: Start or verify the current API and Vite processes**

Confirm the ports used by this checkout before opening the page:

```bash
lsof -nP -iTCP -sTCP:LISTEN | rg ':(3010|3011|5173|5174)'
```

Expected: one current API listener and one current Vite listener. Do not assume a stale process serves this checkout.

- [ ] **Step 2: Open Binance Web Onboarding in Document Flow mode**

Use Chrome CDP and navigate to:

```text
http://127.0.0.1:5173/apps/binance/flows?platform=web&version=1&flow=mobbin-flow-35d999f5-e3af-4d34-85e4-be5b208e5f99&flowView=document
```

If Vite is on port 5174, use the verified port instead.

- [ ] **Step 3: Verify the rendered contract**

Evaluate the DOM and assert:

```js
(() => {
  const text = document.body.innerText;
  return {
    requirementCards: document.querySelectorAll('.document-flow__requirement').length,
    scenarios: document.querySelectorAll('.document-flow__scenario').length,
    givenRows: [...document.querySelectorAll('.document-flow__scenario dt')]
      .filter((node) => node.textContent === 'GIVEN').length,
    evidenceButtons: document.querySelectorAll('button.document-flow__evidence-chip').length,
    technicalDetailsClosed: [...document.querySelectorAll('details.document-flow__details')]
      .every((node) => !node.open),
    hasMarkdownReader: Boolean(document.querySelector('.document-flow__markdown')),
    hasExpectedCounts:
      text.includes('14') && text.includes('6') && text.includes('supported'),
  };
})()
```

Expected for Binance Revision 2:

```json
{
  "requirementCards": 6,
  "scenarios": 6,
  "givenRows": 6,
  "technicalDetailsClosed": true,
  "hasMarkdownReader": false,
  "hasExpectedCounts": true
}
```

`evidenceButtons` must be greater than zero.

- [ ] **Step 4: Verify evidence navigation**

Activate evidence `S02`. Confirm:

- The outer representation changes from Document Flow to Screens.
- The selected Visual Flow step matches `revision.evidenceManifest` for `S02`.
- Focus reaches the Visual Flow panel or selected screen.

- [ ] **Step 5: Capture the evaluation screenshot**

Capture the viewport with the summary, Requirements tab, and first requirement card visible. Save it under the active visualization directory and visually inspect the image before reporting it.

- [ ] **Step 6: Final regression commands**

Run:

```bash
node --import tsx --test src/vitrine/documentFlowModel.test.ts
npx tsx --test src/vitrine/FlowModes.test.tsx
npm run build
```

Expected: all focused tests pass and the production build succeeds.

- [ ] **Step 7: Final review checkpoint**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only the intended files from this plan are newly changed by this implementation. Preserve all pre-existing unrelated changes.
