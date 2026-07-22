import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { FeatureDocumentContent, FeatureDocumentRevisionView } from '../featureDocument.ts';
import { FeatureDocumentEditor } from './components/FeatureDocumentEditor.tsx';
import { FeatureDocumentEvidencePanel } from './components/FeatureDocumentEvidencePanel.tsx';
import { FeatureDocumentRevisionHistory } from './components/FeatureDocumentRevisionHistory.tsx';
import { FeatureDocumentPendingState } from './components/FeatureDocumentPage.tsx';

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

test('renders all structured sections without collapsing into Markdown', () => {
  const html = renderToStaticMarkup(<FeatureDocumentEditor content={content} onChange={() => {}} onEvidence={() => {}} />);
  for (const section of ['Executive summary', 'Observed flow', 'Flow analysis', 'Proposed feature', 'Requirements', 'Edge cases', 'Success metrics', 'Guardrail metrics', 'Analytics events', 'Dependencies', 'Open questions']) {
    assert.match(html, new RegExp(section, 'i'));
  }
  assert.match(html, /Problem statement/);
  assert.match(html, /IMAGE-42/);
  assert.doesNotMatch(html, /Markdown/);
});

test('evidence inspector uses only the protected revision media route', () => {
  const html = renderToStaticMarkup(<FeatureDocumentEvidencePanel documentId={12} revision={revision} selectedEvidenceId="IMAGE-42" onSelect={() => {}} />);
  assert.match(html, /Flow step 1 image 1/);
  assert.match(html, /\/api\/feature-documents\/12\/revisions\/4\/media\/42/);
  assert.match(html, /Cart review/);
});

test('revision history labels immutable authors and source metadata', () => {
  const html = renderToStaticMarkup(<FeatureDocumentRevisionHistory revisions={[revision, { ...revision, id: 3, revisionNumber: 3, authorType: 'generated' }]} selectedRevisionId={4} onSelect={() => {}} onRestore={() => {}} />);
  assert.match(html, /Revision 4 · User edit/);
  assert.match(html, /Revision 3 · Generated/);
  assert.match(html, /research-model/);
  assert.match(html, /Prompt 1/);
});

test('initial generation exposes durable progress and cancellation before a revision exists', () => {
  const html = renderToStaticMarkup(<FeatureDocumentPendingState title="Checkout" job={{ id: 9, documentId: 12, status: 'running', stage: 'analyzing', doneCount: 1, totalCount: 3, updatedAt: '2026-07-22T00:00:00.000Z' }} onCancel={() => {}} onReconnect={() => {}} />);
  assert.match(html, /Analyzing image 2 of 3/);
  assert.match(html, /Cancel generation/);
  assert.doesNotMatch(html, /Loading Feature Document/);
});
