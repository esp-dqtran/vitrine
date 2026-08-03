import { test } from "node:test";
import assert from "node:assert/strict";
import { parseReferoImportArgs } from "../scripts/import-refero-design-systems.ts";

test("Refero importer defaults to archive-only and bounded crawling", () => {
  const options = parseReferoImportArgs([]);
  assert.equal(options.apply, false);
  assert.equal(options.concurrency, 4);
  assert.equal(options.retries, 3);
  assert.match(options.archiveDirectory, /\.codex-artifacts\/refero-styles$/);
});

test("Refero importer parses explicit crawl and apply safeguards", () => {
  const options = parseReferoImportArgs([
    "--apply",
    "--confirm-database-host", "db.example.com",
    "--concurrency", "6",
    "--limit", "12",
    "--force",
  ]);
  assert.equal(options.apply, true);
  assert.equal(options.confirmDatabaseHost, "db.example.com");
  assert.equal(options.concurrency, 6);
  assert.equal(options.limit, 12);
  assert.equal(options.force, true);
});

test("Refero importer rejects unsafe concurrency", () => {
  assert.throws(() => parseReferoImportArgs(["--concurrency", "99"]), /--concurrency/);
});
