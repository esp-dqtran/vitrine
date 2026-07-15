import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { generateThumbnail } from "./imageThumbnail.ts";

const solid = (w: number, h: number) =>
  sharp({ create: { width: w, height: h, channels: 3, background: { r: 100, g: 140, b: 220 } } }).png().toBuffer();

const metaOf = (buf: Buffer) => sharp(buf).metadata();

test("resizes a large screenshot down to the grid thumbnail width", async () => {
  const out = await generateThumbnail(await solid(1920, 4266));
  const meta = await metaOf(out);
  assert.equal(meta.width, 480);
  assert.equal(meta.height, Math.round((4266 * 480) / 1920));
  assert.equal(meta.format, "jpeg");
});

test("does not upscale an image already narrower than the thumbnail width", async () => {
  const out = await generateThumbnail(await solid(240, 500));
  const meta = await metaOf(out);
  assert.equal(meta.width, 240);
  assert.equal(meta.height, 500);
});

test("produces bytes meaningfully smaller than the source", async () => {
  const source = await solid(1920, 4266);
  const out = await generateThumbnail(source);
  assert.ok(out.byteLength < source.byteLength / 4, `expected thumbnail (${out.byteLength}b) well under source (${source.byteLength}b)`);
});
