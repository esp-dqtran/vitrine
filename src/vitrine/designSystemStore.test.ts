import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDesignSystemStore } from './designSystemStore.ts';

const key = { appId: 'claude', platform: 'ios' as const, version: 4 };
const snapshot = { app: 'claude', generatedAt: '2026-07-20T00:00:00.000Z', tokens: [], components: [], flows: [] };

test('deduplicates and caches a successful design-system key', async () => {
  let calls = 0;
  let resolve!: (value: typeof snapshot) => void;
  const pending = new Promise<typeof snapshot>((done) => { resolve = done; });
  const store = createDesignSystemStore(async () => { calls += 1; return pending; });
  const first = store.load(key);
  const second = store.load(key);
  assert.equal(first, second);
  resolve(snapshot);
  await first;
  await store.load(key);
  assert.equal(calls, 1);
  assert.equal(store.get(key).status, 'ready');
});

test('keeps platform and version keys independent', async () => {
  const calls: string[] = [];
  const store = createDesignSystemStore(async (input) => {
    calls.push(`${input.platform}:${input.version}`);
    return snapshot;
  });
  await store.load(key);
  await store.load({ ...key, platform: 'android' });
  await store.load({ ...key, version: 5 });
  await store.load(key);
  assert.deepEqual(calls, ['ios:4', 'android:4', 'ios:5']);
});

test('caches missing data, isolates errors, and allows retry', async () => {
  let calls = 0;
  const missing = createDesignSystemStore(async () => null);
  await missing.load(key);
  await missing.load(key);
  assert.equal(missing.get(key).status, 'missing');

  const failing = createDesignSystemStore(async () => {
    calls += 1;
    if (calls === 1) throw new Error('temporary');
    return snapshot;
  });
  await assert.rejects(() => failing.load(key), /temporary/);
  assert.equal(failing.get(key).status, 'error');
  await failing.retry(key);
  assert.equal(failing.get(key).status, 'ready');
});

test('keeps aborts silent', async () => {
  const store = createDesignSystemStore(async () => { throw new DOMException('Aborted', 'AbortError'); });
  await assert.rejects(() => store.load(key), /Aborted/);
  assert.equal(store.get(key).status, 'idle');
  assert.equal(store.get(key).error, null);
});
