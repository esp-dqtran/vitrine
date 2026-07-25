import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Sites single-page migration separates source kinds and analysis artifacts", async () => {
  const sql = await readFile(
    new URL("../migrations/0024_sites_single_page_analysis.sql", import.meta.url),
    "utf8",
  );
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
