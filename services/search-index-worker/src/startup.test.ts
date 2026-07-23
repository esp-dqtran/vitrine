import assert from "node:assert/strict";
import { test } from "node:test";
import { runSearchIndexLoop, startSearchIndexWorker } from "./start.ts";

test("worker verifies migrations before entering the claim loop", async () => {
  const order: string[] = [];
  await startSearchIndexWorker({
    assertMigrations: async () => { order.push("migrations"); },
    run: async () => { order.push("run"); },
  });
  assert.deepEqual(order, ["migrations", "run"]);
});

test("worker refuses to claim when migrations are not current", async () => {
  let ran = false;
  await assert.rejects(() => startSearchIndexWorker({
    assertMigrations: async () => { throw new Error("pending migrations"); },
    run: async () => { ran = true; },
  }), /pending migrations/);
  assert.equal(ran, false);
});

test("idle loop waits without processing and then observes shutdown", async () => {
  const controller = new AbortController();
  let claims = 0;
  let processed = false;
  await runSearchIndexLoop({
    signal: controller.signal,
    claim: async () => {
      claims += 1;
      return null;
    },
    process: async () => { processed = true; },
    sleep: async () => { controller.abort(); },
  });
  assert.equal(claims, 1);
  assert.equal(processed, false);
});
