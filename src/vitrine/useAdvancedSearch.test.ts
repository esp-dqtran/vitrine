import assert from "node:assert/strict";
import { test } from "node:test";
import type { AdvancedSearchResult, SearchResultItem } from "../searchTypes.ts";
import {
  createAdvancedSearchController,
  type AdvancedSearchClient,
} from "./useAdvancedSearch.ts";
import { defaultSearchState, type SearchPageState } from "./searchState.ts";

const emptyFacets = {
  platform: [], app: [], appCategory: [], pageType: [], productArea: [],
  flow: [], component: [], state: [], theme: [], layout: [],
};

function item(documentId: string, title = documentId): SearchResultItem {
  return {
    documentId,
    indexVersion: 1,
    versionId: 1,
    appId: 1,
    appName: "Linear",
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
    typeCounts: { app: 0, screen: ids.length, flow: 0, component: 0, pattern: 0 },
    nextCursor,
    hasMore: !!nextCursor,
    degraded: false,
  };
}

function state(input: Partial<SearchPageState>): SearchPageState {
  return { ...defaultSearchState, ...input };
}

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
