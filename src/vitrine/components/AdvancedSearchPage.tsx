import { useState } from "react";
import { Button, TextInput } from "@astryxdesign/core";
import type { CatalogComparison } from "../../catalogResearch.ts";
import type { SearchFilters, SearchResultItem, SearchType } from "../../searchTypes.ts";
import { compatibleFilterKeys } from "../../searchScope.ts";
import { useAdvancedSearch } from "../useAdvancedSearch.ts";
import {
  parseSearchState,
  parseComparisonApps,
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
import { compareCatalogApps } from "../researchApi.ts";
import { CopyButton } from "./CopyButton.tsx";
import { InspirationComparison } from "./InspirationComparison.tsx";

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
  const locationSearch = queryIndex < 0 ? "" : location.slice(queryIndex);
  const state = parseSearchState(locationSearch);
  const sharedComparisonApps = parseComparisonApps(locationSearch);
  const comparisonApps = comparison.length
    ? comparison.flatMap(({ appName }) => appName ? [appName] : [])
    : sharedComparisonApps;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [comparisonView, setComparisonView] = useState<CatalogComparison | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState("");
  const search = useAdvancedSearch(state);
  const commit = (next: SearchPageState, push = true) => {
    if (typeof window !== "undefined") {
      const query = serializeSearchState(next, comparisonApps);
      updateLocation(
        `/search${query ? `?${query}` : ""}`,
        { replace: !push },
      );
    }
  };
  const commitComparison = (items: SearchResultItem[], appNames: string[]) => {
    onComparisonChange(items);
    setComparisonView(null);
    setComparisonError("");
    const query = serializeSearchState(state, appNames);
    updateLocation(`/search${query ? `?${query}` : ""}`);
  };
  const openComparison = async () => {
    if (comparisonApps.length < 2) return;
    setComparisonLoading(true);
    setComparisonError("");
    try {
      setComparisonView(await compareCatalogApps(comparisonApps));
    } catch (error) {
      setComparisonError((error as Error).message);
    } finally {
      setComparisonLoading(false);
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
        <CopyButton
          label="Copy search link"
          successMessage="Search link copied"
          action={async () => {
            const query = serializeSearchState(state, comparisonApps);
            const href = `${window.location.origin}/search${query ? `?${query}` : ""}`;
            await navigator.clipboard.writeText(href);
          }}
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
                comparisonAppNames={comparisonApps}
                onToggleCompare={(item) => {
                  if (item.catalogScope !== "apps" || item.appId === undefined) return;
                  const appName = item.appName;
                  if (!appName) return;
                  if (comparisonApps.includes(appName)) {
                    commitComparison(
                      comparison.filter(({ appId, appName: selectedName }) =>
                        appId !== item.appId && selectedName !== appName),
                      comparisonApps.filter((name) => name !== appName),
                    );
                    return;
                  }
                  if (comparisonApps.length >= 5) return;
                  try {
                    commitComparison(
                      addComparisonSelection(comparison, item),
                      [...comparisonApps, appName],
                    );
                  } catch {}
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
      {comparisonView ? (
        <section className="advanced-search-comparison" aria-label="Search comparison">
          <InspirationComparison
            comparison={comparisonView}
            onBack={() => setComparisonView(null)}
            backLabel="Back to search"
            title="Compare selected apps"
          />
        </section>
      ) : null}
      {comparisonApps.length ? (
        <div className="advanced-search-comparison-tray" role="status">
          <span>{comparisonApps.join(" · ")}</span>
          <Button
            label="Compare selected"
            variant="primary"
            isDisabled={comparisonApps.length < 2}
            isLoading={comparisonLoading}
            onClick={() => void openComparison()}
          />
          <Button label="Clear" variant="ghost" onClick={() => commitComparison([], [])} />
          {comparisonError ? <span role="alert">{comparisonError}</span> : null}
        </div>
      ) : null}
    </main>
  );
}
