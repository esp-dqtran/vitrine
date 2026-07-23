import type { AdvancedSearchResult, SearchFilters } from "../searchTypes.ts";
import type { SearchSuggestion } from "../searchStore.ts";
import type { SearchPageState } from "./searchState.ts";

const filterKeys: Array<keyof SearchFilters> = [
  "platform",
  "app",
  "appCategory",
  "pageType",
  "productArea",
  "flow",
  "component",
  "state",
  "theme",
  "layout",
];

async function json<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `${url} returned ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function searchAdvancedCatalog(
  state: SearchPageState,
  cursor?: string,
  signal?: AbortSignal,
): Promise<AdvancedSearchResult> {
  const params = new URLSearchParams();
  if (state.query) params.set("q", state.query);
  params.set("type", state.type);
  for (const key of filterKeys) {
    for (const value of [...state.filters[key]].sort()) params.append(key, value);
  }
  params.set("sort", state.sort);
  if (cursor) params.set("cursor", cursor);
  params.set("limit", "24");
  return json(`/api/search?${params}`, signal);
}

export function loadSearchSuggestions(
  prefix: string,
  signal?: AbortSignal,
): Promise<SearchSuggestion[]> {
  const params = new URLSearchParams({ prefix, limit: "10" });
  return json<{ items: SearchSuggestion[] }>(
    `/api/search/suggestions?${params}`,
    signal,
  ).then(({ items }) => items);
}

export function loadRelatedSearchResults(
  sourceId: string,
  signal?: AbortSignal,
): Promise<AdvancedSearchResult> {
  const params = new URLSearchParams({
    relatedTo: sourceId,
    type: "all",
    limit: "12",
  });
  return json(`/api/search?${params}`, signal);
}
