import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  QuickSearchFilters,
  switchSearchScope,
  toggleFilterValue,
} from "./components/QuickSearchFilters.tsx";
import {
  defaultSearchState,
  emptySearchFilters,
} from "./searchState.ts";

const facets = {
  ...Object.fromEntries(Object.keys(emptySearchFilters).map((key) => [key, []])),
  platform: [{ value: "ios", count: 12 }],
  appCategory: [{ value: "Finance", count: 8 }],
  siteSection: [{ value: "Pricing", count: 6 }],
  siteStyle: [{ value: "Minimal", count: 4 }],
} as never;

test("renders accessible scope, quick filters, More filters, and active pills", () => {
  const html = renderToStaticMarkup(
    <QuickSearchFilters
      state={{
        ...defaultSearchState,
        scope: "apps",
        filters: { ...emptySearchFilters, platform: ["ios"] },
      }}
      facets={facets}
      typeCounts={{ app: 2, site: 0, screen: 4, flow: 0, component: 0, pattern: 0 }}
      onChange={() => {}}
      onOpenMore={() => {}}
    />,
  );

  assert.match(html, /role="tablist" aria-label="Search scope"/);
  assert.match(html, /role="tab"[^>]+aria-selected="true"/);
  assert.match(html, />Apps</);
  assert.match(html, /aria-label="Filter \(1 selected\): ios"/);
  assert.match(html, /aria-label="Open App category filters"/);
  assert.match(html, />More filters</);
  assert.match(html, /aria-label="Active search filters"/);
  assert.match(html, />Clear all</);
});

test("uses the shared selected-filter control in Quick Search", () => {
  const html = renderToStaticMarkup(
    <QuickSearchFilters
      state={{
        ...defaultSearchState,
        scope: "apps",
        filters: { ...emptySearchFilters, platform: ["ios"] },
      }}
      facets={facets}
      typeCounts={{ app: 2, site: 0, screen: 4, flow: 0, component: 0, pattern: 0 }}
      onChange={() => {}}
      onOpenMore={() => {}}
    />,
  );

  assert.match(html, /apps-filterbar__filter--selected/);
  assert.match(html, /Clear Platform filter/);
});

test("switching to Sites prunes App-only filters and keeps compatible values", () => {
  const state = {
    ...defaultSearchState,
    scope: "apps" as const,
    filters: {
      ...emptySearchFilters,
      platform: ["ios"],
      appCategory: ["Finance"],
    },
  };

  const sites = switchSearchScope(state, "sites");
  assert.deepEqual(sites.filters.platform, []);
  assert.deepEqual(sites.filters.appCategory, ["Finance"]);
  assert.deepEqual(toggleFilterValue([], "Pricing"), ["Pricing"]);
  assert.deepEqual(toggleFilterValue(["Pricing"], "Pricing"), []);
});
