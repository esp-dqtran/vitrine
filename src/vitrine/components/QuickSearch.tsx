import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Button, TextInput } from "@astryxdesign/core";
import {
  compatibleFilterKeys,
} from "../../searchScope.ts";
import type {
  AdvancedSearchResult,
  SearchEntityType,
  SearchFacets,
  SearchResultItem,
} from "../../searchTypes.ts";
import { searchAdvancedCatalog } from "../advancedSearchApi.ts";
import {
  serializeSearchState,
  type SearchPageState,
} from "../searchState.ts";
import type { AdvancedSearchClient } from "../useAdvancedSearch.ts";
import { useAdvancedSearch } from "../useAdvancedSearch.ts";
import type { Route } from "../router.ts";
import { AdvancedSearchFilterDrawer } from "./AdvancedSearchFilterDrawer.tsx";
import { QuickSearchFilters } from "./QuickSearchFilters.tsx";

const labels: Record<SearchEntityType, string> = {
  app: "Apps",
  site: "Sites",
  screen: "Screens",
  flow: "Flows",
  component: "UI Elements",
  pattern: "Patterns",
};

const emptyFacets = (): SearchFacets => ({
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
  siteSection: [],
  siteStyle: [],
});

const emptyTypeCounts: AdvancedSearchResult["typeCounts"] = {
  app: 0,
  site: 0,
  screen: 0,
  flow: 0,
  component: 0,
  pattern: 0,
};

export function quickSearchHandoff(
  value: string | SearchPageState,
): { route: Route; search: string } {
  if (typeof value !== "string") {
    return { route: { name: "search" }, search: serializeSearchState(value) };
  }
  const params = new URLSearchParams();
  if (value.trim()) params.set("q", value.trim());
  return { route: { name: "search" }, search: params.toString() };
}

export function quickSearchKeyAction(
  key: string,
  index: number,
  length: number,
): number | string {
  if (key === "Tab" || key === "Shift+Tab") return "native-tab";
  if (key === "Escape") return "close";
  if (key === "Enter") return `open:${index}`;
  if (!length) return 0;
  if (key === "ArrowDown") return (index + 1) % length;
  if (key === "ArrowUp") return (index - 1 + length) % length;
  return index;
}

export function QuickSearch({
  state,
  recent = [],
  initialResult = null,
  client = searchAdvancedCatalog,
  onStateChange,
  onClose,
  onPreview,
  onViewAll,
}: {
  state: SearchPageState;
  recent?: string[];
  initialResult?: AdvancedSearchResult | null;
  client?: AdvancedSearchClient;
  onStateChange(state: SearchPageState): void;
  onClose(): void;
  onPreview(item: SearchResultItem): void;
  onViewAll(state: SearchPageState): void;
}) {
  const search = useAdvancedSearch(state, client);
  const [active, setActive] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  const result = search.result ?? initialResult;
  const groups = useMemo(() => {
    const grouped = new Map<SearchEntityType, SearchResultItem[]>();
    for (const item of result?.items ?? []) {
      const items = grouped.get(item.entityType) ?? [];
      if (items.length < 5) grouped.set(item.entityType, [...items, item]);
    }
    return [...grouped.entries()];
  }, [result]);
  const visible = groups.flatMap(([, items]) => items);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const key = event.shiftKey && event.key === "Tab" ? "Shift+Tab" : event.key;
    const action = quickSearchKeyAction(key, active, visible.length);
    if (action === "native-tab") return;
    if (action === "close") { event.preventDefault(); onClose(); return; }
    if (typeof action === "string" && action.startsWith("open:")) {
      const selected = visible[active];
      if (selected) { event.preventDefault(); onPreview(selected); }
      return;
    }
    if (typeof action === "number" && action !== active) {
      event.preventDefault();
      setActive(action);
    }
  };
  const updateQuery = (query: string) => onStateChange({ ...state, query });

  return (
    <div
      className="quick-search"
      role="dialog"
      aria-modal="true"
      aria-label="Quick Search"
      onKeyDown={onKeyDown}
    >
      <div className="quick-search__panel">
        <header>
          <TextInput
            label="Quick Search query"
            isLabelHidden
            role="combobox"
            aria-expanded={groups.length > 0}
            ref={input}
            value={state.query}
            onChange={updateQuery}
            placeholder="Search screens, flows, UI elements…"
            width="100%"
          />
          <Button label="Close" variant="ghost" onClick={onClose} />
        </header>
        <QuickSearchFilters
          state={state}
          facets={result?.facets ?? emptyFacets()}
          typeCounts={result?.typeCounts ?? emptyTypeCounts}
          onChange={onStateChange}
          onOpenMore={() => setFiltersOpen(true)}
        />
        {!state.query ? (
          <section>
            <h2>{recent.length ? "Recent searches" : "Try a research prompt"}</h2>
            {(recent.length ? recent : [
              "dark mobile checkout",
              "onboarding with progressive disclosure",
              "empty states for project tools",
            ]).map((value) => (
              <Button key={value} label={value} variant="ghost" onClick={() => updateQuery(value)} />
            ))}
          </section>
        ) : null}
        <div
          className="quick-search__results"
          aria-busy={search.loading}
          aria-live="polite"
        >
          {search.loading && !result ? <p>Searching…</p> : null}
          {search.error ? (
            <p role="alert">
              {search.error} <Button label="Retry" size="sm" onClick={() => void search.retry()} />
            </p>
          ) : null}
          {groups.map(([type, items]) => (
            <section key={type}>
              <h2>{labels[type]}</h2>
              {items.map((item) => {
                const index = visible.indexOf(item);
                return (
                  <Button
                    key={item.documentId}
                    label={`Preview ${item.title}`}
                    variant="ghost"
                    aria-selected={index === active}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => onPreview(item)}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.catalogName} · {item.platform}</span>
                  </Button>
                );
              })}
            </section>
          ))}
        </div>
        {state.query.trim() ? (
          <footer>
            <Button
              label={`View all results for “${state.query.trim()}”`}
              variant="ghost"
              onClick={() => onViewAll(state)}
            />
          </footer>
        ) : null}
      </div>
      <AdvancedSearchFilterDrawer
        open={filtersOpen}
        filters={state.filters}
        facets={result?.facets ?? emptyFacets()}
        keys={compatibleFilterKeys(state.scope)}
        onChange={(filters) => onStateChange({ ...state, filters })}
        onClose={() => setFiltersOpen(false)}
      />
    </div>
  );
}
