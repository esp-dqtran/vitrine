import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { BuildInPublicPage } from './BuildInPublic.tsx';

test('renders the public roadmap as an accessible editorial timeline', () => {
  const html = renderToStaticMarkup(
    <BuildInPublicPage onHome={() => undefined} onBrowse={() => undefined} onPricing={() => undefined} />,
  );

  assert.match(html, /<h1[^>]*>Building the design intelligence workspace in the open<\/h1>/);
  assert.match(html, /Last updated July 23, 2026/);
  assert.match(html, /<ol/);
  assert.match(html, /Building now/);
  assert.match(html, /Shipped/);
  assert.match(html, /Up next/);
  assert.match(html, /Exploring/);
  assert.match(html, />465</);
  assert.match(html, />137K\+</);
  assert.match(html, />647</);
  assert.match(html, /Browse the library/);
});

test('keeps roadmap content typed, static, and independent from APIs', () => {
  const source = readFileSync(new URL('./BuildInPublic.tsx', import.meta.url), 'utf8');

  assert.match(source, /type RoadmapStatus = 'building' \| 'shipped' \| 'next' \| 'exploring'/);
  assert.match(source, /const ROADMAP_ITEMS: readonly RoadmapItemData\[\]/);
  assert.doesNotMatch(source, /fetch\(|useEffect|setInterval|setTimeout/);
});
