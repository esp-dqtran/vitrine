import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('does not replay page-load request effects in development', async () => {
  const source = await readFile(new URL('./main.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /\bStrictMode\b/);
});

test('renders both catalogs publicly while preserving private detail routing', async () => {
  const source = await readFile(new URL('./main.tsx', import.meta.url), 'utf8');
  const publicCatalogIndex = source.indexOf(
    "if (route.name === 'apps' || route.name === 'sites') return <App />;",
  );
  const authPolicyIndex = source.indexOf('if (requiresAuthentication(route))');

  assert.ok(publicCatalogIndex >= 0, 'Root must render the public catalogs');
  assert.ok(authPolicyIndex >= 0, 'Root must retain an explicit private-route policy');
  assert.ok(publicCatalogIndex < authPolicyIndex, 'public catalog handling must precede the private-route gate');
  assert.match(source, /<Home[\s\S]{0,300}onBrowse=\{goApps\}/);
});
