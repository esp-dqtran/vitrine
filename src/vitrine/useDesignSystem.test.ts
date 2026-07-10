import { test } from "node:test";
import assert from "node:assert/strict";
import { loadDesignSystem } from "./useDesignSystem.ts";

test("loads a structured design-system snapshot", async () => {
  const snapshot = {
    app: "linear",
    generatedAt: "2026-07-10T00:00:00.000Z",
    tokens: [],
    components: [],
    flows: [],
  };
  const result = await loadDesignSystem("linear", undefined, async () =>
    new Response(JSON.stringify(snapshot), { status: 200, headers: { "content-type": "application/json" } })
  );
  assert.deepEqual(result, snapshot);
});

test("returns null when an app has no synthesized design system", async () => {
  const result = await loadDesignSystem("linear", undefined, async () =>
    new Response(JSON.stringify({ error: "not found" }), { status: 404 })
  );
  assert.equal(result, null);
});

test("rejects non-success API responses", async () => {
  await assert.rejects(
    () => loadDesignSystem("linear", undefined, async () => new Response(null, { status: 503 })),
    /Design system returned 503/,
  );
});
