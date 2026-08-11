import { test } from "node:test";
import assert from "node:assert/strict";
import {
  publishedAppCatalogDocument,
  publishedAppCatalogDocuments,
} from "./typesenseAppCatalogSource.ts";

test("builds one App-card document per published platform", async () => {
  const calls: string[] = [];
  const documents = await publishedAppCatalogDocuments(async ({ platform }) => {
    calls.push(platform);
    return {
      apps: [{
        app_id: 1, app: "linear", display_name: "Linear", description: "Product management",
        categories: [{ id: 1, name: "Productivity", slug: "productivity" }], website_url: null,
        icon_url: null, accent_color: null, total_screens: 2, available_platforms: [platform],
        last_captured_at: "2026-08-11T00:00:00.000Z",
      }],
      previews: [], nextCursor: null,
    };
  });
  assert.deepEqual(calls, ["web", "ios", "android"]);
  assert.equal(documents.length, 3);
  assert.equal(documents[0]?.id, "web:linear");
  assert.deepEqual(documents[0]?.categories, ["Productivity"]);
  assert.match(documents[0]?.card ?? "", /"id":"linear"/);
});

test("builds one changed App document from an exact published catalog match", async () => {
  const inputs: unknown[] = [];
  const document = await publishedAppCatalogDocument("linear", "web", async (input) => {
    inputs.push(input);
    return {
      apps: [{
        app_id: 1, app: "linear", display_name: "Linear", description: "Product management",
        categories: [{ id: 1, name: "Productivity", slug: "productivity" }], website_url: null,
        icon_url: null, accent_color: null, total_screens: 2, available_platforms: ["web"],
        last_captured_at: "2026-08-11T00:00:00.000Z",
      }],
      previews: [], nextCursor: null,
    };
  });

  assert.deepEqual(inputs, [{ query: "linear", limit: 24, includeFacets: false, platform: "web", sort: "latest" }]);
  assert.equal(document?.id, "web:linear");
});
