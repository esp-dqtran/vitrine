import assert from "node:assert/strict";
import type { Server } from "node:http";
import test from "node:test";
import express from "express";
import type { ObjectMetadata } from "../../../src/objectStore.ts";
import type {
  ReadySitesPage,
  ReadySitesPageInput,
  SiteSummary,
  SitesStore,
} from "../../../src/sitesStore.ts";
import { SitesCursorError } from "../../../src/sitesCursor.ts";
import type { TypesenseSiteCatalogClient } from "../../../src/typesenseSiteCatalog.ts";
import { mountPublicSitesRoutes } from "./sites.ts";

const summary: SiteSummary = {
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
  previewMediaKind: "video",
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
  accessClass: "public-preview",
};
const cursorSecret = "public-sites-test-secret-0123456789abcdef";

async function serve(
  sites = [summary],
  listReadySitesPage?: (input: ReadySitesPageInput) => Promise<ReadySitesPage>,
  typesenseSiteCatalog?: TypesenseSiteCatalogClient,
) {
  const reads: Array<Parameters<SitesStore["siteMediaObject"]>[0]> = [];
  const pageReads: ReadySitesPageInput[] = [];
  let listReads = 0;
  const app = express();
  mountPublicSitesRoutes(app, {
    store: {
      listReadySites: async () => {
        listReads += 1;
        return sites;
      },
      listReadySitesPage: async (input: ReadySitesPageInput) => {
        pageReads.push(input);
        if (listReadySitesPage) return listReadySitesPage(input);
        return {
          items: sites,
          nextCursor: null,
          totalCount: sites.length,
          facets: [],
        };
      },
      siteMediaObject: async (
        input: Parameters<SitesStore["siteMediaObject"]>[0],
      ) => {
        reads.push(input);
        return input.siteId !== 1
          || input.versionId !== 2
          || (input.kind === "page" && input.recordId !== 10)
          ? undefined
          : metadata;
      },
    } as never,
    cursorSecret,
    ...(typesenseSiteCatalog ? { typesenseSiteCatalog } : {}),
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
    pageReads,
    listReads: () => listReads,
  };
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

test("always serves the canonical Site discovery envelope", async (t) => {
  const { base, server } = await serve();
  t.after(() => close(server));

  const response = await fetch(`${base}/sites`);
  assert.equal(response.status, 200);
  const page = await response.json();
  assert.deepEqual(Object.keys(page), ["items", "nextCursor", "totalCount", "facets"]);
  const [site] = page.items;
  assert.equal(
    site.previewUrl,
    "/api/sites/1/versions/2/catalog-media/preview",
  );
  assert.equal(
    site.previews[0].url,
    "/api/sites/1/versions/2/catalog-media/posters/10",
  );
});

test("rejects the retired public offset page shape", async (t) => {
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

  assert.equal((await fetch(`${base}/sites?limit=1&offset=0`)).status, 400);
  assert.equal((await fetch(`${base}/sites?limit=0&offset=0`)).status, 400);
  assert.equal((await fetch(`${base}/sites?limit=24&offset=-1`)).status, 400);
});

test("serves the exact canonical cursor discovery envelope", async (t) => {
  const facets = [
    { group: "categories", value: "Business", count: 12 },
    { group: "sections", value: "Pricing", count: 8 },
    { group: "styles", value: "Minimal", count: 6 },
  ];
  const { base, server, pageReads, listReads } = await serve(
    [summary],
    async () => ({
      items: [summary],
      nextCursor: "next-site-cursor",
      totalCount: 37,
      facets,
    }),
  );
  t.after(() => close(server));

  const response = await fetch(
    `${base}/sites?platform=web&sort=popular&query=linear`
      + `&filter=categories.Business&filter=categories.Finance`
      + `&filter=sections.Pricing&limit=12`,
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "public, max-age=60, stale-while-revalidate=240");
  const body = await response.json();
  assert.deepEqual(Object.keys(body), ["items", "nextCursor", "totalCount", "facets"]);
  assert.equal(body.items[0].previewUrl, "/api/sites/1/versions/2/catalog-media/preview");
  assert.equal(body.nextCursor, "next-site-cursor");
  assert.equal(body.totalCount, 37);
  assert.deepEqual(body.facets, facets);
  assert.deepEqual(pageReads, [{
    platform: "web",
    sort: "popular",
    query: "linear",
    limit: 12,
    cursorSecret,
    filters: [
      { group: "categories", value: "Business" },
      { group: "categories", value: "Finance" },
      { group: "sections", value: "Pricing" },
    ],
  }]);
  assert.equal(listReads(), 0);
});

test("serves Site catalog searches from Typesense before PostgreSQL", async (t) => {
  let postgresReads = 0;
  let typesenseInput: unknown;
  const { base, server } = await serve(
    [summary],
    async () => {
      postgresReads += 1;
      return { items: [], nextCursor: null, totalCount: 0, facets: [] };
    },
    {
      index: async () => 0,
      upsert: async () => undefined,
      search: async (input) => {
        typesenseInput = input;
        return {
          sites: [summary],
          nextPage: 2,
          totalCount: 13,
          facets: [{ group: "sections", value: "Pricing", count: 7 }],
        };
      },
    },
  );
  t.after(() => close(server));

  const response = await fetch(`${base}/sites/search?platform=web&sort=popular&query=framer&filter=sections.Pricing&limit=12`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("server-timing") ?? "", /^typesense-site;dur=/);
  assert.equal(postgresReads, 0);
  assert.deepEqual(typesenseInput, {
    query: "framer",
    filters: [{ group: "sections", value: "Pricing" }],
    sort: "popular",
    page: 1,
    limit: 12,
  });
  assert.deepEqual(await response.json(), {
    items: [{
      ...summary,
      routeSlug: "v7",
      previewUrl: "/api/sites/1/versions/2/catalog-media/preview",
      previews: [{
        id: 10,
        title: "Home",
        position: 0,
        url: "/api/sites/1/versions/2/catalog-media/posters/10",
      }],
    }],
    nextCursor: "typesense-site:2",
    totalCount: 13,
    facets: [{ group: "sections", value: "Pricing", count: 7 }],
  });
});

test("rejects invalid canonical Site queries before reading the store", async (t) => {
  const { base, server, pageReads, listReads } = await serve();
  t.after(() => close(server));

  for (const suffix of [
    "platform=ios&sort=latest",
    "platform=android&sort=latest",
    "platform=web&sort=trending",
    `platform=web&query=${"x".repeat(121)}`,
    "platform=web&filter=unknown.Value",
    "platform=web&filter=styles.",
    "platform=web&limit=49",
    "platform=web&offset=1",
    `platform=web&${Array.from({ length: 41 }, (_, index) =>
      `filter=categories.C${index}`
    ).join("&")}`,
  ]) {
    assert.equal((await fetch(`${base}/sites?${suffix}`)).status, 400, suffix);
  }
  assert.deepEqual(pageReads, []);
  assert.equal(listReads(), 0);
});

test("returns 400 for an invalid Site cursor and supports no-store refresh", async (t) => {
  const { base, server } = await serve([summary], async (input) => {
    if (input?.cursor) throw new SitesCursorError();
    return { items: [summary], nextCursor: null, totalCount: 1, facets: [] };
  });
  t.after(() => close(server));

  const invalid = await fetch(`${base}/sites?platform=web&sort=latest&cursor=bad`);
  assert.equal(invalid.status, 400);
  assert.deepEqual(await invalid.json(), { error: "invalid Sites cursor" });

  const refresh = await fetch(`${base}/sites?platform=web&sort=latest&refresh=1`);
  assert.equal(refresh.status, 200);
  assert.equal(refresh.headers.get("cache-control"), "no-store");
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
