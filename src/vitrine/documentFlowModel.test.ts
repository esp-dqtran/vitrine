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
    proposedFeature: {
      problem: { id: 'problem', kind: 'unknown', text: '', evidenceIds: [] },
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
