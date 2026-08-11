import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appCatalogTypesenseFilter,
  createTypesenseAppCatalogClient,
} from "./typesenseAppCatalog.ts";

const document = {
  id: "linear:web", appId: "linear", platform: "web" as const,
  title: "Linear", searchText: "Linear productivity project management Login Text input",
  categories: ["Productivity"],
  latestAt: 1_700_000_000, trendingScore: 8,
  card: JSON.stringify({ id: "linear", app: "Linear", description: null, categories: [], accent: "#5e6ad2", totalScreens: 12, platforms: ["web"], lastCapturedAt: "2023-11-14T00:00:00.000Z", previewScreens: [], websiteUrl: null, iconUrl: null }),
};

test("maps App category filters to Typesense", () => {
  assert.equal(appCatalogTypesenseFilter({
    platform: "web",
    filters: [
      { group: "categories", value: "Productivity" },
      { group: "categories", value: "CRM" },
      { group: "elements", value: "Text input" },
    ],
  }), "platform:=`web` && (categories:=`Productivity` || categories:=`CRM`)");
});

test("indexes and returns App-card documents through a separate alias", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const client = createTypesenseAppCatalogClient(
    { host: "http://typesense.test", apiKey: "secret", collection: "vitrines_apps_v1" },
    async (url, init) => {
      requests.push({ url: String(url), init });
      if (String(url).endsWith("/aliases/vitrines_apps_v1") && init?.method !== "PUT") return new Response("", { status: 404 });
      if (String(url).endsWith("/collections") && init?.method === "POST") return new Response("{}", { status: 201 });
      if (String(url).includes("/documents/import")) return new Response('{"success":true}', { status: 200 });
      if (String(url).endsWith("/aliases/vitrines_apps_v1") && init?.method === "PUT") return new Response("{}", { status: 200 });
      return new Response(JSON.stringify({
        found: 1,
        hits: [{ document }],
        facet_counts: [{ field_name: "categories", counts: [{ value: "Productivity", count: 1 }] }],
      }));
    },
  );
  assert.equal(await client.index([document]), 1);
  const result = await client.search({ query: "linear", platform: "web", filters: [], sort: "latest" });
  assert.equal(result.apps[0]?.id, "linear");
  assert.equal(result.totalCount, 1);
  assert.deepEqual(result.facets, [{ group: "categories", value: "Productivity", count: 1 }]);
  assert.match(requests.at(-1)?.url ?? "", /filter_by=platform%3A%3D%60web%60/);
  assert.match(requests.at(-1)?.url ?? "", /sort_by=_text_match%3Adesc%2ClatestAt%3Adesc/);
});

test("upserts a changed App document through the stable alias", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const client = createTypesenseAppCatalogClient(
    { host: "http://typesense.test", apiKey: "secret", collection: "vitrines_apps_v1" },
    async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response("{}", { status: 200 });
    },
  );

  await client.upsert(document);
  assert.equal(requests.length, 1);
  assert.match(requests[0]?.url ?? "", /\/collections\/vitrines_apps_v1\/documents\?action=upsert$/);
  assert.equal(requests[0]?.init?.method, "POST");
  assert.equal(requests[0]?.init?.body, JSON.stringify(document));
});
