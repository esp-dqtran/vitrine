import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ApplicationSurface } from './components/ApplicationSurface.tsx';

test('keeps page, overlays, and dialogs mounted in one application surface', () => {
  const html = renderToStaticMarkup(
    <ApplicationSurface
      page={<main data-current-page="site-version">Site detail</main>}
      overlays={<aside data-application-overlays="true">Settings</aside>}
      dialogs={<div data-application-dialogs="true">Import</div>}
    />,
  );

  assert.match(html, /data-application-surface="true"/);
  assert.match(html, /data-current-page="site-version"/);
  assert.match(html, /data-application-overlays="true"/);
  assert.match(html, /data-application-dialogs="true"/);
});

test('keeps the normal application surface independent from user role', () => {
  const html = renderToStaticMarkup(
    <ApplicationSurface
      page={<main data-current-page="apps">Apps</main>}
      overlays={<aside data-application-overlays="true">Collections</aside>}
      dialogs={<div data-application-dialogs="true">Import</div>}
    />,
  );

  assert.match(html, /data-application-surface="true"/);
  assert.match(html, /data-current-page="apps"/);
  assert.match(html, /data-application-overlays="true"/);
  assert.doesNotMatch(html, /data-admin-dashboard/);
});
