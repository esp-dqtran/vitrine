import assert from "node:assert/strict";
import { test } from "node:test";
import { createSearchSession } from "./searchSession.ts";
import {
  defaultSearchState,
  emptySearchFilters,
} from "./searchState.ts";

test("opens in gallery context and preserves compatible filters", () => {
  const session = createSearchSession({
    ...defaultSearchState,
    scope: "apps",
    filters: {
      ...emptySearchFilters,
      platform: ["web"],
      appCategory: ["Finance"],
    },
  });

  session.open("sites", {
    appCategory: ["Finance"],
    siteSection: ["Pricing"],
  });

  assert.equal(session.snapshot().open, true);
  assert.equal(session.snapshot().state.scope, "sites");
  assert.deepEqual(session.snapshot().state.filters.appCategory, ["Finance"]);
  assert.deepEqual(session.snapshot().state.filters.platform, []);
  assert.deepEqual(session.snapshot().state.filters.siteSection, ["Pricing"]);
});

test("closing clears modal-only search input and filters", () => {
  const session = createSearchSession(defaultSearchState);
  session.open("apps", { platform: ["ios"] });
  session.update({ ...session.snapshot().state, query: "Linear" });
  session.close();
  session.open("apps");
  assert.equal(session.snapshot().state.query, "");
  assert.deepEqual(session.snapshot().state.filters.platform, []);
});

test("canonicalizes seeded filter values", () => {
  const session = createSearchSession(defaultSearchState);
  session.open("sites", {
    siteSection: [" Pricing ", "FAQ", "Pricing"],
  });
  assert.deepEqual(session.snapshot().state.filters.siteSection, ["FAQ", "Pricing"]);
});
