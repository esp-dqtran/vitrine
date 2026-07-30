import assert from "node:assert/strict";
import test from "node:test";
import { parseSitesDiscoveryPage } from "./sitesPageParser.ts";

const summary = {
  siteId: 1,
  versionId: 2,
  name: "Linear",
  slug: "linear",
  routeSlug: "linear",
  sourceUrl: "https://linear.app/",
  description: "Plan and build products",
  logoUrl: null,
  categories: ["Business"],
  styles: ["Minimal"],
  popularity: 42,
  label: "Jul 2026",
  isLatest: true,
  pageCount: 8,
  sectionCount: 20,
  previewUrl: "/api/sites/1/versions/2/catalog-media/preview",
  previewMediaKind: "image",
  previews: [{
    id: 10,
    title: "Home",
    position: 0,
    url: "/api/sites/1/versions/2/catalog-media/posters/10",
  }],
  updatedAt: "2026-07-29T03:00:00.000Z",
};

test("parses every Site summary and facet field in the discovery envelope", () => {
  assert.deepEqual(parseSitesDiscoveryPage({
    items: [summary],
    nextCursor: "opaque",
    totalCount: 9,
    facets: [{
      group: "sections",
      value: "Pricing",
      count: 4,
      section: "Sections",
    }],
  }), {
    items: [{
      id: 1,
      versionId: 2,
      name: "Linear",
      slug: "linear",
      routeSlug: "linear",
      sourceUrl: "https://linear.app/",
      description: "Plan and build products",
      logoUrl: null,
      categories: ["Business"],
      styles: ["Minimal"],
      popularity: 42,
      label: "Jul 2026",
      isLatest: true,
      pageCount: 8,
      sectionCount: 20,
      previewUrl: "/api/sites/1/versions/2/catalog-media/preview",
      previewMediaKind: "image",
      previews: [{
        id: 10,
        title: "Home",
        position: 0,
        url: "/api/sites/1/versions/2/catalog-media/posters/10",
      }],
      updatedAt: "2026-07-29T03:00:00.000Z",
    }],
    nextCursor: "opaque",
    totalCount: 9,
    facets: [{
      group: "sections",
      value: "Pricing",
      count: 4,
      section: "Sections",
    }],
  });
});

test("rejects malformed Site page summaries, facets, and envelope fields", () => {
  const without = (key: keyof typeof summary) => {
    const copy: Record<string, unknown> = { ...summary };
    delete copy[key];
    return copy;
  };
  for (const body of [
    { items: [], nextCursor: null, totalCount: 0 },
    { items: [], nextCursor: 1, totalCount: 0, facets: [] },
    { items: [], nextCursor: "x".repeat(2_049), totalCount: 0, facets: [] },
    { items: [], nextCursor: null, totalCount: -1, facets: [] },
    { items: [{ ...summary, isLatest: "yes" }], nextCursor: null, totalCount: 1, facets: [] },
    { items: [{ ...summary, previewMediaKind: "gif" }], nextCursor: null, totalCount: 1, facets: [] },
    { items: [{ ...summary, categories: ["Business", 3] }], nextCursor: null, totalCount: 1, facets: [] },
    { items: [without("categories")], nextCursor: null, totalCount: 1, facets: [] },
    { items: [without("styles")], nextCursor: null, totalCount: 1, facets: [] },
    { items: [without("popularity")], nextCursor: null, totalCount: 1, facets: [] },
    { items: [without("previewMediaKind")], nextCursor: null, totalCount: 1, facets: [] },
    { items: [summary], nextCursor: null, totalCount: 1, facets: [{ group: "unknown", value: "X", count: 1 }] },
    { items: [summary], nextCursor: null, totalCount: 1, facets: [{ group: "styles", value: "X", count: 1, section: 2 }] },
  ]) {
    assert.throws(() => parseSitesDiscoveryPage(body), /Sites returned an invalid response/);
  }
});
