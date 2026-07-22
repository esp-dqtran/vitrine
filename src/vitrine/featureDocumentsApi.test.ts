import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createFeatureDocument,
  getFeatureDocument,
  saveFeatureDocumentRevision,
  subscribeFeatureDocumentJob,
} from './featureDocumentsApi.ts';

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
});

test('creates a generation with exact source identity', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const request = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return response({ documentId: 12, jobId: 31 }, 201);
  };
  const input = { app: 'linear', platform: 'web' as const, version: 3, flowId: 'create-issue', focusInstruction: 'Recovery' };

  assert.deepEqual(await createFeatureDocument(input, request as typeof fetch), { documentId: 12, jobId: 31 });
  assert.equal(calls[0].url, '/api/feature-documents');
  assert.equal(calls[0].init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), input);
});

test('uses optimistic immutable revision endpoints', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const request = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return response(calls.length === 1
      ? { id: 12, title: 'Checkout', reviewStatus: 'draft', sourceChanged: false, revisions: [] }
      : { id: 5, documentId: 12, revisionNumber: 2 });
  };
  await getFeatureDocument(12, request as typeof fetch);
  await saveFeatureDocumentRevision(12, 4, { executiveSummary: {} } as never, request as typeof fetch);

  assert.equal(calls[0].url, '/api/feature-documents/12');
  assert.equal(calls[1].url, '/api/feature-documents/12/revisions');
  assert.deepEqual(JSON.parse(String(calls[1].init?.body)), { revisionId: 4, content: { executiveSummary: {} } });
});

test('validates SSE progress and closes on a terminal update', () => {
  const listeners = new Map<string, (event: MessageEvent) => void>();
  let closed = 0;
  const updates: unknown[] = [];
  const errors: Error[] = [];
  const factory = (url: string) => {
    assert.equal(url, '/api/feature-document-jobs/31/events');
    return {
      addEventListener(type: string, listener: EventListener) { listeners.set(type, listener as (event: MessageEvent) => void); },
      close() { closed += 1; },
    };
  };
  const cleanup = subscribeFeatureDocumentJob(31, (job) => updates.push(job), (error) => errors.push(error), factory as never);

  listeners.get('feature-document-progress')?.({ data: JSON.stringify({
    id: 31, documentId: 12, status: 'done', stage: 'complete', doneCount: 3, totalCount: 3,
    updatedAt: '2026-07-22T00:00:00.000Z',
  }) } as MessageEvent);
  assert.equal(updates.length, 1);
  assert.equal(errors.length, 0);
  assert.equal(closed, 1);
  cleanup();
  assert.equal(closed, 1);
});
