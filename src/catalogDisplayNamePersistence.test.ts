import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dbSource = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
const bulkSource = readFileSync(new URL("./bulkDownload.ts", import.meta.url), "utf8");
const publicPageStoreSource = readFileSync(
  new URL("./publicPageStore.ts", import.meta.url),
  "utf8",
);

test("Mobbin metadata persists a human display name separately from the route slug", () => {
  const setAppMetaSource = dbSource.match(
    /export async function setAppMeta[\s\S]*?\n}\n/,
  )?.[0];

  assert.ok(setAppMetaSource, "setAppMeta source was not found");
  assert.match(setAppMetaSource, /displayName\?: string \| null/);
  assert.match(
    setAppMetaSource,
    /display_name = COALESCE\(display_name, \$3\)/,
  );
  assert.match(setAppMetaSource, /meta\.displayName \?\? null/);
  assert.match(setAppMetaSource, /assignNames/);
});

test("both App ingestion paths persist Category relationships", () => {
  assert.match(dbSource, /createCategoryStore/);
  assert.match(publicPageStoreSource, /createCategoryStore/);
  assert.match(publicPageStoreSource, /assignNames/);
});

test("bulk import captures the visible Mobbin heading as app metadata", () => {
  const crawlSource = bulkSource.match(
    /export async function crawlBulkDownload[\s\S]*?\n}\n/,
  )?.[0];

  assert.ok(crawlSource, "crawlBulkDownload source was not found");
  assert.match(crawlSource, /const displayName = \(document\.querySelector\("h1"\)/);
  assert.match(crawlSource, /return \{ displayName, iconUrl, category \}/);
  assert.match(
    crawlSource,
    /if \(pageMeta\.displayName \|\| pageMeta\.iconUrl \|\| pageMeta\.category\) await setAppMeta/,
  );
});
