import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
const start = source.indexOf("export async function adminAppPage");
const end = source.indexOf("export async function appImages", start);
const adminAppPageSource = source.slice(start, end);

test("admin app page aggregates screen facts once per selected page", () => {
  assert.match(adminAppPageSource, /page_image_facts AS MATERIALIZED/);
  assert.match(adminAppPageSource, /app_platforms AS/);
  assert.doesNotMatch(adminAppPageSource, /WHERE p2\.app_id = ri\.app_id/);
});

test("admin app page distributes preview slots across available platforms", () => {
  assert.match(adminAppPageSource, /PARTITION BY app_id, platform/);
  assert.match(adminAppPageSource, /ORDER BY platform_preview_rank,[\s\S]*CASE platform WHEN 'web' THEN 1 WHEN 'ios' THEN 2 WHEN 'android' THEN 3/);
});

test("admin app page selects identities by indexed Updated At keyset", () => {
  assert.match(adminAppPageSource, /JOIN LATERAL/);
  assert.match(adminAppPageSource, /i\.created_at <= \$1::timestamptz/);
  assert.match(adminAppPageSource, /ORDER BY updated_at DESC,\s*app_id DESC/);
  assert.match(adminAppPageSource, /\(updated_at,\s*app_id\)\s*<\s*\(\$2::timestamptz,\s*\$3::integer\)/);
  assert.match(adminAppPageSource, /encodeUpdatedCatalogCursor/);
  assert.doesNotMatch(adminAppPageSource, /WHERE \(\$1::text IS NULL OR name > \$1\)/);
});

test("admin app page aggregates only the selected page identities", () => {
  assert.ok(
    adminAppPageSource.indexOf("candidate_apps AS")
      < adminAppPageSource.indexOf("page_image_facts AS MATERIALIZED"),
  );
  assert.match(adminAppPageSource, /JOIN page_apps pa ON pa\.app_id = p\.app_id/);
  assert.match(
    adminAppPageSource,
    /page_image_facts AS MATERIALIZED[\s\S]*i\.created_at <= \$1::timestamptz/,
  );
});
