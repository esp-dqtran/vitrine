import { useState } from "react";
import type { SearchFilters, SearchResultItem, SearchType } from "../../searchTypes.ts";
import { useAdvancedSearch } from "../useAdvancedSearch.ts";
import {
  parseSearchState,
  recordRecentSearch,
  serializeSearchState,
  type SearchPageState,
} from "../searchState.ts";
import { ActiveSearchFilters } from "./ActiveSearchFilters.tsx";
import { AdvancedSearchFilterDrawer } from "./AdvancedSearchFilterDrawer.tsx";
import { AdvancedSearchFilters } from "./AdvancedSearchFilters.tsx";
import { AdvancedSearchResults } from "./AdvancedSearchResults.tsx";
import { addComparisonSelection } from "./SearchResearchActions.tsx";

const tabs: Array<[SearchType, string]> = [
  ["all", "All"],
  ["screen", "Screens"],
  ["flow", "Flows"],
  ["component", "UI Elements"],
  ["pattern", "Patterns"],
  ["app", "Apps"],
];

function initialSearchState(): SearchPageState {
  return typeof window === "undefined"
    ? parseSearchState("")
    : parseSearchState(window.location.search);
}

export function AdvancedSearchPage({
  onPreview = () => {},
  comparison = [],
  onComparisonChange = () => {},
}: {
  onPreview?(item: SearchResultItem): void;
  comparison?: SearchResultItem[];
  onComparisonChange?(items: SearchResultItem[]): void;
}) {
  const [state, setState] = useState(initialSearchState);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const search = useAdvancedSearch(state);
  const commit = (next: SearchPageState, push = true) => {
    setState(next);
    if (typeof window !== "undefined") {
      const query = serializeSearchState(next);
      window.history[push ? "pushState" : "replaceState"](
        null,
        "",
        `/search${query ? `?${query}` : ""}`,
      );
    }
  };
  const applyFilters = (filters: SearchFilters) => commit({ ...state, filters });
  return (
    <main className="advanced-search-page">
      <header className="advanced-search-header">
        <div><span>Research library</span><h1>Search product experiences</h1></div>
        <form onSubmit={(event) => {
          event.preventDefault();
          if (typeof window !== "undefined") recordRecentSearch(window.localStorage, state.query);
          commit(state);
        }}>
          <input
            role="combobox"
            aria-expanded="false"
            value={state.query}
            onChange={(event) => commit({ ...state, query: event.target.value }, false)}
            placeholder="Try “dark mobile checkout with trust signals”"
            aria-label="Search the research library"
          />
        </form>
        <nav className="advanced-search-tabs" aria-label="Result type" role="tablist">
          {tabs.map(([type, label]) => (
            <button
              key={type}
              type="button"
              role="tab"
              aria-selected={state.type === type}
              tabIndex={state.type === type ? 0 : -1}
              onClick={() => commit({ ...state, type })}
            >{label}</button>
          ))}
        </nav>
      </header>
      <div className="advanced-search-toolbar">
        <button type="button" onClick={() => setFiltersOpen(true)}>Filters</button>
        <label>Sort
          <select
            value={state.sort}
            onChange={(event) => commit({
              ...state,
              sort: event.target.value as SearchPageState["sort"],
            })}
          >
            <option value="relevance">Relevance</option>
            <option value="recent">Recently added</option>
            <option value="app-az">App A–Z</option>
          </select>
        </label>
      </div>
      <ActiveSearchFilters filters={state.filters} onChange={applyFilters} />
      <div className="advanced-search-layout">
        {search.result ? (
          <AdvancedSearchFilters
            filters={state.filters}
            facets={search.result.facets}
            onChange={applyFilters}
          />
        ) : null}
        <section className="advanced-search-stream" aria-live="polite">
          {search.loading && !search.result ? <p>Searching…</p> : null}
          {search.error ? (
            <div className="advanced-search-error">
              <span>{search.error}</span>
              <button type="button" onClick={() => void search.retry()}>Retry</button>
            </div>
          ) : null}
          {search.result ? (
            <>
              {search.result.degraded ? <p className="advanced-search-degraded">Showing keyword results while semantic search is unavailable.</p> : null}
              <AdvancedSearchResults
                items={search.result.items}
                onPreview={onPreview}
                comparisonAppIds={comparison.map(({ appId }) => appId)}
                onToggleCompare={(item) => {
                  if (comparison.some(({ appId }) => appId === item.appId)) {
                    onComparisonChange(comparison.filter(({ appId }) => appId !== item.appId));
                    return;
                  }
                  try { onComparisonChange(addComparisonSelection(comparison, item)); } catch {}
                }}
              />
              {search.result.hasMore ? (
                <button type="button" onClick={() => void search.loadMore()} disabled={search.loadingMore}>
                  {search.loadingMore ? "Loading…" : "Load more"}
                </button>
              ) : null}
            </>
          ) : null}
        </section>
      </div>
      {search.result ? (
        <AdvancedSearchFilterDrawer
          open={filtersOpen}
          filters={state.filters}
          facets={search.result.facets}
          onApply={applyFilters}
          onClose={() => setFiltersOpen(false)}
        />
      ) : null}
      {comparison.length ? (
        <div className="advanced-search-comparison-tray" role="status">
          <span>{comparison.length} {comparison.length === 1 ? "app" : "apps"} selected for comparison</span>
          <button
            type="button"
            disabled={comparison.length < 2}
            onClick={() => window.open(
              `/api/compare?apps=${encodeURIComponent(comparison.map(({ appName }) => appName).join(","))}`,
              "_blank",
              "noopener,noreferrer",
            )}
          >Compare selected</button>
          <button type="button" onClick={() => onComparisonChange([])}>Clear</button>
        </div>
      ) : null}
    </main>
  );
}
