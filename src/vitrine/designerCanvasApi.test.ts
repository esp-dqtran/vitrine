import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DesignerCanvasApiError,
  getDesignerCanvas,
  saveDesignerCanvas,
} from "./designerCanvasApi.ts";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

test("loads and saves through the dedicated designer canvas API", async (t) => {
  const original = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return Response.json({ snapshot: null, revision: 0 });
  };

  await getDesignerCanvas(PROJECT_ID);
  await saveDesignerCanvas(PROJECT_ID, {
    type: "excalidraw",
    version: 2,
    source: "https://astryx.design",
    elements: [],
    appState: {},
    files: {},
  });

  assert.equal(calls[0].url, `/api/designer-canvases/${PROJECT_ID}`);
  assert.equal(calls[1].url, `/api/designer-canvases/${PROJECT_ID}`);
  assert.equal(calls[1].init?.method, "PUT");
  assert.equal(
    (calls[1].init?.headers as Record<string, string>)["content-type"],
    "application/vnd.astryx.excalidraw+json",
  );
});

test("surfaces dedicated canvas errors", async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async () => Response.json(
    { error: "Authentication required" },
    { status: 401 },
  );

  await assert.rejects(
    getDesignerCanvas(PROJECT_ID),
    (error: unknown) => error instanceof DesignerCanvasApiError
      && error.status === 401
      && error.message === "Authentication required",
  );
});
