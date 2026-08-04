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
  assert.equal(robots, 'User-agent: *\nAllow: /\n');
});

test('keeps every in-app Vitrines mark center theme-contrasting', async () => {
  const marks = [
    ['./SignIn.tsx', 11],
    ['./Pricing.tsx', 11],
    ['./components/AdminSidebar.tsx', 9],
  ] as const;

  for (const [path, size] of marks) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.match(
      source,
      new RegExp(`width: ${size}, height: ${size}, borderRadius: \\d+, background: 'var\\(--color-on-accent\\)'`),
      path,
    );
  }

  const home = await readFile(new URL('./Home.tsx', import.meta.url), 'utf8');
  assert.equal((home.match(/src="\/favicon\.svg"/g) ?? []).length, 2);
  const discoveryNavigation = await readFile(
    new URL('./components/ReferenceDiscoveryTopNav.tsx', import.meta.url),
    'utf8',
  );
  assert.match(discoveryNavigation, /src="\/favicon\.svg"/);
});
