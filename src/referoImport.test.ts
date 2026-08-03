import assert from "node:assert/strict";
import test from "node:test";
import {
  crawlReferoFlows,
  crawlReferoSite,
  fetchReferoSiteDetail,
  parseReferoFlowSearchResponse,
  parseReferoSearchResponse,
  parseReferoSiteDetail,
  referoAppSlug,
  referoWebsiteUrl,
} from "./referoImport.ts";

function response(page: number, next: number | null, image = `${page}.jpg`): Response {
  return Response.json({
    pagination: { current: page, previous: null, next, per_page: 24, pages: 2, count: 25 },
    options: { search_uuid: null },
    records: [{
      id: 100 + page,
      width: 1440,
      height: 900,
      url: [`https://images.refero.design/screenshots/example/${image}`],
      page_url: "https://example.com/dashboard",
      site: { id: 250, domain: "example.com", name: "Example App", description: "Example" },
    }],
  });
}

test("parses the Refero fields used by app ingestion and ignores UUID metadata", () => {
  const parsed = parseReferoSearchResponse({
    pagination: { current: 1, next: null, count: 1 },
    records: [{
      id: 1,
      width: 1440,
      height: 900,
      url: ["https://images.refero.design/screenshots/example/one.jpg"],
      page_url: "https://example.com/",
      uuid: "not-persisted",
      site: { id: 250, domain: "example.com", name: "Example", description: null },
    }],
  });
  assert.equal(parsed.records[0].site.name, "Example");
  assert.deepEqual(Object.keys(parsed.records[0]).sort(), ["height", "id", "page_url", "site", "url", "width"]);
});

test("rejects image hosts outside Refero's image CDN", () => {
  assert.throws(() => parseReferoSearchResponse({
    pagination: { current: 1, next: null, count: 1 },
    records: [{
      id: 1, width: 1, height: 1,
      url: ["https://attacker.example/image.jpg"], page_url: null,
      site: { id: 250, domain: "example.com", name: "Example", description: null },
    }],
  }), /not trusted/);
});

test("parses Refero site metadata for the app catalog", () => {
  const detail = parseReferoSiteDetail({
    id: 250,
    domain: "windy.com",
    favicon_url: "https://images.refero.design/favicon/windy.com/icon.jpg",
    description: "Weather forecast",
    name: "Windy",
    background_color: "D03C2D",
    categories: [
      { id: 39, name: "Map & Navigation", description: "" },
      { id: 49, name: "Weather", description: null },
    ],
    screenshots_count: 183,
  });
  assert.deepEqual(detail, {
    id: 250,
    domain: "windy.com",
    faviconUrl: "https://images.refero.design/favicon/windy.com/icon.jpg",
    description: "Weather forecast",
    name: "Windy",
    backgroundColor: "#d03c2d",
    categories: ["Map & Navigation", "Weather"],
    screenshotsCount: 183,
  });
  assert.equal(referoWebsiteUrl(detail), "https://windy.com/");
});

test("fetches Refero site metadata with runtime authorization", async () => {
  let requestedUrl = "";
  let requestedAuthorization: string | null = null;
  const detail = await fetchReferoSiteDetail(250, async (input, init) => {
    requestedUrl = String(input);
    requestedAuthorization = new Headers(init?.headers).get("Authorization");
    return Response.json({
      id: 250, domain: "windy.com", name: "Windy", description: null,
      favicon_url: "https://images.refero.design/favicon/windy.com/icon.jpg",
      background_color: "d03c2d", categories: [], screenshots_count: 1,
    });
  }, "Bearer token.value");
  assert.equal(requestedUrl, "https://api.refero.design/v1/sites/250");
  assert.equal(requestedAuthorization, "Bearer token.value");
  assert.equal(detail.id, 250);
});

test("crawls pagination and reports complete coverage", async () => {
  const requested: string[] = [];
  const crawl = await crawlReferoSite(250, async (input) => {
    const url = new URL(String(input));
    requested.push(url.toString());
    return url.searchParams.get("page") === "2" ? response(2, null) : response(1, 2);
  });
  assert.equal(crawl.complete, true);
  assert.equal(crawl.pagesFetched, 2);
  assert.equal(crawl.captures.length, 2);
  assert.match(requested[0], /site_id%5Bid%5D%5B%5D=250/);
  assert.match(requested[1], /page=2/);
});

