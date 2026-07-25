import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import sharp from "sharp";
import type { ObjectMetadata, ObjectStore } from "./objectStore.ts";
import { decodeMobbinSitesSource } from "./sitesSource.ts";
import {
  classifyMobbinSitesNavigation,
  collectMobbinSitesSectionMedia,
  createSiteCaptureLatch,
  crawlMobbinSite,
  mergeMobbinSitesPreviewMetadata,
  mobbinSiteCategoriesFromHrefs,
  PermanentSiteImportError,
  resolveMobbinSitesLiveMedia,
  SiteImportCancelledError,
  type SitesCrawlerDependencies,
} from "./sitesCrawler.ts";

test("classifies Mobbin's logged-out shell as authentication, not navigation drift", () => {
  assert.equal(classifyMobbinSitesNavigation({ loginLinks: 1, sectionLinks: 0 }), "authentication");
  assert.equal(classifyMobbinSitesNavigation({ loginLinks: 0, sectionLinks: 0 }), "navigation-changed");
  assert.equal(classifyMobbinSitesNavigation({ loginLinks: 0, sectionLinks: 1 }), "ready");
});

test("defers a source-capture failure until the crawler reads it", async () => {
  const latch = createSiteCaptureLatch();
  const error = new PermanentSiteImportError("Mobbin Sites source changed");

  latch.fail(error);
  await new Promise<void>((resolve) => setImmediate(resolve));

  await assert.rejects(latch.read(), error);
});

import type { CompletedSiteImport } from "./sitesStore.ts";
import type { SiteImport } from "./sites.ts";

const approved =
  "https://mobbin.com/sites/v-7-1fbe80df-2586-4a09-aa5c-29aeeb716a09/f4e176f7-aeb6-4f9a-9689-e4379fc357b1/preview";

const rawFixture = await readFile(
  new URL("../tests/fixtures/mobbin-sites-v7-rsc.txt", import.meta.url),
  "utf8",
);
const fixtureImport = decodeMobbinSitesSource(rawFixture);

test("extracts and stores the exact Mobbin Site preview categories", () => {
  const categories = mobbinSiteCategoriesFromHrefs([
    "/search/sites?content_type=sites&sort=publishedAt&filter=categories.Technology",
    "/search/sites?content_type=sites&sort=publishedAt&filter=categories.Finance",
    "/search/sites?content_type=sites&sort=publishedAt&filter=styles.Minimal",
    "/search/sites?content_type=sites&sort=publishedAt&filter=categories.Technology",
  ]);

  assert.deepEqual(categories, ["Technology", "Finance"]);
  assert.deepEqual(
    mergeMobbinSitesPreviewMetadata(fixtureImport, { categories }).site.categories,
    ["Technology", "Finance"],
  );
  assert.equal(
    mergeMobbinSitesPreviewMetadata(fixtureImport, { categories }).site.logoUrl,
    "https://cdn.fixture/asset-0039.webp",
  );
});

test("revisits Mobbin's virtualized Sections grid when lazy media is missing", async () => {
  let pass = 0;
  const fakePage = {
    async $$eval() {
      return pass < 2
        ? [{
            sourceId: "section-a",
            imageUrl: "https://cdn.example/a.webp",
            videoUrl: "",
            posterUrl: "",
          }]
        : [
            {
              sourceId: "section-a",
              imageUrl: "https://cdn.example/a.webp",
              videoUrl: "",
              posterUrl: "",
            },
            {
              sourceId: "section-b",
              imageUrl: "",
              videoUrl: "https://cdn.example/b.mp4",
              posterUrl: "https://cdn.example/b-poster.webp",
            },
          ];
    },
    async evaluate(callback: () => unknown) {
      if (String(callback).includes("scrollTo")) {
        pass++;
        return undefined;
      }
      return true;
    },
    async waitForTimeout() {},
  };
  const graph = {
    pages: [
      {
        sourceId: "page-a",
        sections: [{ sourceId: "section-a", mediaKind: "image" }],
      },
      {
        sourceId: "page-b",
        sections: [{ sourceId: "section-b", mediaKind: "video" }],
      },
    ],
  } as SiteImport;

  assert.deepEqual(
    await collectMobbinSitesSectionMedia(fakePage as never, graph),
    {
      sectionMediaUrls: {
        "section-a": "https://cdn.example/a.webp",
        "section-b": "https://cdn.example/b.mp4",
      },
      sectionPosterUrls: {
        "section-b": "https://cdn.example/b-poster.webp",
      },
      pageImageUrls: {
        "page-a": "https://cdn.example/a.webp",
        "page-b": "https://cdn.example/b-poster.webp",
      },
    },
  );
  assert.equal(pass, 2);
});

