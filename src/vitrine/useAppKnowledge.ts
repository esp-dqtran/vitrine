import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type {
  AppKnowledgeReviewStatus,
  AppKnowledgeSnapshot,
} from '../appKnowledge.ts';
import type { Platform } from '../platformFromUrl.ts';
import {
  cancelAppKnowledgeJob,
  regenerateAppKnowledge,
  resumeAppKnowledgeJob,
  retryAppKnowledgeJob,
  saveAppKnowledgeRevision,
  setAppKnowledgeReviewStatus,
  startAppKnowledge,
  type AppKnowledgeRole,
} from './appKnowledgeApi.ts';
import {
  createAppKnowledgeStore,
  type AppKnowledgeKey,
  type AppKnowledgeStore,
} from './appKnowledgeStore.ts';

export interface AppKnowledgeActionClients {
  start: typeof startAppKnowledge;
  cancel: typeof cancelAppKnowledgeJob;
  resume: typeof resumeAppKnowledgeJob;
  retryFailed: typeof retryAppKnowledgeJob;
  regenerate: typeof regenerateAppKnowledge;
  saveRevision: typeof saveAppKnowledgeRevision;
  setReviewStatus: typeof setAppKnowledgeReviewStatus;
}

const defaultActionClients: AppKnowledgeActionClients = {
  start: startAppKnowledge,
  cancel: cancelAppKnowledgeJob,
  resume: resumeAppKnowledgeJob,
  retryFailed: retryAppKnowledgeJob,
  regenerate: regenerateAppKnowledge,
  saveRevision: saveAppKnowledgeRevision,
  setReviewStatus: setAppKnowledgeReviewStatus,
};

export function createAppKnowledgeActions(
  userRole: 'admin' | 'user',
  key: AppKnowledgeKey,
  store: Pick<AppKnowledgeStore, 'retry' | 'invalidate'>,
  clients: AppKnowledgeActionClients = defaultActionClients,
) {
  if (userRole !== 'admin') return null;
  const refresh = async <T>(operation: Promise<T>): Promise<T> => {
    const result = await operation;
    await store.retry(key);
    return result;
  };
  return {
    start() {
      if (key.version === undefined) throw new Error('Select a capture version first');
      return refresh(clients.start(key.app, key.platform, key.version));
    },
    cancel(jobId: number) {
      return refresh(clients.cancel(jobId));
    },
    resume(jobId: number) {
      return refresh(clients.resume(jobId));
    },
    retryFailed(jobId: number) {
      return refresh(clients.retryFailed(jobId));
    },
    regenerate(snapshotId: number) {
      return refresh(clients.regenerate(snapshotId));
    },
    saveRevision(snapshotId: number, revisionId: number, content: AppKnowledgeSnapshot) {
      return refresh(clients.saveRevision(snapshotId, revisionId, content));
    },
    setReviewStatus(
      snapshotId: number,
      revisionId: number,
      status: Exclude<AppKnowledgeReviewStatus, 'superseded'>,
    ) {
      return refresh(clients.setReviewStatus(snapshotId, revisionId, status));
    },
    reload() {
      return store.retry(key);
    },
    invalidate() {
      store.invalidate(key);
    },
  };
}

export function useAppKnowledge(input: {
  app: string;
  platform: Platform;
  version?: number;
  role: AppKnowledgeRole;
  userRole: 'admin' | 'user';
}, injectedStore?: AppKnowledgeStore) {
  const storeRef = useRef<AppKnowledgeStore | null>(null);
  if (!storeRef.current) storeRef.current = injectedStore ?? createAppKnowledgeStore();
  const store = storeRef.current;
  const key = useMemo<AppKnowledgeKey>(() => ({
    app: input.app,
    platform: input.platform,
    version: input.version,
    role: input.role,
  }), [input.app, input.platform, input.version, input.role]);
  const cacheKey = `${key.app}|${key.platform}|${key.version ?? 'latest'}|${key.role}`;

  useEffect(() => store.activate(key), [store, cacheKey]);
  const state = useSyncExternalStore(
    store.subscribe,
    () => store.get(key),
    () => store.get(key),
  );
  const actions = useMemo(
    () => createAppKnowledgeActions(input.userRole, key, store),
    [input.userRole, store, cacheKey],
  );

  return {
    ...state,
    currentJob: store.currentJob(key) ?? null,
    actions,
    retry: () => store.retry(key),
    invalidate: () => store.invalidate(key),
  };
}
