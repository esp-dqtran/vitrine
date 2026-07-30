import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import pg from "pg";
import {
  applyMigrations,
  assertMigrationsCurrent,
  discoverMigrations,
  redactMigrationError,
} from "../src/migrations.ts";

const GENERATED_DATABASE = /^astryx_migration_test_[0-9a-f]{32}$/;

const TABLE_ORDER = {
  apps: "id",
  platforms: "id",
  images: "id",
  jobs: "id",
  users: "id",
  sessions: "id",
  subscriptions: "user_id",
  free_app_unlocks: "user_id, app_id",
  stripe_events: "event_id",
  export_usage: "user_id, window_start",
  access_events: "id",
  design_systems: "app_id",
  app_versions: "id",
  version_images: "version_id, image_id",
  design_system_versions: "version_id",
  review_issues: "id",
  exports: "id",
  crawl_plans: "id",
  crawl_runs: "id",
  crawl_evidence: "id",
  crawl_run_steps: "run_id, flow_id, step_id",
  crawl_repairs: "id",
  collections: "id",
  collection_items: "id",
} as const;

const OBJECT_STORAGE_TABLES = [
  "app_preview_images",
  "media_migration_state",
  "object_gc_marks",
  "stored_objects",
] as const;

const AUTONOMOUS_CRAWLER_TABLES = [
  "crawl_account_leases",
  "crawl_account_sessions",
  "crawl_dossiers",
  "crawl_missions",
  "crawl_states",
  "crawl_transitions",
] as const;

const RESEARCH_PROJECT_TABLES = [
  "research_project_items",
  "research_project_lanes",
  "research_project_syntheses",
  "research_projects",
] as const;

const SITES_TABLES = [
  "site_pages",
  "site_sections",
  "site_versions",
  "sites",
] as const;

const PUBLIC_PAGE_TABLES = [
  "web_page_sections",
  "web_page_versions",
  "web_pages",
] as const;

const REFERRAL_TABLES = [
  "promotional_entitlements",
  "referral_activity",
  "referral_codes",
  "referral_rewards",
  "referral_visits",
  "referrals",
] as const;

const FEATURE_DOCUMENT_TABLES = [
  "feature_document_jobs",
  "feature_document_revisions",
  "feature_document_shares",
  "feature_document_step_analyses",
  "feature_documents",
] as const;

const APP_KNOWLEDGE_TABLES = [
  "app_knowledge_component_crops",
  "app_knowledge_design_system_chunks",
  "app_knowledge_evidence_cache",
  "app_knowledge_evidence_overrides",
  "app_knowledge_job_evidence",
  "app_knowledge_jobs",
  "app_knowledge_review_events",
  "app_knowledge_revisions",
  "app_knowledge_snapshots",
] as const;

const SEARCH_TABLES = [
  "search_documents",
  "search_index_queue",
  "site_search_index_queue",
] as const;

const PUBLIC_PREVIEW_TABLES = [
  "public_facet_previews",
] as const;

const CATEGORY_TABLES = [
  "app_categories",
  "categories",
] as const;

const SCREEN_PATTERN_TABLES = [
  "screen_pattern_assignments",
  "screen_pattern_sections",
  "screen_patterns",
] as const;

const FLOW_TABLES = [
  "app_flow_mappings",
  "app_flow_version_mappings",
  "app_flow_versions",
  "app_flows",
  "flows",
] as const;

const UI_ELEMENT_TABLES = [
  "screen_ui_elements",
  "ui_element_extractions",
  "ui_element_types",
] as const;

const AUXILIARY_MIGRATION_TABLES = [
  "design_system_import_history",
  "organization_members",
  "organizations",
] as const;

const ADDED_COLUMNS: Partial<Record<keyof typeof TABLE_ORDER, readonly string[]>> = {
  access_events: ["feature_key", "metadata"],
  apps: ["source_domain", "display_name", "description", "website_url", "accent_color"],
  app_versions: ["platform", "screen_count", "ui_element_count"],
  crawl_runs: ["run_kind", "parent_run_id", "platform", "allow_all", "pause_requested_at"],
  design_systems: [
    "origin",
    "platform",
    "capture_version_id",
    "source_app_knowledge_revision_id",
    "generated_at",
  ],
  images: ["object_key", "thumbnail_object_key"],
  exports: ["object_key"],
  crawl_run_steps: ["failure_object_key"],
  users: ["clerk_user_id"],
};

