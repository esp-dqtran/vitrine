import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("indexes the newest admin and published screen lookup paths", async () => {
  const migration = await readFile(
    new URL("../migrations/0031_apps_updated_pagination_indexes.sql", import.meta.url),
    "utf8",
  );
  assert.match(
    migration,
    /CREATE INDEX IF NOT EXISTS images_screen_platform_created_idx[\s\S]*images\s*\(platform_id,\s*created_at DESC,\s*id DESC\)[\s\S]*WHERE kind = 'screen'/,
  );
  assert.match(
    migration,
    /CREATE INDEX IF NOT EXISTS version_images_version_captured_idx[\s\S]*version_images\s*\(version_id,\s*captured_at DESC,\s*image_id DESC\)/,
  );
  assert.match(
    migration,
    /CREATE INDEX IF NOT EXISTS app_versions_published_snapshot_idx[\s\S]*app_versions\s*\(app_id,\s*platform,\s*published_at DESC,\s*version_number DESC\)[\s\S]*WHERE published_at IS NOT NULL/,
  );
});

test("indexes version evidence in the same order used by the gallery cursor", async () => {
  const migration = await readFile(
    new URL("../migrations/0106_version_images_id_pagination.sql", import.meta.url),
    "utf8",
  );
  assert.match(
    migration,
    /CREATE INDEX IF NOT EXISTS version_images_version_image_idx[\s\S]*version_images\s*\(version_id,\s*image_id DESC\)/,
  );
});

test("indexes current app evidence in the same order used by the gallery cursor", async () => {
  const migration = await readFile(
    new URL("../migrations/0107_images_platform_kind_id_pagination.sql", import.meta.url),
    "utf8",
  );
  assert.match(
    migration,
    /CREATE INDEX IF NOT EXISTS images_platform_kind_id_idx[\s\S]*images\s*\(platform_id,\s*kind,\s*id DESC\)/,
  );
});

test("keeps versioned gallery pagination on the bounded per-version plan", async () => {
  const source = await readFile(new URL("./db.ts", import.meta.url), "utf8");
  const appEvidencePage = source.slice(
    source.indexOf("export async function appEvidencePage"),
    source.indexOf("export async function appScreenTypes"),
  );
  assert.match(appEvidencePage, /SET LOCAL enable_hashjoin = off/);
  assert.match(appEvidencePage, /SET LOCAL enable_mergejoin = off/);
  assert.match(appEvidencePage, /client\.query<CrawledImage>/);
});

test("persists published analyzed counts instead of rescanning version images", async () => {
  const migration = await readFile(
    new URL("../migrations/0108_app_versions_analyzed_count.sql", import.meta.url),
    "utf8",
  );
  const source = await readFile(new URL("./db.ts", import.meta.url), "utf8");
  assert.match(migration, /ADD COLUMN IF NOT EXISTS analyzed_count INTEGER NOT NULL DEFAULT 0/);
  assert.match(source, /ELSE av\.analyzed_count END::int AS analyzed_count/);
  assert.match(source, /analyzed_count = counts\.analyzed_count/);
});
