import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import type { Platform } from '../platformFromUrl.ts';
import {
  flowCatalogItemKey,
  loadFlowCatalogPage,
  type FlowCatalogItem,
} from './flowCatalogApi.ts';

export type FlowCatalogPageLoader = (
  input: Parameters<typeof loadFlowCatalogPage>[0],
  signal: AbortSignal,
) => ReturnType<typeof loadFlowCatalogPage>;

export type FlowCatalogObserverFactory = (
  callback: (
    entries: readonly Pick<IntersectionObserverEntry, 'isIntersecting'>[],
  ) => void,
  options: IntersectionObserverInit,
) => Pick<IntersectionObserver, 'observe' | 'disconnect'>;

interface UseCommandPaletteFlowCatalogInput {
  enabled: boolean;
  platform: Platform;
  query: string;
  rootRef: RefObject<HTMLElement | null>;
  sentinelRef: RefObject<HTMLElement | null>;
  loadPage?: FlowCatalogPageLoader;
  observerFactory?: FlowCatalogObserverFactory;
  debounceMs?: number;
}

interface ActiveRequest {
  controller: AbortController;
  generation: number;
}

interface ActiveCursorRequest extends ActiveRequest {
  cursor: string;
}

const defaultObserverFactory: FlowCatalogObserverFactory = (
  callback,
  options,
) => new IntersectionObserver(
  (entries) => callback(entries),
  options,
);

function appendUniqueFlowItems(
  current: FlowCatalogItem[],
  incoming: FlowCatalogItem[],
): FlowCatalogItem[] {
  const keys = new Set(current.map(flowCatalogItemKey));
  const appended = incoming.filter((item) => {
    const key = flowCatalogItemKey(item);
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });
  return appended.length ? [...current, ...appended] : current;
}

export function useCommandPaletteFlowCatalog({
  enabled,
  platform,
  query,
  rootRef,
  sentinelRef,
  loadPage = loadFlowCatalogPage,
  observerFactory = defaultObserverFactory,
  debounceMs,
}: UseCommandPaletteFlowCatalogInput) {
  const [items, setItems] = useState<FlowCatalogItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retryVersion, setRetryVersion] = useState(0);
  const generationRef = useRef(0);
  const initialRequestRef = useRef<ActiveRequest | null>(null);
  const cursorRequestRef = useRef<ActiveCursorRequest | null>(null);
  const observerRef = useRef<Pick<
    IntersectionObserver,
    'observe' | 'disconnect'
  > | null>(null);
  const suspendedRef = useRef(true);
  const failedCursorRef = useRef<string | null>(null);

  const cancel = useCallback(() => {
    suspendedRef.current = true;
    generationRef.current += 1;
    initialRequestRef.current?.controller.abort();
    initialRequestRef.current = null;
    cursorRequestRef.current?.controller.abort();
    cursorRequestRef.current = null;
    observerRef.current?.disconnect();
    observerRef.current = null;
  }, []);

  useEffect(() => {
    cancel();
    failedCursorRef.current = null;
    setItems([]);
    setCursor(null);
    setError('');
    if (!enabled) {
      setLoading(false);
      return;
    }

    suspendedRef.current = false;
    const generation = generationRef.current;
    const controller = new AbortController();
    const request = { controller, generation };
    initialRequestRef.current = request;
    setLoading(true);
    const normalizedQuery = query.trim();
    const delay = debounceMs ?? (normalizedQuery ? 160 : 0);
    const run = () => {
      loadPage({
        platform,
        query: normalizedQuery || undefined,
      }, controller.signal)
        .then((page) => {
          if (
            controller.signal.aborted
            || generation !== generationRef.current
            || initialRequestRef.current !== request
          ) return;
          setItems(page.items);
          setCursor(page.nextCursor);
        })
        .catch((caught: Error) => {
          if (
            caught.name !== 'AbortError'
            && !controller.signal.aborted
            && generation === generationRef.current
            && initialRequestRef.current === request
          ) setError(caught.message);
        })
        .finally(() => {
          if (
            !controller.signal.aborted
            && generation === generationRef.current
            && initialRequestRef.current === request
          ) {
            initialRequestRef.current = null;
            setLoading(false);
          }
        });
    };
    const timer = delay > 0 ? globalThis.setTimeout(run, delay) : undefined;
    if (delay === 0) run();

    return () => {
      if (timer !== undefined) globalThis.clearTimeout(timer);
      if (initialRequestRef.current === request) initialRequestRef.current = null;
      controller.abort();
      if (generation === generationRef.current) generationRef.current += 1;
      const cursorRequest = cursorRequestRef.current;
      if (cursorRequest?.generation === generation) {
        cursorRequestRef.current = null;
        cursorRequest.controller.abort();
      }
    };
  }, [
    cancel,
    debounceMs,
    enabled,
    loadPage,
    platform,
    query,
    retryVersion,
  ]);

  const loadMore = useCallback(async () => {
    const nextCursor = cursor;
    if (
      suspendedRef.current
      || !enabled
      || !nextCursor
      || loading
      || failedCursorRef.current === nextCursor
      || cursorRequestRef.current
    ) return;

    const generation = generationRef.current;
    const controller = new AbortController();
    const request = { cursor: nextCursor, controller, generation };
    cursorRequestRef.current = request;
    setLoading(true);
    setError('');
    try {
      const page = await loadPage({
        platform,
        query: query.trim() || undefined,
        cursor: nextCursor,
      }, controller.signal);
      if (
        controller.signal.aborted
        || generation !== generationRef.current
        || cursorRequestRef.current !== request
      ) return;
      failedCursorRef.current = null;
      setItems((current) => appendUniqueFlowItems(current, page.items));
      setCursor(page.nextCursor);
    } catch (caught) {
      if (
        (caught as Error).name !== 'AbortError'
        && !controller.signal.aborted
        && generation === generationRef.current
        && cursorRequestRef.current === request
      ) {
        failedCursorRef.current = nextCursor;
        setError((caught as Error).message);
      }
    } finally {
      if (
        !controller.signal.aborted
        && generation === generationRef.current
        && cursorRequestRef.current === request
      ) {
        cursorRequestRef.current = null;
        setLoading(false);
      }
    }
  }, [cursor, enabled, loadPage, loading, platform, query]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = rootRef.current;
    if (
      suspendedRef.current
      || !enabled
      || !cursor
      || loading
      || failedCursorRef.current === cursor
      || !sentinel
      || !root
    ) return;
    const observer = observerFactory((entries) => {
      if (
        !suspendedRef.current
        && failedCursorRef.current !== cursor
        && entries.some(({ isIntersecting }) => isIntersecting)
      ) void loadMore();
    }, { root, rootMargin: '360px 0px' });
    observerRef.current = observer;
    observer.observe(sentinel);
    return () => {
      if (observerRef.current === observer) observerRef.current = null;
      observer.disconnect();
    };
  }, [
    cursor,
    enabled,
    loadMore,
    loading,
    observerFactory,
    rootRef,
    sentinelRef,
  ]);

  const retry = useCallback(() => setRetryVersion((value) => value + 1), []);

  return {
    items,
    cursor,
    loading,
    error,
    retry,
    cancel,
  };
}
