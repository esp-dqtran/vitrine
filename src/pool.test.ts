import { test } from "node:test";
import assert from "node:assert/strict";
import { runPool } from "./pool.ts";

test("runPool processes every item exactly once across a pool of lanes", async () => {
  const items = Array.from({ length: 23 }, (_, i) => i);
  const seen: number[] = [];
  await runPool(items, ["a", "b", "c"], async (_lane, item) => {
    seen.push(item);
  });
  assert.deepEqual(seen.slice().sort((a, b) => a - b), items);
});

test("runPool tolerates more lanes than items", async () => {
  const seen: number[] = [];
  await runPool([1, 2], ["a", "b", "c", "d"], async (_lane, item) => {
    seen.push(item);
  });
  assert.deepEqual(seen.sort(), [1, 2]);
});

test("runPool stops pulling new items once shouldStop returns true", async () => {
  const items = Array.from({ length: 10 }, (_, i) => i);
  const seen: number[] = [];
  await runPool(
    items,
    ["a"],
    async (_lane, item) => {
      seen.push(item);
    },
    () => seen.length >= 3
  );
  assert.equal(seen.length, 3);
});
