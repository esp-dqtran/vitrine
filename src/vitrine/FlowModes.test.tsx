import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DesignFlow, EvidenceView } from '../designSystem.ts';
import type { FeatureDocumentRevisionView, FeatureDocumentView } from '../featureDocument.ts';
import { DocumentFlowPanelView } from './components/DocumentFlowPanel.tsx';
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

const revision: FeatureDocumentRevisionView = {
  id: 5,
  documentId: 12,
  revisionNumber: 2,
  authorType: 'generated',
  reviewStatus: 'draft',
  source: {
    app: 'linear',
    platform: 'web',
    versionId: 3,
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
    proposedFeature: {
      problem: { id: 'problem', kind: 'unknown', text: 'Reduce checkout friction', evidenceIds: [] },
      targetUsers: [],
      goals: [],
      nonGoals: [],
      behavior: [],
      journey: [],
    },
    requirements: [],
    edgeCases: [],
    successMetrics: [],
    guardrailMetrics: [],
    analyticsEvents: [],
    dependencies: [],
    openQuestions: [],
  },
};

const featureDocument: FeatureDocumentView = {
  id: 12,
  title: 'Checkout',
  reviewStatus: 'draft',
  sourceChanged: false,
  currentRevision: revision,
  revisions: [revision],
  shares: [],
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
  assert.match(html, /role="tabpanel"/);
  assert.match(html, /aria-controls="flow-checkout-document-panel"/);
  assert.match(html, /Visual Flow/);
  assert.match(html, /Document Flow/);
  assert.match(html, /aria-selected="true"[\s\S]*Visual Flow/);
  assert.match(html, /Screens/);
  assert.match(html, /Prototype/);
  assert.match(html, /aria-label="Checkout Visual Flow"/);
  assert.doesNotMatch(html, /aria-modal="true"/);
});

test('renders the five-section Document Flow and opens its exact visual step', () => {
  const opened: number[] = [];
  const html = renderToStaticMarkup(
    <DocumentFlowPanelView
      flow={flow}
      state={{ kind: 'ready', document: featureDocument, revision }}
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
  assert.match(html, /aria-label="Document Flow"/);
  assert.match(html, /class="document-flow__claim-kind is-observed"/);
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