const SEQUENCE_MAX_ID = {
  apps_id_seq: "apps",
  platforms_id_seq: "platforms",
  images_id_seq: "images",
  jobs_id_seq: "jobs",
  users_id_seq: "users",
  sessions_id_seq: "sessions",
  access_events_id_seq: "access_events",
  app_versions_id_seq: "app_versions",
  review_issues_id_seq: "review_issues",
  exports_id_seq: "exports",
  crawl_plans_id_seq: "crawl_plans",
  crawl_runs_id_seq: "crawl_runs",
  crawl_evidence_id_seq: "crawl_evidence",
  crawl_repairs_id_seq: "crawl_repairs",
  collections_id_seq: "collections",
  collection_items_id_seq: "collection_items",
} as const;

export interface MigrationVerificationConfig {
  adminUrl: string;
  databaseNames: { empty: string; upgrade: string };
}

export interface MigrationVerificationResult {
  empty: { migrationHead: number; tableCount: number; rerunApplied: number };
  upgrade: {
    migrationHead: number;
    preservedCounts: Record<string, number>;
    preservedSnapshotHashes: Record<string, string>;
    rerunApplied: number;
  };
}

interface UpgradeState {
  counts: Record<string, number>;
  hashes: Record<string, string>;
}

function randomSuffix(): string {
  return randomBytes(16).toString("hex");
}

export function assertGeneratedMigrationDatabaseName(name: string): void {
  if (!GENERATED_DATABASE.test(name)) {
    throw new Error(`Refusing unsafe database name: ${name}`);
  }
}

export function createMigrationVerificationConfig(
  environment: NodeJS.ProcessEnv,
  suffixes: readonly string[] = [randomSuffix(), randomSuffix()],
): MigrationVerificationConfig {
  const adminUrl = environment.MIGRATION_TEST_DATABASE_URL;
  if (!adminUrl) throw new Error("MIGRATION_TEST_DATABASE_URL is required");
  if (environment.MIGRATION_TEST_ALLOW_DROP !== "1") {
    throw new Error("MIGRATION_TEST_ALLOW_DROP=1 is required");
  }
  let parsed: URL;
  try {
    parsed = new URL(adminUrl);
  } catch {
    throw new Error("MIGRATION_TEST_DATABASE_URL must be a PostgreSQL URL");
  }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol) || parsed.pathname === "/") {
    throw new Error("MIGRATION_TEST_DATABASE_URL must name a maintenance database");
  }
  if (suffixes.length !== 2 || suffixes.some((suffix) => !/^[0-9a-f]{32}$/.test(suffix))) {
    throw new Error("Migration verification suffixes must be 32 lowercase hexadecimal characters");
  }
  const databaseNames = {
    empty: `astryx_migration_test_${suffixes[0]}`,
    upgrade: `astryx_migration_test_${suffixes[1]}`,
  };
  assertGeneratedMigrationDatabaseName(databaseNames.empty);
  assertGeneratedMigrationDatabaseName(databaseNames.upgrade);
  return { adminUrl, databaseNames };
}

function databaseUrl(adminUrl: string, databaseName: string): string {
  assertGeneratedMigrationDatabaseName(databaseName);
  const parsed = new URL(adminUrl);
  parsed.pathname = `/${databaseName}`;
  return parsed.toString();
}

function quotedIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function migrationHead(pool: pg.Pool): Promise<number> {
  const result = await pool.query<{ head: number | null }>(
    "SELECT max(version)::integer AS head FROM schema_migrations",
  );
  if (result.rows[0].head === null) throw new Error("Migration ledger is empty");
  return result.rows[0].head;
}

async function publicTables(pool: pg.Pool): Promise<string[]> {
  const result = await pool.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
  );
  return result.rows.map((row) => row.table_name);
}

