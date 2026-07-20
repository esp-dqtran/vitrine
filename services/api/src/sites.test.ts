import assert from "node:assert/strict";
import type { Server } from "node:http";
import test from "node:test";
import express from "express";
import type { ObjectMetadata } from "../../../src/objectStore.ts";
import type { SiteVersionDetail, SitesStore } from "../../../src/sitesStore.ts";
import { mountSitesRoutes } from "./sites.ts";

const metadata: ObjectMetadata = {
  key: "sites/1/versions/2/preview.webp",
  sha256: "a".repeat(64),
  byteSize: 10,
  contentType: "image/webp",
  accessClass: "protected",
};

const detail: SiteVersionDetail = {
  siteId: 1,
  versionId: 2,
  name: "V7",
  slug: "v-7-1fbe80df-2586-4a09-aa5c-29aeeb716a09",
  sourceUrl: "https://v7labs.com/",
  canonicalUrl: "https://mobbin.com/sites/v-7-1fbe80df-2586-4a09-aa5c-29aeeb716a09/f4e176f7-aeb6-4f9a-9689-e4379fc357b1/preview",
  label: "Jul 2026",
  isLatest: true,
  previewUrl: "/api/sites/1/versions/2/media/preview",
  pages: [],
};

function fakeStore(overrides: Partial<SitesStore> = {}): SitesStore {
  return {
    readyVersionByCanonicalUrl: async () => undefined,
    listReadySites: async () => [{
      siteId: 1,
      versionId: 2,
      name: "V7",
      slug: detail.slug,
      sourceUrl: detail.sourceUrl,
      label: detail.label,
      isLatest: true,
      pageCount: 16,
      sectionCount: 46,
      previewUrl: detail.previewUrl,
      previews: [
        { id: 10, title: "Home", position: 0, url: "/api/sites/1/versions/2/pages/10/media" },
        { id: 11, title: "Pricing", position: 1, url: "/api/sites/1/versions/2/pages/11/media" },
      ],
      updatedAt: "2026-07-20T00:00:00.000Z",
    }],
    readyVersionDetail: async () => detail,
    beginImport: async () => ({ siteId: 1, versionId: 2 }),
    completeImport: async () => ({ siteId: 1, versionId: 2 }),
    failImport: async () => undefined,
    siteMediaObject: async () => metadata,
    ...overrides,
  };
}

async function serve(store: SitesStore, sent: ObjectMetadata[] = []) {
  const app = express();
  mountSitesRoutes(app, {
    store,
    sendObject: async (object, res) => {
      sent.push(object);
      res.status(302).setHeader("Location", "https://objects.example/signed").end();
    },
  });
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  return { base: `http://127.0.0.1:${address.port}`, server };
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

test("serves only ready Site summaries and version details", async (t) => {
  const { base, server } = await serve(fakeStore());
  t.after(() => close(server));

  const sites = await fetch(`${base}/sites`);
  assert.equal(sites.status, 200);
  const [summary] = await sites.json();
  assert.equal(summary.pageCount, 16);
  assert.deepEqual(summary.previews, [
    { id: 10, title: "Home", position: 0, url: "/api/sites/1/versions/2/pages/10/media" },
    { id: 11, title: "Pricing", position: 1, url: "/api/sites/1/versions/2/pages/11/media" },
  ]);

  const version = await fetch(`${base}/sites/1/versions/2`);
  assert.equal(version.status, 200);
  assert.equal((await version.json()).canonicalUrl, detail.canonicalUrl);
});

test("validates positive Site route IDs before store reads", async (t) => {
  let reads = 0;
  const store = fakeStore({
    readyVersionDetail: async () => { reads++; return detail; },
    siteMediaObject: async () => { reads++; return metadata; },
  });
  const { base, server } = await serve(store);
  t.after(() => close(server));

  assert.equal((await fetch(`${base}/sites/0/versions/2`)).status, 400);
  assert.equal((await fetch(`${base}/sites/1/versions/nope/media/preview`)).status, 400);
  assert.equal((await fetch(`${base}/sites/1/versions/2/pages/-1/media`)).status, 400);
  assert.equal(reads, 0);
});

test("resolves each protected Site media route without exposing object keys", async (t) => {
  const inputs: Array<Parameters<SitesStore["siteMediaObject"]>[0]> = [];
  const sent: ObjectMetadata[] = [];
  const { base, server } = await serve(fakeStore({
    siteMediaObject: async (input) => { inputs.push(input); return metadata; },
  }), sent);
  t.after(() => close(server));

  const paths = [
    "/sites/1/versions/2/media/preview",
    "/sites/1/versions/2/pages/3/media",
    "/sites/1/versions/2/sections/4/media",
    "/sites/1/versions/2/sections/4/poster",
  ];
  for (const path of paths) {
    const response = await fetch(`${base}${path}`, { redirect: "manual" });
    assert.equal(response.status, 302);
    assert.doesNotMatch(await response.text(), /sites\/1\/versions/);
  }
  assert.deepEqual(inputs, [
    { siteId: 1, versionId: 2, kind: "preview" },
    { siteId: 1, versionId: 2, kind: "page", recordId: 3 },
    { siteId: 1, versionId: 2, kind: "section", recordId: 4 },
    { siteId: 1, versionId: 2, kind: "poster", recordId: 4 },
  ]);
  assert.equal(sent.length, 4);
});

test("returns 404 for missing or internal Site media", async (t) => {
  let result: ObjectMetadata | undefined;
  const { base, server } = await serve(fakeStore({ siteMediaObject: async () => result }));
  t.after(() => close(server));

  assert.equal((await fetch(`${base}/sites/1/versions/2/media/preview`)).status, 404);
  result = { ...metadata, accessClass: "internal" };
  assert.equal((await fetch(`${base}/sites/1/versions/2/media/preview`)).status, 404);
});
