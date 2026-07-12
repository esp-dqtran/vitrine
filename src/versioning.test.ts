import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canTransitionVersion, validatePublication } from './versioning.ts';

const analyzed = { id: 7, analysis: { pageType: 'Workspace' } };
const snapshot = {
  app: 'linear', generatedAt: '2026-07-11T00:00:00.000Z',
  tokens: [{ id: 'accent', kind: 'color' as const, name: 'Accent', value: '#5E6AD2', role: 'Primary', evidence: [7] }],
  components: [{ id: 'button', name: 'Button', category: 'Actions', description: 'Action', variants: [{ id: 'primary', name: 'Primary', description: 'Filled', evidence: [7] }] }],
  flows: [],
};

test('blocks publication until every item is reviewed and evidence-backed', () => {
  assert.deepEqual(validatePublication({ images: [{ id: 7, analysis: null }], snapshot: undefined, flows: [] }).map(({ code }) => code), ['screen_analysis_missing', 'design_system_missing']);
  assert.deepEqual(validatePublication({ images: [analyzed], snapshot: { ...snapshot, tokens: [{ ...snapshot.tokens[0], evidence: [99] }] }, flows: [] }).map(({ code }) => code), ['invalid_evidence']);
  assert.deepEqual(validatePublication({ images: [analyzed], snapshot, flows: [{ id: 'flow', title: 'Flow', description: 'Observed', tags: [], steps: [{ label: 'Step', evidence: [99] }] }] }).map(({ code }) => code), ['invalid_evidence']);
  assert.deepEqual(validatePublication({ images: [analyzed], snapshot, flows: [] }), []);
});

test('allows only the curator draft-review-publish sequence', () => {
  assert.equal(canTransitionVersion('draft', 'in_review'), true);
  assert.equal(canTransitionVersion('in_review', 'published'), true);
  assert.equal(canTransitionVersion('draft', 'published'), false);
  assert.equal(canTransitionVersion('published', 'draft'), false);
});
