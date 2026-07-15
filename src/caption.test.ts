import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { parseCaptionReply, withDownloaded } from "./caption.ts";
import type { ObjectMetadata, ObjectStore } from "./objectStore.ts";

const objectMetadata: ObjectMetadata = {
  key: "images/1/abc.png",
  sha256: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  byteSize: 5,
  contentType: "image/png",
  accessClass: "protected",
};

function storeReturning(body: Buffer): ObjectStore {
  return {
    get: async () => ({ metadata: objectMetadata, body }),
  } as unknown as ObjectStore;
}

test("parses a structured caption reply", () => {
  const analysis = parseCaptionReply(JSON.stringify({
    description: "A dark settings page.",
    purpose: "Manage account preferences",
    pageType: "Settings",
    productArea: "Account",
    theme: "dark",
    visibleStates: ["selected navigation item"],
    componentNames: ["Side navigation", "Toggle"],
  }));
  assert.equal(analysis.productArea, "Account");
  assert.deepEqual(analysis.componentNames, ["Side navigation", "Toggle"]);
});

test("rejects an unstructured caption reply", () => {
  assert.throws(() => parseCaptionReply("A dark settings page."), /valid JSON/);
});

test("materializes object-backed captions in a private temporary file and removes it", async () => {
  let filePath = "";
  const result = await withDownloaded(
    { id: 1, app: "Test", platform: "web", image_url: "mobbin-bulk:abc" },
    async (path) => {
      filePath = path;
      assert.equal(statSync(dirname(path)).mode & 0o777, 0o700);
      assert.equal(statSync(path).mode & 0o777, 0o600);
      return "captioned";
    },
    {
      objectStore: storeReturning(Buffer.from("hello")),
      resolveObjectMetadata: async () => objectMetadata,
    },
  );

  assert.equal(result, "captioned");
  assert.equal(existsSync(dirname(filePath)), false);
});

test("removes object-backed temporary files when captioning fails", async () => {
  let directory = "";
  await assert.rejects(
    withDownloaded(
      { id: 1, app: "Test", platform: "web", image_url: "mobbin-bulk:abc" },
      async (path) => {
        directory = dirname(path);
        throw new Error("provider failed");
      },
      {
        objectStore: storeReturning(Buffer.from("hello")),
        resolveObjectMetadata: async () => objectMetadata,
      },
    ),
    /provider failed/,
  );
  assert.equal(existsSync(directory), false);
});

test("rejects object bytes that do not match associated metadata", async () => {
  await assert.rejects(
    withDownloaded(
      { id: 1, app: "Test", platform: "web", image_url: "mobbin-bulk:abc" },
      async () => assert.fail("caption callback must not receive unverified bytes"),
      {
        objectStore: storeReturning(Buffer.from("wrong")),
        resolveObjectMetadata: async () => objectMetadata,
      },
    ),
    /do not match metadata/i,
  );
});

test("keeps the remote-image fallback when no object is associated", async () => {
  const originalFetch = globalThis.fetch;
  let filePath = "";
  globalThis.fetch = async () => new Response(Buffer.from("legacy"), {
    headers: { "content-type": "image/webp" },
  });
  try {
    await withDownloaded(
      { id: 2, app: "test", platform: "web", image_url: "https://example.test/image.webp" },
      async (path) => {
        filePath = path;
        assert.equal(existsSync(path), true);
      },
      { resolveObjectMetadata: async () => undefined },
    );
    assert.equal(existsSync(dirname(filePath)), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
