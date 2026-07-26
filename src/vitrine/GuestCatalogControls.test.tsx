import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';

test('renders labelled public catalog authentication actions', async () => {
  const controls = await import('./components/GuestCatalogControls.tsx').catch(() => null);
  assert.ok(controls, 'guest catalog controls must exist');

  const html = renderToStaticMarkup(
    <controls.GuestCatalogControls onLogin={() => undefined} />,
  );

  assert.match(html, /data-guest-catalog-controls="true"/);
  assert.equal((html.match(/<button /g) ?? []).length, 1);
  assert.match(html, />Login</);
  assert.match(html, /data-variant="primary"/);
  assert.doesNotMatch(html, /Log in|Get started/);
  assert.doesNotMatch(html, /Account|Collections|Settings|Log out/);
});
