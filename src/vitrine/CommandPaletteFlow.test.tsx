import assert from 'node:assert/strict';
import test from 'node:test';
import type { CatalogSearchResultItem } from '../catalogResearch.ts';
import {
  flowIdFromCatalogResultId,
  flowIdFromSearchResult,
} from './components/CommandPalette.tsx';

const result = (overrides: Partial<CatalogSearchResultItem>): CatalogSearchResultItem => ({
  id: 'app:linear',
  kind: 'app',
  app: 'linear',
  title: 'Linear',
  description: '',
  evidenceIds: [],
  states: [],
  layoutPatterns: [],
  componentNames: [],
  appCategories: [],
  ...overrides,
});

test('preserves the canonical Flow id when opening a search result', () => {
  assert.equal(
    flowIdFromSearchResult(result({
      id: 'flow:linear:settings-workspace-members',
      kind: 'flow',
    })),
    'settings-workspace-members',
  );
});

test('does not manufacture a Flow id for unrelated or malformed results', () => {
  assert.equal(flowIdFromSearchResult(result({})), undefined);
  assert.equal(
    flowIdFromSearchResult(result({ id: 'flow:other:invite-team', kind: 'flow' })),
    undefined,
  );
});

test('preserves the Flow id when a Flow result is opened from the Apps results page', () => {
  assert.equal(
    flowIdFromCatalogResultId('linear', 'flow:linear:settings-workspace-members'),
    'settings-workspace-members',
  );
  assert.equal(
    flowIdFromCatalogResultId('linear', 'flow:notion:settings-workspace-members'),
    undefined,
  );
});
