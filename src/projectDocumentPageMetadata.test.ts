import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizeProjectDocumentProperties } from "./projectDocument.ts";

test("adds constrained persistent Page icon metadata", () => {
  const sql = readFileSync(
    new URL(
      "../migrations/0044_project_document_page_metadata.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(sql, /ALTER TABLE project_documents/);
  assert.match(sql, /ADD COLUMN icon TEXT NOT NULL DEFAULT 'none'/);
  assert.match(
    sql,
    /CHECK \(icon IN \('none', 'document', 'idea', 'task', 'schedule', 'build'\)\)/,
  );
});

test("adds constrained persistent Page workspace settings", () => {
  const sql = readFileSync(
    new URL(
      "../migrations/0045_project_document_page_settings.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(sql, /ALTER TABLE project_documents/);
  assert.match(sql, /ADD COLUMN is_favorite BOOLEAN NOT NULL DEFAULT false/);
  assert.match(sql, /ADD COLUMN page_width TEXT NOT NULL DEFAULT 'standard'/);
  assert.match(sql, /CHECK \(page_width IN \('standard', 'full'\)\)/);
});

test("normalizes the AFFiNE-style custom property types", () => {
  assert.deepEqual(
    normalizeProjectDocumentProperties([
      { id: "summary", name: "Summary", type: "text", value: "Ready" },
      { id: "score", name: "Score", type: "number", value: 8 },
      { id: "approved", name: "Approved", type: "checkbox", value: true },
      { id: "due", name: "Due date", type: "date", value: "2026-08-01" },
    ]),
    [
      { id: "summary", name: "Summary", type: "text", value: "Ready" },
      { id: "score", name: "Score", type: "number", value: 8 },
      { id: "approved", name: "Approved", type: "checkbox", value: true },
      { id: "due", name: "Due date", type: "date", value: "2026-08-01" },
    ],
  );
  assert.equal(
    normalizeProjectDocumentProperties([
      { id: "score", name: "Score", type: "number", value: "eight" },
    ]),
    undefined,
  );
  assert.equal(
    normalizeProjectDocumentProperties([
      { id: "due", name: "Due", type: "date", value: "2026-02-31" },
    ]),
    undefined,
  );
  assert.equal(
    normalizeProjectDocumentProperties([
      { id: "duplicate", name: "One", type: "text", value: "" },
      { id: "duplicate", name: "Two", type: "text", value: "" },
    ]),
    undefined,
  );
});
