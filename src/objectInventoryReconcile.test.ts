import assert from "node:assert/strict";
import test from "node:test";
import {
  objectInventoriesMatch,
  reconcileObjectInventories,
  type ObjectInventoryEntry,
} from "./objectInventoryReconcile.ts";

async function* entries(values: ObjectInventoryEntry[]): AsyncIterable<ObjectInventoryEntry> {
  yield* values;
}

test("reconciles matching sorted inventories", async () => {
  const values = [
    { key: "images/1/a.png", byteSize: 10 },
    { key: "thumbnails/1/a.webp", byteSize: 4 },
  ];
  const report = await reconcileObjectInventories(entries(values), entries(values));

  assert.equal(objectInventoriesMatch(report), true);
  assert.deepEqual(report, {
    databaseObjects: 2,
    databaseBytes: 14,
    bucketObjects: 2,
    bucketBytes: 14,
    matchedObjects: 2,
    matchedBytes: 14,
    missingObjects: 0,
    unexpectedObjects: 0,
    sizeMismatches: 0,
    missingSamples: [],
    unexpectedSamples: [],
    sizeMismatchSamples: [],
  });
});

test("reports missing, unexpected, and size-mismatched objects", async () => {
  const report = await reconcileObjectInventories(
    entries([
      { key: "images/missing.png", byteSize: 8 },
      { key: "images/shared.png", byteSize: 10 },
    ]),
    entries([
      { key: "images/extra.png", byteSize: 5 },
      { key: "images/shared.png", byteSize: 11 },
    ]),
  );

  assert.equal(objectInventoriesMatch(report), false);
  assert.equal(report.missingObjects, 1);
  assert.equal(report.unexpectedObjects, 1);
  assert.equal(report.sizeMismatches, 1);
  assert.deepEqual(report.missingSamples, ["images/missing.png"]);
  assert.deepEqual(report.unexpectedSamples, ["images/extra.png"]);
  assert.deepEqual(report.sizeMismatchSamples, [{
    key: "images/shared.png",
    databaseBytes: 10,
    bucketBytes: 11,
  }]);
});

test("limits discrepancy samples without hiding aggregate counts", async () => {
  const report = await reconcileObjectInventories(
    entries([
      { key: "a", byteSize: 1 },
      { key: "b", byteSize: 1 },
      { key: "c", byteSize: 1 },
    ]),
    entries([]),
    2,
  );

  assert.equal(report.missingObjects, 3);
  assert.deepEqual(report.missingSamples, ["a", "b"]);
});

test("rejects unsorted, duplicate, and invalid inventories", async () => {
  await assert.rejects(
    reconcileObjectInventories(entries([
      { key: "b", byteSize: 1 },
      { key: "a", byteSize: 1 },
    ]), entries([])),
    /database_inventory_not_strictly_sorted/,
  );
  await assert.rejects(
    reconcileObjectInventories(entries([]), entries([
      { key: "a", byteSize: 1 },
      { key: "a", byteSize: 1 },
    ])),
    /bucket_inventory_not_strictly_sorted/,
  );
  await assert.rejects(
    reconcileObjectInventories(entries([{ key: "a", byteSize: -1 }]), entries([])),
    /database_inventory_size_invalid/,
  );
});
