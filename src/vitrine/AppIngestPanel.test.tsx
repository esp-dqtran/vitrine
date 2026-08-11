import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppIngestPanel, appSlugFromName } from './components/AppIngestPanel.tsx';

test('derives a stable App record slug from its name', () => {
  assert.equal(appSlugFromName('Linear – Product'), 'linear-product');
  assert.equal(appSlugFromName('  Đăng Ký  '), 'dang-ky');
});

test('renders Stage 1 followed by disabled Flow preparation without offering Screen crawling', () => {
  const html = renderToStaticMarkup(<AppIngestPanel onOpenApp={() => undefined} />);
  assert.match(html, /Stage 1 · Create App record/);
  assert.match(html, /App name/);
  assert.match(html, /Official App URL/);
  assert.match(html, /ingest its official icon and description/);
  assert.match(html, /existing category taxonomy/);
  assert.match(html, /Stage 2 · Research and prepare Flows/);
  assert.match(html, /flows\/&lt;flow-id&gt;\/flow.json/);
  assert.match(html, /Complete Stage 1 first/);
  assert.match(html, /Research and prepare Flows/);
  assert.doesNotMatch(html, /Start autonomous crawl/);
  assert.doesNotMatch(html, /Capture screens/);
});
