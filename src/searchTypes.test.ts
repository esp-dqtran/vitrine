import assert from "node:assert/strict";
import { test } from "node:test";
import {
  decodeSearchCursor,
  encodeSearchCursor,
  fuseSearchRanks,
  normalizeSearchRequest,
} from "./searchTypes.ts";

test("normalizes OR values within filter groups without changing the visible query", () => {
  const request = normalizeSearchRequest({
    q: " dark mobile checkout ",
    type: "all",
    platform: ["ios", "android", "ios"],
    component: ["Modal", "Bottom sheet"],
    limit: "500",
  });
  assert.equal(request.query, "dark mobile checkout");
  assert.deepEqual(request.filters.platform, ["android", "ios"]);
  assert.deepEqual(request.filters.component, ["Bottom sheet", "Modal"]);
  assert.equal(request.limit, 48);
});

test("cursor binds search state and final sort values", () => {
  const encoded = encodeSearchCursor({
    fingerprint: "abc",
    indexVersion: 1,
    sort: "relevance",
    values: [0.75, "screen:7"],
  });
  assert.deepEqual(decodeSearchCursor(encoded), {
    fingerprint: "abc",
    indexVersion: 1,
    sort: "relevance",
    values: [0.75, "screen:7"],
  });
});

test("reciprocal-rank fusion rewards candidates present in both lists", () => {
  const fused = fuseSearchRanks([
    ["screen:exact", "screen:both"],
    ["screen:both", "screen:semantic"],
  ]);
  assert.equal(fused[0].documentId, "screen:both");
});
