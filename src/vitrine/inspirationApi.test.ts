import { test } from "node:test";
import assert from "node:assert/strict";
import type { CatalogSearchResultItem } from "../catalogResearch.ts";
import { compareCatalogApps, searchRelatedCatalog } from "./researchApi.ts";

test("reuses catalog search for related references and the comparison endpoint for apps", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const requested: string[] = [];
  const selected: CatalogSearchResultItem = {
    id: "screen:1",
    kind: "screen",
    app: "linear",
    title: "Login",
    description: "Sign in",
    evidenceIds: [1],
    pageType: "Login",
    productArea: "Authentication",
    states: [],
    layoutPatterns: [],
    componentNames: ["Text input"],
  };
  const related = { ...selected, id: "screen:2", app: "airbnb", title: "Account access" };

  globalThis.fetch = async (input) => {
    const url = String(input);
    requested.push(url);
    if (url.startsWith("/api/search?")) {
      return new Response(JSON.stringify({
        items: [selected, related],
        facets: { kinds: { app: 0, screen: 2, component: 0, token: 0, flow: 0, pattern: 0 }, themes: [], pageTypes: [], productAreas: [], states: [], layouts: [], components: [], appCategories: [] },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ apps: ["linear", "airbnb"], foundations: [], components: [], flows: [] }), { status: 200, headers: { "content-type": "application/json" } });
  };

  assert.deepEqual(await searchRelatedCatalog(selected), [related]);
  assert.deepEqual(await compareCatalogApps(["linear", "airbnb"]), { apps: ["linear", "airbnb"], foundations: [], components: [], flows: [] });
  assert.equal(requested[0], "/api/search?q=Login+Authentication+Text+input&kind=all&limit=12");
  assert.equal(requested[1], "/api/compare?apps=linear%2Cairbnb");
});
