import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  assertGeneratedMigrationDatabaseName,
  createMigrationVerificationConfig,
} from "../scripts/verify-migrations.ts";
import {
  discoverMigrations,
  redactMigrationError,
  validateMigrationState,
} from "./migrations.ts";

const migrationDefinitions = [
  {
    file: "0015_feature_documents.sql",
    patterns: [
      /CREATE TABLE feature_documents/,
      /CREATE TABLE feature_document_revisions/,
      /CREATE TABLE feature_document_jobs/,
      /CREATE TABLE feature_document_step_analyses/,
      /CREATE TABLE feature_document_shares/,
      /pg_notify\('feature_document_jobs'/,
    ],
  },
  {
    file: "0016_getdesign_imports.sql",
    patterns: [
      /ADD COLUMN IF NOT EXISTS origin/,
      /CREATE TABLE design_system_import_history/,
      /previous_snapshot JSONB/,
      /rolled_back_at TIMESTAMPTZ/,
    ],
  },
  {
    file: "0017_adaptive_search.sql",
    patterns: [
      /CREATE EXTENSION IF NOT EXISTS vector/,
      /PRIMARY KEY \(index_version, document_id\)/,
      /embedding VECTOR\(1536\)/,
      /search_vector TSVECTOR GENERATED ALWAYS/,
      /CREATE TRIGGER images_search_queue/,
    ],
  },
  {
    file: "0018_app_knowledge_analysis.sql",
    patterns: [
      /CREATE TABLE app_knowledge_snapshots/,
      /CREATE TABLE app_knowledge_revisions/,
      /CREATE TABLE app_knowledge_jobs/,
      /CREATE TABLE app_knowledge_job_evidence/,
      /CREATE TABLE app_knowledge_evidence_cache/,
      /CREATE TABLE app_knowledge_review_events/,
      /CREATE TABLE app_knowledge_evidence_overrides/,
      /pg_notify\('app_knowledge_jobs'/,
    ],
  },
  {
    file: "0019_app_knowledge_design_system_chunks.sql",
    patterns: [
      /CREATE TABLE app_knowledge_design_system_chunks/,
      /UNIQUE \(job_id, chunk_key\)/,
      /UNIQUE \(job_id, ordinal\)/,
      /jsonb_typeof\(fragment\) = 'object'/,
    ],
  },
  {
    file: "0020_drop_flow_documents.sql",
    patterns: [
      /DROP TABLE IF EXISTS flow_documents/,
    ],
  },
] as const;

for (const definition of migrationDefinitions) {
  test(`${definition.file} retains its schema contract`, async () => {
    const sql = await readFile(
      new URL(`../migrations/${definition.file}`, import.meta.url),
      "utf8",
    );
    for (const pattern of definition.patterns) assert.match(sql, pattern);
  });
}

test("migration verification requires explicit disposable-database opt-in", () => {
  const adminUrl = "postgres://operator:secret@localhost:5432/postgres";
  assert.throws(
    () => createMigrationVerificationConfig({}),
    /MIGRATION_TEST_DATABASE_URL is required/,
  );
  assert.throws(
    () => createMigrationVerificationConfig({
      MIGRATION_TEST_DATABASE_URL: adminUrl,
    }),
    /MIGRATION_TEST_ALLOW_DROP=1 is required/,
  );

  const config = createMigrationVerificationConfig({
    MIGRATION_TEST_DATABASE_URL: adminUrl,
    MIGRATION_TEST_ALLOW_DROP: "1",
  }, ["a".repeat(32), "b".repeat(32)]);

  assert.deepEqual(config.databaseNames, {
    empty: `astryx_migration_test_${"a".repeat(32)}`,
    upgrade: `astryx_migration_test_${"b".repeat(32)}`,
  });
  assert.doesNotThrow(() =>
    assertGeneratedMigrationDatabaseName(config.databaseNames.empty)
  );
  for (const unsafe of [
    "astryx",
    "astryx_migration_test_",
    "astryx_migration_test_bad-name",
    "postgres",
  ]) {
    assert.throws(
      () => assertGeneratedMigrationDatabaseName(unsafe),
      /refusing unsafe database name/i,
    );
  }
});

async function temporaryDirectory(
  t: { after(fn: () => Promise<void>): void },
): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "astryx-migrations-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test("discovers contiguous immutable migrations and identifies pending versions", async (t) => {
  const directory = await temporaryDirectory(t);
  await writeFile(join(directory, "0001_base.sql"), "SELECT 1;\n");
  await writeFile(join(directory, "0002_more.sql"), "SELECT 2;\n");

  const files = await discoverMigrations(directory);

  assert.deepEqual(files.map(({ version, name }) => [version, name]), [
    [1, "base"],
    [2, "more"],
  ]);
  assert.match(files[0].checksum, /^[0-9a-f]{64}$/);
  assert.deepEqual(validateMigrationState(files, [{
    version: 1,
    name: "base",
    checksum: files[0].checksum,
  }]).pending.map(({ version }) => version), [2]);
});

test("rejects invalid names, sequence gaps, and top-level transactions", async (t) => {
  const root = await temporaryDirectory(t);
  const invalidName = join(root, "invalid-name");
  await mkdir(invalidName);
  await writeFile(join(invalidName, "1_base.sql"), "SELECT 1;\n");
  await assert.rejects(
    () => discoverMigrations(invalidName),
    /Invalid migration filename/,
  );

  const gap = join(root, "gap");
  await mkdir(gap);
  await writeFile(join(gap, "0001_base.sql"), "SELECT 1;\n");
  await writeFile(join(gap, "0003_gap.sql"), "SELECT 3;\n");
  await assert.rejects(() => discoverMigrations(gap), /sequence gap/i);

  const transaction = join(root, "transaction");
  await mkdir(transaction);
  await writeFile(
    join(transaction, "0001_bad.sql"),
    "BEGIN;\nSELECT 1;\nCOMMIT;\n",
  );
  await assert.rejects(
    () => discoverMigrations(transaction),
    /contains a transaction statement/i,
  );
});

test("rejects changed, missing, and discontinuous applied migrations", async (t) => {
  const directory = await temporaryDirectory(t);
  await writeFile(join(directory, "0001_base.sql"), "SELECT 1;\n");
  await writeFile(join(directory, "0002_more.sql"), "SELECT 2;\n");
  const files = await discoverMigrations(directory);

  assert.throws(() => validateMigrationState(files, [{
    version: 1,
    name: "base",
    checksum: "0".repeat(64),
  }]), /does not match its immutable file/);
  assert.throws(() => validateMigrationState([], [{
    version: 1,
    name: "missing",
    checksum: "0".repeat(64),
  }]), /not present on disk/);
  assert.throws(() => validateMigrationState(files, [{
    version: 2,
    name: "more",
    checksum: files[1].checksum,
  }]), /sequence gap at version 2/);
});

test("redacts database URLs and decoded passwords from errors", () => {
  const databaseUrl =
    "postgres://operator:p%40ssword@db.internal:5432/astryx";
  const message = redactMigrationError(
    new Error(`connection failed for ${databaseUrl} with password p@ssword`),
    databaseUrl,
  );
  assert.doesNotMatch(message, /operator|p%40ssword|p@ssword|db\.internal/);
  assert.match(message, /redacted/);
});

test("ordinary database queries never bootstrap or mutate schema", async () => {
  const source = await readFile(new URL("./db.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /ensureSchema|schemaReady/);
  assert.doesNotMatch(source, /pool\.query\(`\s*(?:CREATE|ALTER|DROP)/i);
});
