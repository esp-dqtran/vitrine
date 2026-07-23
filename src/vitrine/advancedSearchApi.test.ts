import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  loadSearchSuggestions,
  searchAdvancedCatalog,
} from "./advancedSearchApi.ts";
import {
  defaultSearchState,
  emptySearchFilters,
} from "./searchState.ts";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test("requests repeated filter parameters and an opaque cursor", async () => {
  let requested = "";
  globalThis.fetch = async (url) => {
    requested = String(url);
    return new Response(JSON.stringify({
      requestId: "1",
      items: [],
      facets: {},
      typeCounts: {},
      nextCursor: null,
      hasMore: false,
      degraded: false,
    }), { status: 200 });
  };
  await searchAdvancedCatalog({
    ...defaultSearchState,
    filters: {
      ...emptySearchFilters,
      platform: ["ios", "android"],
    },
  }, "cursor-1");
  assert.equal(
    requested,
    "/api/search?type=all&platform=android&platform=ios&sort=relevance&cursor=cursor-1&limit=24",
  );
});

test("preserves API errors and requests bounded suggestions", async () => {
  const requested: string[] = [];
  globalThis.fetch = async (url) => {
    requested.push(String(url));
    return new Response(JSON.stringify({ error: "Upgrade required" }), { status: 403 });
  };
  await assert.rejects(() => loadSearchSuggestions("Lin"), /Upgrade required/);
  assert.equal(requested[0], "/api/search/suggestions?prefix=Lin&limit=10");
});

test("requests related results by stable source identity", async () => {
  let requested = "";
  globalThis.fetch = async (url) => {
    requested = String(url);
    return new Response(JSON.stringify({
      requestId: "1", items: [], facets: {}, typeCounts: {},
      nextCursor: null, hasMore: false, degraded: false,
    }), { status: 200 });
  };
  await loadSearchSuggestions;
  const { loadRelatedSearchResults } = await import("./advancedSearchApi.ts");
  await loadRelatedSearchResults("screen:101");
  assert.equal(requested, "/api/search?relatedTo=screen%3A101&type=all&limit=12");
});
