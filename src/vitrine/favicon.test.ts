import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('uses the Vitrine brand mark as the browser favicon', async () => {
  const [html, favicon] = await Promise.all([
    readFile(new URL('../../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../../public/favicon.svg', import.meta.url), 'utf8'),
  ]);

  assert.match(html, /<link rel="icon" type="image\/svg\+xml" href="\/favicon\.svg" \/>/);
  assert.match(favicon, /viewBox="0 0 32 32"/);
  assert.match(favicon, /#0064E0/);
  assert.match(favicon, /#3E9EFB/);
  assert.equal(favicon.match(/\.inner\s*\{\s*fill:/g)?.length, 1);
  assert.match(favicon, /<rect x="10" y="10" width="12" height="12" rx="4"/);
});

test('keeps every in-app Vitrine mark center white in all themes', async () => {
  const marks = [
    ['./SignIn.tsx', 11],
    ['./Pricing.tsx', 11],
    ['./App.tsx', 11],
    ['./components/Sidebar.tsx', 9],
  ] as const;

  for (const [path, size] of marks) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.match(
      source,
      new RegExp(`width: ${size}, height: ${size}, borderRadius: \\d+, background: '#FFFFFF'`),
      path,
    );
  }

  const home = await readFile(new URL('./Home.tsx', import.meta.url), 'utf8');
  assert.equal((home.match(/src="\/favicon\.svg"/g) ?? []).length, 2);
});
