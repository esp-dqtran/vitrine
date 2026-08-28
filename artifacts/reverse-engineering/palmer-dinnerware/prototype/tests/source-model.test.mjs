import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  PALMER_SOURCE_COLUMN_COUNT,
  PALMER_SOURCE_ROW_COUNT,
  PALMER_SOURCE_SLOTS,
} from "../src/data/palmerSourceSlots.js";

const prototypeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("retains the 114 spatial slots extracted from the Palmer source", () => {
  assert.equal(PALMER_SOURCE_SLOTS.length, 114);
  assert.equal(PALMER_SOURCE_COLUMN_COUNT, 15);
  assert.equal(PALMER_SOURCE_ROW_COUNT, 8);
  assert.equal(new Set(PALMER_SOURCE_SLOTS.map(({ runtimeColumn, runtimeRow }) => (
    `${runtimeColumn}:${runtimeRow}`
  ))).size, 114);
  assert.ok(PALMER_SOURCE_SLOTS.every(({ size }) => Number.isFinite(size) && size > 0));
});

test("implements the primitive to page hierarchy", async () => {
  const expectedFiles = [
    "src/primitives/BrandLogo.jsx",
    "src/primitives/ControlButton.jsx",
    "src/primitives/ProductImage.jsx",
    "src/primitives/ProductLabel.jsx",
    "src/composites/MenuControl.jsx",
    "src/composites/FilterControl.jsx",
    "src/composites/CollectionFocus.jsx",
    "src/sections/GlobalChrome.jsx",
    "src/sections/ExperienceCanvasSection.jsx",
    "src/pages/PalmerHomePage.jsx",
  ];
  await Promise.all(expectedFiles.map((file) => access(path.join(prototypeRoot, file))));
});
