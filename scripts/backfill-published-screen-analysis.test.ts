import assert from "node:assert/strict";
import test from "node:test";
import { backfillOptions } from "./backfill-published-screen-analysis.ts";

test("defaults to one bounded dry-run batch at the parity coverage target", () => {
  assert.deepEqual(backfillOptions(["--platform", "web"]), {
    platform: "web",
    targetCoverage: 0.8,
    batchSize: 500,
    concurrency: 3,
    maxBatches: 1,
    execute: false,
  });
});

test("requires an explicit execute flag and preserves operator bounds", () => {
  assert.deepEqual(backfillOptions([
    "--platform", "web",
    "--target-coverage", "0.85",
    "--batch-size", "1000",
    "--concurrency", "8",
    "--max-batches", "20",
    "--execute",
  ]), {
    platform: "web",
    targetCoverage: 0.85,
    batchSize: 1000,
    concurrency: 8,
    maxBatches: 20,
    execute: true,
  });
});

test("rejects unsafe or invalid backfill bounds", () => {
  assert.throws(() => backfillOptions(["--platform", "web", "--target-coverage", "1.1"]));
  assert.throws(() => backfillOptions(["--platform", "web", "--batch-size", "20001"]));
  assert.throws(() => backfillOptions(["--platform", "web", "--concurrency", "9"]));
  assert.throws(() => backfillOptions(["--platform", "web", "--max-batches", "1001"]));
  assert.throws(() => backfillOptions(["--platform", "desktop"]));
  assert.throws(() => backfillOptions(["--platform", "web", "--unknown", "value"]));
});
