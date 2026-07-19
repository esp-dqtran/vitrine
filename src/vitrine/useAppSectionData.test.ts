import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sectionDependencies } from './useAppSectionData.ts';

test('Overview has no data dependencies', () => {
  assert.deepEqual(sectionDependencies('overview'), []);
});

test('each detail section declares only its active dependencies', () => {
  assert.deepEqual(sectionDependencies('screens'), ['versions', 'screens']);
  assert.deepEqual(sectionDependencies('elements'), ['versions', 'ui-elements']);
  assert.deepEqual(sectionDependencies('flows'), ['versions', 'flows']);
  assert.deepEqual(sectionDependencies('design-system'), ['versions', 'design-system']);
  assert.deepEqual(sectionDependencies('export'), ['versions', 'design-system', 'screens']);
  assert.deepEqual(sectionDependencies('review'), ['versions', 'design-system']);
});
