import { useState } from "react";
import { Button } from "@astryxdesign/core";
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
import { DiscoveryFilterMenu, type DiscoveryFilterGroup } from "./AppsFilterBar.tsx";

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
  const quickKeys = quickFilterKeys(state.scope);
  const types = (Object.keys(typeLabels) as SearchType[])
    .filter((type) => type === "all" || (typeCounts[type] ?? 0) > 0);

  return (
    <div className="quick-search__filter-controls">
      <div className="quick-search__scope" role="tablist" aria-label="Search scope">
        {(["apps", "sites", "all"] as const).map((scope) => (
          <Button
            label={scopeLabels[scope]}
            variant="ghost"
            size="sm"
            role="tab"
            aria-selected={state.scope === scope}
            tabIndex={state.scope === scope ? 0 : -1}
            key={scope}
            onClick={() => onChange(switchSearchScope(state, scope))}
          />
        ))}
      </div>
      <div className="quick-search__quick-filters">
        {quickKeys.map((key) => {
          const options = facets[key] ?? [];
          const selected = state.filters[key];
          const group: DiscoveryFilterGroup = {
            id: `quick-search-${key}`,
            label: filterLabels[key],
            selected,
            options: options.map(({ value, count }) => ({
              value,
              count,
              section: filterLabels[key],
            })),
          };
          return (
            <QuickSearchFilterMenu
              key={key}
              group={group}
              onChange={(value) => onChange({
                ...state,
                filters: {
                  ...state.filters,
                  [key]: toggleFilterValue(selected, value),
                },
              })}
              onClear={() => onChange({
                ...state,
                filters: { ...state.filters, [key]: [] },
              })}
            />
          );
        })}
        {state.scope === "all" ? (
          <QuickSearchResultTypeMenu
            type={state.type}
            types={types}
            typeCounts={typeCounts}
            onChange={(type) => onChange({ ...state, type })}
          />
        ) : null}
        <Button
          label="More filters"
          variant="ghost"
          size="sm"
          className="quick-search__filter-chip"
          onClick={onOpenMore}
        />
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

function QuickSearchResultTypeMenu({
  type,
  types,
  typeCounts,
  onChange,
}: {
  type: SearchType;
  types: SearchType[];
  typeCounts: AdvancedSearchResult["typeCounts"];
  onChange(type: SearchType): void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = type === "all" ? [] : [typeLabels[type]];
  const group: DiscoveryFilterGroup = {
    id: "quick-search-result-type",
    label: "Result type",
    selected,
    options: types
      .filter((option) => option !== "all")
      .map((option) => ({
        value: typeLabels[option],
        count: typeCounts[option],
        section: "Result type",
      })),
  };
  return (
    <DiscoveryFilterMenu
      group={group}
      open={open}
      query={query}
      preview={null}
      filterClassName="quick-search__filter"
      onToggleOpen={() => {
        setQuery("");
        setOpen((current) => !current);
      }}
      onQueryChange={setQuery}
      onPreview={() => undefined}
      onToggleOption={(option) => {
        const next = types.find((candidate) => typeLabels[candidate] === option.value);
        if (next) onChange(next);
      }}
      onClear={() => onChange("all")}
    />
  );
}

function QuickSearchFilterMenu({
  group,
  onChange,
  onClear,
}: {
  group: DiscoveryFilterGroup;
  onChange(value: string): void;
  onClear(): void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  return (
    <DiscoveryFilterMenu
      group={group}
      open={open}
      query={query}
      preview={null}
      filterClassName="quick-search__filter"
      onToggleOpen={() => {
        setQuery("");
        setOpen((current) => !current);
      }}
      onQueryChange={setQuery}
      onPreview={() => undefined}
      onToggleOption={(option) => onChange(option.value)}
      onClear={onClear}
    />
  );
}
