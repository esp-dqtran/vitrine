import assert from "node:assert/strict";
import test from "node:test";
import { startPublicPageImportWorker } from "./start.ts";

test("public-page worker verifies migrations and storage before consuming", async () => {
  const order: string[] = [];
  await startPublicPageImportWorker({
    assertMigrations: async () => { order.push("migrations"); },
    assertObjectStorage: async () => { order.push("storage"); },
    consume: async () => { order.push("consume"); },
  });
  assert.deepEqual(order, ["migrations", "storage", "consume"]);
});

test("public-page worker does not consume after a failed startup gate", async () => {
  for (const failed of ["migrations", "storage"] as const) {
    let consumed = false;
    await assert.rejects(startPublicPageImportWorker({
      assertMigrations: async () => {
        if (failed === "migrations") throw new Error("pending migrations");
      },
      assertObjectStorage: async () => {
        if (failed === "storage") throw new Error("storage unavailable");
      },
      consume: async () => { consumed = true; },
    }), failed === "migrations" ? /pending migrations/ : /storage unavailable/);
    assert.equal(consumed, false);
  }
});
