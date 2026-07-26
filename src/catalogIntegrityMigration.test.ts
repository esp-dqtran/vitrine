import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("repairs and prevents cross-platform catalog version corruption", async () => {
  const migration = await readFile(
    new URL("../migrations/0029_repair_catalog_version_integrity.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /INSERT INTO version_images/);
  assert.match(migration, /target\.platform = image_platform\.name/);
  assert.match(migration, /DELETE FROM version_images vi[\s\S]*image_platform\.name <> av\.platform/);
  assert.match(migration, /DELETE FROM app_versions av[\s\S]*FROM platforms platform_identity/);
  assert.match(migration, /DELETE FROM search_index_queue queue[\s\S]*FROM platforms platform_identity/);
  assert.match(migration, /INSERT INTO design_system_versions/);
  assert.match(migration, /DISTINCT ON \(av\.app_id, av\.platform\)/);
  assert.match(migration, /UPDATE app_versions[\s\S]*screen_count = counts\.screen_count/);
  assert.match(migration, /refresh_public_facet_previews/);
  assert.match(migration, /FOREIGN KEY \(app_id, platform\)[\s\S]*REFERENCES platforms \(app_id, name\)/);
  assert.match(migration, /search_index_queue_platform_fkey/);
  assert.match(migration, /FOREIGN KEY \(version_id, image_id\)[\s\S]*REFERENCES version_images \(version_id, image_id\)/);
  assert.match(migration, /CREATE TRIGGER validate_version_image_context/);
  assert.match(migration, /CREATE TRIGGER validate_app_version_context/);
  assert.match(migration, /CREATE TRIGGER validate_image_platform_context/);
});
