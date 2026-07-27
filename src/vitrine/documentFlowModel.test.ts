import assert from 'node:assert/strict';
import test from 'node:test';
import type { DesignFlow, EvidenceView } from '../designSystem.ts';
import type { FeatureDocumentRevisionView } from '../featureDocument.ts';
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
        imageUrl: '/42.png',
        thumbnailUrl: '/42-thumb.png',
        description: 'Cart visible',
      }],
    },
    {
      label: 'Pay',
      interaction: 'Submit card',
      evidence: [{ imageId: 43, imageUrl: '/43.png', description: 'Card form' }],
    },
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
    edgeCases: [],
    successMetrics: [],
    guardrailMetrics: [],
    analyticsEvents: [],
    dependencies: [],
    openQuestions: [
      { id: 'question', kind: 'unknown', text: ' Declined   card state ', evidenceIds: [] },
    ],
  },
} satisfies FeatureDocumentRevisionView;

test('builds requirements-first presentation data from a revision and Flow', () => {
  const model = buildDocumentFlowPresentation(flow, revision);

  assert.deepEqual(model.summary, {
    goal: 'Buy items',
    entryPoint: 'Open cart',
    completionPoint: 'Order confirmation',
    reviewStatus: 'draft',
    requirementCount: 1,
    acceptanceCriteriaCount: 2,
    supportedRequirementCount: 1,
    openQuestionCount: 1,
  });
  assert.equal(model.requirements[0].text, 'The checkout must support card payment.');
  assert.equal(model.requirements[0].userStory, 'As a buyer, I want to pay by card.');
  assert.deepEqual(model.requirements[0].businessRules, ['The cart contains an item.']);
  assert.equal(model.requirements[0].scenarios.length, 2);
  assert.equal(model.requirements[0].scenarios[0].given, 'The buyer has reviewed the cart');
  assert.equal(model.requirements[0].scenarios[1].id, 'AC-02');
  assert.deepEqual(
    model.requirements[0].evidence.map(({
      evidenceId,
      stepNumber,
      stepLabel,
      imageUrl,
      thumbnailUrl,
      description,
    }) => ({
      evidenceId,
      stepNumber,
      stepLabel,
      imageUrl,
      thumbnailUrl,
      description,
    })),
    [
      {
        evidenceId: 'E-42',
        stepNumber: 1,
        stepLabel: 'Review cart',
        imageUrl: '/42.png',
        thumbnailUrl: '/42-thumb.png',
        description: 'Cart visible',
      },
      {
        evidenceId: 'E-43',
        stepNumber: 2,
        stepLabel: 'Pay',
        imageUrl: '/43.png',
        thumbnailUrl: undefined,
        description: 'Card form',
      },
      {
        evidenceId: 'E-missing',
        stepNumber: undefined,
        stepLabel: undefined,
        imageUrl: undefined,
        thumbnailUrl: undefined,
        description: undefined,
      },
    ],
  );
  assert.deepEqual(model.openQuestions.map(({ text }) => text), ['Declined card state']);
});
