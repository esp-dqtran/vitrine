import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyCuratorAction } from './curatorReview.ts';

const snapshot = {
  app: 'linear', generatedAt: '', tokens: [{ id: 'accent', kind: 'color' as const, name: 'Accent', value: '#fff', role: 'action', evidence: [1] }],
  components: [
    { id: 'button-a', name: 'Button A', category: 'Actions', description: 'A', variants: [{ id: 'primary', name: 'Primary', description: 'P', evidence: [1] }] },
    { id: 'button-b', name: 'Button B', category: 'Actions', description: 'B', variants: [{ id: 'secondary', name: 'Secondary', description: 'S', evidence: [2] }] },
  ], flows: [],
};

test('renames, rejects, merges, and splits entities without losing evidence', () => {
  const renamed = applyCuratorAction(snapshot, { type: 'rename', kind: 'token', id: 'accent', name: 'Brand accent' });
  assert.equal(renamed.tokens[0].name, 'Brand accent');
  const merged = applyCuratorAction(snapshot, { type: 'merge-components', ids: ['button-a', 'button-b'], targetId: 'button', name: 'Button' });
  assert.deepEqual(merged.components[0].variants.flatMap(({ evidence }) => evidence), [1, 2]);
  const split = applyCuratorAction(merged, { type: 'split-component', id: 'button', variantIds: ['secondary'], newId: 'secondary-button', name: 'Secondary button' });
  assert.deepEqual(split.components.map(({ id }) => id), ['button', 'secondary-button']);
  assert.deepEqual(split.components.flatMap(({ variants }) => variants.flatMap(({ evidence }) => evidence)), [1, 2]);
  const rejected = applyCuratorAction(split, { type: 'reject', kind: 'component', id: 'secondary-button' });
  assert.deepEqual(rejected.components.map(({ id }) => id), ['button']);
});
