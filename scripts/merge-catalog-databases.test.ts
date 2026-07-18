import assert from "node:assert/strict";
import test from "node:test";
import {
  auditSnapshots,
  assertDifferentDatabases,
  chunks,
  mergeFlowArrays,
  missingKeys,
  sameObjectContent,
  sameObjectMetadata,
} from "./merge-catalog-databases.ts";

test("chunks keeps every item exactly once", () => {
  assert.deepEqual(chunks([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});

test("chunks rejects a non-positive batch size", () => {
  assert.throws(() => chunks([1], 0), /positive integer/);
});

test("assertDifferentDatabases rejects identical connection URLs", () => {
  const url = "postgres://postgres:postgres@localhost:5432/astryx";
  assert.throws(() => assertDifferentDatabases(url, url), /must be different/);
});

test("missingKeys deduplicates source keys and returns only absent target keys", () => {
  assert.deepEqual(
    missingKeys(["a", "b", "b", "c"], ["b", "d"]),
    ["a", "c"],
  );
});

test("auditSnapshots reports every missing crawler-owned natural key", () => {
  const source = {
    apps: ["alpha", "beta"],
    platforms: ["alpha|ios", "beta|web"],
    images: ["alpha|ios|screen-1", "beta|web|screen-2"],
    objects: ["prod/full/a", "prod/full/b"],
    flows: ["alpha|ios", "beta|web"],
  };
  const target = {
    apps: ["alpha"],
    platforms: ["alpha|ios"],
    images: ["alpha|ios|screen-1"],
    objects: ["prod/full/a"],
    flows: ["alpha|ios"],
  };

  assert.deepEqual(auditSnapshots(source, target), {
    source: { apps: 2, platforms: 2, images: 2, objects: 2, flows: 2 },
    target: { apps: 1, platforms: 1, images: 1, objects: 1, flows: 1 },
    missing: { apps: 1, platforms: 1, images: 1, objects: 1, flows: 1 },
  });
});

test("mergeFlowArrays preserves target-only flows and lets source refresh matching ids", () => {
  const target = [
    { id: "target-only", title: "Target", steps: [] },
    { id: "shared", title: "Old", steps: [] },
  ];
  const source = [
    { id: "shared", title: "Fresh", steps: [1] },
    { id: "source-only", title: "Source", steps: [] },
  ];

  assert.deepEqual(mergeFlowArrays(target, source), [
    { id: "target-only", title: "Target", steps: [] },
    { id: "shared", title: "Fresh", steps: [1] },
    { id: "source-only", title: "Source", steps: [] },
  ]);
});

test("sameObjectMetadata ignores database number representation but rejects content drift", () => {
  const existing = {
    object_key: "catalog/full/a.png",
    sha256: "a".repeat(64),
    byte_size: "123",
    content_type: "image/png",
    access_class: "protected",
  };
  const incoming = { ...existing, byte_size: 123 };
  assert.equal(sameObjectMetadata(existing, incoming), true);
  assert.equal(sameObjectMetadata(existing, { ...incoming, sha256: "b".repeat(64) }), false);
});

test("sameObjectContent allows different storage keys for identical bytes", () => {
  const left = {
    object_key: "images/1/content.png",
    sha256: "a".repeat(64),
    byte_size: "123",
    content_type: "image/png",
    access_class: "protected",
  };
  assert.equal(sameObjectContent(left, { ...left, object_key: "images/2/content.png" }), true);
  assert.equal(sameObjectContent(left, { ...left, object_key: "images/2/content.png", byte_size: 124 }), false);
});

test("flow evidence remapping replaces nested image ids without changing other fields", async () => {
  const merger = await import("./merge-catalog-databases.ts") as Record<string, unknown>;
  assert.equal(typeof merger.remapFlowEvidence, "function");
  const remap = merger.remapFlowEvidence as (flows: unknown, resolve: (id: number) => number) => unknown;
  const original = [{
    id: "checkout",
    title: "Checkout",
    tags: ["commerce"],
    steps: [
      { label: "Cart", evidence: [11] },
      { label: "Pay", evidence: [22, 11] },
    ],
  }];

  assert.deepEqual(remap(original, (id) => new Map([[11, 101], [22, 202]]).get(id)!), [{
    id: "checkout",
    title: "Checkout",
    tags: ["commerce"],
    steps: [
      { label: "Cart", evidence: [101] },
      { label: "Pay", evidence: [202, 101] },
    ],
  }]);
  assert.deepEqual(original[0]!.steps[0]!.evidence, [11], "repair must not mutate its input");
});

test("flow evidence remapping aborts when an evidence id cannot be resolved", async () => {
  const merger = await import("./merge-catalog-databases.ts") as Record<string, unknown>;
  const remap = merger.remapFlowEvidence as (flows: unknown, resolve: (id: number) => number) => unknown;
  assert.throws(
    () => remap([{ id: "broken", steps: [{ evidence: [999] }] }], () => { throw new Error("unresolved 999"); }),
    /unresolved 999/,
  );
});
