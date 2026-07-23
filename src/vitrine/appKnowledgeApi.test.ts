import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  cancelAppKnowledgeJob,
  getAppKnowledge,
  startAppKnowledge,
  subscribeAppKnowledgeJob,
  type AppKnowledgeEventSource,
} from './appKnowledgeApi.ts';

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('builds scoped read and mutation requests', async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const request = async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), init });
    return response(String(url).includes('/jobs') ? { id: 31 } : { revision: {}, projection: {} });
  };
  await getAppKnowledge('linear', 'web', 2, 'developer', undefined, request as typeof fetch);
  await startAppKnowledge('linear', 'web', 2, request as typeof fetch);
  await cancelAppKnowledgeJob(31, request as typeof fetch);
  assert.equal(requests[0].url, '/api/apps/linear/analysis?platform=web&version=2&role=developer');
  assert.equal(requests[1].url, '/api/app-knowledge/jobs');
  assert.deepEqual(JSON.parse(String(requests[1].init?.body)), {
    app: 'linear',
    platform: 'web',
    version: 2,
  });
  assert.equal(requests[2].url, '/api/app-knowledge/jobs/31/cancel');
});

class FakeEventSource implements AppKnowledgeEventSource {
  closed = false;
  listeners = new Map<string, EventListener>();
  addEventListener(type: string, listener: EventListener) {
    this.listeners.set(type, listener);
  }
  close() { this.closed = true; }
  emit(type: string, data?: unknown) {
    const event = type === 'error'
      ? new Event(type)
      : new MessageEvent(type, { data: JSON.stringify(data) });
    this.listeners.get(type)?.(event);
  }
}

function progress(overrides: Record<string, unknown> = {}) {
  return {
    id: 31,
    snapshotId: 41,
    transportJobId: 71,
    requestedBy: 1,
    status: 'running',
    stage: 'analyzing',
    doneCount: 1,
    totalCount: 3,
    cacheHitCount: 0,
    failedCount: 0,
    providerModel: 'vision-model',
    promptVersion: 1,
    cancelRequested: false,
    retryFailedOnly: false,
    updatedAt: '2026-07-23T00:00:00.000Z',
    ...overrides,
  };
}

test('validates progress events and closes on terminal state', () => {
  const source = new FakeEventSource();
  const updates: unknown[] = [];
  const errors: Error[] = [];
  const close = subscribeAppKnowledgeJob(
    31,
    (job) => updates.push(job),
    (error) => errors.push(error),
    () => source,
  );
  source.emit('app-knowledge-progress', progress());
  assert.equal(updates.length, 1);
  assert.equal(source.closed, false);
  source.emit('app-knowledge-progress', progress({ status: 'done', stage: 'complete', doneCount: 3 }));
  assert.equal(source.closed, true);
  close();
  assert.equal(errors.length, 0);
});

test('rejects malformed progress without accepting provider or storage payloads', () => {
  const source = new FakeEventSource();
  const updates: unknown[] = [];
  const errors: Error[] = [];
  subscribeAppKnowledgeJob(31, (job) => updates.push(job), (error) => errors.push(error), () => source);
  source.emit('app-knowledge-progress', {
    ...progress(),
    doneCount: 9,
    providerBody: 'secret',
  });
  assert.equal(updates.length, 0);
  assert.equal(errors.length, 1);
  assert.equal(source.closed, true);
});
