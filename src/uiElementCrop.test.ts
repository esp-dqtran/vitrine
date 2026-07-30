import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { deriveUiElementCrop } from "./uiElementCrop.ts";
import type { UiElementCandidate } from "./uiElementExtraction.ts";

function candidate(type: string, region: UiElementCandidate["region"]): UiElementCandidate {
  return {
    type,
    variant: "Default",
    purpose: "Test component",
    anatomy: [],
    visibleStates: [],
    observedProperties: [],
    region,
    confidence: 0.99,
  };
}

async function circleFixture(input: {
  width?: number;
  height?: number;
  cx: number;
  cy: number;
  radius: number;
}): Promise<Buffer> {
  const width = input.width ?? 300;
  const height = input.height ?? 300;
  return sharp(Buffer.from(
    `<svg width="${width}" height="${height}">
       <rect width="100%" height="100%" fill="white"/>
       <circle cx="${input.cx}" cy="${input.cy}" r="${input.radius}" fill="#31c86a"/>
     </svg>`,
  )).png().toBuffer();
}

test("expands a clipped compact crop until the complete status dot is enclosed", async () => {
  const crop = await deriveUiElementCrop({
    source: await circleFixture({ cx: 150, cy: 150, radius: 30 }),
    candidate: candidate("Status Dot", { x: 0.34, y: 0.36, width: 0.32, height: 0.14 }),
    platform: "ios",
  });

  assert.equal(crop.quality.passed, true);
  assert.equal(crop.quality.refined, true);
  assert.deepEqual(crop.quality.issues, []);
  assert.ok(crop.quality.contentBounds.width >= 58);
  assert.ok(crop.quality.contentBounds.height >= 58);
  assert.ok(crop.sourceRegionPixels.height > 42);
});

test("rejects a compact component that is clipped by the source image itself", async () => {
  const crop = await deriveUiElementCrop({
    source: await circleFixture({ cx: 150, cy: 294, radius: 30 }),
    candidate: candidate("Status Dot", { x: 0.34, y: 0.86, width: 0.32, height: 0.14 }),
    platform: "ios",
  });

  assert.equal(crop.quality.passed, false);
  assert.ok(crop.quality.issues.includes("content-clipped"));
});

test("rejects an incomplete loading arc clipped by the source image", async () => {
  const source = await sharp({
    create: {
      width: 300,
      height: 200,
      channels: 4,
      background: "white",
    },
  })
    .composite([{
      input: Buffer.from(
        `<svg width="80" height="30"><ellipse cx="40" cy="30" rx="30" ry="24" fill="#f4512c"/></svg>`,
      ),
      left: 110,
      top: 170,
    }])
    .png()
    .toBuffer();
  const crop = await deriveUiElementCrop({
    source,
    candidate: candidate("Loading Indicator", { x: 0.35, y: 0.80, width: 0.30, height: 0.20 }),
    platform: "ios",
  });

  assert.equal(crop.quality.passed, false);
  assert.ok(crop.quality.issues.includes("content-clipped"));
});

test("keeps mobile full-width filter rows out of Dropdown Menu", async () => {
  const source = await sharp({
    create: {
      width: 1_000,
      height: 1_000,
      channels: 4,
      background: "white",
    },
  }).png().toBuffer();
  const crop = await deriveUiElementCrop({
    source,
    candidate: candidate("Dropdown Menu", { x: 0.05, y: 0.24, width: 0.9, height: 0.17 }),
    platform: "ios",
  });

  assert.equal(crop.quality.passed, false);
  assert.deepEqual(crop.quality.issues, ["implausible-geometry"]);
});

test("keeps a large success-check icon out of Status Dot", async () => {
  const statusCandidate = candidate(
    "Status Dot",
    { x: 0.30, y: 0.30, width: 0.40, height: 0.40 },
  );
  statusCandidate.variant = "Success check";
  statusCandidate.anatomy = ["green circle", "white checkmark"];
  const crop = await deriveUiElementCrop({
    source: await circleFixture({ cx: 150, cy: 150, radius: 50 }),
    candidate: statusCandidate,
    platform: "ios",
  });

  assert.equal(crop.quality.passed, false);
  assert.ok(crop.quality.issues.includes("semantic-type-mismatch"));
});

test("outputs full-colour lossless PNG without resizing ordinary components", async () => {
  const source = await sharp({
    create: {
      width: 400,
      height: 200,
      channels: 4,
      background: { r: 12, g: 34, b: 56, alpha: 1 },
    },
  }).png().toBuffer();
  const crop = await deriveUiElementCrop({
    source,
    candidate: candidate("Button", { x: 0.25, y: 0.25, width: 0.5, height: 0.5 }),
    platform: "web",
  });

  const metadata = await sharp(crop.body).metadata();
  assert.equal(metadata.format, "png");
  assert.notEqual(metadata.palette, true);
  assert.equal(metadata.width, crop.sourceRegionPixels.width);
  assert.equal(metadata.height, crop.sourceRegionPixels.height);
  assert.equal(crop.quality.passed, true);
});
