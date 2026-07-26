import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./db.ts", import.meta.url), "utf8");

test("insertImage seeds a new draft with the latest published version evidence", () => {
  const insertImageSource = source.match(
    /export async function insertImage[\s\S]*?\n}\n\n/,
  )?.[0];

  assert.ok(insertImageSource, "insertImage source was not found");
  assert.match(
    insertImageSource,
    /INSERT INTO version_images[\s\S]*JOIN app_versions prior ON prior\.id = vi\.version_id[\s\S]*prior\.status = 'published'[\s\S]*ON CONFLICT DO NOTHING/,
  );
});
