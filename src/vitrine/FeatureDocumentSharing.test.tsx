import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PublicFeatureDocumentShare } from '../featureDocumentStore.ts';
import { featureDocumentReviewActions } from './components/FeatureDocumentPage.tsx';
import { FeatureDocumentSharePage } from './components/FeatureDocumentSharePage.tsx';
import { createFeatureDocumentShare, downloadFeatureDocumentMarkdown, revokeFeatureDocumentShare } from './featureDocumentsApi.ts';

const claim = (id: string, text: string) => ({ id, kind: 'proposed' as const, text, evidenceIds: [] });
const share: PublicFeatureDocumentShare = {
  title: 'Checkout recovery',
  reviewStatus: 'approved',
  expiresAt: '2026-07-29T00:00:00.000Z',
  revision: {
    id: 5, documentId: 12, revisionNumber: 5, authorType: 'user', reviewStatus: 'approved',
    source: { app: 'linear', platform: 'web', flowId: 'checkout', title: 'Checkout', description: '', tags: [] },
    evidenceManifest: [{ stepIndex: 0, imageIndex: 0, imageId: 42, evidenceId: 'IMAGE-42', stepLabel: 'Cart', description: 'Cart review' }],
    focusInstruction: '', promptVersion: 1, providerModel: 'model', createdAt: '2026-07-22T00:00:00.000Z',
    content: {
      executiveSummary: { purpose: claim('p', 'Recover checkout'), userValue: claim('v', 'Finish'), recommendation: claim('r', 'Save') },
      observedFlow: { userGoal: { id: 'g', kind: 'observed', text: 'Checkout', evidenceIds: ['IMAGE-42'] }, entryPoint: { id: 'e', kind: 'observed', text: 'Cart', evidenceIds: ['IMAGE-42'] }, completionPoint: { id: 'c', kind: 'unknown', text: 'Confirmation', evidenceIds: [] }, journey: [], actors: [], visibleStates: [] },
      flowAnalysis: { effectivePatterns: [], friction: [], missingStates: [], inconsistencies: [], risksAndAssumptions: [] },
      proposedFeature: { problem: claim('problem', 'Lost progress'), targetUsers: [], goals: [], nonGoals: [], behavior: [], journey: [] },
      requirements: [{ ...claim('req', 'Preserve progress'), priority: 'must', acceptanceCriteria: [{ id: 'ac', given: 'started', when: 'interrupted', then: 'restore', evidenceIds: ['IMAGE-42'] }] }],
      edgeCases: [], successMetrics: [], guardrailMetrics: [], analyticsEvents: [], dependencies: [], openQuestions: [],
    },
  },
};

test('exposes only valid review transitions', () => {
  assert.deepEqual(featureDocumentReviewActions('draft'), ['in_review']);
  assert.deepEqual(featureDocumentReviewActions('in_review'), ['draft', 'approved']);
  assert.deepEqual(featureDocumentReviewActions('approved'), []);
  assert.deepEqual(featureDocumentReviewActions('superseded'), []);
});

test('public share renders canonical content and share-scoped evidence', () => {
  const token = 'a'.repeat(43);
  const html = renderToStaticMarkup(<FeatureDocumentSharePage token={token} initialShare={share} />);
  assert.match(html, /Read-only Feature Document/);
  assert.match(html, /Checkout recovery/);
  assert.match(html, new RegExp(`/api/feature-document-shares/${token}/media/42`));
  assert.doesNotMatch(html, /\/api\/feature-documents\/12\/revisions/);
});

test('uses selected revision export and revocable share endpoints', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const request = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    if (String(url).includes('export.md')) return new Response('# document', { status: 200, headers: { 'content-disposition': 'attachment; filename="checkout.md"' } });
    if (init?.method === 'DELETE') return new Response(null, { status: 204 });
    return new Response(JSON.stringify({ id: 8, documentId: 12, revisionId: 5, expiresAt: '2026-07-29T00:00:00.000Z', url: 'https://app/feature-document-shares/token' }), { status: 201, headers: { 'content-type': 'application/json' } });
  };
  const download = await downloadFeatureDocumentMarkdown(12, 5, request as typeof fetch);
  await createFeatureDocumentShare(12, 5, request as typeof fetch);
  await revokeFeatureDocumentShare(12, 8, request as typeof fetch);

  assert.equal(download.filename, 'checkout.md');
  assert.equal(calls[0].url, '/api/feature-documents/12/export.md?revisionId=5');
  assert.deepEqual(JSON.parse(String(calls[1].init?.body)), { revisionId: 5 });
  assert.equal(calls[2].init?.method, 'DELETE');
});
