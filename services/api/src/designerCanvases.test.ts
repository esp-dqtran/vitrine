import assert from "node:assert/strict";
import type { Server } from "node:http";
import { test } from "node:test";
import express from "express";
import type { DesignerCanvasStore } from "../../../src/designerCanvas.ts";
import type { ObjectMetadata, ObjectStore } from "../../../src/objectStore.ts";
import { mountDesignerCanvasRoutes } from "./designerCanvases.ts";

const user = { id: 7, email: "designer@example.com", role: "user" as const };
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const metadata: ObjectMetadata = {
  key: `research/${user.id}/${"a".repeat(64)}.png`,
  sha256: "a".repeat(64),
  byteSize: 3,
  contentType: "image/png",
  accessClass: "protected",
};

const canvas = {
  snapshot: null,
  revision: 0,
};

const store = {
  getCanvas: async (userId: number, projectId: string) => {
    assert.equal(userId, user.id);
    assert.equal(projectId, PROJECT_ID);
    return canvas;
  },
  saveCanvas: async (
    userId: number,
    projectId: string,
    snapshot: Record<string, unknown>,
  ) => {
    assert.equal(userId, user.id);
    assert.equal(projectId, PROJECT_ID);
    return {
      snapshot,
      revision: 1,
      updatedAt: "2026-08-01T00:00:00.000Z",
    };
  },
  attachCanvasAsset: async (
    userId: number,
    projectId: string,
    assetId: string,
    attached: ObjectMetadata,
  ) => {
    assert.equal(userId, user.id);
    assert.equal(projectId, PROJECT_ID);
    assert.equal(assetId, "asset:image-1");
    return attached;
  },
  getCanvasAsset: async () => metadata,
} satisfies DesignerCanvasStore;

const objectStore: ObjectStore = {
  async put(input) {
    return {
      created: true,
      metadata: { ...input, body: undefined } as unknown as ObjectMetadata,
    };
  },
  async get() {
    return { metadata, body: Buffer.from([1, 2, 3]) };
  },
  async head() { return metadata; },
  async signedGetUrl() { return undefined; },
  async *list() { yield metadata; },
  async delete() { return true; },
};

async function serve(enabled = true): Promise<{ base: string; server: Server }> {
  const app = express();
  app.use((_req, res, next) => { res.locals.user = user; next(); });
  mountDesignerCanvasRoutes(app, { store, enabled, objectStore });
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  return { base: `http://127.0.0.1:${address.port}`, server };
}

const close = (server: Server) => new Promise<void>((resolve, reject) => {
  server.close((error) => error ? reject(error) : resolve());
});

test("serves the dedicated designer canvas contract with revision ETags", async (t) => {
  const { base, server } = await serve();
  t.after(() => close(server));

  const loaded = await fetch(`${base}/designer-canvases/${PROJECT_ID}`);
  assert.equal(loaded.status, 200);
  assert.equal(loaded.headers.get("etag"), '"0"');

  const saved = await fetch(`${base}/designer-canvases/${PROJECT_ID}`, {
    method: "PUT",
    headers: { "content-type": "application/vnd.astryx.excalidraw+json" },
    body: JSON.stringify({
      snapshot: {
        type: "excalidraw",
        version: 2,
        source: "https://astryx.design",
        elements: [],
        appState: {},
      },
    }),
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.headers.get("etag"), '"1"');
  assert.deepEqual(
    (await saved.json() as { snapshot: { files: Record<string, unknown> } }).snapshot.files,
    {},
  );
});

test("keeps the research canvas route as a compatibility alias", async (t) => {
  const { base, server } = await serve();
  t.after(() => close(server));

  assert.equal(
    (await fetch(`${base}/research-projects/${PROJECT_ID}/canvas`)).status,
    200,
  );
});

test("uploads assets through the designer canvas service", async (t) => {
  const { base, server } = await serve();
  t.after(() => close(server));

  const response = await fetch(
    `${base}/designer-canvases/${PROJECT_ID}/assets/${encodeURIComponent("asset:image-1")}`,
    {
      method: "POST",
      headers: { "content-type": "image/png" },
      body: new Uint8Array([1, 2, 3]),
    },
  );
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), {
    assetId: "asset:image-1",
    src: `/api/designer-canvases/${PROJECT_ID}/assets/asset%3Aimage-1`,
  });
});

test("feature flag hides dedicated and compatibility canvas routes", async (t) => {
  const { base, server } = await serve(false);
  t.after(() => close(server));

  assert.equal((await fetch(`${base}/designer-canvases/${PROJECT_ID}`)).status, 404);
  assert.equal(
    (await fetch(`${base}/research-projects/${PROJECT_ID}/canvas`)).status,
    404,
  );
});
