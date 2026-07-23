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
