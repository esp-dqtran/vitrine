import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import sharp from "sharp";
import { storeAppIcon, storeAppIconBuffer } from "./appIconStore.ts";
import type { ObjectMetadata } from "./objectStore.ts";

test("stores a downscaled WebP copy and points the app at it", async () => {
  const source = await sharp({
    create: { width: 1024, height: 1024, channels: 3, background: "#ff0000" },
  }).png().toBuffer();
  const puts: Array<ObjectMetadata & { body: Uint8Array }> = [];
  const queries: Array<{ sql: string; values: readonly unknown[] }> = [];

  const path = await storeAppIcon({
    objectStore: {
      put: async (input: ObjectMetadata & { body: Uint8Array }) => {
        puts.push(input);
        return { created: true, metadata: input };
      },
    } as never,
    download: async (url) => {
      assert.equal(url, "https://cdn.example.com/icon.png");
      return source;
    },
    runQuery: async (sql, values) => {
      queries.push({ sql, values: values ?? [] });
    },
  }, 42, "https://cdn.example.com/icon.png");

  const stored = puts[0];
  assert.equal(puts.length, 1);
  assert.equal(stored.contentType, "image/webp");
  assert.equal(stored.accessClass, "public-preview");
  assert.equal(stored.sha256, createHash("sha256").update(stored.body).digest("hex"));
  assert.equal(stored.byteSize, stored.body.byteLength);
  assert.equal(stored.key, `icons/42/${stored.sha256}.webp`);
  assert.equal(path, `/assets/${stored.key}`);

  const image = await sharp(Buffer.from(stored.body)).metadata();
  assert.equal(image.format, "webp");
  assert.equal(image.width, 256, "icons are downscaled to the catalog's 2x size");

  // The object row has to exist before the app can reference it.
  assert.match(queries[0].sql, /INSERT INTO stored_objects/);
  assert.match(queries[1].sql, /UPDATE apps SET icon_object_key/);
  assert.deepEqual(queries[1].values, [stored.key, path, 42]);
});

test("stores official inline SVG artwork without downloading another favicon", async () => {
  const puts: Array<ObjectMetadata & { body: Uint8Array }> = [];
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#111"/><path d="M20 20h60v60H20z" fill="#fff"/></svg>');

  const path = await storeAppIconBuffer({
    objectStore: {
      put: async (input: ObjectMetadata & { body: Uint8Array }) => {
        puts.push(input);
        return { created: true, metadata: input };
      },
    } as never,
    download: async () => { throw new Error("inline SVG must not be downloaded"); },
    runQuery: async () => undefined,
  }, 43, svg);

  assert.match(path, /^\/assets\/icons\/43\/[a-f0-9]{64}\.webp$/);
  const image = await sharp(Buffer.from(puts[0].body)).metadata();
  assert.equal(image.format, "webp");
  assert.equal(image.width, 100, "small official artwork is not enlarged");
});
