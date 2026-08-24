import assert from "node:assert/strict";
import test from "node:test";
import worker from "../worker/index.js";

test("returns an existing static asset without an SPA fallback", async () => {
  const response = await worker.fetch(new Request("https://example.test/assets/image.webp"), { ASSETS: { fetch: async () => new Response("asset") } });
  assert.equal(response.status, 200);
});

test("returns the application shell for a missing HTML route", async () => {
  const calls = [];
  const response = await worker.fetch(new Request("https://example.test/unknown", { headers: { accept: "text/html" } }), { ASSETS: { fetch: async (request) => { calls.push(new URL(request.url).pathname); return new Response("shell", { status: calls.length === 1 ? 404 : 200 }); } } });
  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["/unknown", "/index.html"]);
});
