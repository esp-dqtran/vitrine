import { useState } from "react";
import {
  compatibleSearchFilters,
  quickFilterKeys,
} from "../../searchScope.ts";
import type {
  AdvancedSearchResult,
  SearchFacets,
  SearchFilters,
  SearchScope,
  SearchType,
} from "../../searchTypes.ts";
import type { SearchPageState } from "../searchState.ts";
import { ActiveSearchFilters } from "./ActiveSearchFilters.tsx";

const scopeLabels: Record<SearchScope, string> = {
  apps: "Apps",
  sites: "Sites",
  all: "All",
};

const filterLabels: Record<keyof SearchFilters, string> = {
  platform: "Platform",
  app: "App",
  appCategory: "App category",
  pageType: "Page type",
  productArea: "Product area",
  flow: "Flow",
  component: "UI element",
  state: "State",
  theme: "Theme",
  layout: "Layout",
  siteSection: "Sections",
  siteStyle: "Styles",
};

const typeLabels: Record<SearchType, string> = {
  all: "All types",
  app: "Apps",
  site: "Sites",
  screen: "Screens",
  flow: "Flows",
  component: "UI Elements",
  pattern: "Patterns",
};

export function toggleFilterValue(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((selected) => selected !== value)
    : [...values, value].sort((left, right) => left.localeCompare(right));
}

export function switchSearchScope(
  state: SearchPageState,
  scope: SearchScope,
): SearchPageState {
  const type = scope === "sites" && state.type !== "all" && state.type !== "site"
    ? "all"
    : scope === "apps" && state.type === "site"
      ? "all"
      : state.type;
  return {
    ...state,
    scope,
    type,
    filters: compatibleSearchFilters(scope, state.filters),
  };
}

export function QuickSearchFilters({
  state,
  facets,
  typeCounts,
  onChange,
  onOpenMore,
}: {
  state: SearchPageState;
  facets: SearchFacets;
  typeCounts: AdvancedSearchResult["typeCounts"];
  onChange(state: SearchPageState): void;
  onOpenMore(): void;
}) {
  const [openKey, setOpenKey] = useState<keyof SearchFilters | "type" | null>(null);
  const quickKeys = quickFilterKeys(state.scope);
  const types = (Object.keys(typeLabels) as SearchType[])
    .filter((type) => type === "all" || (typeCounts[type] ?? 0) > 0);

  return (
    <div className="quick-search__filter-controls">
      <div className="quick-search__scope" role="tablist" aria-label="Search scope">
        {(["apps", "sites", "all"] as const).map((scope) => (
          <button
            type="button"
            role="tab"
            aria-selected={state.scope === scope}
            tabIndex={state.scope === scope ? 0 : -1}
            key={scope}
            onClick={() => onChange(switchSearchScope(state, scope))}
          >
            {scopeLabels[scope]}
          </button>
        ))}
      </div>
      <div className="quick-search__quick-filters">
        {quickKeys.map((key) => {
          const options = facets[key] ?? [];
          const selected = state.filters[key];
          return (
            <div className="quick-search__filter-menu" key={key}>
              <button
                type="button"
                className="quick-search__filter-chip"
                aria-expanded={openKey === key}
                onClick={() => setOpenKey(openKey === key ? null : key)}
              >
                {filterLabels[key]}{selected.length ? ` · ${selected.length}` : ""}
              </button>
              {openKey === key ? (
                <div role="menu" aria-label={filterLabels[key]}>
                  {options.map(({ value, count }) => (
                    <button
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={selected.includes(value)}
                      key={value}
                      onClick={() => onChange({
                        ...state,
                        filters: {
                          ...state.filters,
                          [key]: toggleFilterValue(selected, value),
                        },
                      })}
                    >
                      <span>{value}</span><small>{count}</small>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
        {state.scope === "all" ? (
          <div className="quick-search__filter-menu">
            <button
              type="button"
              className="quick-search__filter-chip"
              aria-expanded={openKey === "type"}
              onClick={() => setOpenKey(openKey === "type" ? null : "type")}
            >
              Result type{state.type !== "all" ? ` · ${typeLabels[state.type]}` : ""}
            </button>
            {openKey === "type" ? (
              <div role="menu" aria-label="Result type">
                {types.map((type) => (
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={state.type === type}
                    key={type}
                    onClick={() => onChange({ ...state, type })}
                  >
                    <span>{typeLabels[type]}</span>
                    {type !== "all" ? <small>{typeCounts[type]}</small> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        <button
          type="button"
          className="quick-search__filter-chip"
          onClick={onOpenMore}
        >
          More filters
        </button>
      </div>
      <div className="quick-search__active-filters">
        <ActiveSearchFilters
          filters={state.filters}
          onChange={(filters) => onChange({ ...state, filters })}
        />
      </div>
    </div>
  );
}