async function captureUpgradeState(pool: pg.Pool): Promise<UpgradeState> {
  const counts: Record<string, number> = {};
  const hashes: Record<string, string> = {};
  for (const [table, order] of Object.entries(TABLE_ORDER)) {
    const identifier = quotedIdentifier(table);
    const count = await pool.query<{ count: number }>(
      `SELECT count(*)::integer AS count FROM ${identifier}`,
    );
    counts[table] = count.rows[0].count;
    const omitted = ADDED_COLUMNS[table as keyof typeof TABLE_ORDER] ?? [];
    const value = omitted.length
      ? `to_jsonb(ordered_row) - ARRAY[${omitted.map((column) => `'${column}'`).join(", ")}]::text[]`
      : "to_jsonb(ordered_row)";
    const rows = await pool.query<{ value: string }>(
      `SELECT (${value})::text AS value
       FROM (SELECT * FROM ${identifier} ORDER BY ${order}) ordered_row`,
    );
    hashes[table] = sha256(rows.rows.map((row) => row.value).join("\n"));
  }

  for (const [sequence, table] of Object.entries(SEQUENCE_MAX_ID)) {
    const state = await pool.query<{ last_value: string; is_called: boolean }>(
      `SELECT last_value::text, is_called FROM ${quotedIdentifier(sequence)}`,
    );
    const maximum = await pool.query<{ maximum: string | null }>(
      `SELECT max(id)::text AS maximum FROM ${quotedIdentifier(table)}`,
    );
    if (maximum.rows[0].maximum !== null) {
      assert.ok(
        BigInt(state.rows[0].last_value) >= BigInt(maximum.rows[0].maximum),
        `${sequence} is behind ${table}.id`,
      );
    }
    hashes[`sequence:${sequence}`] = sha256(JSON.stringify(state.rows[0]));
  }

  const invalidForeignKeys = await pool.query<{ count: number }>(
    `SELECT count(*)::integer AS count
     FROM pg_constraint constraint_row
     JOIN pg_namespace namespace_row ON namespace_row.oid = constraint_row.connamespace
     WHERE namespace_row.nspname = 'public'
       AND constraint_row.contype = 'f'
       AND NOT constraint_row.convalidated`,
  );
  assert.equal(invalidForeignKeys.rows[0].count, 0, "all foreign keys must be validated");
  return { counts, hashes };
}

async function verifyEmptyDatabase(databaseUrlValue: string): Promise<MigrationVerificationResult["empty"]> {
  const pool = new pg.Pool({ connectionString: databaseUrlValue });
  try {
    await pool.query("SET TIME ZONE 'UTC'");
    await applyMigrations(pool);
    await assertMigrationsCurrent(pool);
    const expectedTables = [
      ...Object.keys(TABLE_ORDER),
      ...OBJECT_STORAGE_TABLES,
      ...AUTONOMOUS_CRAWLER_TABLES,
      ...RESEARCH_PROJECT_TABLES,
      ...SITES_TABLES,
      ...PUBLIC_PAGE_TABLES,
      ...REFERRAL_TABLES,
      ...FEATURE_DOCUMENT_TABLES,
      ...APP_KNOWLEDGE_TABLES,
      ...SEARCH_TABLES,
      ...PUBLIC_PREVIEW_TABLES,
      ...CATEGORY_TABLES,
      ...SCREEN_PATTERN_TABLES,
      ...FLOW_TABLES,
      ...UI_ELEMENT_TABLES,
      ...AUXILIARY_MIGRATION_TABLES,
      "schema_migrations",
    ].sort();
    const tables = await publicTables(pool);
    assert.deepEqual(tables, expectedTables, "empty install created an unexpected table set");
    const rerun = await applyMigrations(pool);
    return {
      migrationHead: await migrationHead(pool),
      tableCount: tables.length,
      rerunApplied: rerun.appliedVersions.length,
    };
  } finally {
    await pool.end();
  }
}

