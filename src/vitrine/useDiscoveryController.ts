import { useEffect, useMemo, useRef, useSyncExternalStore, type RefObject } from 'react';
import type { Platform } from '../platformFromUrl.ts';
import type {
  DiscoveryAdapter,
  DiscoveryFacet,
  DiscoveryFilter,
  DiscoveryState,
} from './discoveryTypes.ts';

export interface DiscoveryController<
  T,
  Sort extends string,
  State extends DiscoveryState<Sort> = DiscoveryState<Sort>,
> {
  state: State;
  items: T[];
  facets: DiscoveryFacet[];
  totalCount: number | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  loadMoreError: string | null;
  hasMore: boolean;
  sentinelRef: RefObject<HTMLDivElement | null>;
  setState(state: State, mode?: 'push' | 'replace'): void;
  setPlatform(platform: Platform): void;
  setSort(sort: Sort): void;
  setQuery(query: string): void;
  toggleFilter(filter: DiscoveryFilter): void;
  clearFilterGroup(group: string): void;
  retry(): void;
  retryLoadMore(): void;
}

interface DiscoveryObserver {
  observe(target: Element): void;
  disconnect(): void;
}

export type DiscoveryObserverFactory = (
  callback: (entries: readonly Pick<IntersectionObserverEntry, 'isIntersecting'>[]) => void,
) => DiscoveryObserver | null;

export interface UseDiscoveryControllerOptions<
  T,
  Sort extends string,
  State extends DiscoveryState<Sort> = DiscoveryState<Sort>,
> {
  adapter: DiscoveryAdapter<T, Sort, State>;
  locationSearch: string;
  onNavigate(search: string, mode: 'push' | 'replace'): void;
  queryDebounceMs?: number;
  observerFactory?: DiscoveryObserverFactory;
}

type DiscoveryView<T, Sort extends string, State extends DiscoveryState<Sort>> = Pick<
  DiscoveryController<T, Sort, State>,
  'state' | 'items' | 'facets' | 'totalCount' | 'loading' | 'loadingMore' | 'error' | 'loadMoreError' | 'hasMore'
>;

interface CompletedDiscoveryPage<T> {
  canonical: string;
  items: T[];
  facets: DiscoveryFacet[];
  totalCount: number;
  nextCursor: string | null;
}

