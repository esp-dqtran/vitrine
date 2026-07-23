import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  appKnowledgeCacheKey,
  createAppKnowledgeStore,
  type AppKnowledgeKey,
  type AppKnowledgeView,
} from './appKnowledgeStore.ts';
import type { AppKnowledgeJobView } from '../appKnowledgeStore.ts';

const key: AppKnowledgeKey = {
  app: 'linear',
  platform: 'web',
  version: 2,
  role: 'designer',
};

const runningJob = {
  id: 31,
  status: 'running',
  stage: 'analyzing',
  doneCount: 1,
  totalCount: 3,
} as AppKnowledgeJobView;
const runningView = { snapshot: { id: 41 }, job: runningJob } as unknown as AppKnowledgeView;
const doneView = {
  snapshot: { id: 41 },
  job: { ...runningJob, status: 'done', stage: 'complete', doneCount: 3 },
} as unknown as AppKnowledgeView;

test('uses the role-aware cache key', () => {
  assert.equal(appKnowledgeCacheKey(key), 'linear|web|2|designer');
  assert.equal(appKnowledgeCacheKey({ ...key, version: undefined }), 'linear|web|latest|designer');
});

test('loads once, streams active progress, then refreshes exactly once on terminal state', async () => {
  const requests: Array<{ signal?: AbortSignal }> = [];
  let onUpdate: ((job: AppKnowledgeJobView) => void) | undefined;
  let closed = 0;
  const store = createAppKnowledgeStore({
    get: async (_key, signal) => {
      requests.push({ signal });
      return requests.length === 1 ? runningView : doneView;
    },
    subscribe: (_jobId, update) => {
      onUpdate = update;
      return () => { closed += 1; };
    },
  });
  const cleanup = store.activate(key);
  await store.whenSettled(key);
  assert.equal(requests.length, 1);
  assert.equal(store.get(key).status, 'ready');
  onUpdate?.({ ...runningJob, doneCount: 2 });
  assert.equal(store.currentJob(key)?.doneCount, 2);
  onUpdate?.({ ...runningJob, status: 'done', stage: 'complete', doneCount: 3 });
  await store.whenSettled(key);
  assert.equal(closed, 1);
  assert.equal(requests.length, 2);
  cleanup();
});

test('deactivation aborts the old GET and closes its EventSource', async () => {
  let signal: AbortSignal | undefined;
  let close = 0;
  let resolve!: (view: AppKnowledgeView) => void;
  const pending = new Promise<AppKnowledgeView>((done) => { resolve = done; });
  const store = createAppKnowledgeStore({
    get: async (_key, requestSignal) => {
      signal = requestSignal;
      return pending;
    },
    subscribe: () => () => { close += 1; },
  });
  const cleanup = store.activate(key);
  cleanup();
  assert.equal(signal?.aborted, true);
  resolve(runningView);
  await pending;
  assert.equal(close, 0);
});

test('deactivation closes an active EventSource', async () => {
  let close = 0;
  const store = createAppKnowledgeStore({
    get: async () => runningView,
    subscribe: () => () => { close += 1; },
  });
  const cleanup = store.activate(key);
  await store.whenSettled(key);
  cleanup();
  assert.equal(close, 1);
});

test('explicit retry reloads and 404 becomes a neutral missing state', async () => {
  let count = 0;
  const missing = Object.assign(new Error('not found'), { status: 404 });
  const store = createAppKnowledgeStore({
    get: async () => {
      count += 1;
      if (count === 1) throw missing;
      return doneView;
    },
    subscribe: () => () => {},
  });
  store.activate(key);
  await store.whenSettled(key);
  assert.equal(store.get(key).status, 'missing');
  await store.retry(key);
  assert.equal(count, 2);
  assert.equal(store.get(key).status, 'ready');
});
