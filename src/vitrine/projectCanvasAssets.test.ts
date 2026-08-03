import assert from "node:assert/strict";
import { test } from "node:test";
import { uploadProjectCanvasAsset } from "./projectCanvasAssets.ts";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

test("uploads project canvas images through the authenticated Astryx API", async (t) => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ input: string; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ input: String(input), init });
    return new Response(JSON.stringify({
      src: `/api/designer-canvases/${PROJECT_ID}/assets/asset%3Aimage-1`,
    }), { status: 201, headers: { "content-type": "application/json" } });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const file = new File([new Uint8Array([1, 2, 3])], "reference.png", {
    type: "image/png",
  });
  const controller = new AbortController();
  const uploaded = await uploadProjectCanvasAsset(
    PROJECT_ID,
    "asset:image-1",
    file,
    controller.signal,
  );

  assert.equal(
    uploaded,
    `/api/designer-canvases/${PROJECT_ID}/assets/asset%3Aimage-1`,
  );
  assert.equal(calls[0]?.input, `/api/designer-canvases/${PROJECT_ID}/assets/asset%3Aimage-1`);
  assert.equal(calls[0]?.init?.method, "POST");
  assert.equal((calls[0]?.init?.headers as Record<string, string>)["content-type"], "image/png");
  assert.equal(calls[0]?.init?.body, file);
  assert.equal(calls[0]?.init?.signal, controller.signal);
});

test("surfaces the canvas asset API error", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({ error: "unsupported canvas asset type" }),
    { status: 415, headers: { "content-type": "application/json" } },
  );
  t.after(() => { globalThis.fetch = originalFetch; });

  await assert.rejects(
    () => uploadProjectCanvasAsset(
      PROJECT_ID,
      "asset:image-2",
      new File(["gif"], "reference.gif", { type: "image/gif" }),
    ),
    /unsupported canvas asset type/,
  );
});
