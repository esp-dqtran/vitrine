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
  app_flows: "app_id",
  app_versions: "id",
  version_images: "version_id, image_id",
  design_system_versions: "version_id",
  app_flow_versions: "version_id",
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

const SEARCH_TABLES = [
  "search_documents",
  "search_index_queue",
] as const;

const AUXILIARY_MIGRATION_TABLES = [
  "design_system_import_history",
  "organization_members",
  "organizations",
] as const;

const ADDED_COLUMNS: Partial<Record<keyof typeof TABLE_ORDER, readonly string[]>> = {
  access_events: ["feature_key", "metadata"],
  apps: ["source_domain", "display_name", "description", "website_url", "accent_color"],
  app_flows: ["platform"],
  app_versions: ["platform"],
  crawl_runs: ["run_kind", "parent_run_id", "platform", "allow_all", "pause_requested_at"],
  design_systems: ["origin", "platform"],
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
      ...SEARCH_TABLES,
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
