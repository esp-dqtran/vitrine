import assert from "node:assert/strict";
import test from "node:test";
import { warmFlowCatalogFilters } from "./flowCatalogWarmup.ts";

test("warms every Category and the slowest Flow Type query shape", async () => {
  const calls: unknown[] = [];
  const failures = await warmFlowCatalogFilters({
    cursorSecret: "warmup-secret",
    platforms: ["web"],
    loadPage: async (input) => {
      calls.push(input);
    },
  });

  assert.equal(failures, 0);
  assert.equal(calls.length, 14);
  assert.deepEqual(calls[0], {
    platform: "web",
    limit: 80,
    sort: "grouped",
    includeFacets: false,
    cursorSecret: "warmup-secret",
    flowCategories: ["authentication"],
  });
  assert.deepEqual(calls[4], {
    platform: "web",
    limit: 80,
    sort: "grouped",
    includeFacets: false,
    cursorSecret: "warmup-secret",
    flowCategories: ["content-detail"],
  });
  assert.deepEqual(calls.at(-1), {
      platform: "web",
      limit: 80,
      sort: "grouped",
      includeFacets: false,
      cursorSecret: "warmup-secret",
      flowTypes: ["content-detail/other-content-detail"],
  });
});

test("continues warming after an individual filter fails", async () => {
  let calls = 0;
  const failures = await warmFlowCatalogFilters({
    cursorSecret: "warmup-secret",
    platforms: ["web", "ios"],
    loadPage: async () => {
      calls += 1;
      if (calls === 1) throw new Error("temporary database error");
    },
  });

  assert.equal(calls, 28);
  assert.equal(failures, 1);
});
