import assert from "node:assert/strict";
import { test } from "node:test";
import {
  activeFilterCount,
  compatibleSearchFilters,
  quickFilterKeys,
} from "./searchScope.ts";
import { normalizeSearchRequest } from "./searchTypes.ts";

test("removes filters incompatible with the next scope", () => {
  const filters = normalizeSearchRequest({
    platform: "web",
    appCategory: "Finance",
    siteSection: "Pricing",
    siteStyle: "Minimal",
  }).filters;

  const appFilters = compatibleSearchFilters("apps", filters);
  assert.deepEqual(appFilters.siteSection, []);
  assert.deepEqual(appFilters.siteStyle, []);
  assert.deepEqual(appFilters.platform, ["web"]);
  assert.deepEqual(quickFilterKeys("sites"), ["appCategory", "siteSection", "siteStyle"]);
});

test("counts every selected filter value", () => {
  const filters = normalizeSearchRequest({
    platform: ["ios", "android"],
    appCategory: "Finance",
    siteSection: "Pricing",
  }).filters;

  assert.equal(activeFilterCount(filters), 4);
});
