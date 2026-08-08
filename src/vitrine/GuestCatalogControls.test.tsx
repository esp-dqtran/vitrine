import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
  assert.match(html, /data-size="md"/);
  assert.match(html, /guest-catalog-controls__login/);
  assert.doesNotMatch(html, /Log in|Get started/);
  assert.doesNotMatch(html, /Account|Collections|Settings|Log out/);
});

test('uses the same pill shape as the Login dialog submit button', async () => {
  const styles = await readFile(new URL('./referenceDiscovery.css', import.meta.url), 'utf8');

  assert.match(
    styles,
    /\.guest-catalog-controls__login\s*\{[^}]*border-radius:\s*var\(--radius-full\)\s*!important;/s,
  );
});