test("uses authorization and the ephemeral Refero search context without returning it", async () => {
  const requests: Array<{ url: URL; authorization: string | null }> = [];
  const crawl = await crawlReferoSite(250, async (input, init) => {
    const url = new URL(String(input));
    const headers = new Headers(init?.headers);
    requests.push({ url, authorization: headers.get("Authorization") });
    if (url.searchParams.get("page") === "2") return response(2, null);
    const first = await response(1, 2).json() as Record<string, unknown>;
    first.options = { search_uuid: "temporary-search-context" };
    return Response.json(first);
  }, 100, "Bearer token.value");
  assert.equal(crawl.complete, true);
  assert.equal(requests[0].authorization, "Bearer token.value");
  assert.equal(requests[1].authorization, "Bearer token.value");
  assert.equal(requests[1].url.searchParams.get("search_uuid"), "temporary-search-context");
  assert.doesNotMatch(JSON.stringify(crawl), /temporary-search-context/);
});

test("rejects malformed authorization before sending a request", async () => {
  let called = false;
  await assert.rejects(
    crawlReferoSite(250, async () => {
      called = true;
      return response(1, null);
    }, 100, "token.value"),
    /authorization is invalid/,
  );
  assert.equal(called, false);
});

test("stops safely when Refero's public gate repeats page one", async () => {
  const first = response(1, 2, "same.jpg");
  const crawl = await crawlReferoSite(250, async () => first.clone());
  assert.equal(crawl.complete, false);
  assert.equal(crawl.pagesFetched, 2);
  assert.equal(crawl.captures.length, 1);
  assert.equal(crawl.reportedCount, 25);
});

test("derives a stable app slug without a provider or external identifier", () => {
  assert.equal(referoAppSlug({ name: "Windy", domain: "windy.com" }), "windy");
  assert.equal(referoAppSlug({ name: "Example & Co.", domain: "example.com" }), "example-co");
});

test("parses Refero web flow groups as ordered logical steps without UUIDs", () => {
  const flow = parseReferoFlowSearchResponse({
    pagination: { current: 1, next: null, count: 1 },
    options: { search_uuid: null },
    records: [{
      id: 1780,
      name: "Flagging user",
      description: "",
      uuid: "not-persisted",
      site: { id: 250, name: "Windy", favicon_url: "ignored" },
      screenshots: [{
        id: 13264,
        uuid: "also-not-persisted",
        url: [
          "https://images.refero.design/flows/windy/step-1-a.jpg",
          "https://images.refero.design/flows/windy/step-1-b.jpg",
        ],
        preview_url: "https://images.refero.design/flows/windy/step-1-preview.jpg",
      }, {
        id: 13266,
        url: ["https://images.refero.design/flows/windy/step-2.jpg"],
        preview_url: null,
      }],
    }],
  }).records[0];
  assert.equal(flow.id, 1780);
  assert.deepEqual(flow.screenshots.map(({ imageUrls }) => imageUrls.length), [2, 1]);
  assert.equal(flow.screenshots[0].previewUrl, "https://images.refero.design/flows/windy/step-1-preview.jpg");
  assert.equal(flow.screenshots[1].previewUrl, null);
  assert.doesNotMatch(JSON.stringify(flow), /uuid/);
});

test("parses Refero iOS-style single flow screenshot URLs", () => {
  const flow = parseReferoFlowSearchResponse({
    pagination: { current: 1, next: null, count: 1 },
    records: [{
      id: 1, name: "Onboarding", description: null,
      site: { id: 250, name: "Example" },
      screenshots: [{ id: 2, url: "https://images.refero.design/apps/example/step.jpg", preview_url: null }],
    }],
  }).records[0];
  assert.deepEqual(flow.screenshots[0].imageUrls, ["https://images.refero.design/apps/example/step.jpg"]);
  assert.equal(flow.screenshots[0].previewUrl, null);
  assert.equal(flow.description, "");
});

test("crawls scoped Refero flows and only reports full count parity as complete", async () => {
  const requested: URL[] = [];
  const crawl = await crawlReferoFlows(250, async (input, init) => {
    const url = new URL(String(input));
    requested.push(url);
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer token.value");
    const page = Number(url.searchParams.get("page") ?? 1);
    return Response.json({
      pagination: { current: page, next: page === 1 ? 2 : null, count: 3 },
      options: { search_uuid: page === 1 ? "temporary-flow-context" : null },
      records: [{
        id: page, name: `Flow ${page}`, description: "",
        site: { id: 250, name: "Windy" },
        screenshots: [{ id: page, url: [`https://images.refero.design/flows/windy/${page}.jpg`] }],
      }],
    });
  }, 100, "Bearer token.value");
  assert.equal(crawl.complete, false);
  assert.equal(crawl.reportedCount, 3);
  assert.equal(crawl.flows.length, 2);
  assert.equal(requested[0].searchParams.get("site_id[id][]"), "250");
  assert.equal(requested[1].searchParams.get("search_uuid"), "temporary-flow-context");
  assert.doesNotMatch(JSON.stringify(crawl), /temporary-flow-context/);
});
