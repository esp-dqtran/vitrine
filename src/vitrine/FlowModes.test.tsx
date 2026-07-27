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
    { label: 'Review cart', evidence: [{ imageId: 42, imageUrl: '/api/media/42', description: null }] },
    { label: 'Pay', evidence: [{ imageId: 43, imageUrl: '/api/media/43', description: null }] },
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

test('selected Flow uses Screens and Document Flow as its only representation tabs', () => {
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
  assert.match(html, /Screens/);
  assert.match(html, /Document Flow/);
  assert.doesNotMatch(html, />Visual Flow</);
  assert.doesNotMatch(html, /Prototype/);
  assert.equal((html.match(/role="tablist"/g) ?? []).length, 1);
  assert.match(html, /aria-label="Checkout Visual Flow"/);
  assert.doesNotMatch(html, /aria-modal="true"/);
});

test('renders only the saved revision Markdown', () => {
  const html = renderToStaticMarkup(
    <DocumentFlowPanelView
      state={{ kind: 'ready', document: featureDocument, revision }}
      markdown={{
        kind: 'ready',
        content: [
          '# Checkout brief',
          '',
          '- Review cart',
          '- Pay',
          '',
          '| State | Result |',
          '| --- | --- |',
          '| Paid | Complete |',
        ].join('\n'),
      }}
      userRole="user"
    />,
  );
  assert.match(html, /<h1>Checkout brief<\/h1>/);
  assert.match(html, /<li>Review cart<\/li>/);
  assert.match(html, /<table>/);
  for (const label of ['Overview', 'Trigger', 'Ordered steps', 'Outcome', 'Alternate and error paths', 'Edit Document Flow']) {
    assert.doesNotMatch(html, new RegExp(label));
  }
  assert.match(html, /aria-label="Document Flow"/);
});

test('shows generation progress before the first revision exists', () => {
  const html = renderToStaticMarkup(
    <DocumentFlowPanelView
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
    />,
  );
  assert.match(html, /Analyzing image 2 of 3/);
  assert.doesNotMatch(html, /Document Flow has no revision/);
});
