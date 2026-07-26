import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("backfills missing flow snapshots for each latest published app-platform version", async () => {
  const migration = await readFile(
    new URL("../migrations/0028_backfill_latest_app_flow_versions.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /DISTINCT ON \(av\.app_id, av\.platform\)/);
  assert.match(migration, /av\.status = 'published'/);
  assert.match(migration, /ORDER BY av\.app_id, av\.platform, av\.version_number DESC/);
  assert.match(migration, /af\.app_id = latest\.app_id[\s\S]*af\.platform = latest\.platform/);
  assert.match(migration, /LEFT JOIN app_flow_versions afv ON afv\.version_id = latest\.version_id/);
  assert.match(migration, /WHERE afv\.version_id IS NULL/);
  assert.match(migration, /COALESCE\(af\.flows, '\[\]'::jsonb\)/);
});
