import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { stripMobbinWatermark } from "./mobbinWatermark.ts";

const solid = (w: number, h: number, [r, g, b]: [number, number, number]) =>
  sharp({ create: { width: w, height: h, channels: 3, background: { r, g, b } } }).png().toBuffer();

// Light screenshot with a dark bar composited at the bottom, like a Mobbin export.
async function withBar(width: number, height: number, barHeight: number, bar: [number, number, number] = [47, 47, 47]) {
  const strip = await solid(width, barHeight, bar);
  return sharp({ create: { width, height, channels: 3, background: { r: 248, g: 247, b: 243 } } })
    .composite([{ input: strip, top: height - barHeight, left: 0 }])
    .png()
    .toBuffer();
}

const heightOf = async (buf: Buffer) => (await sharp(buf).metadata()).height;

test("crops the fixed-height Mobbin bar off a screen", async () => {
  // bar height is a fixed 121px regardless of image width
  const out = await stripMobbinWatermark(await withBar(1180, 2676, 121));
  assert.equal(await heightOf(out), 2555);
});

test("crops even when content just above the bar is dark", async () => {
  // dark content above the bar used to fool luminance detection; fixed crop is immune.
  const strip = await solid(1180, 121, [47, 47, 47]);
  const darkContentAbove = await solid(1180, 2676, [30, 30, 30]);
  const img = await sharp(darkContentAbove).composite([{ input: strip, top: 2555, left: 0 }]).png().toBuffer();
  assert.equal(await heightOf(await stripMobbinWatermark(img)), 2555);
});

test("crops a wide web export whose bar the old width-ratio calc would have missed", async () => {
  // 1920w web export: old ratio (0.102 * 1920 = 196px) overshot the real 121px bar,
  // landing the darkness probe on light content above it and skipping the crop entirely.
  const out = await stripMobbinWatermark(await withBar(1920, 1320, 121));
  assert.equal(await heightOf(out), 1199);
});

test("leaves an image with a light bottom (no bar) untouched", async () => {
  const clean = await solid(1180, 2676, [248, 247, 243]);
  assert.equal(await heightOf(await stripMobbinWatermark(clean)), 2676);
});

test("MOBBIN_WATERMARK_PX overrides the height", async () => {
  process.env.MOBBIN_WATERMARK_PX = "200";
  try {
    assert.equal(await heightOf(await stripMobbinWatermark(await withBar(1180, 2676, 200))), 2476);
  } finally {
    delete process.env.MOBBIN_WATERMARK_PX;
  }
});

test("MOBBIN_WATERMARK=keep disables cropping", async () => {
  process.env.MOBBIN_WATERMARK = "keep";
  try {
    assert.equal(await heightOf(await stripMobbinWatermark(await withBar(1180, 2676, 120))), 2676);
  } finally {
    delete process.env.MOBBIN_WATERMARK;
  }
});
