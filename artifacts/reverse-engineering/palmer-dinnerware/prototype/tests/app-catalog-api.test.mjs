import assert from "node:assert/strict";
import test from "node:test";

function catalogResponse(id, nextCursor) {
  return {
    items: [{ id, app: id, totalScreens: 12 }],
    nextCursor,
    totalCount: 2,
  };
}

test("reuses the early catalog request and sends cursor pages independently", async (context) => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  const requests = [];
  const measurements = [];

  globalThis.window = {
    localStorage: {
      getItem(key) {
        return key === "vitrine:auth-token" ? "signed-in-token" : null;
      },
    },
    performance: {
      mark() {},
      measure(name) {
        measurements.push(name);
      },
    },
  };
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    const cursor = new URL(url, "http://local.test").searchParams.get("cursor");
    return new Response(JSON.stringify(
      cursor ? catalogResponse("second", null) : catalogResponse("first", "cursor-2"),
    ), { headers: { "content-type": "application/json" } });
  };

  context.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.window = originalWindow;
  });

  const api = await import(`../src/data/appCatalogApi.js?test=${Date.now()}`);
  const preload = api.preloadInitialAppCatalogPage();
  const hookRead = api.fetchAppCatalogPage();

  assert.strictEqual(hookRead, preload);
  assert.equal((await preload).nextCursor, "cursor-2");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.headers.authorization, "Bearer signed-in-token");
  assert.deepEqual(measurements, ["vitrines:explore-catalog-request"]);

  await api.fetchAppCatalogPage();
  assert.equal(requests.length, 2, "a consumed preload must not become a stale session cache");

  const nextPage = await api.fetchAppCatalogPage("cursor-2");
  assert.equal(nextPage.apps[0].id, "second");
  assert.equal(requests.length, 3);
  assert.match(requests[2].url, /cursor=cursor-2/);
});