async function assertHierarchicalFlowUpgrade(pool: pg.Pool): Promise<void> {
  const counts = await pool.query<{
    roots: number;
    children: number;
    current_rows: number;
    current_mappings: number;
    version_rows: number;
    version_mappings: number;
  }>(`SELECT
    (SELECT count(*)::integer FROM flows WHERE parent_id IS NULL) AS roots,
    (SELECT count(*)::integer FROM flows WHERE parent_id IS NOT NULL) AS children,
    (SELECT count(*)::integer FROM app_flows) AS current_rows,
    (SELECT count(*)::integer FROM app_flow_mappings) AS current_mappings,
    (SELECT count(*)::integer FROM app_flow_versions) AS version_rows,
    (SELECT count(*)::integer FROM app_flow_version_mappings) AS version_mappings`);

  assert.deepEqual(counts.rows[0], {
    roots: 2,
    children: 1,
    current_rows: 3,
    current_mappings: 3,
    version_rows: 3,
    version_mappings: 3,
  });

  const hierarchy = await pool.query<{
    parent: string | null;
    name: string;
    normalized_name: string;
  }>(`SELECT parent.name AS parent, child.name, child.normalized_name
     FROM flows child
     LEFT JOIN flows parent ON parent.id = child.parent_id
     ORDER BY parent.name NULLS FIRST, child.name`);

  assert.deepEqual(hierarchy.rows, [
    { parent: null, name: "Searching products", normalized_name: "searching products" },
    { parent: null, name: "Settings", normalized_name: "settings" },
    { parent: "Settings", name: "Changing password", normalized_name: "changing password" },
  ]);

  const preserved = await pool.query<{
    source_flow_id: string;
    position: number;
    source_category: string | null;
    steps: unknown;
  }>(`SELECT source_flow_id, position, source_category, steps
     FROM app_flows
     WHERE app_id = 101 AND platform = 'web'
     ORDER BY position`);

  assert.equal(preserved.rows[0].source_flow_id, "settings-password");
  assert.equal(preserved.rows[0].source_category, "Settings");
  assert.deepEqual(preserved.rows[0].steps, [{
    label: "Save",
    evidence: [301],
  }]);
  assert.equal(preserved.rows[1].source_flow_id, "search");
  assert.equal(preserved.rows[1].position, 2);
  assert.equal(preserved.rows[2].source_flow_id, "self-settings");

  const aggregateColumns = await pool.query<{ count: number }>(
    `SELECT count(*)::integer AS count
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name IN ('app_flows', 'app_flow_versions')
       AND column_name = 'flows'`,
  );
  assert.equal(aggregateColumns.rows[0].count, 0);

  const appCategories = await pool.query<{ count: number }>(
    `SELECT count(*)::integer AS count
     FROM app_categories
     WHERE app_id = 101`,
  );
  assert.equal(appCategories.rows[0].count, 1);

  const sequences = await pool.query<{
    flows_valid: boolean;
    app_flows_valid: boolean;
    app_flow_versions_valid: boolean;
  }>(`SELECT
    (SELECT last_value >= COALESCE((SELECT max(id) FROM flows), 0)
       FROM flows_id_seq) AS flows_valid,
    (SELECT last_value >= COALESCE((SELECT max(id) FROM app_flows), 0)
       FROM app_flows_id_seq) AS app_flows_valid,
    (SELECT last_value >= COALESCE((SELECT max(id) FROM app_flow_versions), 0)
       FROM app_flow_versions_id_seq) AS app_flow_versions_valid`);
  assert.deepEqual(sequences.rows[0], {
    flows_valid: true,
    app_flows_valid: true,
    app_flow_versions_valid: true,
  });
}

