import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { SearchResults } from './components/SearchResults.tsx';
import { CollectionPicker } from './components/CollectionPicker.tsx';
import { ExportPanel } from './components/ExportPanel.tsx';
import { VersionPanel } from './components/VersionPanel.tsx';

test('renders grouped evidence-aware catalog results and facets', () => {
  const html = renderToStaticMarkup(<SearchResults
    result={{
      items: [{ id: 'component:linear:button', kind: 'component', app: 'linear', title: 'Button', description: 'Primary action', evidenceIds: [7], states: ['Primary'], layoutPatterns: [], componentNames: ['Button'] }],
      facets: { kinds: { app: 1, screen: 2, component: 1, token: 3, flow: 1, pattern: 1 }, themes: ['dark'], pageTypes: ['Workspace'], productAreas: ['Issues'], states: ['Primary'], layouts: ['Sidebar'], components: ['Button'], appCategories: ['Productivity'] },
    }}
    filters={{ kind: 'all' }}
    onFiltersChange={() => undefined}
    onOpen={() => undefined}
    collections={[]}
    onCollectionsChange={() => undefined}
  />);
  assert.match(html, /Components/);
  assert.match(html, /Button/);
  assert.match(html, /1 source/);
  assert.match(html, /All types/);
});

test('offers saving any observed reference to a collection', () => {
  const html = renderToStaticMarkup(<CollectionPicker
    reference={{ kind: 'flow', app: 'linear', referenceId: 'sign-in', title: 'Sign in' }}
    collections={[{ id: 1, name: 'Auth research', description: '', created_at: '', updated_at: '', items: [] }]}
    onCollectionsChange={() => undefined}
    plan="pro"
  />);
  assert.match(html, /Save/);
  assert.match(html, /collection/);
});

test('keeps Free users to their existing collection', () => {
  const html = renderToStaticMarkup(<CollectionPicker
    reference={{ kind: 'flow', app: 'linear', referenceId: 'sign-in', title: 'Sign in' }}
    collections={[{ id: 1, name: 'Auth research', description: '', created_at: '', updated_at: '', items: [] }]}
    onCollectionsChange={() => undefined}
    plan="free"
    onUpgrade={() => undefined}
  />);
  assert.match(html, /Auth research/);
  assert.match(html, /Upgrade for more collections/);
  assert.doesNotMatch(html, /\+ New collection/);
});

test('makes editable Figma the primary export and keeps code formats secondary', () => {
  const html = renderToStaticMarkup(<ExportPanel app="linear" />);
  assert.match(html, /Export editable Figma library/);
  assert.match(html, /Variable collections/);
  assert.match(html, /Secondary formats/);
  assert.match(html, /JSON/);
  assert.match(html, /Tailwind/);
});

test('does not surface the retired FLOW.md export card', () => {
  const html = renderToStaticMarkup(<ExportPanel app="linear" />);
  assert.doesNotMatch(html, /For product managers|Product flow documentation|Export FLOW\.md/);
});

test('shows capture counts and curator review actions without exposing draft as published', () => {
  const html = renderToStaticMarkup(<VersionPanel app="linear" platform="web" role="admin" versions={[
    { id: 2, app: 'linear', platform: 'web', version_number: 2, label: 'v2', source_url: null, status: 'draft', notes: '', captured_at: '2026-07-11T00:00:00.000Z', submitted_at: null, published_at: null, screen_count: 12, analyzed_count: 10, component_count: 4, token_count: 8, flow_count: 2 },
    { id: 1, app: 'linear', platform: 'web', version_number: 1, label: 'v1', source_url: null, status: 'published', notes: '', captured_at: '2026-07-10T00:00:00.000Z', submitted_at: null, published_at: '2026-07-10T01:00:00.000Z', screen_count: 10, analyzed_count: 10, component_count: 3, token_count: 7, flow_count: 1 },
  ]} onVersionsChange={() => undefined} onSelect={() => undefined} />);
  assert.match(html, /12 screens/);
  assert.match(html, /10 analyzed/);
  assert.match(html, /Submit for review/);
  assert.doesNotMatch(html, />Publish<\/button>/);
  assert.match(html, /Published/);
  assert.match(html, /Start recapture/);
});
