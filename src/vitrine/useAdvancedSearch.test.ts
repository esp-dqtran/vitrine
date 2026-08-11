import assert from "node:assert/strict";
import { test } from "node:test";
import type { AdvancedSearchResult, SearchResultItem } from "../searchTypes.ts";
import {
  createAdvancedSearchController,
  hasAdvancedSearchIntent,
  type AdvancedSearchClient,
} from "./useAdvancedSearch.ts";
import { defaultSearchState, type SearchPageState } from "./searchState.ts";

const emptyFacets = {
  platform: [], app: [], appCategory: [], pageType: [], productArea: [],
  flow: [], component: [], state: [], theme: [], layout: [],
  siteSection: [], siteStyle: [],
};

function item(documentId: string, title = documentId): SearchResultItem {
  return {
    documentId,
    indexVersion: 1,
    catalogScope: "apps",
    catalogName: "Linear",
    versionId: 1,
    appId: 1,
    appName: "Linear",
    catalogCategories: [],
    siteSections: [],
    siteStyles: [],
    platform: "web",
    entityType: "screen",
    sourceId: documentId,
    title,
    description: "",
    aliases: [],
    visibleText: "",
    components: [],
    states: [],
    layoutPatterns: [],
    publishedAt: "2026-07-23T00:00:00.000Z",
    sourcePayload: {},
    matchedContext: [],
  };
}

function resultPage(ids: string[], nextCursor: string | null): AdvancedSearchResult {
  return {
    requestId: "request",
    items: ids.map((id) => item(id)),
    facets: emptyFacets,
    typeCounts: { app: 0, site: 0, screen: ids.length, flow: 0, component: 0, pattern: 0 },
    nextCursor,
    hasMore: !!nextCursor,
    degraded: false,
  };
}

function state(input: Partial<SearchPageState>): SearchPageState {
  return { ...defaultSearchState, ...input };
}

test("does not search until the Quick Search dialog has input or an explicit filter", () => {
  assert.equal(hasAdvancedSearchIntent(defaultSearchState), false);
  assert.equal(hasAdvancedSearchIntent(state({ query: "checkout" })), true);
  assert.equal(hasAdvancedSearchIntent(state({
    filters: { ...emptyFacets, appCategory: ["Finance"] },
  })), true);
});

test("discards an older response after search state changes", async () => {
  const pending: Array<(value: AdvancedSearchResult) => void> = [];
  const client: AdvancedSearchClient = () => new Promise((resolve) => pending.push(resolve));
  const controller = createAdvancedSearchController(client);
  const first = controller.search(state({ query: "checkout" }));
  const second = controller.search(state({ query: "onboarding" }));
  pending[0](resultPage(["old"], null));
  pending[1]({ ...resultPage(["new"], null), items: [item("new", "new")] });
  await Promise.all([first, second]);
  assert.equal(controller.snapshot().result?.items[0].title, "new");
});

test("appends cursor results without duplicates", async () => {
  const client: AdvancedSearchClient = async (_state, cursor) =>
    cursor
      ? resultPage(["screen:2", "screen:3"], null)
      : resultPage(["screen:1", "screen:2"], "next-1");
  const controller = createAdvancedSearchController(client);
  await controller.search(state({ query: "checkout" }));
  await controller.loadMore();
  assert.deepEqual(
    controller.snapshot().result?.items.map(({ documentId }) => documentId),
    ["screen:1", "screen:2", "screen:3"],
  );
});

test("retry failure preserves previously loaded items", async () => {
  let fail = false;
  const client: AdvancedSearchClient = async () => {
    if (fail) throw new Error("search unavailable");
    return resultPage(["screen:1"], null);
  };
  const controller = createAdvancedSearchController(client);
  await controller.search(state({ query: "checkout" }));
  fail = true;
  await controller.retry();
  assert.deepEqual(
    controller.snapshot().result?.items.map(({ documentId }) => documentId),
    ["screen:1"],
  );
  assert.equal(controller.snapshot().error, "search unavailable");
});

test("retains the previous result while a replacement search loads", async () => {
  let resolveReplacement: ((value: AdvancedSearchResult) => void) | undefined;
  const client: AdvancedSearchClient = async (nextState) => {
    if (nextState.query === "first") return resultPage(["screen:1"], null);
    return new Promise((resolve) => { resolveReplacement = resolve; });
  };
  const controller = createAdvancedSearchController(client);
  await controller.search(state({ query: "first" }));

  const replacement = controller.search(state({ query: "second" }));
  assert.equal(controller.snapshot().loading, true);
  assert.deepEqual(
    controller.snapshot().result?.items.map(({ documentId }) => documentId),
    ["screen:1"],
  );

  resolveReplacement?.(resultPage(["screen:2"], null));
  await replacement;
});
