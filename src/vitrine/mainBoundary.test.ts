import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('does not replay page-load request effects in development', async () => {
  const source = await readFile(new URL('./main.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /\bStrictMode\b/);
});

test('renders the Apps catalog publicly while preserving private detail routing', async () => {
  const source = await readFile(new URL('./main.tsx', import.meta.url), 'utf8');
  const publicAppsIndex = source.indexOf("if (route.name === 'apps') return <App />;");
  const authPolicyIndex = source.indexOf('if (requiresAuthentication(route))');

  assert.ok(publicAppsIndex >= 0, 'Root must render the public Apps catalog');
  assert.ok(authPolicyIndex >= 0, 'Root must retain an explicit private-route policy');
  assert.ok(publicAppsIndex < authPolicyIndex, 'public Apps handling must precede the private-route gate');
  assert.match(source, /<Home[\s\S]{0,300}onBrowse=\{goApps\}/);
});
