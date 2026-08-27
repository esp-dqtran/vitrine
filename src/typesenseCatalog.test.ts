import { test } from "node:test";
import assert from "node:assert/strict";
import type { CrawledImage } from "./db.ts";
import type { DesignSystemSnapshot } from "./designSystem.ts";
import {
  TYPESENSE_CATALOG_COLLECTION,
  createTypesenseCatalogClient,
  typesenseCatalogConfigFromEnv,
  typesenseFilter,
} from "./typesenseCatalog.ts";
import { normalizeSearchRequest } from "./searchTypes.ts";

const source = {
  images: [{
    id: 1, app: "linear", platform: "web", image_url: "linear.webp", description: "Login",
    analysis: { description: "Email login", pageType: "Login", productArea: "Authentication", theme: "dark", visibleStates: ["default"], componentNames: ["Text input"] },
  }] as CrawledImage[],
  systems: [] as DesignSystemSnapshot[],
  flows: [],
  appCategories: { linear: ["Productivity"] },
};

test("builds an escaped Typesense filter from catalog filters", () => {
  assert.equal(typesenseFilter({ query: "", kind: "flow", platform: "web", flowTag: "Authentication", appCategory: "Productivity" }), "kind:=`flow` && appCategories:=`Productivity` && platform:=`web` && flowTags:=`Authentication`");
  assert.equal(typesenseFilter({ query: "", kind: "all", state: "ready`\\now" }), "states:=`ready\\`\\\\now`");
});

test("requires an explicit Typesense configuration", () => {
  assert.equal(typesenseCatalogConfigFromEnv({}), undefined);
  assert.throws(() => typesenseCatalogConfigFromEnv({ TYPESENSE_SEARCH_ENABLED: "true" }), /TYPESENSE_HOST/);
  assert.throws(() => typesenseCatalogConfigFromEnv({ TYPESENSE_SEARCH_ENABLED: "true", TYPESENSE_HOST: "http://typesense.test", TYPESENSE_API_KEY: "secret", TYPESENSE_COLLECTION: "not a collection" }), /TYPESENSE_COLLECTION/);
  assert.deepEqual(typesenseCatalogConfigFromEnv({
    TYPESENSE_SEARCH_ENABLED: "true", TYPESENSE_HOST: "http://10.104.0.3:8108/", TYPESENSE_API_KEY: "secret",
  }), { host: "http://10.104.0.3:8108", apiKey: "secret", collection: TYPESENSE_CATALOG_COLLECTION });
});

test("creates, imports, and searches catalog documents through Typesense", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const client = createTypesenseCatalogClient(
    { host: "http://typesense.test", apiKey: "secret", collection: TYPESENSE_CATALOG_COLLECTION },
    async (url, init) => {
      requests.push({ url: String(url), init });
      if (String(url).endsWith(`/aliases/${TYPESENSE_CATALOG_COLLECTION}`) && init?.method !== "PUT") return new Response("not found", { status: 404 });
      if (String(url).endsWith("/collections") && init?.method === "POST") return new Response("{}", { status: 201 });
      if (String(url).includes("/documents/import")) return new Response('{"success":true}\n{"success":true}', { status: 200 });
      if (String(url).endsWith(`/aliases/${TYPESENSE_CATALOG_COLLECTION}`) && init?.method === "PUT") return new Response("{}", { status: 200 });
      if (String(url).endsWith("/documents/screen%3A1")) return new Response(JSON.stringify({
        id: "screen:1", kind: "screen", app: "linear", title: "Login", description: "Email login", searchText: "linear login", evidenceIds: [1],
        states: ["default"], layoutPatterns: [], componentNames: ["Text input"], appCategories: ["Productivity"], pageType: "Login", productArea: "Authentication", theme: "dark",
      }), { status: 200 });
      return new Response(JSON.stringify({
        hits: [{ document: {
          id: "screen:1", kind: "screen", app: "linear", title: "Login", description: "Email login", searchText: "linear login", evidenceIds: [1],
          states: ["default"], layoutPatterns: [], componentNames: ["Text input"], appCategories: ["Productivity"], pageType: "Login", productArea: "Authentication", theme: "dark",
        } }],
        found: 1,
        facet_counts: [
          { field_name: "kind", counts: [{ value: "screen", count: 1 }] },
          { field_name: "app", counts: [{ value: "linear", count: 1 }] },
          { field_name: "theme", counts: [{ value: "dark", count: 1 }] },
          { field_name: "pageType", counts: [{ value: "Login", count: 1 }] },
        ],
      }), { status: 200 });
    },
  );
  assert.equal(await client.index(source), 2);
  const result = await client.search({ query: "login", kind: "screen" });
  assert.equal(result.items[0].id, "screen:1");
  assert.equal("searchText" in result.items[0], false);
  assert.equal(result.facets.kinds.screen, 1);
  assert.deepEqual(result.facets.themes, ["dark"]);
  assert.match(requests.at(-1)?.url ?? "", /query_by=title%2Capp%2Cdescription%2CsearchText/);
  assert.match(requests.at(-1)?.url ?? "", /exclude_fields=embedding%2CsearchText/);
  assert.match(requests.at(-1)?.url ?? "", /per_page=24/);
  assert.equal(requests.at(-1)?.init?.signal instanceof AbortSignal, true);
  assert.equal(requests.some(({ url, init }) => url.endsWith(`/aliases/${TYPESENSE_CATALOG_COLLECTION}`) && init?.method === "PUT"), true);
  assert.equal(requests[0].init?.headers && (requests[0].init.headers as Record<string, string>)["x-typesense-api-key"], "secret");

  const advanced = await client.searchAdvanced!(normalizeSearchRequest({
    q: "login", scope: "apps", type: "screen", pageType: "Login", limit: 24,
  }));
  assert.equal(advanced.items[0].documentId, "screen:1");
  assert.equal(advanced.items[0].catalogName, "linear");
  assert.equal(advanced.typeCounts.screen, 1);
  assert.deepEqual(advanced.facets.pageType, [{ value: "Login", count: 1 }]);
  assert.match(requests.at(-1)?.url ?? "", /filter_by=.*kind.*pageType/);

  const suggestions = await client.suggest!("lin", 10);
  assert.deepEqual(suggestions[0], { kind: "app", value: "linear", resultCount: 1 });

  const related = await client.related!("screen:1", 12);
  assert.equal(related.items[0].documentId, "screen:1");
  assert.match(requests.at(-1)?.url ?? "", /filter_by=id%3A%21%3D/);
});
