import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAppSectionStore, type AppSectionKey } from './appSectionStore.ts';

const version = { id: 3, app: 'claude', platform: 'ios', version_number: 4, status: 'published' as const };
const key: AppSectionKey = { appId: 'claude', section: 'screens', platform: 'ios', version: 'latest' };

test('deduplicates in-flight loads and reuses fulfilled section data', async () => {
  let calls = 0;
  let resolve!: (value: unknown) => void;
  const pending = new Promise((done) => { resolve = done; });
  const store = createAppSectionStore({
    screens: async () => { calls += 1; return pending as never; },
    uiElements: async () => { throw new Error('unused'); },
    flows: async () => { throw new Error('unused'); },
  });

  const first = store.load(key);
  const second = store.load(key);
  assert.equal(first, second);
  resolve({ screens: [], nextCursor: null, platform: 'ios', version });
  await first;
  await store.load(key);
  assert.equal(calls, 1);
  assert.equal(store.get({ ...key, version: 4 }).status, 'success');
});

test('keeps section, platform, and version cache keys independent', async () => {
  const calls: string[] = [];
  const response = { screens: [], nextCursor: null, platform: 'ios' as const, version };
  const store = createAppSectionStore({
    screens: async (_app, input) => { calls.push(`screens:${input.platform}:${input.version}`); return response; },
    uiElements: async (_app, input) => { calls.push(`elements:${input.platform}:${input.version}`); return response; },
    flows: async (_app, input) => {
      calls.push(`flows:${input.platform}:${input.version}`);
      return { flows: [], platform: input.platform, version };
    },
  });

  await store.load(key);
  await store.load({ ...key, section: 'ui-elements' });
  await store.load({ ...key, section: 'flows' });
  await store.load({ ...key, platform: 'android' });
  assert.deepEqual(calls, [
    'screens:ios:undefined',
    'elements:ios:undefined',
    'flows:ios:undefined',
    'screens:android:undefined',
  ]);
});

test('appends unique evidence and retries only a failed key', async () => {
  let calls = 0;
  const store = createAppSectionStore({
    screens: async (_app, input) => {
      calls += 1;
      if (calls === 1) throw new Error('temporary');
      if (input.cursor) return {
        screens: [{ id: 2 }, { id: 3 }], nextCursor: null, platform: 'ios', version,
      } as never;
      return {
        screens: [{ id: 1 }, { id: 2 }], nextCursor: 'next', platform: 'ios', version,
      } as never;
    },
    uiElements: async () => { throw new Error('unused'); },
    flows: async () => { throw new Error('unused'); },
  });

  await assert.rejects(() => store.load(key), /temporary/);
  assert.equal(store.get(key).status, 'error');
  await store.retry(key);
  await store.loadNext(key);
  const data = store.get(key).data as { screens: Array<{ id: number }> };
  assert.deepEqual(data.screens.map(({ id }) => id), [1, 2, 3]);
  assert.equal(calls, 3);
});

test('does not turn an aborted request into a section error', async () => {
  const store = createAppSectionStore({
    screens: async () => { throw new DOMException('Aborted', 'AbortError'); },
    uiElements: async () => { throw new Error('unused'); },
    flows: async () => { throw new Error('unused'); },
  });
  await assert.rejects(() => store.load(key), /Aborted/);
  assert.equal(store.get(key).status, 'idle');
  assert.equal(store.get(key).error, null);
});

test('starts a fresh request when an aborted key is opened again immediately', async () => {
  let calls = 0;
  const response = { screens: [], nextCursor: null, platform: 'ios' as const, version };
  const store = createAppSectionStore({
    screens: async (_app, input) => {
      calls += 1;
      if (calls === 2) return response;
      return new Promise((_resolve, reject) => input.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
    },
    uiElements: async () => { throw new Error('unused'); },
    flows: async () => { throw new Error('unused'); },
  });
  const firstController = new AbortController();
  const first = store.load(key, firstController.signal);
  firstController.abort();
  const second = store.load(key, new AbortController().signal);
  await assert.rejects(() => first, /Aborted/);
  await second;
  assert.equal(calls, 2);
  assert.equal(store.get(key).status, 'success');
});