const defaultObserverFactory: DiscoveryObserverFactory = (callback) => {
  if (typeof IntersectionObserver === 'undefined') return null;
  return new IntersectionObserver(callback);
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Discovery unavailable';

const isAbort = (error: unknown) =>
  error instanceof DOMException && error.name === 'AbortError'
    || error instanceof Error && error.name === 'AbortError';

const dedupeItems = <T>(items: readonly T[], itemKey: (item: T) => string): T[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = itemKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export interface DiscoveryControllerHandle<
  T,
  Sort extends string,
  State extends DiscoveryState<Sort> = DiscoveryState<Sort>,
> {
  snapshot(): DiscoveryView<T, Sort, State>;
  subscribe(listener: () => void): () => void;
  start(): void;
  hydrate(locationSearch: string): void;
  observeSentinel(target: HTMLDivElement | null): void;
  stop(): void;
  dispose(): void;
  readonly public: DiscoveryController<T, Sort, State>;
}

/**
 * The imperative half is exported for focused testing; the hook below owns its
 * lifecycle and turns it into React state.
 */
export function createDiscoveryController<
  T,
  Sort extends string,
  State extends DiscoveryState<Sort> = DiscoveryState<Sort>,
>(
  options: UseDiscoveryControllerOptions<T, Sort, State>,
): DiscoveryControllerHandle<T, Sort, State> {
  const { adapter, onNavigate } = options;
  const debounceMs = options.queryDebounceMs ?? 180;
  const observerFactory = options.observerFactory ?? defaultObserverFactory;
  const sentinelRef: RefObject<HTMLDivElement | null> = { current: null };
  const listeners = new Set<() => void>();
  let view: DiscoveryView<T, Sort, State> = {
    state: adapter.parse(options.locationSearch),
    items: [],
    facets: [],
    totalCount: null,
    loading: false,
    loadingMore: false,
    error: null,
    loadMoreError: null,
    hasMore: false,
  };
  let active = false;
  let disposed = false;
  let generation = 0;
  let nextCursor: string | null = null;
  let failedLoadMoreCursor: string | null = null;
  let firstAbort: AbortController | null = null;
  let loadMoreAbort: AbortController | null = null;
  let firstInFlightCanonical: string | null = null;
  let completedFirstPage: CompletedDiscoveryPage<T> | null = null;
  let queryTimer: ReturnType<typeof setTimeout> | null = null;
  let observer: DiscoveryObserver | null = null;
  let observedTarget: HTMLDivElement | null = null;
  let lastSentinelCursor: string | null = null;
  let sentinelIntersecting = false;

  const emit = () => listeners.forEach((listener) => listener());
  const update = (next: Partial<DiscoveryView<T, Sort, State>>) => {
    view = { ...view, ...next };
    emit();
  };
  const cancelQueryTimer = () => {
    if (queryTimer !== null) clearTimeout(queryTimer);
    queryTimer = null;
  };
  const invalidateRequests = () => {
    generation += 1;
    firstAbort?.abort();
    loadMoreAbort?.abort();
    firstAbort = null;
    loadMoreAbort = null;
    firstInFlightCanonical = null;
  };
  const clearPage = (state: State) => {
    nextCursor = null;
    failedLoadMoreCursor = null;
    lastSentinelCursor = null;
    update({
      state,
      items: [],
      facets: [],
      totalCount: null,
      hasMore: false,
      loadingMore: false,
      error: null,
      loadMoreError: null,
    });
  };

  const requestFirstPage = (state: State, reset = true) => {
    if (disposed || !active) return;
    const canonical = adapter.serialize(state);
    if (firstInFlightCanonical === canonical) return;
    generation += 1;
    const requestGeneration = generation;
    firstAbort?.abort();
    loadMoreAbort?.abort();
    loadMoreAbort = null;
    failedLoadMoreCursor = null;
    if (reset) clearPage(state);
    firstAbort = new AbortController();
    firstInFlightCanonical = canonical;
    update({ state, loading: true, loadingMore: false, error: null, loadMoreError: null });

    void adapter.request(state, null, firstAbort.signal).then(
      (page) => {
        if (disposed || requestGeneration !== generation) return;
        firstAbort = null;
        firstInFlightCanonical = null;
        const items = dedupeItems(page.items, adapter.itemKey);
        completedFirstPage = {
          canonical,
          items,
          facets: page.facets,
          totalCount: page.totalCount,
          nextCursor: page.nextCursor,
        };
        nextCursor = page.nextCursor;
        update({
          items,
          facets: page.facets,
          totalCount: page.totalCount,
          hasMore: page.nextCursor !== null,
          loading: false,
          loadingMore: false,
          error: null,
          loadMoreError: null,
        });
        rearmSentinel();
      },
      (error) => {
        if (disposed || requestGeneration !== generation || isAbort(error)) return;
        firstAbort = null;
        firstInFlightCanonical = null;
        update({ loading: false, error: errorMessage(error) });
      },
    );
  };

  const requestLoadMore = (cursor = nextCursor) => {
    if (disposed || !active || !cursor || loadMoreAbort || !view.hasMore) return;
    generation += 1;
    const requestGeneration = generation;
    loadMoreAbort = new AbortController();
    failedLoadMoreCursor = null;
    update({ loadingMore: true, loadMoreError: null });
    const state = view.state;

    void adapter.request(state, cursor, loadMoreAbort.signal).then(
      (page) => {
        if (disposed || requestGeneration !== generation) return;
        loadMoreAbort = null;
        const seen = new Set(view.items.map(adapter.itemKey));
        const items = page.items.filter((item) => {
          const key = adapter.itemKey(item);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        nextCursor = page.nextCursor;
        const allItems = [...view.items, ...items];
        if (completedFirstPage?.canonical === adapter.serialize(state)) {
          completedFirstPage = {
            canonical: completedFirstPage.canonical,
            items: allItems,
            facets: page.facets,
            totalCount: page.totalCount,
            nextCursor: page.nextCursor,
          };
        }
        update({
          items: allItems,
          facets: page.facets,
          totalCount: page.totalCount,
          hasMore: page.nextCursor !== null,
          loadingMore: false,
          loadMoreError: null,
        });
        rearmSentinel();
      },
      (error) => {
        if (disposed || requestGeneration !== generation || isAbort(error)) return;
        loadMoreAbort = null;
        failedLoadMoreCursor = cursor;
        update({ loadingMore: false, loadMoreError: errorMessage(error) });
      },
    );
  };

  const resetAndRequest = (state: State, mode: 'push' | 'replace') => {
    if (disposed) return;
    cancelQueryTimer();
    onNavigate(adapter.serialize(state), mode);
    requestFirstPage(state);
  };
  const setState = (state: State, mode: 'push' | 'replace' = 'push') => {
    if (adapter.serialize(view.state) === adapter.serialize(state)) return;
    resetAndRequest(state, mode);
  };

  const setPlatform = (platform: Platform) => {
    if (view.state.platform === platform) return;
    resetAndRequest({ ...view.state, platform }, 'push');
  };
  const setSort = (sort: Sort) => {
    if (view.state.sort === sort) return;
    resetAndRequest({ ...view.state, sort }, 'push');
  };
  const toggleFilter = (filter: DiscoveryFilter) => {
    const matching = (candidate: DiscoveryFilter) =>
      candidate.group === filter.group && candidate.value === filter.value;
    const filters = view.state.filters.some(matching)
      ? view.state.filters.filter((candidate) => !matching(candidate))
      : [...view.state.filters, filter];
    resetAndRequest({ ...view.state, filters }, 'push');
  };
  const clearFilterGroup = (group: string) => {
    const filters = view.state.filters.filter((filter) => filter.group !== group);
    if (filters.length === view.state.filters.length) return;
    resetAndRequest({ ...view.state, filters }, 'push');
  };
  const setQuery = (query: string) => {
    if (disposed) return;
    cancelQueryTimer();
    // The next request is intentionally delayed, but a result for the prior
    // query must never land while the new query is already displayed.
    invalidateRequests();
    nextCursor = null;
    failedLoadMoreCursor = null;
    lastSentinelCursor = null;
    const state = { ...view.state, query };
    clearPage(state);
    update({ loading: false, loadingMore: false });
    queryTimer = setTimeout(() => {
      queryTimer = null;
      if (disposed || !active) return;
      onNavigate(adapter.serialize(view.state), 'replace');
      requestFirstPage(view.state);
    }, debounceMs);
  };
  const retry = () => {
    if (disposed) return;
    cancelQueryTimer();
    requestFirstPage(view.state);
  };
  const retryLoadMore = () => {
    if (disposed) return;
    const cursor = failedLoadMoreCursor ?? nextCursor;
    if (cursor) requestLoadMore(cursor);
  };

  function requestNextFromSentinel() {
    if (disposed || !active || !sentinelIntersecting) return;
    if (!nextCursor || lastSentinelCursor === nextCursor) return;
    lastSentinelCursor = nextCursor;
    requestLoadMore(nextCursor);
  }
  function rearmSentinel() {
    if (!sentinelIntersecting || !observer || !observedTarget || !nextCursor) return;
    queueMicrotask(() => {
      if (disposed || !active || !observer || !observedTarget) return;
      sentinelIntersecting = false;
      observer.disconnect();
      observer.observe(observedTarget);
    });
  }
  const onIntersection = (entries: readonly Pick<IntersectionObserverEntry, 'isIntersecting'>[]) => {
    if (disposed || !active) return;
    sentinelIntersecting = entries.some((entry) => entry.isIntersecting);
    if (!sentinelIntersecting) return;
    requestNextFromSentinel();
  };
  const observeSentinel = (target: HTMLDivElement | null) => {
    if (disposed) return;
    sentinelRef.current = target;
    if (target === observedTarget) return;
    observedTarget = target;
    observer ??= observerFactory(onIntersection);
    observer?.disconnect();
    if (target) observer?.observe(target);
  };

  const publicController: DiscoveryController<T, Sort, State> = {
    get state() { return view.state; },
    get items() { return view.items; },
    get facets() { return view.facets; },
    get totalCount() { return view.totalCount; },
    get loading() { return view.loading; },
    get loadingMore() { return view.loadingMore; },
    get error() { return view.error; },
    get loadMoreError() { return view.loadMoreError; },
    get hasMore() { return view.hasMore; },
    sentinelRef,
    setState,
    setPlatform,
    setSort,
    setQuery,
    toggleFilter,
    clearFilterGroup,
    retry,
    retryLoadMore,
  };

  return {
    snapshot: () => view,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      if (active || disposed) return;
      active = true;
      requestFirstPage(view.state, false);
    },
    hydrate(locationSearch) {
      if (disposed) return;
      cancelQueryTimer();
      const state = adapter.parse(locationSearch);
      const canonical = adapter.serialize(state);
      if (firstInFlightCanonical === canonical) return;
      if (completedFirstPage?.canonical === canonical) {
        // A browser navigation supersedes any first page started for a
        // different canonical state; otherwise that response could overwrite
        // the restored snapshot after this method returns.
        invalidateRequests();
        nextCursor = completedFirstPage.nextCursor;
        failedLoadMoreCursor = null;
        lastSentinelCursor = null;
        update({
          state,
          items: completedFirstPage.items,
          facets: completedFirstPage.facets,
          totalCount: completedFirstPage.totalCount,
          hasMore: completedFirstPage.nextCursor !== null,
          loading: false,
          loadingMore: false,
          error: null,
          loadMoreError: null,
        });
        return;
      }
      requestFirstPage(state);
    },
    observeSentinel,
    stop() {
      if (!active) return;
      active = false;
      cancelQueryTimer();
      invalidateRequests();
      sentinelIntersecting = false;
      observedTarget = null;
      observer?.disconnect();
    },
    dispose() {
      disposed = true;
      active = false;
      cancelQueryTimer();
      firstAbort?.abort();
      loadMoreAbort?.abort();
      observer?.disconnect();
      listeners.clear();
    },
    public: publicController,
  };
}

export function useDiscoveryController<
  T,
  Sort extends string,
  State extends DiscoveryState<Sort> = DiscoveryState<Sort>,
>(
  options: UseDiscoveryControllerOptions<T, Sort, State>,
): DiscoveryController<T, Sort, State> {
  const navigateRef = useRef(options.onNavigate);
  navigateRef.current = options.onNavigate;
  const controller = useMemo(
    () => createDiscoveryController({
      ...options,
      onNavigate: (search, mode) => navigateRef.current(search, mode),
    }),
    [options.adapter, options.queryDebounceMs, options.observerFactory],
  );
  const view = useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) controller.start();
    });
    return () => {
      cancelled = true;
      controller.stop();
    };
  }, [controller]);
  useEffect(() => {
    controller.hydrate(options.locationSearch);
  }, [controller, options.locationSearch]);
  useEffect(() => {
    controller.observeSentinel(controller.public.sentinelRef.current);
  });

  return {
    ...view,
    sentinelRef: controller.public.sentinelRef,
    setState: controller.public.setState,
    setPlatform: controller.public.setPlatform,
    setSort: controller.public.setSort,
    setQuery: controller.public.setQuery,
    toggleFilter: controller.public.toggleFilter,
    clearFilterGroup: controller.public.clearFilterGroup,
    retry: controller.public.retry,
    retryLoadMore: controller.public.retryLoadMore,
  };
}
