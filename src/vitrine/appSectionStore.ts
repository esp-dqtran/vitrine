import type { Platform } from '../platformFromUrl';
import {
  fetchAppFlows,
  fetchAppScreens,
  fetchAppUiElements,
  type EvidenceSectionPage,
  type EvidenceSectionRequest,
  type FlowSectionResult,
  type FlowSectionRequest,
} from './appsApi.ts';

export type AppDataSection = 'screens' | 'ui-elements' | 'flows';

export interface AppSectionKey {
  appId: string;
  section: AppDataSection;
  platform: Platform;
  version: number | 'latest';
}

export type AppSectionData = EvidenceSectionPage | FlowSectionResult;

export interface AppSectionState {
  status: 'idle' | 'loading' | 'success' | 'error';
  data: AppSectionData | null;
  error: Error | null;
}

interface AppSectionClients {
  screens: (appId: string, input: EvidenceSectionRequest) => Promise<EvidenceSectionPage>;
  uiElements: (appId: string, input: EvidenceSectionRequest) => Promise<EvidenceSectionPage>;
  flows: (appId: string, input: FlowSectionRequest) => Promise<FlowSectionResult>;
}

const defaultClients: AppSectionClients = {
  screens: fetchAppScreens,
  uiElements: fetchAppUiElements,
  flows: fetchAppFlows,
};

const idleState = (): AppSectionState => ({ status: 'idle', data: null, error: null });

export function appSectionCacheKey(key: AppSectionKey): string {
  return `${key.appId}|${key.section}|${key.platform}|${key.version}`;
}

export function createAppSectionStore(clients: AppSectionClients = defaultClients) {
  const states = new Map<string, AppSectionState>();
  const inFlight = new Map<string, { promise: Promise<AppSectionData>; signal?: AbortSignal }>();
  const listeners = new Set<() => void>();

  const emit = () => listeners.forEach((listener) => listener());
  const get = (key: AppSectionKey): AppSectionState => states.get(appSectionCacheKey(key)) ?? idleState();
  const set = (key: AppSectionKey, state: AppSectionState) => {
    states.set(appSectionCacheKey(key), state);
    emit();
  };
  const aliasResolvedVersion = (key: AppSectionKey, data: AppSectionData, state: AppSectionState) => {
    const resolved = data.version?.version_number;
    if (key.version === 'latest' && resolved !== undefined) {
      states.set(appSectionCacheKey({ ...key, version: resolved }), state);
    }
  };

  const request = (key: AppSectionKey, signal?: AbortSignal, cursor?: string): Promise<AppSectionData> => {
    const version = key.version === 'latest' ? undefined : key.version;
    if (key.section === 'screens') {
      return clients.screens(key.appId, { platform: key.platform, version, cursor, limit: 48, signal });
    }
    if (key.section === 'ui-elements') {
      return clients.uiElements(key.appId, { platform: key.platform, version, cursor, limit: 48, signal });
    }
    return clients.flows(key.appId, { platform: key.platform, version, signal });
  };

  const load = (key: AppSectionKey, signal?: AbortSignal): Promise<AppSectionData> => {
    const cacheKey = appSectionCacheKey(key);
    const existing = states.get(cacheKey);
    if (existing?.status === 'success' && existing.data) return Promise.resolve(existing.data);
    const pending = inFlight.get(cacheKey);
    if (pending && !pending.signal?.aborted) return pending.promise;
    if (pending) inFlight.delete(cacheKey);
    set(key, { status: 'loading', data: existing?.data ?? null, error: null });
    const operation = request(key, signal).then((data) => {
      if (inFlight.get(cacheKey)?.promise !== operation) return data;
      const state: AppSectionState = { status: 'success', data, error: null };
      set(key, state);
      aliasResolvedVersion(key, data, state);
      return data;
    }).catch((cause: Error) => {
      if (inFlight.get(cacheKey)?.promise === operation) {
        if (cause.name === 'AbortError') set(key, idleState());
        else set(key, { status: 'error', data: existing?.data ?? null, error: cause });
      }
      throw cause;
    }).finally(() => {
      if (inFlight.get(cacheKey)?.promise === operation) inFlight.delete(cacheKey);
    });
    inFlight.set(cacheKey, { promise: operation, signal });
    return operation;
  };

  const loadNext = (key: AppSectionKey, signal?: AbortSignal): Promise<AppSectionData> => {
    const current = get(key);
    if (current.status !== 'success' || !current.data || !('screens' in current.data) || !current.data.nextCursor) {
      return current.data ? Promise.resolve(current.data) : load(key, signal);
    }
    const nextKey = `${appSectionCacheKey(key)}|next|${current.data.nextCursor}`;
    const pending = inFlight.get(nextKey);
    if (pending && !pending.signal?.aborted) return pending.promise;
    if (pending) inFlight.delete(nextKey);
    const operation = request(key, signal, current.data.nextCursor).then((next) => {
      if (inFlight.get(nextKey)?.promise !== operation) return next;
      if (!('screens' in next) || !('screens' in current.data!)) return next;
      const seen = new Set(current.data.screens.map(({ id }) => id));
      const merged: EvidenceSectionPage = {
        ...next,
        screens: [...current.data.screens, ...next.screens.filter(({ id }) => !seen.has(id))],
      };
      const state: AppSectionState = { status: 'success', data: merged, error: null };
      set(key, state);
      aliasResolvedVersion(key, merged, state);
      return merged;
    }).catch((cause: Error) => {
      if (inFlight.get(nextKey)?.promise === operation && cause.name !== 'AbortError') set(key, { ...current, error: cause });
      throw cause;
    }).finally(() => {
      if (inFlight.get(nextKey)?.promise === operation) inFlight.delete(nextKey);
    });
    inFlight.set(nextKey, { promise: operation, signal });
    return operation;
  };

  return {
    get,
    load,
    loadNext,
    retry(key: AppSectionKey, signal?: AbortSignal) {
      states.delete(appSectionCacheKey(key));
      emit();
      return load(key, signal);
    },
    invalidate(predicate: (key: string) => boolean) {
      for (const key of states.keys()) if (predicate(key)) states.delete(key);
      emit();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

export type AppSectionStore = ReturnType<typeof createAppSectionStore>;
