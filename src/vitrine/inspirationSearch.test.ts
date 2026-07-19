import { test } from "node:test";
import assert from "node:assert/strict";
import type { CatalogSearchResultItem } from "../catalogResearch.ts";
import {
  INSPIRATION_PROMPTS,
  groupInspirationResults,
  relatedSearchQuery,
  moveSelection,
} from "./inspirationSearch.ts";

const items: CatalogSearchResultItem[] = [
  { id: "screen:1", kind: "screen", app: "linear", title: "Login", description: "Sign in", evidenceIds: [1], states: [], layoutPatterns: [], componentNames: [] },
  { id: "flow:linear:signin", kind: "flow", app: "linear", title: "Sign in", description: "Authentication", evidenceIds: [1], states: [], layoutPatterns: [], componentNames: [] },
  { id: "pattern:linear:sidebar", kind: "pattern", app: "linear", title: "Sidebar", description: "Persistent navigation", evidenceIds: [2], states: [], layoutPatterns: ["Sidebar"], componentNames: [] },
];

test("offers useful starting intents", () => {
  assert.deepEqual(INSPIRATION_PROMPTS.slice(0, 4).map(({ query }) => query), ["Onboarding", "Checkout", "AI assistant", "Empty states"]);
});

test("groups inspiration results into screens, flows, and patterns", () => {
  const groups = groupInspirationResults(items);
  assert.deepEqual(groups.map(({ label, items: groupItems }) => [label, groupItems.length]), [["Screens", 1], ["Flows", 1], ["Patterns", 1]]);
});

test("builds a related query from observed metadata", () => {
  assert.equal(relatedSearchQuery({ ...items[0], pageType: "Login", productArea: "Authentication", componentNames: ["Text input"] }), "Login Authentication Text input");
});

test("wraps keyboard selection through visible results", () => {
  assert.equal(moveSelection(2, 1, 3), 0);
  assert.equal(moveSelection(0, -1, 3), 2);
});
