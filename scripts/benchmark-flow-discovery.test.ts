import assert from "node:assert/strict";
import test from "node:test";
import {
  flowDiscoveryBenchmarkViolations,
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

test("fails Flow discovery benchmarks on empty, slow, or oversized responses", () => {
  const healthy = {
    url: "http://localhost/catalog/flows",
    minMs: 4,
    medianMs: 6,
    p95Ms: 12,
    maxMs: 12,
    decodedBytes: 22_000,
    totalCount: 5,
  };
  assert.deepEqual(flowDiscoveryBenchmarkViolations([healthy]), []);
  assert.deepEqual(flowDiscoveryBenchmarkViolations([{
    ...healthy,
    p95Ms: 801,
    decodedBytes: 100_001,
    totalCount: 0,
  }]), [
    "http://localhost/catalog/flows: no results",
    "http://localhost/catalog/flows: p95 801ms exceeds 800ms",
    "http://localhost/catalog/flows: 100001 bytes exceeds 100000",
  ]);
});

test("benchmarks representative Flow states through the public catalog route", () => {
  assert.deepEqual(flowDiscoveryBenchmarkUrls("http://127.0.0.1:3011/"), [
    "http://127.0.0.1:3011/flows?platform=web&limit=12&facets=summary&sort=grouped",
    "http://127.0.0.1:3011/flows?platform=ios&limit=12&facets=summary&sort=grouped",
    "http://127.0.0.1:3011/flows?platform=android&limit=12&facets=summary&sort=grouped",
    "http://127.0.0.1:3011/flows?platform=web&limit=12&facets=summary&sort=grouped&query=settings",
    "http://127.0.0.1:3011/flows?platform=web&limit=12&facets=summary&sort=grouped&query=checkout+with+payment+method+selection",
    "http://127.0.0.1:3011/flows?platform=web&limit=12&facets=summary&sort=grouped&filter=flowCategories.content-detail",
    "http://127.0.0.1:3011/flows?platform=web&limit=12&facets=summary&sort=grouped&filter=flowTypes.content-detail%2Fother-content-detail",
  ]);
});