test("replaces retired Supabase media with the live Mobbin CDN snapshot", () => {
  const retired = structuredClone(fixtureImport);
  for (const page of retired.pages) {
    page.fullPageImageUrl =
      `https://ujasntkfphywizsdaapi.supabase.co/storage/v1/object/public/content/sites/${page.sourceId}.png`;
    for (const section of page.sections) {
      if (section.posterUrl) {
        section.posterUrl =
          `https://ujasntkfphywizsdaapi.supabase.co/storage/v1/object/public/content/sites/${page.sourceId}.png`;
      }
    }
  }
  const liveSections = Object.fromEntries(
    retired.pages.flatMap((page) => page.sections).map((section) => [
      section.sourceId,
      section.mediaKind === "video"
        ? `https://bytescale.mobbin.com/FW25bBB/video/mobbin.com/prod/file.mp4?enc=${section.sourceId}`
        : `https://bytescale.mobbin.com/FW25bBB/image/mobbin.com/prod/content/sites/${section.sourceId}.png`,
    ]),
  );
  const livePosters = Object.fromEntries(
    retired.pages.flatMap((page) => page.sections)
      .filter((section) => section.mediaKind === "video")
      .map((section) => [
        section.sourceId,
        `https://bytescale.mobbin.com/FW25bBB/image/mobbin.com/prod/content/sites/${section.sourceId}-poster.webp`,
      ]),
  );
  const livePages = Object.fromEntries(
    retired.pages.map((page) => [
      page.sourceId,
      `https://bytescale.mobbin.com/FW25bBB/image/mobbin.com/prod/content/sites/${page.sourceId}-page.webp`,
    ]),
  );

  const resolved = resolveMobbinSitesLiveMedia(retired, {
    previewVideoUrl:
      "https://bytescale.mobbin.com/FW25bBB/video/mobbin.com/prod/file.mp4?enc=preview",
    previewMediaKind: "video",
    sectionMediaUrls: liveSections,
    sectionPosterUrls: livePosters,
    pageImageUrls: livePages,
  });

  assert.equal(resolved.version.previewVideoUrl.includes("?enc=preview"), true);
  assert.equal(
    resolved.pages.every((page) => page.fullPageImageUrl === livePages[page.sourceId]),
    true,
  );
  assert.equal(
    resolved.pages.flatMap((page) => page.sections).every((section) =>
      section.mediaUrl === liveSections[section.sourceId] &&
      (section.mediaKind !== "video" ||
        section.posterUrl === livePosters[section.sourceId])),
    true,
  );
});

test("stores an image-only Site preview using the image media contract", async () => {
  const imageOnly = structuredClone(fixtureImport);
  imageOnly.version.previewMediaKind = "image";
  imageOnly.version.previewVideoUrl = "https://cdn.fixture/preview.png";
  const harness = crawlerHarness({ captureSource: async () => imageOnly });

  await crawlMobbinSite(approved, harness.dependencies);

  const preview = harness.putCalls.find((call) => call.key.includes("/preview/"));
  assert.ok(preview);
  assert.equal(preview.contentType, "image/png");
  assert.match(preview.key, /\.png$/);
});

test("stores normalized source and every required V7 media object before one commit", async () => {
  const harness = crawlerHarness();

  const result = await crawlMobbinSite(approved, harness.dependencies);

  assert.deepEqual(result, { siteId: 1, versionId: 2, pageCount: 16, sectionCount: 46 });
  assert.equal(harness.beginCalls.length, 1);
  assert.equal(harness.completeCalls.length, 1);
  assert.equal(harness.failCalls.length, 0);
  assert.equal(harness.putCalls.length, 64);
  assert.equal(harness.putCalls.every((call) => call.key.startsWith("sites/")), true);
  const source = harness.putCalls.find((call) => call.contentType === "application/json");
  assert.ok(source);
  assert.equal(JSON.parse(source.body.toString()).pages.length, 16);
  for (const call of harness.putCalls) {
    assert.equal(call.byteSize, call.body.byteLength);
    assert.equal(call.sha256, createHash("sha256").update(call.body).digest("hex"));
  }
  const completed = harness.completeCalls[0];
  assert.equal(Object.keys(completed.input.objectKeys.pages).length, 16);
  assert.equal(Object.keys(completed.input.objectKeys.sections).length, 46);
  assert.equal(completed.objects.length, 64);
});

test("redacts encrypted Mobbin delivery values from the normalized source object", async () => {
  const liveGraph = structuredClone(fixtureImport);
  liveGraph.version.previewVideoUrl =
    "https://bytescale.mobbin.com/FW25bBB/video/mobbin.com/prod/file.mp4?enc=preview-secret";
  const harness = crawlerHarness({ captureSource: async () => liveGraph });

  await crawlMobbinSite(approved, harness.dependencies);

  const source = harness.putCalls.find((call) => call.contentType === "application/json");
  assert.ok(source);
  const storedSource = source.body.toString();
  assert.doesNotMatch(storedSource, /preview-secret/);
  assert.match(storedSource, /enc=redacted/);
});

