import assert from "node:assert/strict";
import test from "node:test";
import {
  flowDiscoveryBenchmarkUrls,
  summarizeTimings,
} from "./benchmark-flow-discovery.ts";

test("summarizes discovery timings with nearest-rank p95", () => {
  assert.deepEqual(summarizeTimings([5, 1, 3, 2, 4]), {
    minMs: 1,
    medianMs: 3,
    p95Ms: 5,
    maxMs: 5,
  });
});

test("benchmarks representative Flow states through the public catalog route", () => {
  assert.deepEqual(flowDiscoveryBenchmarkUrls("http://127.0.0.1:3011/"), [
    "http://127.0.0.1:3011/catalog/flows?platform=web&limit=12&sort=popular",
    "http://127.0.0.1:3011/catalog/flows?platform=ios&limit=12&sort=popular",
    "http://127.0.0.1:3011/catalog/flows?platform=android&limit=12&sort=popular",
    "http://127.0.0.1:3011/catalog/flows?platform=web&limit=12&sort=grouped",
    "http://127.0.0.1:3011/catalog/flows?platform=web&limit=12&sort=popular&query=settings",
    "http://127.0.0.1:3011/catalog/flows?platform=web&limit=12&sort=popular&filter=flowGroups.Settings",
  ]);
});
