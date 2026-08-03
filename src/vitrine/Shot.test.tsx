import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Shot, type ShotSource } from './components/Shot.tsx';

const shot = (over: Partial<ShotSource> = {}): ShotSource => ({
  url: '/api/preview-media/tide-guide/1',
  platform: 'ios',
  appName: 'Tide Guide',
  ...over,
});

test('frames a handset capture in a portrait bezel with no browser chrome', () => {
  const html = renderToStaticMarkup(<Shot shot={shot()} />);

  assert.match(html, /aspect-ratio:9 \/ 19\.5/);
  assert.doesNotMatch(html, /border-bottom:1px solid var\(--color-border\)/);
});

test('frames a web capture in browser chrome at a landscape ratio', () => {
  const html = renderToStaticMarkup(<Shot shot={shot({ platform: 'web' })} />);

  assert.match(html, /aspect-ratio:16 \/ 10/);
  assert.match(html, /border-bottom:1px solid var\(--color-border\)/);
});

test('android captures are framed as handsets, not as browsers', () => {
  const html = renderToStaticMarkup(<Shot shot={shot({ platform: 'android' })} />);

  assert.match(html, /aspect-ratio:9 \/ 19\.5/);
});

test('never filters or dims the screenshot itself', () => {
  const html = renderToStaticMarkup(
    <Shot shot={shot({ accent: '#f0763b' })} />,
  );
  const img = html.slice(html.indexOf('<img'));

  // The accent glow is a sibling element; the capture keeps its true colours so
  // the references stay accurate.
  assert.doesNotMatch(img, /filter:|opacity:/);
  assert.match(html, /radial-gradient\(closest-side, #f0763b/);
});

test('top-aligns the crop so a capture keeps its header and first content', () => {
  assert.match(
    renderToStaticMarkup(<Shot shot={shot()} />),
    /object-position:top center/,
  );
});

test('omits the caption entirely when there is no real metadata to show', () => {
  assert.doesNotMatch(renderToStaticMarkup(<Shot shot={shot()} />), /figcaption/);
  assert.match(
    renderToStaticMarkup(<Shot shot={shot({ meta: 'Utilities · 154 screens' })} />),
    /figcaption/,
  );
});
