import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { LoginDialog } from './components/LoginDialog.tsx';

test('renders shared authentication inside the catalog login dialog', () => {
  const html = renderToStaticMarkup(
    <LoginDialog
      isOpen
      onClose={() => undefined}
      authenticate={async () => ({ id: 1, email: 'guest@example.com', role: 'user' })}
      register={async () => ({ id: 1, email: 'guest@example.com', role: 'user' })}
      onSignedIn={() => undefined}
    />,
  );

  assert.match(html, /data-login-dialog="true"/);
  assert.match(html, /width:460px/);
  assert.match(html, /min-height:min\(600px, 68vh\)/);
  assert.match(html, /data-sign-in-layout="embedded"/);
  assert.match(html, /Sign in to Vitrine/);
  assert.match(html, /Access your saved apps, sites, screens, and collections\./);
  assert.match(html, /background:transparent/);
  assert.doesNotMatch(html, /background:var\(--color-background-body\)/);
  assert.doesNotMatch(html, /data-sign-in-showcase="true"/);
});

test('allows the catalog login dialog to close from its backdrop', async () => {
  const source = await readFile(new URL('./components/LoginDialog.tsx', import.meta.url), 'utf8');

  assert.match(source, /purpose="info"/);
  assert.match(source, /onOpenChange=\{\(open\) => \{ if \(!open\) onClose\(\); \}\}/);
});
