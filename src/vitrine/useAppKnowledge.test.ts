import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createAppKnowledgeActions } from './useAppKnowledge.ts';

test('actions are exposed only to admins', () => {
  const clients = {
    start: async () => ({ id: 1 }),
    cancel: async () => ({ id: 1 }),
    resume: async () => ({ id: 1 }),
    retryFailed: async () => ({ id: 1 }),
    regenerate: async () => ({ id: 1 }),
    saveRevision: async () => ({ id: 1 }),
    setReviewStatus: async () => ({ id: 1 }),
  };
  const store = { retry: async () => null, invalidate: () => {} };
  const key = { app: 'linear', platform: 'web' as const, version: 2, role: 'designer' as const };
  assert.equal(createAppKnowledgeActions('user', key, store as never, clients as never), null);
  assert.ok(createAppKnowledgeActions('admin', key, store as never, clients as never));
});

test('App Knowledge uses EventSource without interval or transport-job polling', () => {
  const api = readFileSync(new URL('./appKnowledgeApi.ts', import.meta.url), 'utf8');
  const store = readFileSync(new URL('./appKnowledgeStore.ts', import.meta.url), 'utf8');
  const hook = readFileSync(new URL('./useAppKnowledge.ts', import.meta.url), 'utf8');
  const source = `${api}\n${store}\n${hook}`;
  assert.doesNotMatch(source, /setInterval|setTimeout/);
  assert.doesNotMatch(source, /GET\s+\/api\/jobs|fetch\(['"`]\/api\/jobs/);
  assert.match(source, /EventSource/);
});
