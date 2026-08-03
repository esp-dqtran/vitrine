import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./db.ts", import.meta.url), "utf8");

test("app versions persist and return the compact provider code", () => {
  assert.match(source, /provider: AppVersionProvider/);
  assert.match(source, /av\.source_url, av\.provider, av\.status/);
  assert.match(source, /provider: AppVersionProvider = "m"/);
  assert.match(source, /created_by, provider\)/);
});

test("image ingestion keeps active drafts single-provider", () => {
  const insertImage = source.match(
    /export async function insertImage[\s\S]*?\n}\n\n/,
  )?.[0];

  assert.ok(insertImage, "insertImage source was not found");
  assert.match(insertImage, /capture\.provider \?\? "m"/);
  assert.match(insertImage, /SELECT id, provider FROM app_versions/);
  assert.match(insertImage, /activeVersion\.provider !== provider/);
});
