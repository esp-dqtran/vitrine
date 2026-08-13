import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import type {
  FeatureDocumentContent,
  FeatureDocumentRevisionView,
  FeatureDocumentView,
} from '../../featureDocument.ts';
import { ApplicationToastProvider } from '../../vitrine/components/ApplicationToast.tsx';
import { FeatureDocumentHandoffPanel } from '../../vitrine/components/FeatureDocumentHandoffPanel.tsx';
import '../../vitrine/styles.css';

const claim = (id: string, text: string, evidenceIds: string[] = []) => ({
  id,
  kind: evidenceIds.length ? 'observed' as const : 'proposed' as const,
  text,
  evidenceIds,
});

const content: FeatureDocumentContent = {
  executiveSummary: {
    purpose: claim('purpose', 'Help buyers recover an interrupted checkout.'),
    userValue: claim('value', 'Continue a purchase without repeating completed steps.'),
    recommendation: claim('recommendation', 'Persist checkout progress and make recovery explicit.'),
  },
  observedFlow: {
    userGoal: claim('goal', 'Complete checkout', ['IMAGE-42']),
    entryPoint: claim('entry', 'Cart review', ['IMAGE-42']),
    completionPoint: claim('complete', 'Order confirmation'),
    journey: [],
    actors: [],
    visibleStates: [],
  },
  flowAnalysis: {
    effectivePatterns: [],
    friction: [],
    missingStates: [],
    inconsistencies: [],
    risksAndAssumptions: [],
  },
  proposedFeature: {
    problem: claim('problem', 'Buyers lose checkout progress after an interruption.'),
    targetUsers: [],
    goals: [],
    nonGoals: [],
    behavior: [],
    journey: [],
  },
  requirements: [{
    ...claim('requirement', 'Preserve checkout progress', ['IMAGE-42']),
    userStory: 'As a buyer, I want to resume checkout so I can finish my purchase quickly.',
    priority: 'must',
    preconditions: ['The buyer has started checkout'],
    acceptanceCriteria: [{
      id: 'criterion',
      given: 'a buyer has completed at least one checkout step',
      when: 'they return after an interruption',
      then: 'the latest valid checkout state is restored',
      evidenceIds: ['IMAGE-42'],
    }],
  }],
  edgeCases: [],
  successMetrics: [claim('metric', 'Increase recovered checkout completion rate')],
  guardrailMetrics: [],
  analyticsEvents: [],
  dependencies: [],
  openQuestions: [],
};

const revision: FeatureDocumentRevisionView = {
  id: 4,
  documentId: 12,
  revisionNumber: 4,
  authorType: 'user',
  reviewStatus: 'in_review',
  content,
  source: {
    app: 'linear',
    platform: 'web',
    versionId: 3,
    flowId: 'checkout',
    title: 'Checkout recovery',
    description: 'Reference flow for checkout recovery.',
    tags: ['checkout', 'recovery'],
  },
  evidenceManifest: [{
    stepIndex: 0,
    imageIndex: 0,
    imageId: 42,
    evidenceId: 'IMAGE-42',
    stepLabel: 'Cart review',
    description: 'The buyer reviews the cart before checkout.',
  }],
  focusInstruction: 'Prioritize interruption recovery and measurable completion outcomes.',
  promptVersion: 1,
  providerModel: 'research-model',
  createdAt: '2026-08-13T00:00:00.000Z',
};

const initialDocument: FeatureDocumentView = {
  id: 12,
  title: 'Checkout recovery',
  visibility: 'private',
  reviewStatus: 'in_review',
  sourceChanged: false,
  currentRevision: revision,
  revisions: [revision],
  shares: [],
};

const meta = {
  title: 'Patterns/Feature document handoff',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function HandoffPreview() {
  const [document, setDocument] = useState(initialDocument);

  return (
    <ApplicationToastProvider>
      <main style={{ minHeight: '100vh', padding: 32, background: 'var(--color-background-subtle)' }}>
        <FeatureDocumentHandoffPanel
          document={document}
          revision={document.currentRevision}
          onDocumentChange={setDocument}
          onJobStarted={() => {}}
          onOpenVisualStep={() => {}}
        />
      </main>
    </ApplicationToastProvider>
  );
}

export const InReview: Story = {
  render: () => <HandoffPreview />,
};
