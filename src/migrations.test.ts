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
  {
    file: "0030_context_aware_search.sql",
    patterns: [
      /ADD COLUMN catalog_scope TEXT NOT NULL DEFAULT 'apps'/,
      /entity_type IN \('app', 'site', 'screen', 'flow', 'component', 'pattern'\)/,
      /CREATE TABLE site_search_index_queue/,
      /CREATE TRIGGER site_versions_search_queue/,
      /CREATE TRIGGER site_sections_search_queue/,
    ],
  },
  {
    file: "0032_catalog_feature_documents.sql",
    patterns: [
      /ALTER COLUMN user_id DROP NOT NULL/,
      /ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private'/,
      /visibility = 'catalog' AND user_id IS NULL/,
      /feature_documents_catalog_flow_identity_idx/,
    ],
  },
  {
    file: "0033_app_categories.sql",
    patterns: [
      /CREATE TABLE categories/,
      /CREATE TABLE app_categories/,
      /PRIMARY KEY \(app_id, category_id\)/,
      /REFERENCES apps\(id\) ON DELETE CASCADE/,
      /REFERENCES categories\(id\) ON DELETE CASCADE/,
      /INSERT INTO categories/,
      /INSERT INTO app_categories/,
      /CREATE TRIGGER sync_apps_category_to_relationship/,
      /CREATE TRIGGER app_categories_search_queue/,
      /CREATE TRIGGER categories_search_queue/,
    ],
  },
  {
    file: "0034_hierarchical_flow_data.sql",
    patterns: [
      /CREATE TABLE flows/,
      /CREATE TABLE app_flows/,
      /CREATE TABLE app_flow_mappings/,
      /CREATE TABLE app_flow_versions/,
      /CREATE TABLE app_flow_version_mappings/,
      /DROP TABLE legacy_app_flow_versions/,
      /DROP TABLE legacy_app_flows/,
    ],
  },
  {
    file: "0036_site_version_catalog_snapshots.sql",
    patterns: [
      /ADD COLUMN catalog_snapshot JSONB/,
      /jsonb_typeof\(catalog_snapshot\) = 'object'/,
      /CREATE OR REPLACE FUNCTION populate_site_version_catalog_snapshot/,
      /NEW\.catalog_snapshot IS NULL\s+OR NEW\.catalog_snapshot = '\{\}'::jsonb/,
      /NOT \(NEW\.catalog_snapshot \?& ARRAY\[/,
      /BEFORE INSERT OR UPDATE ON site_versions/,
      /UPDATE site_versions sv/,
      /jsonb_build_object\(/,
      /'categoriesNormalized'/,
      /'stylesNormalized'/,
      /jsonb_agg\(lower\(value\)/,
      /'popularity'/,
      /ALTER COLUMN catalog_snapshot SET NOT NULL/,
      /ALTER COLUMN catalog_snapshot DROP DEFAULT/,
      /site_versions_catalog_ready_idx/,
      /site_versions_catalog_categories_normalized_gin_idx/,
      /site_versions_catalog_styles_normalized_gin_idx/,
      /site_pages_version_title_idx/,
      /site_sections_patterns_gin_idx/,
    ],
  },
  {
    file: "0037_flow_catalog_snapshot_guards.sql",
    patterns: [
      /BEFORE UPDATE OR DELETE ON flows/,
      /Published Flow taxonomy is append-only/,
      /BEFORE INSERT OR UPDATE OR DELETE ON app_flow_versions/,
      /BEFORE INSERT OR UPDATE OR DELETE ON app_flow_version_mappings/,
      /BEFORE INSERT OR UPDATE OR DELETE ON app_versions/,
      /Published App versions are immutable/,
      /Published App versions must use the in-review publication transition/,
      /app_versions_publication_markers_consistent/,
      /\(status = 'published'\) = \(published_at IS NOT NULL\)/,
      /\(NEW\.status = 'published'\) IS DISTINCT FROM \(NEW\.published_at IS NOT NULL\)/,
      /App version publication status and timestamp must agree/,
      /OLD\.published_at IS NOT NULL/,
      /OLD\.status = 'published'/,
      /OLD\.status <> 'in_review'/,
      /NEW\.status <> 'published'/,
      /owner_ids := CASE TG_OP/,
      /flow_version_ids := CASE TG_OP/,
      /FOR SHARE/,
      /FOR SHARE OF av, afv/,
      /published_at IS NOT NULL/,
      /publish a new App version/,
    ],
  },
  {
    file: "0039_screen_pattern_taxonomy.sql",
    patterns: [
      /CREATE TABLE screen_pattern_sections/,
      /CREATE TABLE screen_patterns/,
      /CREATE TABLE screen_pattern_assignments/,
      /PRIMARY KEY \(image_id, screen_pattern_id\)/,
      /source IN \('analysis', 'imported', 'manual'\)/,
      /INSERT INTO screen_pattern_sections/,
      /INSERT INTO screen_patterns/,
      /screen_pattern_matches_analysis/,
      /refresh_screen_pattern_previews/,
      /sync_screen_pattern_assignments_from_analysis/,
      /zz_refresh_screen_patterns_on_publish/,
    ],
  },
  {
    file: "0040_app_flow_reconciliations.sql",
    patterns: [
      /CREATE TABLE app_flow_reconciliations/,
      /source_fingerprint TEXT NOT NULL/,
      /visual_analysis_sha256 TEXT NOT NULL/,
      /research_context_sha256 TEXT NOT NULL/,
      /result_sha256 TEXT NOT NULL/,
      /UNIQUE \(app_id, platform, source_flow_id, revision_number\)/,
      /UNIQUE \(app_id, platform, source_flow_id, source_fingerprint\)/,
      /CREATE TRIGGER app_flow_reconciliation_immutable/,
      /App Flow reconciliation evidence is immutable/,
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

test("normal publication snapshots Flow children before the immutable transition", async () => {
  const source = await readFile(new URL("./db.ts", import.meta.url), "utf8");
  const start = source.indexOf("export async function publishAppVersion");
  const end = source.indexOf("export async function getVersionDesignSystem", start);
  assert.ok(start >= 0 && end > start);
  const publication = source.slice(start, end);
  const snapshot = publication.indexOf("await replaceVersionFlows");
  const transition = publication.indexOf("SET status = 'published', published_at = now()");
  assert.ok(snapshot >= 0);
  assert.ok(transition > snapshot);
});

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

test("migration verification checks Category tables and legacy backfill", async () => {
  const source = await readFile(
    new URL("../scripts/verify-migrations.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /const CATEGORY_TABLES/);
  assert.match(source, /category backfill must retain every legacy assignment/);
  assert.match(source, /categories_id_seq is behind categories\.id/);
});

test("migration verification includes every post-v1 table family", async () => {
  const source = await readFile(
    new URL("../scripts/verify-migrations.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /const APP_KNOWLEDGE_TABLES/);
  assert.match(source, /"app_knowledge_component_crops"/);
  assert.match(source, /"app_knowledge_design_system_chunks"/);
  assert.match(source, /"app_knowledge_snapshots"/);
  assert.match(source, /"public_facet_previews"/);
  assert.match(source, /"screen_pattern_assignments"/);
  assert.match(source, /"screen_pattern_sections"/);
  assert.match(source, /"screen_patterns"/);
  assert.match(source, /"site_search_index_queue"/);
  assert.match(source, /\.\.\.APP_KNOWLEDGE_TABLES/);
});

test("upgrade hashes exclude derived columns added after the legacy fixture", async () => {
  const source = await readFile(
    new URL("../scripts/verify-migrations.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    source,
    /app_versions: \["platform", "screen_count", "ui_element_count"\]/,
  );
  assert.match(
    source,
    /design_systems: \[\s*"origin",\s*"platform",\s*"capture_version_id",\s*"source_app_knowledge_revision_id",\s*"generated_at",?\s*\]/,
  );
});
