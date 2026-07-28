import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeAppSectionKey, sectionDependencies } from './useAppSectionData.ts';

test('each detail section declares only its active dependencies', () => {
  assert.deepEqual(sectionDependencies('screens'), ['versions', 'screens']);
  assert.deepEqual(sectionDependencies('elements'), ['versions', 'ui-elements']);
  assert.deepEqual(sectionDependencies('flows'), ['versions', 'flows']);
  assert.deepEqual(sectionDependencies('design-system'), ['versions', 'design-system']);
  assert.deepEqual(sectionDependencies('export'), ['versions', 'design-system', 'screens']);
});

test('starts Screens with the latest version while version metadata is loading', () => {
  assert.deepEqual(activeAppSectionKey({
    appId: 'linear',
    activeSection: 'screens',
    platform: 'ios',
    selectedVersion: undefined,
    versions: null,
  }), {
    appId: 'linear',
    section: 'screens',
    platform: 'ios',
    version: 'latest',
  });
});
