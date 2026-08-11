import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  appCatalogRequestPath,
  appendUniqueApps,
  fetchCatalogPage,
  invalidateCatalogPageCache,
  refreshCatalogPage,
} from "./useApps.ts";

test("builds a platform-scoped App search request for Typesense", () => {
  assert.equal(
    appCatalogRequestPath(" Stripe ", "web"),
    "/api/apps/search?facets=summary&platform=web&query=Stripe",
  );
});

test("appends server-ordered pages without duplicates or reordering", () => {
  const current = [{ id: "tubi" }, { id: "ipsy" }];
  const next = [{ id: "ipsy" }, { id: "zip" }];
  assert.deepEqual(
    appendUniqueApps(current as never[], next as never[]).map(({ id }) => id),
    ["tubi", "ipsy", "zip"],
  );
});

test("refresh bypasses a cached first catalog page and updates its data", async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  const options: RequestInit[] = [];
  globalThis.fetch = (async (_input, init) => {
    requests += 1;
    options.push(init ?? {});
    return new Response(JSON.stringify({
      items: [{
        id: requests === 1 ? "before" : "after",
        app: requests === 1 ? "Before" : "After",
        categories: [],
        accent: "#000",
        totalScreens: 1,
        platforms: ["web"],
        previewScreens: [],
        websiteUrl: null,
        iconUrl: null,
      }],
      nextCursor: null,
      totalCount: 1,
      facets: [],
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  try {
    const endpoint = "/api/apps?test=refresh-cache";
    const first = await fetchCatalogPage(endpoint);
    const cached = await fetchCatalogPage(endpoint);
    const refreshed = await refreshCatalogPage(endpoint);

    assert.equal(requests, 2);
    assert.equal(first.apps[0]?.id, "before");
    assert.equal(cached.apps[0]?.id, "before");
    assert.equal(refreshed.apps[0]?.id, "after");
    assert.equal(options[0]?.cache, "no-store");
    assert.equal(options[1]?.cache, "no-store");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("invalidating the catalog cache reloads an AppCard preview", async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = (async () => {
    requests += 1;
    return new Response(JSON.stringify({
      items: [{
        id: `preview-${requests}`,
        app: "Preview",
        categories: [],
        accent: "#000",
        totalScreens: 1,
        platforms: ["ios"],
        previewScreens: [],
        websiteUrl: null,
        iconUrl: null,
      }],
      nextCursor: null,
      totalCount: 1,
      facets: [],
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  try {
    const endpoint = "/api/apps?test=preview-cache-invalidation";
    await fetchCatalogPage(endpoint);
    invalidateCatalogPageCache();
    const reloaded = await fetchCatalogPage(endpoint);

    assert.equal(requests, 2);
    assert.equal(reloaded.apps[0]?.id, "preview-2");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("legacy load-more requests own an AbortController and pass its signal", () => {
  const source = readFileSync(new URL("./useApps.ts", import.meta.url), "utf8");
  assert.match(source, /loadMoreControllerRef/);
  assert.match(source, /loadMoreControllerRef\.current\?\.abort\(\)/);
  assert.match(source, /apiFetch\(endpoint,\s*\{\s*signal:\s*controller\.signal,\s*cache:\s*'no-store',?\s*\}\)/);
});

test("does not cache an invalid catalog response", async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = (async () => {
    requests += 1;
    return new Response(JSON.stringify(requests === 1
      ? {
          items: [{
            id: "poisoned",
            app: "Poisoned",
            categories: [],
            accent: "#000",
            totalScreens: 1,
            platforms: ["web"],
            previewScreens: [{
              id: 1,
              type: "Dashboard",
              productArea: "Home",
              theme: "light",
              visibleStates: [],
              platform: "web",
              description: null,
              url: "/preview",
              componentNames: 7,
            }],
          }],
          nextCursor: null,
          totalCount: 1,
          facets: [],
        }
      : {
          items: [],
          nextCursor: null,
          totalCount: 0,
          facets: [],
        }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  try {
    const endpoint = "/api/apps?test=invalid-not-cached";
    await assert.rejects(
      () => fetchCatalogPage(endpoint),
      /invalid catalog response: previewScreens/,
    );
    assert.deepEqual(await fetchCatalogPage(endpoint), {
      apps: [],
      nextCursor: null,
      totalCount: 0,
      facets: [],
    });
    assert.equal(requests, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
