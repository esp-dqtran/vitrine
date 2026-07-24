import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button } from '@astryxdesign/core';
import { ReferenceGalleryShell } from './components/ReferenceGalleryShell.tsx';

test('renders the member identity, controls, tabs, count, and shared grid', () => {
  const html = renderToStaticMarkup(
    <ReferenceGalleryShell
      active="sites"
      isAdmin={false}
      toolbar={<div>Site search</div>}
      memberControls={<button type="button">Account</button>}
      countLabel="2 sites"
    >
      <article>Site card</article>
    </ReferenceGalleryShell>,
  );

  assert.match(html, /data-reference-gallery-shell="sites"/);
  assert.match(html, /data-reference-gallery-identity="true"/);
  assert.match(html, />Vitrine</);
  assert.match(html, />Account</);
  assert.match(html, /aria-label="Reference type"/);
  assert.match(html, /2 sites/);
  assert.match(html, /data-reference-gallery-grid="true"/);
  assert.match(html, /^<main /);
  assert.doesNotMatch(html, /<h1[^>]*>References<\/h1>/);
});

test('renders the admin header action without the member identity', () => {
  const html = renderToStaticMarkup(
    <ReferenceGalleryShell
      active="apps"
      isAdmin
      headerAction={<Button variant="primary" label="Import from URL" clickAction={() => undefined} />}
      toolbar={<div>App search</div>}
      countLabel="3 apps"
    >
      <article>App card</article>
    </ReferenceGalleryShell>,
  );

  assert.match(html, /<h1[^>]*>References<\/h1>/);
  assert.match(html, /Browse app and website design references/);
  assert.match(html, /Import from URL/);
  assert.match(html, /^<div /);
  assert.doesNotMatch(html, /<main/);
  assert.doesNotMatch(html, /data-reference-gallery-identity="true"/);
});

test('renders loading and message states inside the shared shell', () => {
  const loading = renderToStaticMarkup(
    <ReferenceGalleryShell active="sites" isAdmin toolbar={<div>Search</div>} loading />,
  );
  const empty = renderToStaticMarkup(
    <ReferenceGalleryShell
      active="sites"
      isAdmin={false}
      toolbar={<div>Search</div>}
      state={{
        title: 'No Sites imported yet',
        description: 'No ready website references are available yet.',
        actions: <Button variant="primary" label="Retry" clickAction={() => undefined} />,
      }}
    />,
  );

  assert.match(loading, /role="status"/);
  assert.match(loading, /aria-label="Loading Sites"/);
  assert.equal((loading.match(/data-reference-gallery-skeleton="true"/g) ?? []).length, 9);
  assert.match(empty, /No Sites imported yet/);
  assert.match(empty, /No ready website references are available yet/);
  assert.match(empty, />Retry</);
  assert.match(empty, /aria-label="Reference type"/);
});
