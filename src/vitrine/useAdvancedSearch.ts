import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { AdvancedSearchResult } from "../searchTypes.ts";
import { searchAdvancedCatalog } from "./advancedSearchApi.ts";
import {
  serializeSearchState,
  type SearchPageState,
} from "./searchState.ts";

export type AdvancedSearchClient = (
  state: SearchPageState,
  cursor?: string,
  signal?: AbortSignal,
) => Promise<AdvancedSearchResult>;

export interface AdvancedSearchViewState {
  result: AdvancedSearchResult | null;
  loading: boolean;
  loadingMore: boolean;
  error: string;
  revision: number;
}

export function createAdvancedSearchController(client: AdvancedSearchClient) {
  let view: AdvancedSearchViewState = {
    result: null,
    loading: false,
    loadingMore: false,
    error: "",
    revision: 0,
  };
  let currentState: SearchPageState | null = null;
  let abort: AbortController | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());
  const update = (next: Partial<AdvancedSearchViewState>) => {
    view = { ...view, ...next };
    emit();
  };

  const run = async (
    state: SearchPageState,
    cursor?: string,
    append = false,
  ) => {
    abort?.abort();
    abort = new AbortController();
    const revision = view.revision + 1;
    currentState = state;
    update({
      revision,
      error: "",
      loading: !append,
      loadingMore: append,
    });
    try {
      const result = await client(state, cursor, abort.signal);
      if (view.revision !== revision) return;
      if (append && view.result) {
        const seen = new Set(view.result.items.map(({ documentId }) => documentId));
        result.items = [
          ...view.result.items,
          ...result.items.filter(({ documentId }) => !seen.has(documentId)),
        ];
      }
      update({ result, loading: false, loadingMore: false });
    } catch (error) {
      if (view.revision !== revision || (error as Error).name === "AbortError") return;
      update({
        loading: false,
        loadingMore: false,
        error: error instanceof Error ? error.message : "Search unavailable",
      });
    }
  };

  return {
    snapshot: () => view,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    search(state: SearchPageState) {
      return run(state);
    },
    retry() {
      return currentState ? run(currentState) : Promise.resolve();
    },
    loadMore() {
      const cursor = view.result?.nextCursor;
      return currentState && cursor
        ? run(currentState, cursor, true)
        : Promise.resolve();
    },
    dispose() {
      abort?.abort();
      listeners.clear();
    },
  };
}

export function useAdvancedSearch(
  state: SearchPageState,
  client: AdvancedSearchClient = searchAdvancedCatalog,
): AdvancedSearchViewState & {
  retry(): Promise<void>;
  loadMore(): Promise<void>;
} {
  const controller = useMemo(() => createAdvancedSearchController(client), [client]);
  const serialized = serializeSearchState(state);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void controller.search(state);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [controller, serialized]);
  useEffect(() => () => controller.dispose(), [controller]);
  const view = useSyncExternalStore(
    controller.subscribe,
    controller.snapshot,
    controller.snapshot,
  );
  return {
    ...view,
    retry: controller.retry,
    loadMore: controller.loadMore,
  };
}
