import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DesignFlow, EvidenceView } from '../designSystem.ts';
import type { FeatureDocumentRevisionView, FeatureDocumentView } from '../featureDocument.ts';
import { DocumentFlowPanelView } from './components/DocumentFlowPanel.tsx';
import { DocumentFlowReadyView } from './components/DocumentFlowReadyView.tsx';
import { FlowsPanel } from './components/FlowsPanel.tsx';
import { buildDocumentFlowPresentation } from './documentFlowModel.ts';

const flow: DesignFlow<EvidenceView> = {
  id: 'checkout',
  title: 'Checkout',
  category: 'Payments',
  description: '',
  tags: [],
  steps: [
    {
      label: 'Review cart',
      evidence: [{
        imageId: 42,
        imageUrl: '/api/media/42',
        thumbnailUrl: '/api/media/42/thumbnail',
        description: 'Cart visible',
      }],
    },
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
    sourceAssessment: {
      captureType: 'partial-journey',
      completeness: 'partial',
      rationale: 'The entry action is not captured.',
      evidenceIds: ['E-42', 'E-43'],
    },
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
      risksAndAssumptions: [{ id: 'risk', kind: 'inferred', text: 'Payment recovery is unverified', evidenceIds: ['E-43'] }],
    },
    proposedFeature: {
      problem: { id: 'problem', kind: 'unknown', text: 'Reduce checkout friction', evidenceIds: [] },
      targetUsers: [],
      goals: [],
      nonGoals: [],
      behavior: [],
      journey: [],
    },
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
          {
            id: 'AC-02',
            given: 'The buyer has reviewed the cart',
            when: 'the buyer returns to edit the order',
            then: 'the cart remains available',
            evidenceIds: ['E-42'],
          },
        ],
      },
    ],
    edgeCases: [{ id: 'edge', kind: 'proposed', text: 'Preserve the cart after a payment timeout', evidenceIds: [] }],
    successMetrics: [{ id: 'metric', kind: 'proposed', text: 'Checkout completion rate', evidenceIds: [] }],
    guardrailMetrics: [],
    analyticsEvents: [],
    dependencies: [{ id: 'dependency', kind: 'proposed', text: 'Payment status API', evidenceIds: [] }],
    openQuestions: [
      { id: 'question', kind: 'unknown', text: 'How is a declined card recovered?', evidenceIds: [] },
    ],
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

test('selected Flow URL keeps the gallery visible for modal preview', () => {
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
  assert.match(html, /data-flow-strip-card="true"/);
  assert.match(html, /data-flow-preview-url-sync="true"/);
  assert.match(html, /Preview Checkout flow screens/);
  assert.doesNotMatch(html, /class="selected-flow-workspace"/);
  assert.doesNotMatch(html, /aria-label="Checkout Visual Flow"/);
  assert.doesNotMatch(html, /aria-modal="true"/);
});

test('renders concise requirements with multiple acceptance criteria and screenshot evidence', () => {
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
  assert.match(html, /Feature brief/);
  assert.match(html, /<dd>1<\/dd><dt>Requirements<\/dt>/);
  assert.match(html, /<dd>2<\/dd><dt>Acceptance criteria<\/dt>/);
  assert.match(html, /<dd>1\/1<\/dd><dt>Supported<\/dt>/);
  assert.match(html, /aria-label="Observed journey"/);
  assert.match(html, /<summary><span>Capture quality<\/span><strong>/);
  assert.match(html, /REQ-01/);
  assert.match(html, /The checkout must support card payment/);
  assert.match(html, /User story/);
  assert.match(html, /As a buyer, I want to pay by card/);
  assert.match(html, /Business rules/);
  assert.match(html, /The cart contains an item/);
  assert.match(html, /Acceptance criteria \(2\)/);
  assert.match(html, /AC-01/);
  assert.match(html, /AC-02/);
  assert.doesNotMatch(html, /document-flow__status/);
  assert.doesNotMatch(html, />Observed</);
  assert.match(html, /GIVEN/);
  assert.match(html, /The buyer has reviewed the cart/);
  assert.match(html, /WHEN/);
  assert.match(html, /THEN/);
  assert.match(html, /the buyer returns to edit the order/);
  assert.match(html, /Open evidence E-42 in Visual Flow/);
  assert.match(html, /Evidence flow \(2\)/);
  assert.match(html, /aria-label="Evidence flow"/);
  assert.match(
    html,
    /class="[^"]*astryx-button[^"]*document-flow__evidence-card"/,
  );
  assert.match(html, /src="\/api\/media\/42\/thumbnail"/);
  assert.match(html, /Step 1/);
  assert.match(html, /Review cart/);
  assert.match(html, /Cart visible/);
  assert.match(html, /role="tablist"/);
  assert.match(html, /aria-selected="true"/);
  for (const className of [
    'document-flow__summary',
    'document-flow__counts',
    'document-flow__nav',
    'document-flow__requirement',
    'document-flow__scenario',
    'document-flow__evidence-node',
    'document-flow__evidence-step',
    'document-flow__evidence-card',
  ]) {
    assert.match(html, new RegExp(className));
  }
  assert.match(html, /<details class="document-flow__details">/);
  assert.match(html, /<summary>Technical appendix<\/summary>/);
  assert.match(html, />Open questions \(2\)</);
  assert.doesNotMatch(html, />Observed journey</);
  assert.doesNotMatch(html, /<details[^>]* open/);
  assert.doesNotMatch(html, /document-flow__markdown/);
});

test('renders deduplicated evidence gaps as open questions', () => {
  const model = buildDocumentFlowPresentation(flow, revision);
  const questions = renderToStaticMarkup(
    <DocumentFlowReadyView
      presentation={model}
      revision={revision}
      activeSection="questions"
      onSectionChange={() => {}}
      onOpenVisualStep={() => {}}
    />,
  );

  assert.match(questions, /Declined card state/);
  assert.match(questions, /How is a declined card recovered/);
  assert.match(questions, /Evidence gaps/);
  assert.match(questions, /Questions to validate/);
  assert.match(questions, /These points are not confirmed by the captured screens/);
  assert.doesNotMatch(questions, /Review the cart/);
});

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
      onOpenVisualStep={() => {}}
    />,
  );
  assert.match(html, /Analyzing image 2 of 3/);
  assert.doesNotMatch(html, /Document Flow has no revision/);
});
