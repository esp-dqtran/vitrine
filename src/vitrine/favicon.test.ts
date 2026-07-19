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
  assert.match(favicon, /<rect x="10" y="10" width="12" height="12" rx="4"/);
});
