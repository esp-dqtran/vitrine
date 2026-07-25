import type { SearchFilters, SearchScope } from "./searchTypes.ts";

const ALL_KEYS = [
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
  "siteSection",
  "siteStyle",
] as const satisfies ReadonlyArray<keyof SearchFilters>;

const COMPATIBLE: Record<SearchScope, ReadonlySet<keyof SearchFilters>> = {
  apps: new Set([
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
  ]),
  sites: new Set(["appCategory", "siteSection", "siteStyle", "theme", "layout"]),
  all: new Set(ALL_KEYS),
};

const QUICK: Record<SearchScope, Array<keyof SearchFilters>> = {
  apps: ["platform", "appCategory", "pageType", "component", "flow"],
  sites: ["appCategory", "siteSection", "siteStyle"],
  all: ["platform", "app", "theme"],
};

export const quickFilterKeys = (scope: SearchScope) => [...QUICK[scope]];

export function compatibleSearchFilters(
  scope: SearchScope,
  filters: SearchFilters,
): SearchFilters {
  return Object.fromEntries(
    ALL_KEYS.map((key) => [key, COMPATIBLE[scope].has(key) ? [...filters[key]] : []]),
  ) as unknown as SearchFilters;
}

export const activeFilterCount = (filters: SearchFilters) =>
  ALL_KEYS.reduce((total, key) => total + filters[key].length, 0);
