import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppDetailLoadingPage } from './components/AppDetailLoadingPage.tsx';

const source = readFileSync(
  new URL('./components/AppDetailLoadingPage.tsx', import.meta.url),
  'utf8',
);

test('renders App detail loading through the shared detail shell boundary', () => {
  const html = renderToStaticMarkup(
    <AppDetailLoadingPage
      isAdmin={false}
      accountControls={<button type="button">Account</button>}
      onOpenSearch={() => undefined}
      onImport={() => undefined}
    />,
  );

  assert.match(html, /data-app-detail-loading="true"/);
  assert.match(html, /data-reference-detail="app"/);
  assert.match(html, /apps-top-nav/);
  assert.match(html, /reference-detail__hero/);
  assert.match(html, /reference-detail__tabs/);
  assert.match(html, /app-detail-loading__overview/);
  assert.doesNotMatch(html, /aria-label="Analysis"/);
  assert.doesNotMatch(source, /label: 'Analysis'/);
});
