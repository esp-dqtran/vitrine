import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalMobbinSitesUrl,
  parseSiteImport,
  type SiteImport,
} from "./sites.ts";

const approved =
  "https://mobbin.com/sites/v-7-1fbe80df-2586-4a09-aa5c-29aeeb716a09/f4e176f7-aeb6-4f9a-9689-e4379fc357b1/preview";

const validImport: SiteImport = {
  site: {
    sourceId: "site-1",
    name: "V7",
    slug: "v7",
    sourceUrl: "https://v7labs.com",
  },
  version: {
    sourceId: "version-1",
    label: "Jul 2026",
    isLatest: true,
    previewVideoUrl: "https://cdn.fixture/preview.mp4",
  },
  pages: [
    {
      sourceId: "page-1",
      title: "Home",
      url: "/",
      position: 0,
      fullPageImageUrl: "https://cdn.fixture/home.webp",
      sections: [
        {
          sourceId: "section-1",
          position: 0,
          mediaKind: "image" as const,
          mediaUrl: "https://cdn.fixture/hero.webp",
          cropTop: 0,
          cropBottom: 900,
          ocrBoxes: [],
        },
      ],
    },
  ],
};

test("canonicalizes the approved URL", () => {
  assert.deepEqual(canonicalMobbinSitesUrl(`${approved}/`), {
    canonicalUrl: approved,
    sourceSiteId: "v-7-1fbe80df-2586-4a09-aa5c-29aeeb716a09",
    sourceVersionId: "f4e176f7-aeb6-4f9a-9689-e4379fc357b1",
  });
});

test("rejects unsafe and unsupported URLs", () => {
  for (const value of [
    "http://mobbin.com/sites/a/b/preview",
    `${approved}?token=x`,
    `${approved}#x`,
    "https://example.com/sites/a/b/preview",
    "https://mobbin.com/apps/a/b/screens",
    "https://user:password@mobbin.com/sites/a/b/preview",
  ]) {
    assert.throws(
      () => canonicalMobbinSitesUrl(value),
      /invalid Mobbin Sites URL/i,
    );
  }
});

test("validates ordered media-specific sections", () => {
  const result = parseSiteImport(validImport);
  assert.equal(result.pages[0].sections[0].mediaKind, "image");
});

test("rejects duplicate positions and media-field drift", () => {
  const duplicatePage = structuredClone(validImport);
  duplicatePage.pages.push({
    ...structuredClone(validImport.pages[0]),
    sourceId: "page-2",
  });
  assert.throws(() => parseSiteImport(duplicatePage), /invalid Mobbin Sites import/i);

  const videoWithCrop = structuredClone(validImport);
  videoWithCrop.pages[0].sections[0] = {
    ...videoWithCrop.pages[0].sections[0],
    mediaKind: "video",
    mediaUrl: "https://cdn.fixture/hero.mp4",
    videoStartSeconds: 0,
    videoEndSeconds: 2,
  };
  assert.throws(() => parseSiteImport(videoWithCrop), /invalid Mobbin Sites import/i);
});

test("rejects sensitive media URLs and invalid OCR geometry", () => {
  const sensitiveUrl = structuredClone(validImport);
  sensitiveUrl.pages[0].fullPageImageUrl =
    "https://cdn.fixture/home.webp?signature=secret";
  assert.throws(() => parseSiteImport(sensitiveUrl), /invalid Mobbin Sites import/i);

  const invalidOcr = structuredClone(validImport);
  invalidOcr.pages[0].sections[0].ocrBoxes = [
    { x: 0, y: 0, width: -1, height: 10, text: "invalid" },
  ];
  assert.throws(() => parseSiteImport(invalidOcr), /invalid Mobbin Sites import/i);
});

test("accepts Mobbin's encrypted Bytescale media URLs only on the exact trusted host", () => {
  for (const pathname of [
    "/FW25bBB/video/mobbin.com/prod/file.mp4",
    "/FW25bBB/image/mobbin.com/prod/file.mp4",
    "/FW25bBB/image/mobbin.com/prod/file.webp",
  ]) {
    const trusted = structuredClone(validImport);
    trusted.version.previewVideoUrl =
      `https://bytescale.mobbin.com${pathname}?enc=fixture`;
    assert.equal(parseSiteImport(trusted).version.previewVideoUrl, trusted.version.previewVideoUrl);
  }

  for (const hostname of ["cdn.fixture", "bytescale.mobbin.com.evil.test"]) {
    const untrusted = structuredClone(validImport);
    untrusted.version.previewVideoUrl =
      `https://${hostname}/FW25bBB/video/mobbin.com/prod/file.mp4?enc=fixture`;
    assert.throws(() => parseSiteImport(untrusted), /Invalid Mobbin Sites import/);
  }

  const nonstandardPort = structuredClone(validImport);
  nonstandardPort.version.previewVideoUrl =
    "https://bytescale.mobbin.com:444/FW25bBB/video/mobbin.com/prod/file.mp4?enc=fixture";
  assert.throws(() => parseSiteImport(nonstandardPort), /Invalid Mobbin Sites import/);
});
