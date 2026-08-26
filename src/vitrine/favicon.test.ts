import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('uses the Vitrines brand mark as the browser favicon', async () => {
  const [html, favicon] = await Promise.all([
    readFile(new URL('../../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../../public/favicon.svg', import.meta.url), 'utf8'),
  ]);

  assert.match(html, /<link rel="icon" type="image\/svg\+xml" href="\/favicon\.svg" \/>/);
  assert.match(favicon, /viewBox="0 0 62 40"/);
  assert.match(favicon, /#0a1317/);
  assert.match(favicon, /prefers-color-scheme:\s*dark/);
  assert.match(favicon, /#dfe2e5/);
  assert.equal(favicon.match(/<path/g)?.length, 3);
  assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
});

test('publishes crawlable catalog metadata', async () => {
  const [html, robots] = await Promise.all([
    readFile(new URL('../../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../../public/robots.txt', import.meta.url), 'utf8'),
  ]);

  assert.match(html, /<meta name="description" content="[^"]+" \/>/);
  assert.match(robots, /^User-agent: \*\nAllow: \/\n/m);
  assert.match(robots, /Disallow: \/admin/);
  assert.match(robots, /Disallow: \/projects/);
  assert.match(robots, /Sitemap: https:\/\/vitrines\.ai\/sitemap\.xml/);
});

test('renders the real Vitrines mark everywhere the brand icon appears', async () => {
  const signIn = await readFile(new URL('./SignIn.tsx', import.meta.url), 'utf8');
  assert.match(signIn, /const iconSize = enlarged \? 48 : 26;/);
  assert.match(signIn, /src="\/favicon\.svg"[^>]*width=\{iconSize\}/);

  const pricing = await readFile(new URL('./Pricing.tsx', import.meta.url), 'utf8');
  assert.match(pricing, /src="\/favicon\.svg"[^>]*width=\{26\}/);

  // The Admin shell now brands through the shared WorkspaceHeader.
  const workspaceChrome = await readFile(new URL('./components/WorkspaceChrome.tsx', import.meta.url), 'utf8');
  assert.match(workspaceChrome, /src="\/favicon\.svg"/);

  const home = await readFile(new URL('./Home.tsx', import.meta.url), 'utf8');
  assert.equal((home.match(/src="\/favicon\.svg"/g) ?? []).length, 2);
  const discoveryNavigation = await readFile(
    new URL('./components/ApplicationHeader.tsx', import.meta.url),
    'utf8',
  );
  assert.match(discoveryNavigation, /src="\/favicon\.svg"/);
});
