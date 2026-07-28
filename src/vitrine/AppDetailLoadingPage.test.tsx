import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppDetailLoadingPage } from './components/AppDetailLoadingPage.tsx';

const source = readFileSync(
  new URL('./components/AppDetailLoadingPage.tsx', import.meta.url),
  'utf8',
);

test('renders calm App detail loading beneath the persistent navigation', () => {
  const html = renderToStaticMarkup(
    <AppDetailLoadingPage
      accountControls={<button type="button">Account</button>}
      onOpenSearch={() => undefined}
    />,
  );

  assert.match(html, /data-reference-detail-loading="app"/);
  assert.match(html, /apps-top-nav/);
  assert.match(html, /aria-label="Loading App details"/);
  assert.doesNotMatch(html, /Skeleton|reference-detail__hero|reference-detail__tabs/);
  assert.doesNotMatch(html, /aria-label="Analysis"/);
  assert.doesNotMatch(html, /Import App/);
  assert.doesNotMatch(source, /Skeleton|loadingTabs|ReferenceDetailShell/);
});
