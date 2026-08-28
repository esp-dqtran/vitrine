import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  PALMER_SOURCE_COLUMN_COUNT,
  PALMER_SOURCE_ROW_COUNT,
  PALMER_SOURCE_SLOTS,
} from "../src/data/palmerSourceSlots.js";

const prototypeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceHtmlPath = path.resolve(
  prototypeRoot,
  "../source/downloaded/www.palmer-dinnerware.com/index.html",
);

function decodeHtmlPath(value) {
  return value.replaceAll("&#32;", " ").replaceAll("&amp;", "&");
}

test("derives the 114 spatial slots from downloaded Palmer source", async () => {
  const html = await readFile(sourceHtmlPath, "utf8");
  const productTags = [...html.matchAll(/<div([^>]*class="new-products-collection_item[^>]*)>/g)]
    .map((match) => match[1]);
  const sourceSizes = productTags.map((attributes) => Number(
    attributes.match(/data-size="([^"]+)"/)[1],
  ));

  assert.equal(productTags.length, 114);
  assert.equal(PALMER_SOURCE_SLOTS.length, productTags.length);
  assert.deepEqual(PALMER_SOURCE_SLOTS.map(({ size }) => size), sourceSizes);
  assert.equal(PALMER_SOURCE_COLUMN_COUNT, 15);
  assert.equal(PALMER_SOURCE_ROW_COUNT, 8);
  assert.equal(new Set(PALMER_SOURCE_SLOTS.map(({ runtimeColumn, runtimeRow }) => (
    `${runtimeColumn}:${runtimeRow}`
  ))).size, 114);
});

test("all 114 product assets referenced by source HTML were downloaded", async () => {
  const html = await readFile(sourceHtmlPath, "utf8");
  const imageSources = [...html.matchAll(
    /<div[^>]*class="new-products-collection_item[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/g,
  )].map((match) => decodeHtmlPath(match[1]));

  assert.equal(imageSources.length, 114);
  await Promise.all(imageSources.map((source) => access(path.resolve(
    path.dirname(sourceHtmlPath),
    source,
  ))));
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
