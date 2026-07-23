import {
  SEARCH_ENTITY_TYPES,
  type SearchFilters,
  type SearchSort,
  type SearchType,
} from "../searchTypes.ts";

export interface SearchPageState {
  query: string;
  type: SearchType;
  filters: SearchFilters;
  sort: SearchSort;
}

export const emptySearchFilters: SearchFilters = {
  platform: [],
  app: [],
  appCategory: [],
  pageType: [],
  productArea: [],
  flow: [],
  component: [],
  state: [],
  theme: [],
  layout: [],
};

export const defaultSearchState: SearchPageState = {
  query: "",
  type: "all",
  filters: emptySearchFilters,
  sort: "relevance",
};

const filterKeys = Object.keys(emptySearchFilters) as Array<keyof SearchFilters>;
const recentSearchesKey = "astryx:recent-searches:v1";

function canonical(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
}

export function parseSearchState(search: string): SearchPageState {
  const params = new URLSearchParams(search);
  const typeValue = params.get("type") ?? "all";
  const type: SearchType = typeValue === "all"
    || SEARCH_ENTITY_TYPES.includes(typeValue as never)
    ? typeValue as SearchType
    : "all";
  const sortValue = params.get("sort") ?? "relevance";
  const sort: SearchSort = ["relevance", "recent", "app-az"].includes(sortValue)
    ? sortValue as SearchSort
    : "relevance";
  return {
    query: (params.get("q") ?? "").trim().slice(0, 500),
    type,
    filters: Object.fromEntries(
      filterKeys.map((key) => [key, canonical(params.getAll(key))]),
    ) as unknown as SearchFilters,
    sort,
  };
}

export function serializeSearchState(state: SearchPageState): string {
  const params = new URLSearchParams();
  if (state.query.trim()) params.set("q", state.query.trim());
  if (state.type !== "all") params.set("type", state.type);
  for (const key of filterKeys) {
    for (const value of canonical(state.filters[key])) params.append(key, value);
  }
  if (state.sort !== "relevance") params.set("sort", state.sort);
  return params.toString();
}

export function readRecentSearches(storage: Storage): string[] {
  try {
    const parsed = JSON.parse(storage.getItem(recentSearchesKey) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string").slice(0, 10)
      : [];
  } catch {
    return [];
  }
}

export function recordRecentSearch(storage: Storage, query: string): string[] {
  const normalized = query.trim();
  if (!normalized) return readRecentSearches(storage);
  const values = [
    normalized,
    ...readRecentSearches(storage).filter((value) =>
      value.toLocaleLowerCase() !== normalized.toLocaleLowerCase()),
  ].slice(0, 10);
  storage.setItem(recentSearchesKey, JSON.stringify(values));
  return values;
}

export function clearRecentSearches(storage: Storage): void {
  storage.removeItem(recentSearchesKey);
}
