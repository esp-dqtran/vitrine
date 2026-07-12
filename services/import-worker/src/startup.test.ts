import assert from "node:assert/strict";
import { test } from "node:test";
import { startImportWorker } from "./start.ts";

test("worker verifies migrations before consuming jobs", async () => {
  const order: string[] = [];

  await startImportWorker({
    assertMigrations: async () => { order.push("migrations"); },
    consume: async () => { order.push("consume"); },
  });

  assert.deepEqual(order, ["migrations", "consume"]);
});

test("worker refuses to consume when migrations are not current", async () => {
  let consumed = false;

  await assert.rejects(() => startImportWorker({
    assertMigrations: async () => { throw new Error("pending migrations"); },
    consume: async () => { consumed = true; },
  }), /pending migrations/);

  assert.equal(consumed, false);
});
