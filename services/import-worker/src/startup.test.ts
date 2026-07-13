import assert from "node:assert/strict";
import { test } from "node:test";
import { startImportWorker } from "./start.ts";

test("worker verifies migrations and recovers stale runs before consuming jobs", async () => {
  const order: string[] = [];
  let staleBefore: Date | undefined;

  await startImportWorker({
    assertMigrations: async () => { order.push("migrations"); },
    assertObjectStorage: async () => { order.push("storage"); },
    recoverStaleRuns: async (value) => { order.push("recover"); staleBefore = value; },
    consume: async () => { order.push("consume"); },
    now: () => new Date("2026-07-12T12:00:00.000Z"),
    staleRunThresholdMs: 60_000,
  });

  assert.deepEqual(order, ["migrations", "storage", "recover", "consume"]);
  assert.equal(staleBefore?.toISOString(), "2026-07-12T11:59:00.000Z");
});

test("worker refuses to consume when migrations are not current", async () => {
  let consumed = false;

  await assert.rejects(() => startImportWorker({
    assertMigrations: async () => { throw new Error("pending migrations"); },
    assertObjectStorage: async () => {},
    recoverStaleRuns: async () => { throw new Error("must not recover"); },
    consume: async () => { consumed = true; },
  }), /pending migrations/);

  assert.equal(consumed, false);
});

test("worker refuses to consume when object storage is unavailable", async () => {
  let consumed = false;

  await assert.rejects(() => startImportWorker({
    assertMigrations: async () => {},
    assertObjectStorage: async () => { throw new Error("Object storage is unavailable"); },
    recoverStaleRuns: async () => { throw new Error("must not recover"); },
    consume: async () => { consumed = true; },
  }), /Object storage is unavailable/);

  assert.equal(consumed, false);
});

test("worker refuses to consume when stale-run recovery fails", async () => {
  let consumed = false;
  await assert.rejects(() => startImportWorker({
    assertMigrations: async () => {},
    assertObjectStorage: async () => {},
    recoverStaleRuns: async () => { throw new Error("recovery unavailable"); },
    consume: async () => { consumed = true; },
  }), /recovery unavailable/);
  assert.equal(consumed, false);
});
