import { test } from "node:test";
import assert from "node:assert/strict";
import { tabUrl, mergeFlows } from "./bulkDownload.ts";
import type { DesignFlow } from "./designSystem.ts";

test("tabUrl swaps or appends the tab segment", () => {
  const base = "https://mobbin.com/apps/linear-ios-1234/abcd/screens";
  assert.equal(tabUrl(base, "ui-elements"), "https://mobbin.com/apps/linear-ios-1234/abcd/ui-elements");
  assert.equal(tabUrl(base, "flows"), "https://mobbin.com/apps/linear-ios-1234/abcd/flows");
  assert.equal(tabUrl("https://mobbin.com/apps/linear-ios-1234/abcd/flows", "screens"), base);
  assert.equal(tabUrl("https://mobbin.com/apps/linear-ios-1234/abcd", "flows"), "https://mobbin.com/apps/linear-ios-1234/abcd/flows");
});

test("mergeFlows replaces by id and keeps the rest", () => {
  const flow = (id: string, title: string): DesignFlow => ({ id, title, description: "d", tags: [], steps: [{ label: "Step 1", evidence: [1] }] });
  const merged = mergeFlows([flow("a", "old"), flow("b", "keep")], [flow("a", "new"), flow("c", "added")]);
  assert.deepEqual(merged.map(({ id, title }) => `${id}:${title}`), ["a:new", "b:keep", "c:added"]);
});
