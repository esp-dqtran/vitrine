import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Sites single-page migration separates source kinds and analysis artifacts", async () => {
  const [metadata, optionalMedia, sql] = await Promise.all([
    readFile(new URL("../migrations/0022_sites_metadata.sql", import.meta.url), "utf8"),
    readFile(
      new URL("../migrations/0023_optional_site_section_media_metadata.sql", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../migrations/0024_sites_single_page_analysis.sql", import.meta.url),
      "utf8",
    ),
  ]);
  for (const pattern of [
    /ADD COLUMN description TEXT/,
    /ADD COLUMN logo_url TEXT/,
    /ADD COLUMN categories JSONB/,
    /ADD COLUMN styles JSONB/,
  ]) {
    assert.match(metadata, pattern);
  }
  assert.match(optionalMedia, /site_sections_media_metadata_check/);
  assert.match(optionalMedia, /crop_top IS NULL AND crop_bottom IS NULL/);
  for (const pattern of [
    /source_kind TEXT NOT NULL DEFAULT 'mobbin'/,
    /content_hash TEXT/,
    /analysis_status TEXT NOT NULL DEFAULT 'evidence-only'/,
    /analysis JSONB NOT NULL/,
    /analysis_object_key TEXT/,
    /mobile_page_object_key TEXT/,
    /site_versions_public_content_unique/,
    /DROP CONSTRAINT site_versions_canonical_url_key/,
  ]) {
    assert.match(sql, pattern);
  }
});
