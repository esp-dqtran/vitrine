import assert from "node:assert/strict";
import test from "node:test";
import {
  createTypesenseSiteCatalogClient,
  siteCatalogTypesenseFilter,
} from "./typesenseSiteCatalog.ts";

const document = {
  id: "site:7", siteId: 7, versionId: 9, title: "Linear", sourceUrl: "https://linear.app",
  searchText: "Linear project management pricing hero Framer Motion", categories: ["Business"],
  sections: ["Pricing", "Hero"], styles: ["Minimal"], technologies: ["Framer"], motion: ["scroll-linked"],
  latestAt: 1_700_000_000, popularity: 8,
  card: JSON.stringify({
    siteId: 7, versionId: 9, name: "Linear", slug: "linear", sourceUrl: "https://linear.app",
    categories: ["Business"], styles: ["Minimal"], popularity: 8, label: "Aug 2026", isLatest: true,
    pageCount: 1, sectionCount: 2, previewUrl: "/assets/sites/7/preview.webp", isUpdated: false,
    previewMediaKind: "image", previews: [], updatedAt: "2026-08-11T00:00:00.000Z",
  }),
};

test("maps Site filters to Typesense fields", () => {
  assert.equal(siteCatalogTypesenseFilter({
    filters: [
      { group: "categories", value: "Business" },
      { group: "sections", value: "Pricing" },
      { group: "styles", value: "Minimal" },
    ],
  }), "(categories:=`Business`) && (sections:=`Pricing`) && (styles:=`Minimal`)");
});

test("indexes and searches Site cards through a dedicated Typesense alias", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const client = createTypesenseSiteCatalogClient(
    { host: "http://typesense.test", apiKey: "secret", collection: "vitrines_sites_v1" },
    async (url, init) => {
      requests.push({ url: String(url), init });
      if (String(url).endsWith("/aliases/vitrines_sites_v1") && init?.method !== "PUT") return new Response("", { status: 404 });
      if (String(url).endsWith("/collections") && init?.method === "POST") return new Response("{}", { status: 201 });
      if (String(url).includes("/documents/import")) return new Response('{"success":true}', { status: 200 });
      if (String(url).endsWith("/aliases/vitrines_sites_v1") && init?.method === "PUT") return new Response("{}", { status: 200 });
      return new Response(JSON.stringify({
        found: 1,
        hits: [{ document }],
        facet_counts: [{ field_name: "sections", counts: [{ value: "Pricing", count: 1 }] }],
      }));
    },
  );

  assert.equal(await client.index([document]), 1);
  const result = await client.search({
    query: "framer", filters: [{ group: "sections", value: "Pricing" }], sort: "popular",
  });
  assert.equal(result.sites[0]?.siteId, 7);
  assert.deepEqual(result.facets, [{ group: "sections", value: "Pricing", count: 1 }]);
  assert.match(requests.at(-1)?.url ?? "", /query_by=title%2CsourceUrl%2CsearchText%2Ctechnologies%2Cmotion/);
  assert.match(requests.at(-1)?.url ?? "", /filter_by=%28sections%3A%3D%60Pricing%60%29/);
  assert.match(requests.at(-1)?.url ?? "", /sort_by=popularity%3Adesc%2ClatestAt%3Adesc%2C_text_match%3Adesc/);
});

test("upserts a changed Site document through the stable alias", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const client = createTypesenseSiteCatalogClient(
    { host: "http://typesense.test", apiKey: "secret", collection: "vitrines_sites_v1" },
    async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response("{}", { status: 200 });
    },
  );

  await client.upsert(document);
  assert.match(requests[0]?.url ?? "", /\/collections\/vitrines_sites_v1\/documents\?action=upsert$/);
  assert.equal(requests[0]?.init?.body, JSON.stringify(document));
});