async function verifyUpgradeDatabase(databaseUrlValue: string): Promise<MigrationVerificationResult["upgrade"]> {
  const pool = new pg.Pool({ connectionString: databaseUrlValue });
  try {
    await pool.query("SET TIME ZONE 'UTC'");
    const migrations = await discoverMigrations();
    if (migrations.length === 0) throw new Error("No migration files were discovered");
    await pool.query(migrations[0].sql);
    const fixture = await readFile(
      new URL("../tests/fixtures/current-schema-upgrade.sql", import.meta.url),
      "utf8",
    );
    await pool.query(fixture);
    const before = await captureUpgradeState(pool);

    await applyMigrations(pool);
    await assertMigrationsCurrent(pool);
    const after = await captureUpgradeState(pool);
    assert.deepEqual(after.counts, before.counts, "upgrade changed protected row counts");
    assert.deepEqual(after.hashes, before.hashes, "upgrade changed protected rows or sequences");
    await assertHierarchicalFlowUpgrade(pool);
    const categoryBackfill = await pool.query<{
      categories: number;
      relationships: number;
      missing: number;
    }>(
      `SELECT
         (SELECT count(*)::integer FROM categories) AS categories,
         (SELECT count(*)::integer FROM app_categories) AS relationships,
         (
           SELECT count(*)::integer
           FROM apps a
           WHERE a.category IS NOT NULL
             AND btrim(a.category) <> ''
             AND NOT EXISTS (
               SELECT 1 FROM app_categories ac WHERE ac.app_id = a.id
             )
         ) AS missing`,
    );
    assert.equal(
      categoryBackfill.rows[0].missing,
      0,
      "category backfill must retain every legacy assignment",
    );
    assert.ok(
      categoryBackfill.rows[0].categories > 0,
      "upgrade fixture must create categories",
    );
    assert.ok(
      categoryBackfill.rows[0].relationships > 0,
      "upgrade fixture must create app category relationships",
    );
    const categorySequence = await pool.query<{
      last_value: string;
      maximum: string;
    }>(
      `SELECT sequence_row.last_value::text,
         COALESCE((SELECT max(id) FROM categories), 0)::text AS maximum
       FROM categories_id_seq sequence_row`,
    );
    assert.ok(
      BigInt(categorySequence.rows[0].last_value)
        >= BigInt(categorySequence.rows[0].maximum),
      "categories_id_seq is behind categories.id",
    );
    for (const table of OBJECT_STORAGE_TABLES) {
      const result = await pool.query<{ count: number }>(
        `SELECT count(*)::integer AS count FROM ${quotedIdentifier(table)}`,
      );
      assert.equal(result.rows[0].count, 0, `${table} must start empty`);
    }
    for (const table of SITES_TABLES) {
      const result = await pool.query<{ count: number }>(
        `SELECT count(*)::integer AS count FROM ${quotedIdentifier(table)}`,
      );
      assert.equal(result.rows[0].count, 0, `${table} must start empty`);
    }
    assert.equal((await pool.query<{ count: number }>(
      "SELECT count(*)::integer AS count FROM images WHERE object_key IS NOT NULL",
    )).rows[0].count, 0, "upgrade must preserve legacy image references");

    const rerun = await applyMigrations(pool);
    return {
      migrationHead: await migrationHead(pool),
      preservedCounts: after.counts,
      preservedSnapshotHashes: after.hashes,
      rerunApplied: rerun.appliedVersions.length,
    };
  } finally {
    await pool.end();
  }
}

export async function verifyMigrations(
  config = createMigrationVerificationConfig(process.env),
): Promise<MigrationVerificationResult> {
  const adminPool = new pg.Pool({ connectionString: config.adminUrl });
  const names = [config.databaseNames.empty, config.databaseNames.upgrade];
  const created: string[] = [];
  let verificationError: unknown;
  try {
    for (const name of names) {
      assertGeneratedMigrationDatabaseName(name);
      await adminPool.query(`CREATE DATABASE ${quotedIdentifier(name)}`);
      created.push(name);
    }
    const empty = await verifyEmptyDatabase(databaseUrl(config.adminUrl, config.databaseNames.empty));
    const upgrade = await verifyUpgradeDatabase(databaseUrl(config.adminUrl, config.databaseNames.upgrade));
    return { empty, upgrade };
  } catch (error) {
    verificationError = error;
    throw error;
  } finally {
    let cleanupError: unknown;
    for (const name of created.reverse()) {
      try {
        assertGeneratedMigrationDatabaseName(name);
        await adminPool.query(`DROP DATABASE IF EXISTS ${quotedIdentifier(name)} WITH (FORCE)`);
      } catch (error) {
        cleanupError ??= error;
        if (verificationError !== undefined) {
          process.stderr.write(
            `Migration verifier cleanup failed for ${name}: ${redactMigrationError(error, config.adminUrl)}\n`,
          );
        }
      }
    }
    await adminPool.end();
    if (cleanupError !== undefined && verificationError === undefined) {
      throw new Error(`Migration verifier cleanup failed: ${redactMigrationError(cleanupError, config.adminUrl)}`);
    }
  }
}

const invokedPath = process.argv[1];
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  const databaseUrlValue = process.env.MIGRATION_TEST_DATABASE_URL ?? "";
  verifyMigrations()
    .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch((error) => {
      process.stderr.write(`${redactMigrationError(error, databaseUrlValue)}\n`);
      process.exitCode = 1;
    });
}
