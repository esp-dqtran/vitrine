import assert from "node:assert/strict";
import test from "node:test";
import { searchDiscoveryFacets } from "./discoveryFacetSearch.ts";

test("facet search keeps selected values while bounding and ranking matches", () => {
  const facets = [
    { group: "categories", value: "Business", count: 12 },
    { group: "categories", value: "AI", count: 20 },
    { group: "categories", value: "Education", count: 8 },
    { group: "flows", value: "Business setup", count: 30 },
  ];

  assert.deepEqual(
    searchDiscoveryFacets(facets, {
      group: "categories",
      query: "business",
      selected: ["AI"],
      limit: 1,
    }).map(({ value }) => value),
    ["Business", "AI"],
  );
});
