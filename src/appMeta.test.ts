import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./db.ts", import.meta.url), "utf8");

test("app metadata fills missing catalog fields and assigns every provider category", () => {
  const start = source.indexOf("export async function setAppMeta");
  const end = source.indexOf("export type ImageKind", start);
  const setAppMeta = source.slice(start, end);
  assert.match(setAppMeta, /description = COALESCE\(description, \$3\)/);
  assert.match(setAppMeta, /website_url = COALESCE\(website_url, \$4\)/);
  assert.match(setAppMeta, /icon_url = COALESCE\(icon_url, \$5\)/);
  assert.match(setAppMeta, /accent_color = COALESCE\(accent_color, \$6\)/);
  assert.match(setAppMeta, /assignNames\(appId, categories, \{ replace: false \}\)/);
});
