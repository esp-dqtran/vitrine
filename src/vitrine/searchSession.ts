import {
  canonicalSearchFilterSeed,
  compatibleSearchFilters,
} from "../searchScope.ts";
import type {
  SearchFilters,
  SearchScope,
} from "../searchTypes.ts";
import type { SearchPageState } from "./searchState.ts";
import { defaultSearchState } from "./searchState.ts";

export interface SearchSessionSnapshot {
  open: boolean;
  state: SearchPageState;
}

export function createSearchSession(initial: SearchPageState) {
  let current: SearchSessionSnapshot = {
    open: false,
    state: {
      ...initial,
      filters: Object.fromEntries(
        Object.entries(initial.filters).map(([key, values]) => [key, [...values]]),
      ) as unknown as SearchFilters,
    },
  };
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());

  return {
    snapshot: () => current,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    open(scope: SearchScope, seed: Partial<SearchFilters> = {}) {
      const filters = compatibleSearchFilters(scope, current.state.filters);
      const canonicalSeed = canonicalSearchFilterSeed(seed);
      current = {
        open: true,
        state: {
          ...current.state,
          scope,
          filters: compatibleSearchFilters(scope, {
            ...filters,
            ...canonicalSeed,
          }),
        },
      };
      emit();
    },
    update(state: SearchPageState) {
      current = {
        ...current,
        state: {
          ...state,
          filters: compatibleSearchFilters(state.scope, state.filters),
        },
      };
      emit();
    },
    close() {
      current = {
        open: false,
        state: {
          ...defaultSearchState,
          filters: Object.fromEntries(
            Object.entries(defaultSearchState.filters).map(([key, values]) => [key, [...values]]),
          ) as unknown as SearchFilters,
        },
      };
      emit();
    },
  };
}
