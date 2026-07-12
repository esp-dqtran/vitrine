import assert from "node:assert/strict";
import { test } from "node:test";
import { startApi } from "./start.ts";

test("API verifies migrations before starting", async () => {
  const order: string[] = [];

  await startApi({
    assertMigrations: async () => { order.push("migrations"); },
    start: () => { order.push("listen"); },
  });

  assert.deepEqual(order, ["migrations", "listen"]);
});

test("API refuses to listen when migrations are not current", async () => {
  let listened = false;

  await assert.rejects(() => startApi({
    assertMigrations: async () => { throw new Error("pending migrations"); },
    start: () => { listened = true; },
  }), /pending migrations/);

  assert.equal(listened, false);
});
