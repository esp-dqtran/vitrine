import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { blurPngRectangles, type PixelRectangle } from "./imageRedaction.ts";

async function fixture(width = 18, height = 14): Promise<Buffer> {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const insideTextPattern = x >= 4 && x < 14 && y >= 4 && y < 10;
      data[offset] = insideTextPattern && (x + y) % 2 === 0 ? 255 : x * 9;
      data[offset + 1] = insideTextPattern && (x + y) % 2 === 1 ? 255 : y * 11;
      data[offset + 2] = (x * 13 + y * 7) % 256;
      data[offset + 3] = 255;
    }
  }
  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

async function rawPng(input: Uint8Array) {
  return sharp(input).raw().toBuffer({ resolveWithObject: true });
}

test("blurPngRectangles changes only pixels inside the selected rectangles", async () => {
  const input = await fixture();
  const rectangle: PixelRectangle = { left: 3, top: 3, width: 12, height: 8 };
  const result = await blurPngRectangles(input, [rectangle], { sigma: 2 });
  const before = await rawPng(input);
  const after = await rawPng(result.body);

  assert.deepEqual([result.width, result.height, result.channels], [18, 14, 4]);
  assert.deepEqual(after.info, before.info);
  let changedInside = 0;
  for (let y = 0; y < before.info.height; y += 1) {
    for (let x = 0; x < before.info.width; x += 1) {
      const inside = x >= rectangle.left && x < rectangle.left + rectangle.width
        && y >= rectangle.top && y < rectangle.top + rectangle.height;
      const offset = (y * before.info.width + x) * before.info.channels;
      for (let channel = 0; channel < before.info.channels; channel += 1) {
        if (inside && before.data[offset + channel] !== after.data[offset + channel]) changedInside += 1;
        if (!inside) assert.equal(after.data[offset + channel], before.data[offset + channel]);
      }
    }
  }
  assert.ok(changedInside > 0);
});

test("blurPngRectangles rejects unsafe or unsupported input", async () => {
  const png = await fixture();
  await assert.rejects(blurPngRectangles(png, []), /At least one/);
  await assert.rejects(blurPngRectangles(png, [{ left: 17, top: 0, width: 2, height: 2 }]), /bounds/);
  await assert.rejects(blurPngRectangles(png, [{ left: 0.5, top: 0, width: 2, height: 2 }]), /integers/);
  await assert.rejects(blurPngRectangles(png, [{ left: 0, top: 0, width: 0, height: 2 }]), /positive size/);
  await assert.rejects(blurPngRectangles(png, [{ left: 0, top: 0, width: 2, height: 2 }], { sigma: 0 }), /sigma/);
  const jpeg = await sharp({ create: { width: 4, height: 4, channels: 3, background: "white" } }).jpeg().toBuffer();
  await assert.rejects(blurPngRectangles(jpeg, [{ left: 0, top: 0, width: 2, height: 2 }]), /PNG input/);
});
