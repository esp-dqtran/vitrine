import assert from "node:assert/strict";
import { test } from "node:test";
import type { SearchAccess } from "../../../src/searchStore.ts";
import {
  createSearchService,
  searchRequestFromExpressQuery,
} from "./search.ts";
import { normalizeSearchRequest } from "../../../src/searchTypes.ts";

const request = normalizeSearchRequest({ q: "checkout" });
const access: SearchAccess = { publishedOnly: true };

const emptyFacets = {
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
};

function result() {
  return {
    requestId: "",
    items: [{
      documentId: "screen:1",
      indexVersion: 1 as const,
      versionId: 1,
      appId: 1,
      appName: "Linear",
      platform: "web",
      entityType: "screen" as const,
      sourceId: "screen:1",
      title: "Checkout",
      description: "",
      aliases: [],
      visibleText: "",
      components: [],
      states: [],
      layoutPatterns: [],
      publishedAt: "2026-07-23T00:00:00.000Z",
      mediaImageId: 1,
      sourcePayload: { imageUrl: "https://storage.test/private.png", objectKey: "private/key" },
      matchedContext: [],
    }],
    facets: emptyFacets,
    typeCounts: { app: 0, screen: 1, flow: 0, component: 0, pattern: 0 },
    nextCursor: null,
    hasMore: false,
    degraded: false,
  };
}

test("returns keyword results with degraded true when query embeddings fail", async () => {
  const service = createSearchService({
    store: {
      search: async () => result(),
      suggest: async () => [],
    },
    embedder: {
      model: "fixture",
      embed: async () => { throw new Error("offline"); },
    },
  });
  const response = await service.search(request, access);
  assert.equal(response.degraded, true);
  assert.equal(response.items.length, 1);
});

test("does not record raw query text", async () => {
  const events: Array<Record<string, unknown>> = [];
  const service = createSearchService({
    store: {
      search: async () => result(),
      suggest: async () => [],
    },
    embedder: null,
    telemetry: { record: (event) => { events.push(event); } },
    now: (() => {
      let value = 100;
      return () => value += 5;
    })(),
  });
  await service.search(
    { ...request, query: "private acquisition research" },
    access,
  );
  assert.equal(events.length, 1);
  assert.equal(events[0].action, "adaptive-search");
  assert.equal(events[0].resultCount, 1);
  assert.equal(events[0].degraded, true);
  assert.equal("query" in events[0], false);
  assert.equal(JSON.stringify(events[0]).includes("private acquisition"), false);
});

test("strictly validates public search query parameters", () => {
  assert.throws(() => searchRequestFromExpressQuery({ type: "token" }), /invalid search type/);
  assert.throws(() => searchRequestFromExpressQuery({ sort: "popular" }), /invalid search sort/);
  assert.throws(() => searchRequestFromExpressQuery({ limit: "500" }), /invalid search limit/);
  assert.deepEqual(
    searchRequestFromExpressQuery({ platform: ["ios", "android"] }).filters.platform,
    ["android", "ios"],
  );
});
