import assert from "node:assert/strict";
import test from "node:test";
import { appleAppStoreScreenshots } from "./appleAppStoreImport.ts";

test("selects the largest responsive rendition for each Apple App Store screenshot", () => {
  const page = [
    'https://is1-ssl.mzstatic.com/image/thumb/Purple/v4/a/01.png/157x340bb.webp',
    'https://is1-ssl.mzstatic.com/image/thumb/Purple/v4/a/01.png/600x1300bb.webp',
    'https://is2-ssl.mzstatic.com/image/thumb/Purple/v4/b/02.png/300x650bb.webp',
    'https://is2-ssl.mzstatic.com/image/thumb/Purple/v4/b/02.png/600x1300bb.webp',
  ].join(" ");

  const screenshots = appleAppStoreScreenshots(page, 2);

  assert.deepEqual(screenshots.map(({ index, width, height }) => ({ index, width, height })), [
    { index: 1, width: 600, height: 1300 },
    { index: 2, width: 600, height: 1300 },
  ]);
});

test("fails closed when the App Store shelf changes", () => {
  assert.throws(
    () => appleAppStoreScreenshots('https://is1-ssl.mzstatic.com/image/thumb/Purple/v4/a/01.png/600x1300bb.webp'),
    /Expected 5 static App Store screenshots; found 1/,
  );
});

test("reads screenshot URLs from Apple SSR JSON with escaped solidi", () => {
  const page = "https:\\/\\/is1-ssl.mzstatic.com\\/image\\/thumb\\/PurpleSource221\\/v4\\/a\\/01.png\\/600x1300bb.webp";
  const screenshots = appleAppStoreScreenshots(page, 1);

  assert.deepEqual(screenshots.map(({ index, width, height }) => ({ index, width, height })), [
    { index: 1, width: 600, height: 1300 },
  ]);
});

test("accepts Apple shelf assets backed by JPEG originals", () => {
  const page = "https://is1-ssl.mzstatic.com/image/thumb/Purple/v4/a/one.jpg/600x1300bb.webp";
  const screenshots = appleAppStoreScreenshots(page, 1);

  assert.deepEqual(screenshots.map(({ width, height }) => ({ width, height })), [
    { width: 600, height: 1300 },
  ]);
});

test("ignores square App Store icon assets beside the phone screenshots", () => {
  const page = [
    "https://is1-ssl.mzstatic.com/image/thumb/Purple/v4/icon.png/128x128bb.webp",
    "https://is1-ssl.mzstatic.com/image/thumb/Purple/v4/phone.png/600x1300bb.webp",
  ].join(" ");
  const screenshots = appleAppStoreScreenshots(page, 1);

  assert.deepEqual(screenshots.map(({ width, height }) => ({ width, height })), [
    { width: 600, height: 1300 },
  ]);
});
