import assert from 'node:assert/strict';
import test from 'node:test';
import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CatalogSearchResultItem } from '../catalogResearch.ts';
import {
  CommandPalette,
  flowIdFromCatalogResultId,
  flowIdFromSearchResult,
} from './components/CommandPalette.tsx';

const baseProps = {
  apps: [],
  query: '',
  result: null,
  searchLoading: false,
  searchError: '',
  collections: [],
  plan: 'pro',
  onUpgrade: () => undefined,
  onCollectionsChange: () => undefined,
  onQueryChange: () => undefined,
  onRetrySearch: () => undefined,
  onClose: () => undefined,
  onSelectApp: () => undefined,
  onSelectScreen: () => undefined,
  onSelectCategory: () => undefined,
  onSelectFlow: () => undefined,
  onSearchFlow: () => undefined,
} satisfies ComponentProps<typeof CommandPalette>;

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

test('opens directly in Flow mode with the current Flow query and platform', () => {
  const html = renderToStaticMarkup(
    <CommandPalette
      {...baseProps}
      initialNav="flows"
      initialFlowQuery="settings"
      initialPlatform="ios"
    />,
  );

  assert.match(html, /data-nav="flows"/);
  assert.match(html, /data-querying="true"/);
  assert.match(html, /value="settings"/);
  assert.match(
    html,
    /<button(?=[^>]*aria-label="iOS")(?=[^>]*aria-pressed="true")/,
  );
  assert.match(html, /data-is-pressed="true"[^>]*aria-label="Flows"/);
});

test('enables only the route-scoped Flow mode for a Free plan', () => {
  const html = renderToStaticMarkup(
    <CommandPalette
      {...baseProps}
      plan="free"
      publicBrowse
      initialNav="flows"
      initialFlowQuery="settings"
      initialPlatform="web"
    />,
  );

  assert.match(html, /data-nav="flows"/);
  assert.match(html, /aria-label="Flows"/);
  assert.match(html, /command-palette-flow-browser/);
  assert.doesNotMatch(html, /aria-label="Screens"/);
  assert.doesNotMatch(html, /aria-label="UI Elements"/);
  assert.doesNotMatch(html, /<input[^>]*disabled/);
});

test('keeps Flow mode unavailable on other Free public routes', () => {
  const html = renderToStaticMarkup(
    <CommandPalette {...baseProps} plan="free" publicBrowse />,
  );

  assert.match(html, /data-nav="trending"/);
  assert.doesNotMatch(html, /aria-label="Flows"/);
  assert.doesNotMatch(html, /command-palette-flow-browser/);
});

test('uses Vitrines-specific search guidance and keeps recovery inside the palette', () => {
  const html = renderToStaticMarkup(
    <CommandPalette
      {...baseProps}
      query="dashboard"
      searchError="Search is taking longer than expected. Try again or keep browsing the library."
    />,
  );

  assert.match(html, /Describe a product moment, flow, or interface/);
  assert.match(html, /Start with intent/);
  assert.match(html, /Narrow with evidence/);
  assert.match(html, /VITRINES SEARCH/);
  assert.match(html, /Retry search/);
  assert.doesNotMatch(html, /AI Search is now/);
  assert.doesNotMatch(html, /Deep Search is automatically selected/);
});
