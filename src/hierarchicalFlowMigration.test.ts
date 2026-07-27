import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../migrations/0034_hierarchical_flow_data.sql",
  import.meta.url,
);

test("0034 replaces aggregate flow arrays with hierarchical row storage", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /ALTER TABLE app_flows RENAME TO legacy_app_flows/);
  assert.match(
    migration,
    /ALTER TABLE app_flow_versions RENAME TO legacy_app_flow_versions/,
  );
  assert.match(migration, /CREATE TABLE flows \(/);
  assert.match(migration, /parent_id BIGINT REFERENCES flows\(id\)/);
  assert.match(migration, /CREATE UNIQUE INDEX flows_root_name_unique/);
  assert.match(migration, /CREATE UNIQUE INDEX flows_child_name_unique/);
  assert.match(migration, /CREATE TABLE app_flows \(/);
  assert.match(migration, /source_flow_id TEXT NOT NULL/);
  assert.match(migration, /source_category TEXT/);
  assert.match(migration, /position INTEGER NOT NULL/);
  assert.match(migration, /CREATE TABLE app_flow_mappings \(/);
  assert.match(migration, /PRIMARY KEY \(app_flow_id, flow_id\)/);
  assert.match(migration, /CREATE TABLE app_flow_versions \(/);
  assert.match(migration, /CREATE TABLE app_flow_version_mappings \(/);
});

test("0034 derives exact normalized parents and children from both snapshots", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /jsonb_array_elements\(legacy\.flows\)/);
  assert.match(migration, /WITH ORDINALITY AS item\(value, position\)/);
  assert.match(migration, /\[\[:space:\]\]\+/);
  assert.match(migration, /lower\(regexp_replace\(btrim\(/);
  assert.match(migration, /source_kind = 'current'/);
  assert.match(migration, /source_kind = 'version'/);
  assert.match(migration, /source_category IS NULL/);
  assert.match(
    migration,
    /staged\.normalized_category = staged\.normalized_title/,
  );
  assert.match(migration, /ROW_NUMBER\(\) OVER \(/);
  assert.match(migration, /ORDER BY occurrence_count DESC, name ASC/);
});

test("0034 aborts before dropping legacy data when invariants fail", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /Legacy app_flows\.flows must be JSON arrays/);
  assert.match(migration, /Legacy app_flow_versions\.flows must be JSON arrays/);
  assert.match(migration, /Current flow source IDs must be unique per app and platform/);
  assert.match(migration, /Historical flow source IDs must be unique per version/);
  assert.match(migration, /Current flow row count mismatch/);
  assert.match(migration, /Historical flow row count mismatch/);
  assert.match(migration, /Current flow mapping count mismatch/);
  assert.match(migration, /Historical flow mapping count mismatch/);
  assert.match(migration, /Flow content mismatch/);
  assert.match(migration, /Flow hierarchy contains a self-reference/);
  assert.match(migration, /DROP TABLE legacy_app_flow_versions/);
  assert.match(migration, /DROP TABLE legacy_app_flows/);
});

test("0034 repairs database-owned flow dependencies", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /CREATE TRIGGER app_flow_versions_search_queue/);
  assert.match(migration, /EXECUTE FUNCTION enqueue_search_from_version_child/);
  assert.match(
    migration,
    /CREATE OR REPLACE FUNCTION refresh_public_facet_previews\(target_version_id INTEGER\)/,
  );
  assert.doesNotMatch(migration, /jsonb_array_elements\(afv\.flows\)/);
  assert.match(migration, /jsonb_array_elements\(afv\.steps\)/);
  assert.match(migration, /concat_ws\(' ', afv\.title, afv\.description, afv\.tags::text\)/);
});
