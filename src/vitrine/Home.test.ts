import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('shows the completed crawl totals in the public homepage statistics', async () => {
  const source = await readFile(new URL('./Home.tsx', import.meta.url), 'utf8');

  assert.match(source, /\{ n: '465', label: 'apps' \}/);
  assert.match(source, /\{ n: '137K\+', label: 'screens' \}/);
  assert.match(source, /\{ n: '647', label: 'UI elements' \}/);
});

test('exposes Build in public from every landing navigation mode', async () => {
  const source = await readFile(new URL('./Home.tsx', import.meta.url), 'utf8');

  assert.match(source, /onBuildInPublic: \(\) => void/);
  assert.equal((source.match(/label: 'Build in public'/g) ?? []).length, 1);
  assert.equal((source.match(/label="Build in public"/g) ?? []).length, 2);
});