test("requires downloaded media to match the graph's image or video kind", async () => {
  let downloads = 0;
  const harness = crawlerHarness({
    download: async (url) => {
      downloads++;
      if (downloads <= 2) return fixtureAsset(url);
      const body = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      return { body, contentType: "image/png", contentLength: body.length, finalUrl: url };
    },
  });

  await assert.rejects(
    crawlMobbinSite(approved, harness.dependencies),
    /media kind/i,
  );
  assert.equal(harness.completeCalls.length, 0);
});

test("strips the detected Mobbin footer from Sites images before object storage", async () => {
  const base = await sharp({
    create: { width: 600, height: 600, channels: 3, background: "#ffffff" },
  }).png().toBuffer();
  const footer = await sharp({
    create: { width: 600, height: 121, channels: 3, background: "#2f2f2f" },
  }).png().toBuffer();
  const watermarked = await sharp(base)
    .composite([{ input: footer, left: 0, top: 479 }])
    .png()
    .toBuffer();
  const harness = crawlerHarness({
    download: async (url) => {
      if (new URL(url).pathname.endsWith(".mp4")) return fixtureAsset(url);
      return {
        body: watermarked,
        contentType: "image/png",
        contentLength: watermarked.length,
        finalUrl: url,
      };
    },
  });

  await crawlMobbinSite(approved, harness.dependencies);

  const image = harness.putCalls.find((call) => call.contentType === "image/png");
  assert.ok(image);
  assert.equal((await sharp(image.body).metadata()).height, 479);
});

test("cancellation after begin fails the invisible import and never completes", async () => {
  let checks = 0;
  const harness = crawlerHarness({
    isCancelled: async () => ++checks >= 3,
  });

  await assert.rejects(
    crawlMobbinSite(approved, harness.dependencies),
    SiteImportCancelledError,
  );

  assert.equal(harness.beginCalls.length, 1);
  assert.equal(harness.completeCalls.length, 0);
  assert.equal(harness.failCalls.length, 1);
});

test("invalid media signatures and oversized declarations never complete", async () => {
  for (const download of [
    async () => ({ body: Buffer.from("not an image"), contentType: "image/png" }),
    async (url: string) => ({
      ...fixtureAsset(url),
      contentLength: 64 * 1024 * 1024 + 1,
    }),
    async (url: string) => ({
      ...fixtureAsset(url),
      finalUrl: "https://[::1]/private",
    }),
  ]) {
    const harness = crawlerHarness({ download });
    await assert.rejects(
      crawlMobbinSite(approved, harness.dependencies),
      PermanentSiteImportError,
    );
    assert.equal(harness.completeCalls.length, 0);
    assert.equal(harness.failCalls.length, 1);
  }
});

function crawlerHarness(overrides: Partial<SitesCrawlerDependencies> = {}) {
  const putCalls: Array<ObjectMetadata & { body: Buffer }> = [];
  const beginCalls: unknown[] = [];
  const completeCalls: Array<{ input: CompletedSiteImport; objects: ObjectMetadata[] }> = [];
  const failCalls: Array<{ url: string; message: string }> = [];
  const objectStore: ObjectStore = {
    async put(input) {
      const stored = { ...input, body: Buffer.from(input.body) };
      putCalls.push(stored);
      const { body: _body, ...metadata } = stored;
      return { created: true, metadata };
    },
    async head() { return undefined; },
    async get() { throw new Error("not used"); },
    async signedGetUrl() { return undefined; },
    async *list() { return; },
    async delete() { return false; },
  };
  const sitesStore = {
    async beginImport(identity: unknown, graph: unknown) {
      beginCalls.push({ identity, graph });
      return { siteId: 1, versionId: 2 };
    },
    async completeImport(input: CompletedSiteImport, objects: ObjectMetadata[]) {
      completeCalls.push({ input, objects });
      return { siteId: 1, versionId: 2 };
    },
    async failImport(url: string, message: string) {
      failCalls.push({ url, message });
    },
  };
  const dependencies: SitesCrawlerDependencies = {
    captureSource: async () => fixtureImport,
    download: async (url) => fixtureAsset(url),
    objectStore,
    sitesStore,
    isCancelled: async () => false,
    ...overrides,
  };
  return { dependencies, putCalls, beginCalls, completeCalls, failCalls };
}

function fixtureAsset(url: string) {
  const pathname = new URL(url).pathname;
  if (pathname.endsWith(".mp4")) {
    const body = Buffer.from([0, 0, 0, 20, 0x66, 0x74, 0x79, 0x70]);
    return { body, contentType: "video/mp4", contentLength: body.length, finalUrl: url };
  }
  const body = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return { body, contentType: "image/png", contentLength: body.length, finalUrl: url };
}
