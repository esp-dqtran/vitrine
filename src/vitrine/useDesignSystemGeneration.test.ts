import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AppKnowledgeJobView } from '../appKnowledgeStore.ts';
import {
  createDesignSystemGenerationController,
  type DesignSystemGenerationDependencies,
} from './useDesignSystemGeneration.ts';

function job(
  overrides: Partial<AppKnowledgeJobView> = {},
): AppKnowledgeJobView {
  return {
    id: 31,
    snapshotId: 41,
    transportJobId: 71,
    requestedBy: null,
    requestOrigin: 'automatic',
    status: 'running',
    stage: 'analyzing',
    doneCount: 2,
    totalCount: 10,
    synthesisDoneCount: 0,
    synthesisTotalCount: 3,
    cacheHitCount: 0,
    failedCount: 0,
    providerModel: 'gemini',
    promptVersion: 2,
    cancelRequested: false,
    retryFailedOnly: false,
    updatedAt: '2026-07-24T00:00:00.000Z',
    ...overrides,
  };
}

function harness() {
  const invalidations: string[] = [];
  const loads: string[] = [];
  let update: ((job: AppKnowledgeJobView) => void) | undefined;
  let closed = false;
  const dependencies: DesignSystemGenerationDependencies = {
    loadGeneration: async () => ({
      snapshot: { id: 41 } as never,
      job: job(),
      coverage: null,
      qualityDiagnostics: null,
    }),
    subscribe: (_jobId, onUpdate) => {
      update = onUpdate;
      return () => { closed = true; };
    },
    invalidateDesignSystem: () => invalidations.push('invalidate'),
    reloadDesignSystem: async () => {
      loads.push('load');
    },
  };
  return {
    dependencies,
    invalidations,
    loads,
    emit(value: AppKnowledgeJobView) {
      update?.(value);
    },
    closed: () => closed,
  };
}

test('subscribes while active and reloads the snapshot exactly once on completion', async () => {
  const h = harness();
  const generation = createDesignSystemGenerationController(h.dependencies);

  await generation.start();
  h.emit(job({
    status: 'done',
    stage: 'complete',
    doneCount: 10,
    synthesisDoneCount: 3,
  }));
  h.emit(job({
    status: 'done',
    stage: 'complete',
    doneCount: 10,
    synthesisDoneCount: 3,
  }));
  await generation.settled();

  assert.deepEqual(h.invalidations, ['invalidate']);
  assert.deepEqual(h.loads, ['load']);
  assert.equal(h.closed(), true);
  generation.stop();
});

test('does not create an interval or poll jobs', async () => {
  const intervalCalls: unknown[] = [];
  const original = globalThis.setInterval;
  globalThis.setInterval = ((...args: unknown[]) => {
    intervalCalls.push(args);
    return 1;
  }) as typeof setInterval;
  try {
    const generation = createDesignSystemGenerationController(harness().dependencies);
    await generation.start();
    assert.equal(intervalCalls.length, 0);
    generation.stop();
  } finally {
    globalThis.setInterval = original;
  }
});

test('retains failure state without reloading the Design System', async () => {
  const h = harness();
  const views: string[] = [];
  const generation = createDesignSystemGenerationController({
    ...h.dependencies,
    onChange: (view) => views.push(view?.phase ?? 'none'),
  });
  await generation.start();
  h.emit(job({ status: 'error', errorCode: 'provider_timeout', errorMessage: 'Analysis failed' }));
  await generation.settled();

  assert.equal(views.at(-1), 'failed');
  assert.deepEqual(h.loads, []);
  assert.equal(h.closed(), true);
});
