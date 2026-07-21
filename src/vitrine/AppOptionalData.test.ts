import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('loads subscription only for regular users and collections on demand', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8');
  assert.match(source, /if \(user\?\.role !== 'user'\)/);
  assert.match(source, /ensureCollections/);
  assert.doesNotMatch(source, /void listCollections\(\)\.then/);
});

test('fails closed and offers retry when subscription state cannot be loaded', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8');
  assert.match(source, /entitlementsError/);
  assert.match(source, /Could not load account access/);
  assert.match(source, /retryEntitlements/);
  assert.match(source, /!entitlementsError && !detailLocked/);
});
