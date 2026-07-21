import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { ObjectMetadata, ObjectStore } from "./objectStore.ts";
import type { PublicPageBrowserResult } from "./publicPageBrowser.ts";
import {
  crawlPublicPage,
  PublicPageImportCancelledError,
  type PublicPageCrawlerDependencies,
} from "./publicPageCrawler.ts";
import type { NewPublicPageCapture, PublicPageAssets } from "./publicPageStore.ts";

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);
const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 1]);
const captureResult: PublicPageBrowserResult = {
  capture: {
    requestedUrl: "https://example.com/pricing",
    canonicalUrl: "https://example.com/pricing",
    metadata: { name: "Example", description: "Plans", category: "Website", accent: "#112233" },
    viewport: { width: 1440, height: 900 },
    document: { width: 1440, height: 1200 },
    html: "<html><body>Pricing</body></html>",
    sections: [
      { position: 0, selector: "main", tagName: "main", heading: "Pricing", text: "Pricing", bounds: { x: 0, y: 0, width: 1440, height: 600 } },
      { position: 1, selector: "footer", tagName: "footer", heading: "Footer", text: "Footer", bounds: { x: 0, y: 600, width: 1440, height: 600 } },
    ],
  },
  pageImage: png,
  sectionImages: [{ position: 0, body: png }, { position: 1, body: png }],
  preview: webm,
  scroll: { durationMs: 2_000, stops: 0 },
};

function sha(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}

function harness(overrides: Partial<PublicPageCrawlerDependencies> = {}) {
  const puts: Array<ObjectMetadata & { body: Uint8Array }> = [];
  const completes: Array<{ begin: NewPublicPageCapture; assets: PublicPageAssets; objects: ObjectMetadata[] }> = [];
  const failures: Array<{ versionId: number; message: string }> = [];
  const reports: string[] = [];
  const objectStore: ObjectStore = {
    async put(input) {
      puts.push(input);
      const { body: _body, ...metadata } = input;
      return { created: true, metadata };
    },
    async head() { return undefined; },
    async get() { throw new Error("unused"); },
    async signedGetUrl() { return undefined; },
    async *list() { return; },
    async delete() { return false; },
  };
  const begin: NewPublicPageCapture = {
    reused: false,
    app: "example-com",
    appId: 1,
    pageId: 2,
    versionId: 3,
    contentHash: "a".repeat(64),
    capture: captureResult.capture,
  };
  const dependencies: PublicPageCrawlerDependencies = {
    browser: { capture: async () => captureResult },
    objectStore,
    pageStore: {
      beginCapture: async (_capture, contentHash) => ({ ...begin, contentHash }),
      async completeCapture(newCapture, assets, objects) {
        completes.push({ begin: newCapture, assets, objects });
        return { app: newCapture.app, pageId: newCapture.pageId, versionId: newCapture.versionId, sectionCount: assets.sections.length };
      },
      async failCapture(versionId, message) { failures.push({ versionId, message }); },
      async previewObject() { return undefined; },
    },
    isCancelled: async () => false,
    report: async (message) => { reports.push(message); },
    ...overrides,
  };
  return { dependencies, puts, completes, failures, reports };
}

test("uploads every required object before one completion", async () => {
  const state = harness();

  const result = await crawlPublicPage("https://example.com/pricing", state.dependencies);

  assert.deepEqual(result, { app: "example-com", pageId: 2, versionId: 3, sectionCount: 2, reused: false });
  assert.deepEqual(state.reports, [
    "Rendering page",
    "Analyzing HTML",
    "Saving page capture",
    "Recording preview",
    "Finalizing page import",
  ]);
  assert.equal(state.puts.length, 5);
  assert.deepEqual(state.puts.map(({ contentType }) => contentType), [
    "application/json",
    "image/png",
    "video/webm",
    "image/png",
    "image/png",
  ]);
  assert.equal(state.completes.length, 1);
  assert.equal(state.completes[0].objects.length, state.puts.length);
  assert.equal(state.failures.length, 0);
  assert.equal(state.completes[0].assets.page.imageRef, `capture:${sha(png).slice(0, 16)}`);
  assert.deepEqual(state.completes[0].assets.sections.map(({ imageRef }) => imageRef), [
    `capture:ui_element:${sha(png).slice(0, 16)}:0`,
    `capture:ui_element:${sha(png).slice(0, 16)}:1`,
  ]);
});

test("unchanged capture reuses the ready version without uploading", async () => {
  const state = harness({
    pageStore: {
      beginCapture: async () => ({ reused: true, app: "example-com", pageId: 2, versionId: 9 }),
      async completeCapture() { throw new Error("must not complete"); },
      async failCapture() { throw new Error("must not fail"); },
      async previewObject() { return undefined; },
    },
  });

  assert.deepEqual(await crawlPublicPage("https://example.com/pricing", state.dependencies), {
    app: "example-com", pageId: 2, versionId: 9, sectionCount: 2, reused: true,
  });
  assert.equal(state.puts.length, 0);
});

test("cancellation after rendering never uploads or completes", async () => {
  let checks = 0;
  const state = harness({ isCancelled: async () => ++checks >= 2 });

  await assert.rejects(
    crawlPublicPage("https://example.com/pricing", state.dependencies),
    PublicPageImportCancelledError,
  );
  assert.equal(state.puts.length, 0);
  assert.equal(state.completes.length, 0);
});

test("object metadata mismatch fails the importing version", async () => {
  const state = harness();
  state.dependencies.objectStore = {
    ...state.dependencies.objectStore,
    async put(input) {
      const { body: _body, ...metadata } = input;
      return { created: true, metadata: { ...metadata, sha256: "f".repeat(64) } };
    },
  };

  await assert.rejects(
    crawlPublicPage("https://example.com/pricing", state.dependencies),
    /different public-page metadata/i,
  );
  assert.equal(state.completes.length, 0);
  assert.deepEqual(state.failures, [{ versionId: 3, message: "Public page import failed" }]);
});
