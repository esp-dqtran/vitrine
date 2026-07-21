import type { DesignSystemSnapshot, EvidenceView } from '../designSystem';
import type { Platform } from '../platformFromUrl';

export interface DesignSystemKey {
  appId: string;
  platform: Platform;
  version?: number;
}

export interface DesignSystemState {
  status: 'idle' | 'loading' | 'ready' | 'missing' | 'error';
  snapshot: DesignSystemSnapshot<EvidenceView> | null;
  error: Error | null;
}

type Loader = (
  key: DesignSystemKey,
  signal?: AbortSignal,
) => Promise<DesignSystemSnapshot<EvidenceView> | null>;

const cacheKey = (key: DesignSystemKey) => `${key.appId}|${key.platform}|${key.version ?? 'latest'}`;
const idle = (): DesignSystemState => ({ status: 'idle', snapshot: null, error: null });

export function createDesignSystemStore(loader: Loader) {
  const states = new Map<string, DesignSystemState>();
  const inFlight = new Map<string, { promise: Promise<DesignSystemSnapshot<EvidenceView> | null>; signal?: AbortSignal }>();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());
  const get = (key: DesignSystemKey) => states.get(cacheKey(key)) ?? idle();

  const load = (key: DesignSystemKey, signal?: AbortSignal) => {
    const id = cacheKey(key);
    const state = states.get(id);
    if (state?.status === 'ready' || state?.status === 'missing') return Promise.resolve(state.snapshot);
    const pending = inFlight.get(id);
    if (pending && !pending.signal?.aborted) return pending.promise;
    if (pending) inFlight.delete(id);
    states.set(id, { status: 'loading', snapshot: state?.snapshot ?? null, error: null });
    emit();
    const operation = loader(key, signal).then((snapshot) => {
      if (inFlight.get(id)?.promise !== operation) return snapshot;
      states.set(id, { status: snapshot ? 'ready' : 'missing', snapshot, error: null });
      emit();
      return snapshot;
    }).catch((cause: Error) => {
      if (inFlight.get(id)?.promise === operation) {
        states.set(id, cause.name === 'AbortError' ? idle() : { status: 'error', snapshot: state?.snapshot ?? null, error: cause });
        emit();
      }
      throw cause;
    }).finally(() => {
      if (inFlight.get(id)?.promise === operation) inFlight.delete(id);
    });
    inFlight.set(id, { promise: operation, signal });
    return operation;
  };

  return {
    get,
    load,
    retry(key: DesignSystemKey, signal?: AbortSignal) {
      states.delete(cacheKey(key));
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

export type DesignSystemStore = ReturnType<typeof createDesignSystemStore>;
