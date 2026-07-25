import assert from "node:assert/strict";
import { test } from "node:test";
import type { SearchAccess } from "../../../src/searchStore.ts";
import {
  createSearchService,
  hydrateSearchMedia,
  searchRequestFromExpressQuery,
  type SearchTelemetryEvent,
} from "./search.ts";
import {
  normalizeSearchRequest,
  type AdvancedSearchResult,
} from "../../../src/searchTypes.ts";

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
  siteSection: [],
  siteStyle: [],
};

function result() {
  return {
    requestId: "",
    items: [{
      documentId: "screen:1",
      indexVersion: 1 as const,
      catalogScope: "apps" as const,
      catalogName: "Linear",
      versionId: 1,
      appId: 1,
      appName: "Linear",
      catalogCategories: [],
      siteSections: [],
      siteStyles: [],
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
    typeCounts: { app: 0, site: 0, screen: 1, flow: 0, component: 0, pattern: 0 },
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
  const events: SearchTelemetryEvent[] = [];
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
  assert.equal(events[0].scope, "all");
  assert.equal(events[0].resultCount, 1);
  assert.equal(events[0].degraded, true);
  assert.equal("query" in events[0], false);
  assert.equal(JSON.stringify(events[0]).includes("private acquisition"), false);
});

test("hydrates Site results through the authorized preview route", () => {
  const response = result() as AdvancedSearchResult;
  response.items = [{
    ...response.items[0],
    documentId: "site:7",
    catalogScope: "sites",
    catalogName: "V7",
    siteId: 7,
    siteVersionId: 11,
    entityType: "site",
    sourceId: "site:7",
    sourcePayload: { objectKey: "private/preview.png" },
  }];

  const [item] = hydrateSearchMedia(response).items;
  assert.equal(item.imageUrl, "/api/sites/7/versions/11/media/preview");
  assert.equal(item.thumbnailUrl, "/api/sites/7/versions/11/media/preview");
  assert.equal("objectKey" in item.sourcePayload, false);
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

test("accepts scoped Site filters", () => {
  const scoped = searchRequestFromExpressQuery({
    q: "pricing",
    scope: "sites",
    type: "site",
    siteSection: ["Pricing"],
    siteStyle: "Minimal",
  });

  assert.equal(scoped.scope, "sites");
  assert.deepEqual(scoped.filters.siteSection, ["Pricing"]);
  assert.deepEqual(scoped.filters.siteStyle, ["Minimal"]);
});

test("rejects unknown search scope", () => {
  assert.throws(
    () => searchRequestFromExpressQuery({ scope: "private" }),
    /invalid search scope/,
  );
});
