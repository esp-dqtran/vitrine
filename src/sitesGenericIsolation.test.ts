import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("keeps arbitrary-page analysis inside Sites persistence", async () => {
  const [crawler, worker] = await Promise.all([
    readFile(new URL("src/genericSiteCrawler.ts", root), "utf8"),
    readFile(new URL("services/sites-import-worker/src/index.ts", root), "utf8"),
  ]);

  assert.match(crawler, /GenericSitesStoreMethods/);
  assert.match(crawler, /\bbeginGenericImport\b/);
  assert.match(crawler, /\bcompleteGenericImport\b/);
  assert.match(worker, /\bcrawlGenericSite\b/);
  assert.match(worker, /\bcreateSitesStore\b/);

  const genericPath = `${crawler}\n${worker}`;
  assert.doesNotMatch(genericPath, /\bPublicPageStore\b|\bcreatePublicPageStore\b/);
  assert.doesNotMatch(genericPath, /from ["'][^"']*\/store\.ts["']/);
  assert.doesNotMatch(genericPath, /\bapp_screens\b|\bapp_flows\b|\bpublic_pages\b/);
});
