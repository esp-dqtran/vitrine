import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { ObjectMetadata, ObjectStore } from "./objectStore.ts";
import { decodeMobbinSitesSource } from "./sitesSource.ts";
import {
  classifyMobbinSitesNavigation,
  crawlMobbinSite,
  PermanentSiteImportError,
  SiteImportCancelledError,
  type SitesCrawlerDependencies,
} from "./sitesCrawler.ts";

test("classifies Mobbin's logged-out shell as authentication, not navigation drift", () => {
  assert.equal(classifyMobbinSitesNavigation({ loginLinks: 1, sectionLinks: 0 }), "authentication");
  assert.equal(classifyMobbinSitesNavigation({ loginLinks: 0, sectionLinks: 0 }), "navigation-changed");
  assert.equal(classifyMobbinSitesNavigation({ loginLinks: 0, sectionLinks: 1 }), "ready");
});
import type { CompletedSiteImport } from "./sitesStore.ts";

const approved =
  "https://mobbin.com/sites/v-7-1fbe80df-2586-4a09-aa5c-29aeeb716a09/f4e176f7-aeb6-4f9a-9689-e4379fc357b1/preview";

const rawFixture = await readFile(
  new URL("../tests/fixtures/mobbin-sites-v7-rsc.txt", import.meta.url),
  "utf8",
);
const fixtureImport = decodeMobbinSitesSource(rawFixture);

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
