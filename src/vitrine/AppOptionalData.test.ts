import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('loads subscription only for regular users and collections on demand', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8');
  assert.match(source, /if \(user\?\.role !== 'user'\)/);
  assert.match(source, /ensureCollections/);
  assert.doesNotMatch(source, /void listCollections\(\)\.then/);
});
