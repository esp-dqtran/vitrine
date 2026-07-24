import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("migration 0021 adds automatic design-generation provenance", () => {
  const sql = readFileSync(
    new URL("../migrations/0021_automatic_llm_design_system_extraction.sql", import.meta.url),
    "utf8",
  );

  assert.match(sql, /request_origin TEXT NOT NULL DEFAULT 'manual'/);
  assert.match(sql, /ALTER COLUMN requested_by DROP NOT NULL/);
  assert.match(sql, /ALTER COLUMN created_by DROP NOT NULL/);
  assert.match(sql, /author_type = 'generated'/);
  assert.match(sql, /CREATE TABLE app_knowledge_component_crops/);
  assert.match(sql, /source_app_knowledge_revision_id/);
  assert.match(sql, /app_knowledge_automatic_generation_identity/);
  assert.match(sql, /synthesis_done_count INTEGER NOT NULL DEFAULT 0/);
  assert.match(sql, /synthesis_total_count INTEGER NOT NULL DEFAULT 0/);
  assert.match(sql, /design_system_seed_outcome TEXT/);
  assert.match(sql, /'merging'/);
  assert.match(sql, /origin IN \('observed', 'automatic', 'imported'\)/);
});
