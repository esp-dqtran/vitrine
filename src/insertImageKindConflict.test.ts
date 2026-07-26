import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./db.ts", import.meta.url), "utf8");

test("insertImage reclassifies an existing image reference to the imported kind", () => {
  const insertImageSource = source.match(
    /export async function insertImage[\s\S]*?\n}\n\n/,
  )?.[0];

  assert.ok(insertImageSource, "insertImage source was not found");
  assert.match(
    insertImageSource,
    /ON CONFLICT \(platform_id, image_url\) DO UPDATE SET[\s\S]*kind = EXCLUDED\.kind/,
  );
});
