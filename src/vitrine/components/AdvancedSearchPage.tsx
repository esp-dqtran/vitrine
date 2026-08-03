import { useState } from "react";
import { Button, TextInput } from "@astryxdesign/core";
import type { SearchFilters, SearchResultItem, SearchType } from "../../searchTypes.ts";
import { compatibleFilterKeys } from "../../searchScope.ts";
import { useAdvancedSearch } from "../useAdvancedSearch.ts";
import {
  parseSearchState,
  recordRecentSearch,
  serializeSearchState,
  type SearchPageState,
} from "../searchState.ts";
import { updateLocation, useLocationKey } from "../router.ts";
import { ActiveSearchFilters } from "./ActiveSearchFilters.tsx";
import { AstryxSingleSelectDropdown } from "./AstryxDropdown.tsx";
import { AdvancedSearchFilterDrawer } from "./AdvancedSearchFilterDrawer.tsx";
import { AdvancedSearchFilters } from "./AdvancedSearchFilters.tsx";
import { AdvancedSearchResults } from "./AdvancedSearchResults.tsx";
import { addComparisonSelection } from "./SearchResearchActions.tsx";
import { switchSearchScope } from "./QuickSearchFilters.tsx";

const tabs: Array<[SearchType, string]> = [
  ["all", "All"],
  ["screen", "Screens"],
  ["flow", "Flows"],
  ["component", "UI Elements"],
  ["pattern", "Patterns"],
  ["app", "Apps"],
  ["site", "Sites"],
];

export function AdvancedSearchPage({
  onPreview = () => {},
  comparison = [],
  onComparisonChange = () => {},
}: {
  onPreview?(item: SearchResultItem): void;
  comparison?: SearchResultItem[];
  onComparisonChange?(items: SearchResultItem[]): void;
}) {
  const location = useLocationKey();
  const queryIndex = location.indexOf("?");
  const state = parseSearchState(queryIndex < 0 ? "" : location.slice(queryIndex));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const search = useAdvancedSearch(state);
  const commit = (next: SearchPageState, push = true) => {
    if (typeof window !== "undefined") {
      const query = serializeSearchState(next);
      updateLocation(
        `/search${query ? `?${query}` : ""}`,
        { replace: !push },
      );
    }
  };
  const applyFilters = (filters: SearchFilters) => commit({ ...state, filters });
  return (
    <main className="vitrine-page advanced-search-page">
      <header className="advanced-search-header">
        <div><span>Research library</span><h1>Search product experiences</h1></div>
        <form onSubmit={(event) => {
          event.preventDefault();
          if (typeof window !== "undefined") recordRecentSearch(window.localStorage, state.query);
          commit(state);
        }}>
          <TextInput
            label="Search the research library"
            isLabelHidden
            role="combobox"
            aria-expanded="false"
            value={state.query}
            onChange={(value) => commit({ ...state, query: value }, false)}
            placeholder="Try “dark mobile checkout with trust signals”"
            width="100%"
          />
        </form>
        <nav className="advanced-search-tabs" aria-label="Search scope" role="tablist">
          {(["apps", "sites", "all"] as const).map((scope) => (
            <Button
              key={scope}
              label={scope === "apps" ? "Apps" : scope === "sites" ? "Sites" : "All"}
              variant="ghost"
              size="sm"
              role="tab"
              aria-selected={state.scope === scope}
              tabIndex={state.scope === scope ? 0 : -1}
              onClick={() => commit(switchSearchScope(state, scope))}
            />
          ))}
        </nav>
        <nav className="advanced-search-tabs" aria-label="Result type" role="tablist">
          {tabs.map(([type, label]) => (
            <Button
              key={type}
              label={label}
              variant="ghost"
              size="sm"
              role="tab"
              aria-selected={state.type === type}
              tabIndex={state.type === type ? 0 : -1}
              onClick={() => commit({ ...state, type })}
            />
          ))}
        </nav>
      </header>
      <div className="advanced-search-toolbar">
        <Button label="Filters" variant="secondary" onClick={() => setFiltersOpen(true)} />
        <AstryxSingleSelectDropdown
          ariaLabel="Sort"
          triggerClassName="advanced-search-sort"
          value={state.sort}
          onChange={(value) => commit({
              ...state,
              sort: value as SearchPageState["sort"],
          })}
          options={[
            { value: "relevance", label: "Relevance" },
            { value: "recent", label: "Recently added" },
            { value: "app-az", label: "App A–Z" },
          ]}
        />
      </div>
      <ActiveSearchFilters filters={state.filters} onChange={applyFilters} />
      <div className="advanced-search-layout">
        {search.result ? (
          <AdvancedSearchFilters
            filters={state.filters}
            facets={search.result.facets}
            keys={compatibleFilterKeys(state.scope)}
            onChange={applyFilters}
          />
        ) : null}
        <section className="advanced-search-stream" aria-live="polite">
          {search.loading && !search.result ? <p>Searching…</p> : null}
          {search.error ? (
            <div className="advanced-search-error">
              <span>{search.error}</span>
              <Button label="Retry" size="sm" onClick={() => void search.retry()} />
            </div>
          ) : null}
          {search.result ? (
            <>
              {search.result.degraded ? <p className="advanced-search-degraded">Showing keyword results while semantic search is unavailable.</p> : null}
              <AdvancedSearchResults
                items={search.result.items}
                onPreview={onPreview}
                comparisonAppIds={comparison.flatMap(({ appId }) =>
                  appId === undefined ? [] : [appId])}
                onToggleCompare={(item) => {
                  if (item.catalogScope !== "apps" || item.appId === undefined) return;
                  if (comparison.some(({ appId }) => appId === item.appId)) {
                    onComparisonChange(comparison.filter(({ appId }) => appId !== item.appId));
                    return;
                  }
                  try { onComparisonChange(addComparisonSelection(comparison, item)); } catch {}
                }}
              />
              {search.result.hasMore ? (
                <Button
                  label="Load more"
                  isLoading={search.loadingMore}
                  onClick={() => void search.loadMore()}
                />
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
          keys={compatibleFilterKeys(state.scope)}
          onChange={applyFilters}
          onClose={() => setFiltersOpen(false)}
        />
      ) : null}
      {comparison.length ? (
        <div className="advanced-search-comparison-tray" role="status">
          <span>{comparison.length} {comparison.length === 1 ? "app" : "apps"} selected for comparison</span>
          <Button
            label="Compare selected"
            variant="primary"
            isDisabled={comparison.length < 2}
            onClick={() => window.open(
              `/api/compare?apps=${encodeURIComponent(comparison.flatMap(({ appName }) =>
                appName ? [appName] : []).join(","))}`,
              "_blank",
              "noopener,noreferrer",
            )}
          />
          <Button label="Clear" variant="ghost" onClick={() => onComparisonChange([])} />
        </div>
      ) : null}
    </main>
  );
}
