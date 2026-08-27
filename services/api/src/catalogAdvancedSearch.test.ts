import assert from "node:assert/strict";
import { test } from "node:test";
import {
  advancedSearchRequestFromQuery,
  decodeAdvancedSearchCursor,
  emptyAdvancedSearchResult,
  isAdvancedSearchQuery,
  mergeAdvancedSearchResults,
  siteAdvancedSearchResult,
} from "./catalogAdvancedSearch.ts";

test("recognizes and validates the URL-owned advanced search contract", () => {
  assert.equal(isAdvancedSearchQuery({ q: "checkout", scope: "apps" }), true);
  assert.equal(isAdvancedSearchQuery({ q: "checkout", kind: "screen" }), false);
  const request = advancedSearchRequestFromQuery({
    q: "checkout",
    scope: "apps",
    type: "screen",
    platform: ["web", "ios"],
    limit: "24",
  });
  assert.equal(request.query, "checkout");
  assert.deepEqual(request.filters.platform, ["ios", "web"]);
  assert.throws(() => advancedSearchRequestFromQuery({ type: "token" }), /invalid search type/);
});

test("maps Site catalog results and merges facets and type counts", () => {
  const apps = emptyAdvancedSearchResult(true);
  apps.typeCounts.screen = 2;
  apps.facets.appCategory = [{ value: "Business", count: 2 }];
  const sites = siteAdvancedSearchResult({
    sites: [{
      siteId: 7,
      versionId: 9,
      name: "Stripe",
      slug: "stripe",
      sourceUrl: "https://stripe.com",
      categories: ["Business"],
      styles: ["Minimal"],
      popularity: 4,
      label: "Latest",
      isLatest: true,
      pageCount: 3,
      sectionCount: 8,
      previewUrl: "/api/sites/7/versions/9/media/preview",
      isUpdated: false,
      previewMediaKind: "image",
      previews: [],
      updatedAt: "2026-08-01T00:00:00.000Z",
    }],
    totalCount: 1,
    nextPage: null,
    facets: [
      { group: "categories", value: "Business", count: 1 },
      { group: "styles", value: "Minimal", count: 1 },
    ],
  });
  const request = advancedSearchRequestFromQuery({ q: "stripe", scope: "all", limit: "24" });
  const merged = mergeAdvancedSearchResults(apps, sites, request);
  assert.equal(merged.items[0].entityType, "site");
  assert.equal(merged.typeCounts.screen, 2);
  assert.equal(merged.typeCounts.site, 1);
  assert.deepEqual(merged.facets.appCategory, [{ value: "Business", count: 3 }]);
  assert.deepEqual(merged.facets.siteStyle, [{ value: "Minimal", count: 1 }]);
});

test("keeps App and Site pagination in one opaque cursor", () => {
  const apps = emptyAdvancedSearchResult();
  apps.hasMore = true;
  apps.nextCursor = "typesense-catalog:2";
  const sites = emptyAdvancedSearchResult();
  sites.hasMore = true;
  sites.nextCursor = "typesense-site:3";
  const request = advancedSearchRequestFromQuery({ q: "checkout", scope: "all", limit: "24" });
  const merged = mergeAdvancedSearchResults(apps, sites, request);
  assert.ok(merged.nextCursor?.startsWith("catalog-mixed:"));
  assert.deepEqual(decodeAdvancedSearchCursor(merged.nextCursor ?? undefined), {
    appCursor: "typesense-catalog:2",
    sitePage: 3,
  });
  assert.throws(() => decodeAdvancedSearchCursor("catalog-mixed:not-json"), /invalid search cursor/);
});
