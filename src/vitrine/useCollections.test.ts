import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionsResource } from './useCollections.ts';

test('deduplicates concurrent collection loads', async () => {
  let calls = 0;
  const resource = createCollectionsResource(async () => {
    calls += 1;
    return [];
  });

  const [left, right] = await Promise.all([resource.load(), resource.load()]);

  assert.equal(calls, 1);
  assert.deepEqual(left, right);
});

test('returns the cached collection list after the first load', async () => {
  let calls = 0;
  const resource = createCollectionsResource(async () => {
    calls += 1;
    return [];
  });

  await resource.load();
  await resource.load();

  assert.equal(calls, 1);
});
