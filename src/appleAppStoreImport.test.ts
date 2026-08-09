import assert from "node:assert/strict";
import test from "node:test";
import {
  appleAppStoreLookupScreenshots,
  appleAppStoreScreenshots,
  completeAppleAppStoreScreenshots,
} from "./appleAppStoreImport.ts";

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

test("keeps distinct Apple assets that reuse the same source filename", () => {
  const page = [
    'https://is1-ssl.mzstatic.com/image/thumb/Purple/v4/a/one/pr_source.png/300x650bb.webp',
    'https://is1-ssl.mzstatic.com/image/thumb/Purple/v4/a/one/pr_source.png/600x1300bb.webp',
    'https://is1-ssl.mzstatic.com/image/thumb/Purple/v4/b/two/pr_source.png/600x1300bb.webp',
  ].join(" ");

  const screenshots = appleAppStoreScreenshots(page, 2);

  assert.deepEqual(screenshots.map(({ url }) => url), [
    'https://is1-ssl.mzstatic.com/image/thumb/Purple/v4/a/one/pr_source.png/600x1300bb.webp',
    'https://is1-ssl.mzstatic.com/image/thumb/Purple/v4/b/two/pr_source.png/600x1300bb.webp',
  ]);
});

test("uses every iTunes Lookup screenshot even when filenames repeat", () => {
  const screenshots = appleAppStoreLookupScreenshots({ results: [{ screenshotUrls: [
    "https://is1-ssl.mzstatic.com/image/thumb/Purple/v4/a/one/pr_source.png/392x696bb.png",
    "https://is1-ssl.mzstatic.com/image/thumb/Purple/v4/b/two/pr_source.png/392x696bb.png",
  ] }] });

  assert.deepEqual(screenshots.map(({ index, url, width, height }) => ({ index, url, width, height })), [
    {
      index: 1,
      url: "https://is1-ssl.mzstatic.com/image/thumb/Purple/v4/a/one/pr_source.png/600x1300bb.webp",
      width: 600,
      height: 1300,
    },
    {
      index: 2,
      url: "https://is1-ssl.mzstatic.com/image/thumb/Purple/v4/b/two/pr_source.png/600x1300bb.webp",
      width: 600,
      height: 1300,
    },
  ]);
});

test("uses JPEG iTunes Lookup renditions", () => {
  const screenshots = appleAppStoreLookupScreenshots({ results: [{ screenshotUrls: [
    "https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/a/one.jpg/320x480bb.jpg",
  ] }] });

  assert.deepEqual(screenshots, [{
    index: 1,
    url: "https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/a/one.jpg/600x1300bb.webp",
    width: 600,
    height: 1300,
  }]);
});

test("reads the separate iPad screenshot shelf", () => {
  const screenshots = appleAppStoreLookupScreenshots({ results: [{
    screenshotUrls: ["https://is1-ssl.mzstatic.com/image/thumb/Purple/v4/phone.png/320x480bb.png"],
    ipadScreenshotUrls: ["https://is1-ssl.mzstatic.com/image/thumb/Purple/v4/tablet.png/320x480bb.png"],
  }] }, "ipad");

  assert.equal(screenshots.length, 1);
  assert.match(screenshots[0]?.url ?? "", /tablet\.png\/600x1300bb\.webp$/);
});

test("completes a server-rendered shelf from a matching longer Lookup feed", () => {
  const live = appleAppStoreScreenshots([
    "https://is1-ssl.mzstatic.com/image/thumb/Purple/v4/a/one.png/600x1300bb.webp",
    "https://is1-ssl.mzstatic.com/image/thumb/Purple/v4/b/two.png/600x1300bb.webp",
  ].join(" "), 2);
  const lookup = appleAppStoreLookupScreenshots({ results: [{ screenshotUrls: [
    "https://is2-ssl.mzstatic.com/image/thumb/Purple/v4/a/one.png/392x696bb.png",
    "https://is2-ssl.mzstatic.com/image/thumb/Purple/v4/b/two.png/392x696bb.png",
    "https://is2-ssl.mzstatic.com/image/thumb/Purple/v4/c/three.png/392x696bb.png",
  ] }] });

  assert.equal(completeAppleAppStoreScreenshots(live, lookup).length, 3);
});

test("keeps the live shelf when Lookup points at different assets", () => {
  const live = appleAppStoreScreenshots(
    "https://is1-ssl.mzstatic.com/image/thumb/Purple/v4/current/one.png/600x1300bb.webp",
    1,
  );
  const lookup = appleAppStoreLookupScreenshots({ results: [{ screenshotUrls: [
    "https://is1-ssl.mzstatic.com/image/thumb/Purple/v4/old/one.png/392x696bb.png",
    "https://is1-ssl.mzstatic.com/image/thumb/Purple/v4/old/two.png/392x696bb.png",
  ] }] });

  assert.deepEqual(completeAppleAppStoreScreenshots(live, lookup), live);
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
