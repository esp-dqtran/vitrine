import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { AdvancedSearchResult, SearchResultItem } from "../searchTypes.ts";
import {
  QuickSearch,
  quickSearchHandoff,
  quickSearchKeyAction,
} from "./components/QuickSearch.tsx";

const base: SearchResultItem = {
  documentId: "screen:1", indexVersion: 1, versionId: 1, appId: 1, appName: "Linear",
  platform: "web", entityType: "screen", sourceId: "screen:1", title: "Checkout",
  description: "", aliases: [], visibleText: "", components: [], states: [], layoutPatterns: [],
  publishedAt: "", sourcePayload: {}, matchedContext: [],
};
const result: AdvancedSearchResult = {
  requestId: "1",
  items: [
    base,
    { ...base, documentId: "flow:1", sourceId: "flow:1", entityType: "flow", title: "Checkout flow" },
    { ...base, documentId: "component:1", sourceId: "component:1", entityType: "component", title: "Button" },
  ],
  facets: {} as never,
  typeCounts: { app: 0, screen: 1, flow: 1, component: 1, pattern: 0 },
  nextCursor: null, hasMore: false, degraded: false,
};
const props = (input: { initialQuery?: string; recent?: string[]; initialResult?: AdvancedSearchResult | null }) => ({
  ...input, onClose: () => {}, onPreview: () => {}, onViewAll: () => {},
});

test("shows recent searches only before the user types", () => {
  const html = renderToStaticMarkup(<QuickSearch {...props({ initialQuery: "", recent: ["checkout"] })} />);
  assert.match(html, /checkout/);
});

test("groups only top Quick Search results by entity type", () => {
  const html = renderToStaticMarkup(<QuickSearch {...props({ initialQuery: "check", initialResult: result })} />);
  assert.match(html, /Screens/);
  assert.match(html, /Flows/);
  assert.match(html, /UI Elements/);
});

test("View all hands the exact query to /search", () => {
  assert.deepEqual(quickSearchHandoff("dark checkout"), {
    route: { name: "search" },
    search: "q=dark+checkout",
  });
});

test("keyboard helpers preserve the modal contract", () => {
  assert.equal(quickSearchKeyAction("ArrowDown", 0, 3), 1);
  assert.equal(quickSearchKeyAction("ArrowUp", 0, 3), 2);
  assert.equal(quickSearchKeyAction("Enter", 1, 3), "open:1");
  assert.equal(quickSearchKeyAction("Escape", 1, 3), "close");
  assert.equal(quickSearchKeyAction("Tab", 1, 3), "native-tab");
  assert.equal(quickSearchKeyAction("Shift+Tab", 1, 3), "native-tab");
});
