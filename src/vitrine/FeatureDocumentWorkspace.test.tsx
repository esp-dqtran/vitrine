import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DesignFlow, EvidenceView } from '../designSystem.ts';
import type {
  FeatureDocumentContent,
  FeatureDocumentRevisionView,
  FeatureDocumentView,
} from '../featureDocument.ts';
import { DocumentFlowPanelView } from './components/DocumentFlowPanel.tsx';
import { FeatureDocumentEditor } from './components/FeatureDocumentEditor.tsx';

const claim = (id: string, text: string) => ({ id, kind: 'proposed' as const, text, evidenceIds: [] });
const content: FeatureDocumentContent = {
  executiveSummary: { purpose: claim('purpose', 'Recover checkout'), userValue: claim('value', 'Finish purchase'), recommendation: claim('recommendation', 'Save progress') },
  observedFlow: {
    userGoal: { id: 'goal', kind: 'observed', text: 'Checkout', evidenceIds: ['IMAGE-42'] },
    entryPoint: { id: 'entry', kind: 'observed', text: 'Cart', evidenceIds: ['IMAGE-42'] },
    completionPoint: { id: 'complete', kind: 'unknown', text: 'Confirmation', evidenceIds: [] },
    journey: [], actors: [], visibleStates: [],
  },
  flowAnalysis: { effectivePatterns: [], friction: [], missingStates: [], inconsistencies: [], risksAndAssumptions: [] },
  proposedFeature: { problem: claim('problem', 'Users lose progress'), targetUsers: [], goals: [], nonGoals: [], behavior: [], journey: [] },
  requirements: [{ ...claim('requirement', 'Preserve progress'), userStory: 'As a buyer, I want to resume checkout.', priority: 'must', preconditions: ['Checkout started'], acceptanceCriteria: [{ id: 'criterion', given: 'checkout started', when: 'interrupted', then: 'restore it', evidenceIds: ['IMAGE-42'] }] }],
  edgeCases: [], successMetrics: [], guardrailMetrics: [], analyticsEvents: [], dependencies: [], openQuestions: [],
};

const revision: FeatureDocumentRevisionView = {
  id: 4,
  documentId: 12,
  revisionNumber: 4,
  authorType: 'user',
  reviewStatus: 'draft',
  content,
  source: { app: 'linear', platform: 'web', versionId: 3, flowId: 'checkout', title: 'Checkout', description: '', tags: [] },
  evidenceManifest: [{ stepIndex: 0, imageIndex: 0, imageId: 42, evidenceId: 'IMAGE-42', stepLabel: 'Cart', description: 'Cart review' }],
  focusInstruction: 'Recovery',
  promptVersion: 1,
  providerModel: 'research-model',
  createdAt: '2026-07-22T00:00:00.000Z',
};

const featureDocument: FeatureDocumentView = {
  id: 12,
  title: 'Checkout',
  visibility: 'private',
  reviewStatus: 'draft',
  sourceChanged: false,
  currentRevision: revision,
  revisions: [revision],
  shares: [],
};

const flow = {
  id: 'checkout',
  title: 'Checkout',
  category: 'Payments',
  description: '',
  tags: [],
  steps: [
    {
      label: 'Cart',
      evidence: [{ imageId: 42, imageUrl: '/api/media/42', description: 'Cart review' }],
    },
  ],
} satisfies DesignFlow<EvidenceView>;

test('renders all structured sections without collapsing into Markdown', () => {
  const html = renderToStaticMarkup(<FeatureDocumentEditor content={content} onChange={() => {}} onEvidence={() => {}} />);
  for (const section of ['Executive summary', 'Observed flow', 'Flow analysis', 'Proposed feature', 'Requirements', 'Edge cases', 'Success metrics', 'Guardrail metrics', 'Analytics events', 'Dependencies', 'Open questions']) {
    assert.match(html, new RegExp(section, 'i'));
  }
  assert.match(html, /Problem statement/);
  assert.match(html, /IMAGE-42/);
  assert.doesNotMatch(html, /Markdown/);
});

test('Document Flow renders structured requirements without exposing the editor', () => {
  const html = renderToStaticMarkup(
    <DocumentFlowPanelView
      flow={flow}
      state={{ kind: 'ready', document: featureDocument, revision }}
      userRole="admin"
      onOpenVisualStep={() => {}}
    />,
  );
  assert.match(html, /Preserve progress/);
  assert.match(html, /GIVEN/);
  assert.match(html, /Open evidence IMAGE-42 in Visual Flow/);
  assert.doesNotMatch(html, /Overview|Edit Document Flow|Revision history|Evidence inspector|Save new revision/);
});
