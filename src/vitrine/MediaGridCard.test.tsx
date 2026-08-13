import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MediaGridCard } from './components/MediaGridCard.tsx';

test('renders route-backed media cards as native links', () => {
  const html = renderToStaticMarkup(
    <MediaGridCard
      label="Open Canvas"
      kind="image"
      url="/favicon.svg"
      href="/projects/project-id/canvases/canvas-id"
    />,
  );

  assert.match(html, /href="\/projects\/project-id\/canvases\/canvas-id"/);
  assert.match(html, /aria-label="Open Canvas"/);
  assert.doesNotMatch(html, /<button[^>]*aria-label="Open Canvas"/);
});
