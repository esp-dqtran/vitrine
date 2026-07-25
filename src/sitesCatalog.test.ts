import assert from "node:assert/strict";
import test from "node:test";
import { canonicalSitesCatalogUrls } from "./sitesCatalog.ts";

test("keeps only unique canonical Mobbin Site preview URLs", () => {
  assert.deepEqual(
    canonicalSitesCatalogUrls([
      "/sites/v-7-1fbe80df-2586-4a09-aa5c-29aeeb716a09/f4e176f7-aeb6-4f9a-9689-e4379fc357b1/preview",
      "https://mobbin.com/sites/v-7-1fbe80df-2586-4a09-aa5c-29aeeb716a09/f4e176f7-aeb6-4f9a-9689-e4379fc357b1/preview",
      "/sites/v-7-1fbe80df-2586-4a09-aa5c-29aeeb716a09/f4e176f7-aeb6-4f9a-9689-e4379fc357b1/sections",
      "https://example.com/sites/not-mobbin/preview",
    ]),
    [
      "https://mobbin.com/sites/v-7-1fbe80df-2586-4a09-aa5c-29aeeb716a09/f4e176f7-aeb6-4f9a-9689-e4379fc357b1/preview",
    ],
  );
});
