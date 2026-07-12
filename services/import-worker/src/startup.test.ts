import assert from "node:assert/strict";
import { test } from "node:test";
import { startImportWorker } from "./start.ts";

test("worker verifies migrations before consuming jobs", async () => {
  const order: string[] = [];

  await startImportWorker({
    assertMigrations: async () => { order.push("migrations"); },
    assertObjectStorage: async () => { order.push("storage"); },
    consume: async () => { order.push("consume"); },
  });

  assert.deepEqual(order, ["migrations", "storage", "consume"]);
});

test("worker refuses to consume when migrations are not current", async () => {
  let consumed = false;

  await assert.rejects(() => startImportWorker({
    assertMigrations: async () => { throw new Error("pending migrations"); },
    assertObjectStorage: async () => {},
    consume: async () => { consumed = true; },
  }), /pending migrations/);

  assert.equal(consumed, false);
});

test("worker refuses to consume when object storage is unavailable", async () => {
  let consumed = false;

  await assert.rejects(() => startImportWorker({
    assertMigrations: async () => {},
    assertObjectStorage: async () => { throw new Error("Object storage is unavailable"); },
    consume: async () => { consumed = true; },
  }), /Object storage is unavailable/);

  assert.equal(consumed, false);
});
