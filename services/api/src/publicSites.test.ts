import assert from "node:assert/strict";
import type { Server } from "node:http";
import test from "node:test";
import express from "express";
import type { ObjectMetadata } from "../../../src/objectStore.ts";
import type { SitesStore } from "../../../src/sitesStore.ts";
import { mountPublicSitesRoutes } from "./sites.ts";

const summary = {
  siteId: 1,
  versionId: 2,
  name: "V7",
  slug: "v-7",
  sourceUrl: "https://v7labs.com/",
  categories: [],
  styles: [],
  popularity: 1,
  label: "Jul 2026",
  isLatest: true,
  pageCount: 1,
  sectionCount: 1,
  previewUrl: "/api/sites/1/versions/2/media/preview",
  previews: [{
    id: 10,
    title: "Home",
    position: 0,
    url: "/api/sites/1/versions/2/pages/10/media",
  }],
  updatedAt: "2026-07-20T00:00:00.000Z",
};

const metadata: ObjectMetadata = {
  key: "sites/1/versions/2/preview.webm",
  sha256: "b".repeat(64),
  byteSize: 5,
  contentType: "video/webm",
  accessClass: "protected",
};

async function serve(sites = [summary]) {
  const reads: Array<Parameters<SitesStore["siteMediaObject"]>[0]> = [];
  let listReads = 0;
  const app = express();
  mountPublicSitesRoutes(app, {
    store: {
      listReadySites: async () => {
        listReads += 1;
        return sites;
      },
      siteMediaObject: async (input) => {
        reads.push(input);
        return input.siteId !== 1
          || input.versionId !== 2
          || (input.kind === "page" && input.recordId !== 10)
          ? undefined
          : metadata;
      },
    } as never,
    sendObject: async (_object, res) => {
      res.status(302).setHeader("Location", "https://objects.example/signed").end();
    },
  });
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  return {
    base: `http://127.0.0.1:${address.port}`,
    server,
    reads,
    listReads: () => listReads,
  };
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

test("serves ready Site summaries with public catalog media URLs", async (t) => {
  const { base, server } = await serve();
  t.after(() => close(server));

  const response = await fetch(`${base}/sites`);
  assert.equal(response.status, 200);
  const [site] = await response.json();
  assert.equal(
    site.previewUrl,
    "/api/sites/1/versions/2/catalog-media/preview",
  );
  assert.equal(
    site.previews[0].url,
    "/api/sites/1/versions/2/catalog-media/posters/10",
  );
});

test("serves a bounded public Site page when limit and offset are provided", async (t) => {
  const second = {
    ...summary,
    siteId: 3,
    versionId: 4,
    name: "Second",
    slug: "second",
    previewUrl: "/api/sites/3/versions/4/media/preview",
    previews: [{
      id: 30,
      title: "Home",
      position: 0,
      url: "/api/sites/3/versions/4/pages/30/media",
    }],
  };
  const { base, server } = await serve([summary, second]);
  t.after(() => close(server));

  const response = await fetch(`${base}/sites?limit=1&offset=0`);
  assert.equal(response.status, 200);
  const page = await response.json();
  assert.equal(page.total, 2);
  assert.equal(page.nextOffset, 1);
  assert.equal(page.sites.length, 1);
  assert.equal(page.sites[0].name, "V7");
  assert.equal(
    page.sites[0].previewUrl,
    "/api/sites/1/versions/2/catalog-media/preview",
  );

  assert.equal((await fetch(`${base}/sites?limit=0&offset=0`)).status, 400);
  assert.equal((await fetch(`${base}/sites?limit=24&offset=-1`)).status, 400);
});

test("serves only ready Site media without reloading the complete catalog", async (t) => {
  const { base, server, reads, listReads } = await serve();
  t.after(() => close(server));

  assert.equal(
    (await fetch(`${base}/sites/1/versions/2/catalog-media/preview`, { redirect: "manual" })).status,
    302,
  );
  assert.equal(
    (await fetch(`${base}/sites/1/versions/2/catalog-media/posters/10`, { redirect: "manual" })).status,
    302,
  );
  assert.equal(
    (await fetch(`${base}/sites/1/versions/2/catalog-media/posters/99`)).status,
    404,
  );
  assert.deepEqual(reads, [
    { siteId: 1, versionId: 2, kind: "preview" },
    { siteId: 1, versionId: 2, kind: "page", recordId: 10 },
    { siteId: 1, versionId: 2, kind: "page", recordId: 99 },
  ]);
  assert.equal(listReads(), 0);
});

test("rejects invalid or non-ready catalog media references", async (t) => {
  const { base, server } = await serve();
  t.after(() => close(server));

  assert.equal(
    (await fetch(`${base}/sites/0/versions/2/catalog-media/preview`)).status,
    400,
  );
  assert.equal(
    (await fetch(`${base}/sites/8/versions/9/catalog-media/preview`)).status,
    404,
  );
});
