import { useEffect, useState } from 'react';
import type { AppKnowledgeJobView } from '../appKnowledgeStore.ts';
import type { Platform } from '../platformFromUrl.ts';
import {
  getAppKnowledge,
  subscribeAppKnowledgeJob,
  type AdminAppKnowledgeView,
} from './appKnowledgeApi.ts';

export type DesignSystemGenerationPhase =
  | 'queued'
  | 'analyzing'
  | 'synthesizing'
  | 'merging'
  | 'saving'
  | 'draft_ready'
  | 'failed'
  | 'stale';

export interface DesignSystemGenerationView {
  phase: DesignSystemGenerationPhase;
  job: AppKnowledgeJobView;
  coverage: AdminAppKnowledgeView['coverage'];
  qualityDiagnostics: AdminAppKnowledgeView['qualityDiagnostics'];
  regenerating: boolean;
}

export interface DesignSystemGenerationDependencies {
  loadGeneration(): Promise<AdminAppKnowledgeView | null>;
  subscribe(
    jobId: number,
    onUpdate: (job: AppKnowledgeJobView) => void,
    onError: (error: Error) => void,
  ): () => void;
  invalidateDesignSystem(): void;
  reloadDesignSystem(): Promise<unknown>;
  hasSnapshot?: boolean;
  onChange?(view: DesignSystemGenerationView | null): void;
}

function phase(job: AppKnowledgeJobView): DesignSystemGenerationPhase {
  if (job.status === 'queued') return 'queued';
  if (job.status === 'error' || job.status === 'cancelled') return 'failed';
  if (job.status === 'stale') return 'stale';
  if (job.status === 'done') return 'draft_ready';
  if (job.stage === 'synthesizing') return 'synthesizing';
  if (job.stage === 'merging' || job.stage === 'validating_output') return 'merging';
  if (job.stage === 'saving' || job.stage === 'complete') return 'saving';
  return 'analyzing';
}

function active(job: AppKnowledgeJobView): boolean {
  return job.status === 'queued' || job.status === 'running';
}

export function createDesignSystemGenerationController(
  dependencies: DesignSystemGenerationDependencies,
) {
  let view: DesignSystemGenerationView | null = null;
  let close: (() => void) | undefined;
  let terminalKey: string | undefined;
  let pending = Promise.resolve();

  const update = (
    job: AppKnowledgeJobView,
    source?: Pick<AdminAppKnowledgeView, 'coverage' | 'qualityDiagnostics'>,
  ) => {
    view = {
      phase: phase(job),
      job,
      coverage: source?.coverage ?? view?.coverage ?? null,
      qualityDiagnostics: source?.qualityDiagnostics ?? view?.qualityDiagnostics ?? null,
      regenerating: dependencies.hasSnapshot === true && active(job),
    };
    dependencies.onChange?.(view);
    if (active(job)) return;
    close?.();
    close = undefined;
    const key = `${job.id}:${job.status}`;
    if (terminalKey === key) return;
    terminalKey = key;
    if (job.status === 'done') {
      pending = pending.then(async () => {
        dependencies.invalidateDesignSystem();
        await dependencies.reloadDesignSystem();
      });
    }
  };

  return {
    async start(): Promise<DesignSystemGenerationView | null> {
      const loaded = await dependencies.loadGeneration();
      if (!loaded?.job) {
        view = null;
        dependencies.onChange?.(null);
        return null;
      }
      update(loaded.job, loaded);
      if (active(loaded.job)) {
        close = dependencies.subscribe(
          loaded.job.id,
          (job) => update(job),
          () => {
            close?.();
            close = undefined;
          },
        );
      }
      return view;
    },
    stop() {
      close?.();
      close = undefined;
    },
    current: () => view,
    settled: () => pending,
  };
}

export function useDesignSystemGeneration(input: {
  app: string;
  platform: Platform;
  version?: number;
  enabled: boolean;
  hasSnapshot: boolean;
  invalidateDesignSystem(): void;
  reloadDesignSystem(): Promise<unknown>;
}) {
  const [generation, setGeneration] = useState<DesignSystemGenerationView | null>(null);

  useEffect(() => {
    if (!input.enabled) {
      setGeneration(null);
      return;
    }
    const controller = createDesignSystemGenerationController({
      loadGeneration: async () => {
        try {
          const loaded = await getAppKnowledge(
            input.app,
            input.platform,
            input.version,
            'designer',
          );
          return 'snapshot' in loaded ? loaded : null;
        } catch {
          return null;
        }
      },
      subscribe: (jobId, onUpdate, onError) =>
        subscribeAppKnowledgeJob(jobId, onUpdate, onError),
      invalidateDesignSystem: input.invalidateDesignSystem,
      reloadDesignSystem: input.reloadDesignSystem,
      hasSnapshot: input.hasSnapshot,
      onChange: setGeneration,
    });
    void controller.start();
    return () => controller.stop();
  }, [
    input.app,
    input.enabled,
    input.platform,
    input.version,
  ]);

  return generation;
}
