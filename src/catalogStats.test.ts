import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { catalogStats } from "./db.ts";

test("counts latest published app-platform versions without a correlated lookup", async () => {
  let captured = "";
  const runQuery = async (sql: string) => {
    captured = sql;
    return {
      rows: [{ apps: 1192, screens: 120000, ui_elements: 0 }],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    };
  };

  assert.deepEqual(await catalogStats(runQuery as never), {
    apps: 1192,
    screens: 120000,
    uiElements: 0,
  });
  assert.match(captured, /DISTINCT ON \(av\.app_id, av\.platform\)/);
  assert.match(captured, /SUM\(latest\.screen_count\)/);
  assert.doesNotMatch(captured, /version_images|JOIN images/);
  assert.doesNotMatch(captured, /SELECT MAX\(latest\.version_number\)/);
});

test("backfills version counters and refreshes them during publication", async () => {
  const [migration, source] = await Promise.all([
    readFile(new URL("../migrations/0025_catalog_version_counts.sql", import.meta.url), "utf8"),
    readFile(new URL("./db.ts", import.meta.url), "utf8"),
  ]);

  assert.match(migration, /ADD COLUMN IF NOT EXISTS screen_count/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS ui_element_count/);
  assert.match(migration, /COUNT\(\*\) FILTER \(WHERE i\.kind = 'screen'\)[\s\S]*UPDATE app_versions av/);
  assert.match(source, /UPDATE app_versions[\s\S]*screen_count = counts\.screen_count[\s\S]*ui_element_count = counts\.ui_element_count/);
});
