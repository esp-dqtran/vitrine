import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { PreviewCarouselCard } from './components/PreviewCarouselCard.tsx';

const previews = Array.from({ length: 6 }, (_, index) => ({
  key: String(index),
  url: `/preview-${index}.png`,
  alt: `Preview ${index + 1}`,
}));

test('caps the shared carousel at five previews and keeps one card target', () => {
  const html = renderToStaticMarkup(
    <PreviewCarouselCard
      label="Open V7"
      identityKey="site-1"
      identityLabel="V7"
      supportingText="Jul 2026 · 16 pages · 46 sections"
      overlayLabel="View pages"
      previews={previews}
      onOpen={() => undefined}
    />,
  );
  assert.match(html, /aria-label="Open V7"/);
  assert.match(html, /preview-0\.png/);
  assert.doesNotMatch(html, /preview-5\.png/);
});

test('keeps deferred previews behind the activation boundary', () => {
  const source = readFileSync(new URL('./components/PreviewCarouselCard.tsx', import.meta.url), 'utf8');
  assert.match(source, /i === 0 \|\| activated/);
  assert.match(source, /slice\(0, 5\)/);
});
