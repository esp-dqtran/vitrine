import type { AppKnowledgeJobView } from '../appKnowledgeStore.ts';
import type { Platform } from '../platformFromUrl.ts';
import {
  getAppKnowledge,
  subscribeAppKnowledgeJob,
  type AppKnowledgeRole,
  type AppKnowledgeView,
} from './appKnowledgeApi.ts';

export type { AppKnowledgeView } from './appKnowledgeApi.ts';

export interface AppKnowledgeKey {
  app: string;
  platform: Platform;
  version?: number;
  role: AppKnowledgeRole;
}

export type AppKnowledgeState =
  | { status: 'idle'; data: null; error: null }
  | { status: 'loading'; data: AppKnowledgeView | null; error: null }
  | { status: 'ready'; data: AppKnowledgeView; error: null }
  | { status: 'missing'; data: null; error: null }
  | { status: 'error'; data: AppKnowledgeView | null; error: Error };

interface AppKnowledgeClients {
  get(key: AppKnowledgeKey, signal: AbortSignal): Promise<AppKnowledgeView>;
  subscribe(
    jobId: number,
    onUpdate: (job: AppKnowledgeJobView) => void,
    onError: (error: Error) => void,
  ): () => void;
}

const terminalStatuses = new Set(['done', 'error', 'cancelled', 'stale']);
const idleState: AppKnowledgeState = { status: 'idle', data: null, error: null };
const defaultClients: AppKnowledgeClients = {
  get: (key, signal) =>
    getAppKnowledge(key.app, key.platform, key.version, key.role, signal),
  subscribe: subscribeAppKnowledgeJob,
};

export function appKnowledgeCacheKey(key: AppKnowledgeKey): string {
  return `${key.app}|${key.platform}|${key.version ?? 'latest'}|${key.role}`;
}

function viewJob(view: AppKnowledgeView | null): AppKnowledgeJobView | undefined {
  return view && 'job' in view && view.job ? view.job : undefined;
}

function withJob(view: AppKnowledgeView, job: AppKnowledgeJobView): AppKnowledgeView {
  return 'job' in view ? { ...view, job } : view;
}

function isMissing(error: Error): boolean {
  return (error as Error & { status?: number }).status === 404;
}

export function createAppKnowledgeStore(clients: AppKnowledgeClients = defaultClients) {
  const states = new Map<string, AppKnowledgeState>();
  const requests = new Map<string, {
    controller: AbortController;
    promise: Promise<AppKnowledgeView | null>;
  }>();
  const streams = new Map<string, { jobId: number; close: () => void }>();
  const active = new Map<string, number>();
  const listeners = new Set<() => void>();

  const emit = () => listeners.forEach((listener) => listener());
  const get = (key: AppKnowledgeKey): AppKnowledgeState =>
    states.get(appKnowledgeCacheKey(key)) ?? idleState;
  const set = (key: AppKnowledgeKey, state: AppKnowledgeState) => {
    states.set(appKnowledgeCacheKey(key), state);
    emit();
  };
  const closeStream = (cacheKey: string) => {
    streams.get(cacheKey)?.close();
    streams.delete(cacheKey);
  };

  const ensureStream = (key: AppKnowledgeKey, view: AppKnowledgeView) => {
    const cacheKey = appKnowledgeCacheKey(key);
    const job = viewJob(view);
    if (
      !job
      || terminalStatuses.has(job.status)
      || (active.get(cacheKey) ?? 0) < 1
    ) {
      closeStream(cacheKey);
      return;
    }
    const current = streams.get(cacheKey);
    if (current?.jobId === job.id) return;
    closeStream(cacheKey);
    const close = clients.subscribe(
      job.id,
      (update) => {
        const state = states.get(cacheKey);
        if (state?.data) {
          set(key, { status: 'ready', data: withJob(state.data, update), error: null });
        }
        if (terminalStatuses.has(update.status)) {
          closeStream(cacheKey);
          void load(key, true);
        }
      },
      (error) => {
        closeStream(cacheKey);
        const state = states.get(cacheKey);
        set(key, { status: 'error', data: state?.data ?? null, error });
      },
    );
    streams.set(cacheKey, { jobId: job.id, close });
  };

  const load = (
    key: AppKnowledgeKey,
    force = false,
  ): Promise<AppKnowledgeView | null> => {
    const cacheKey = appKnowledgeCacheKey(key);
    const current = states.get(cacheKey);
    if (!force && current?.status === 'ready') {
      ensureStream(key, current.data);
      return Promise.resolve(current.data);
    }
    const pending = requests.get(cacheKey);
    if (!force && pending && !pending.controller.signal.aborted) return pending.promise;
    pending?.controller.abort();
    if (force) closeStream(cacheKey);
    const controller = new AbortController();
    set(key, { status: 'loading', data: current?.data ?? null, error: null });
    const operation = clients.get(key, controller.signal).then((view) => {
      if (controller.signal.aborted || requests.get(cacheKey)?.promise !== operation) {
        return view;
      }
      set(key, { status: 'ready', data: view, error: null });
      ensureStream(key, view);
      return view;
    }).catch((cause: Error) => {
      if (requests.get(cacheKey)?.promise !== operation) return null;
      if (controller.signal.aborted || cause.name === 'AbortError') {
        set(key, current?.data
          ? { status: 'ready', data: current.data, error: null }
          : idleState);
        return null;
      }
      if (isMissing(cause)) {
        set(key, { status: 'missing', data: null, error: null });
        return null;
      }
      set(key, { status: 'error', data: current?.data ?? null, error: cause });
      return null;
    }).finally(() => {
      if (requests.get(cacheKey)?.promise === operation) requests.delete(cacheKey);
    });
    requests.set(cacheKey, { controller, promise: operation });
    return operation;
  };

  return {
    get,
    currentJob(key: AppKnowledgeKey) {
      return viewJob(get(key).data);
    },
    load,
    activate(key: AppKnowledgeKey) {
      const cacheKey = appKnowledgeCacheKey(key);
      active.set(cacheKey, (active.get(cacheKey) ?? 0) + 1);
      void load(key);
      return () => {
        const remaining = Math.max(0, (active.get(cacheKey) ?? 1) - 1);
        if (remaining > 0) {
          active.set(cacheKey, remaining);
          return;
        }
        active.delete(cacheKey);
        requests.get(cacheKey)?.controller.abort();
        closeStream(cacheKey);
      };
    },
    retry(key: AppKnowledgeKey) {
      return load(key, true);
    },
    invalidate(key: AppKnowledgeKey) {
      const cacheKey = appKnowledgeCacheKey(key);
      requests.get(cacheKey)?.controller.abort();
      closeStream(cacheKey);
      states.delete(cacheKey);
      emit();
    },
    whenSettled(key: AppKnowledgeKey): Promise<AppKnowledgeView | null> {
      return requests.get(appKnowledgeCacheKey(key))?.promise
        ?? Promise.resolve(get(key).data);
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

export type AppKnowledgeStore = ReturnType<typeof createAppKnowledgeStore>;
