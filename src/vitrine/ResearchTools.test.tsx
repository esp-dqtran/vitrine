import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { SearchResults } from './components/SearchResults.tsx';
import { CollectionPicker } from './components/CollectionPicker.tsx';
import { ExportPanel } from './components/ExportPanel.tsx';
import { VersionPanel } from './components/VersionPanel.tsx';

test('renders grouped evidence-aware catalog results and facets', () => {
  const html = renderToStaticMarkup(<SearchResults
    result={{
      items: [{ id: 'component:linear:button', kind: 'component', app: 'linear', title: 'Button', description: 'Primary action', evidenceIds: [7], appCategories: ['Productivity'], states: ['Primary'], layoutPatterns: [], componentNames: ['Button'] }],
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

test('offers every existing collection even when names match the reserved Saved collection', () => {
  const html = renderToStaticMarkup(<CollectionPicker
    reference={{ kind: 'flow', app: 'linear', referenceId: 'sign-in', title: 'Sign in' }}
    collections={[
      { id: 1, name: 'Saved', description: '', created_at: '', updated_at: '', items: [] },
      { id: 2, name: 'Saved', description: '', created_at: '', updated_at: '', items: [] },
      { id: 3, name: 'Checkout research', description: '', created_at: '', updated_at: '', items: [] },
    ]}
    onCollectionsChange={() => undefined}
    plan="pro"
  />);

  assert.equal(html.match(/<strong>Saved<\/strong>/g)?.length, 2);
  assert.match(html, /Checkout research/);
});

test('keeps the collection modal interactive outside the screen card hover state', () => {
  const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
  assert.match(
    css,
    /\.screen-grid-card__actions \.collection-picker__dialog\[open\] \{[\s\S]*?pointer-events: auto;/,
  );
});

test('keeps the save confirmation visible when destination lists are long', () => {
  const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.collection-picker__dialog \{[\s\S]*?height: min\(640px, calc\(100dvh - 32px\)\) !important;/);
  assert.match(css, /\.collection-picker__dialog > div \{[\s\S]*?height: 100% !important;/);
  assert.match(css, /\.collection-picker__dialog-body \{[\s\S]*?min-height: 0;[\s\S]*?overflow: hidden;/);
  assert.match(css, /\.collection-picker__destination-list \{[\s\S]*?max-height: min\(320px, max\(100px, calc\(100dvh - 360px\)\)\);/);
});

test('reports collection saves through the shared application Toast', () => {
  const picker = readFileSync(new URL('./components/CollectionPicker.tsx', import.meta.url), 'utf8');
  assert.match(picker, /useApplicationToast\(\)/);
  assert.match(picker, /showApplicationToast\(message\)/);
  assert.doesNotMatch(picker, /onStatus/);
});

test('visually distinguishes destinations that already contain every saved screen', () => {
  const picker = readFileSync(new URL('./components/CollectionPicker.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
  assert.match(picker, /fullyInSavedCollection \? ' is-saved'/);
  assert.match(picker, /collectionHasEveryReference \? ' is-saved'/);
  assert.match(css, /\.collection-picker__destination\.is-saved \{/);
  assert.match(css, /background: var\(--vitrine-color-action-primary\);/);
  assert.doesNotMatch(picker, /Already saved here/);
});

test('offers canvas placement for screen saves through existing project canvases', () => {
  const html = renderToStaticMarkup(<CollectionPicker
    reference={{ kind: 'screen', app: 'linear', referenceId: '42', title: 'Dashboard' }}
    canvasItems={[{
      appId: 'linear',
      appName: 'Linear',
      screen: {
        id: 42,
        type: 'Dashboard',
        productArea: 'Workspace',
        theme: 'light',
        visibleStates: [],
        platform: 'web',
        description: null,
        url: '/screen.png',
      },
    }]}
    collections={[]}
    onCollectionsChange={() => undefined}
    plan="pro"
  />);
  const picker = readFileSync(new URL('./components/CollectionPicker.tsx', import.meta.url), 'utf8');
  assert.match(html, /role="tablist" aria-label="Save destination"/);
  assert.match(html, />Collections</);
  assert.match(html, />Canvas</);
  assert.match(picker, /listResearchProjects\(\)/);
  assert.match(picker, /listDesignerCanvases\(project\.id\)/);
  assert.match(picker, /canvasDestinations\.map\(\(\{ project, canvas \}\)/);
  assert.match(picker, /selectedDestinationIds/);
  assert.match(picker, /selectedCanvasKeys/);
  assert.match(picker, /storeCanvasScreenInsertBatch/);
  assert.match(picker, /storeCanvasScreenInsertIntent/);
  assert.match(picker, /collection-picker__destination-status/);
});

test('reserves matching leading and trailing icon slots for every destination row', () => {
  const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.collection-picker__destination-icon,[\s\S]*?\.collection-picker__destination-status \{/);
  assert.match(css, /min-width: 16px !important;/);
});

test('keeps active save destinations visually distinct from saved-but-inactive destinations', () => {
  const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.collection-picker__destination\.is-saved\.is-selected \{[\s\S]*?background: var\(--vitrine-color-page\);/);
  assert.match(css, /\.collection-picker__destination-tabs button\.is-selected \{[\s\S]*?background: var\(--vitrine-color-action-primary\);/);
});

test('rechecks persisted collections before creating the reserved Saved collection', () => {
  const picker = readFileSync(new URL('./components/CollectionPicker.tsx', import.meta.url), 'utf8');
  const ensureSaved = picker.slice(
    picker.indexOf('const ensureSavedCollection'),
    picker.indexOf('const saveReferences'),
  );
  assert.ok(ensureSaved.indexOf('await listCollections()') < ensureSaved.indexOf("createCollection('Saved'"));
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
  assert.match(html, /class="[^"]*export-panel__primary[^"]*"/);
  assert.doesNotMatch(html, /color:var\(--color-text-disabled\)/);
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
    { id: 2, app: 'linear', platform: 'web', version_number: 2, label: 'v2', source_url: null, provider: 'm', status: 'draft', notes: '', captured_at: '2026-07-11T00:00:00.000Z', submitted_at: null, published_at: null, screen_count: 12, analyzed_count: 10, component_count: 4, token_count: 8, flow_count: 2 },
    { id: 1, app: 'linear', platform: 'web', version_number: 1, label: 'v1', source_url: null, provider: 'm', status: 'published', notes: '', captured_at: '2026-07-10T00:00:00.000Z', submitted_at: null, published_at: '2026-07-10T01:00:00.000Z', screen_count: 10, analyzed_count: 10, component_count: 3, token_count: 7, flow_count: 1 },
  ]} onVersionsChange={() => undefined} onSelect={() => undefined} />);
  assert.match(html, /12 screens/);
  assert.match(html, /10 analyzed/);
  assert.match(html, /Submit for review/);
  assert.doesNotMatch(html, />Publish<\/button>/);
  assert.match(html, /Published/);
  assert.doesNotMatch(html, /Start recapture|Mobbin web screens URL|Create draft/);
  assert.doesNotMatch(html, /color:var\(--color-text-disabled\)/);
});
