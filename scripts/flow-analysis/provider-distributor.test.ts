import assert from "node:assert/strict";
import test from "node:test";
import {
  distributeFlowWork,
  providerForFlow,
  runProviderLanes,
} from "./provider-distributor.ts";

const providers = ["chatgpt", "antigravity", "gemini"] as const;

test("assigns each Flow deterministically to exactly one provider", () => {
  const items = Array.from({ length: 120 }, (_, index) => ({
    id: `flow-${index}`,
  }));
  const lanes = distributeFlowWork(items, providers, ({ id }) => id);
  const assigned = lanes.flatMap(({ provider, items }) =>
    items.map(({ id }) => ({ id, provider }))
  );

  assert.equal(assigned.length, items.length);
  assert.equal(new Set(assigned.map(({ id }) => id)).size, items.length);
  for (const { id, provider } of assigned) {
    assert.equal(providerForFlow(id, providers), provider);
  }
});

test("keeps the workload reasonably balanced across three providers", () => {
  const items = Array.from({ length: 300 }, (_, index) => ({
    id: `mobbin-flow-${index}`,
  }));
  const counts = distributeFlowWork(items, providers, ({ id }) => id)
    .map(({ items }) => items.length);

  assert.ok(Math.max(...counts) - Math.min(...counts) <= 20, counts.join(","));
});

test("preserves the configured provider order", () => {
  const lanes = distributeFlowWork(
    [{ id: "one" }],
    ["gemini", "chatgpt"],
    ({ id }) => id,
  );
  assert.deepEqual(lanes.map(({ provider }) => provider), ["gemini", "chatgpt"]);
});

test("runs provider lanes concurrently", async () => {
  let active = 0;
  let maxActive = 0;
  await runProviderLanes(
    providers.map((provider) => ({ provider, items: [provider] })),
    async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active -= 1;
    },
  );

  assert.equal(maxActive, 3);
});

test("waits for every provider lane before reporting a failure", async () => {
  const completed: string[] = [];
  await assert.rejects(
    runProviderLanes(
      providers.map((provider) => ({ provider, items: [provider] })),
      async ({ provider }) => {
        if (provider === "chatgpt") throw new Error("login unavailable");
        await new Promise((resolve) => setTimeout(resolve, 5));
        completed.push(provider);
      },
    ),
    /login unavailable/,
  );

  assert.deepEqual(completed.sort(), ["antigravity", "gemini"]);
});
