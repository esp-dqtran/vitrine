import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import pg from "pg";
import {
  assertGeneratedMigrationDatabaseName,
  createMigrationVerificationConfig,
} from "../scripts/verify-migrations.ts";
import {
  applyMigrations,
  assertMigrationsCurrent,
  discoverMigrations,
  redactMigrationError,
  validateMigrationState,
} from "./migrations.ts";

const ADMIN_URL = "postgres://postgres:postgres@localhost:5432/postgres";
const TEST_DATABASE_URL = "postgres://postgres:postgres@localhost:5432/astryx_migrations_test";

async function ensureMigrationTestDatabase(): Promise<string | undefined> {
  const client = new pg.Client({ connectionString: ADMIN_URL });
  try {
    await client.connect();
  } catch {
    return "Postgres not running — docker compose up -d postgres";
  }
  try {
    await client.query("CREATE DATABASE astryx_migrations_test");
  } catch (error) {
    if ((error as { code?: string }).code !== "42P04") throw error;
  } finally {
    await client.end();
  }
  return undefined;
}

const postgresSkipReason = await ensureMigrationTestDatabase();

test("migration verification requires explicit disposable-database opt-in", () => {
  assert.throws(
    () => createMigrationVerificationConfig({}),
    /MIGRATION_TEST_DATABASE_URL is required/,
  );
  assert.throws(
    () => createMigrationVerificationConfig({
      MIGRATION_TEST_DATABASE_URL: ADMIN_URL,
    }),
    /MIGRATION_TEST_ALLOW_DROP=1 is required/,
  );

  const config = createMigrationVerificationConfig({
    MIGRATION_TEST_DATABASE_URL: ADMIN_URL,
    MIGRATION_TEST_ALLOW_DROP: "1",
  }, ["a".repeat(32), "b".repeat(32)]);

  assert.deepEqual(config.databaseNames, {
    empty: `astryx_migration_test_${"a".repeat(32)}`,
    upgrade: `astryx_migration_test_${"b".repeat(32)}`,
  });
  assert.doesNotThrow(() => assertGeneratedMigrationDatabaseName(config.databaseNames.empty));
  for (const unsafe of ["astryx", "astryx_migration_test_", "astryx_migration_test_bad-name", "postgres"]) {
    assert.throws(() => assertGeneratedMigrationDatabaseName(unsafe), /refusing unsafe database name/i);
  }
});

async function temporaryDirectory(t: { after(fn: () => Promise<void>): void }): Promise<string> {
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

test("rejects invalid names, sequence gaps, and top-level transaction statements", async (t) => {
  const root = await temporaryDirectory(t);

  const invalidName = join(root, "invalid-name");
  await mkdir(invalidName);
  await writeFile(join(invalidName, "1_base.sql"), "SELECT 1;\n");
  await assert.rejects(() => discoverMigrations(invalidName), /Invalid migration filename: 1_base\.sql/);

  const gap = join(root, "gap");
  await mkdir(gap);
  await writeFile(join(gap, "0001_base.sql"), "SELECT 1;\n");
  await writeFile(join(gap, "0003_gap.sql"), "SELECT 3;\n");
  await assert.rejects(() => discoverMigrations(gap), /sequence gap.*0003_gap/i);

  const transaction = join(root, "transaction");
  await mkdir(transaction);
  await writeFile(join(transaction, "0001_bad.sql"), "BEGIN;\nSELECT 1;\nCOMMIT;\n");
  await assert.rejects(() => discoverMigrations(transaction), /contains a transaction statement/i);

  const procedural = join(root, "procedural");
  await mkdir(procedural);
  await writeFile(join(procedural, "0001_do_block.sql"), "DO $$ BEGIN\n  PERFORM 1;\nEND $$;\n");
  assert.equal((await discoverMigrations(procedural)).length, 1);
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

test("redacts database URLs and decoded passwords from migration errors", () => {
  const databaseUrl = "postgres://operator:p%40ssword@db.internal:5432/astryx";
  const error = new Error(`connection failed for ${databaseUrl} with password p@ssword`);

  const message = redactMigrationError(error, databaseUrl);

  assert.doesNotMatch(message, /operator|p%40ssword|p@ssword|db\.internal/);
  assert.match(message, /redacted/);
});

test("applies pending migrations once and rejects an edited applied file", { skip: postgresSkipReason }, async (t) => {
  const directory = await temporaryDirectory(t);
  const pool = new pg.Pool({ connectionString: TEST_DATABASE_URL });
  t.after(() => pool.end());
  await pool.query("DROP TABLE IF EXISTS schema_migrations, migration_probe CASCADE");
  await writeFile(join(directory, "0001_base.sql"),
    "CREATE TABLE migration_probe (id integer PRIMARY KEY, label text NOT NULL);\n");
  await writeFile(join(directory, "0002_seed.sql"),
    "INSERT INTO migration_probe (id, label) VALUES (1, 'ready');\n");

  assert.deepEqual((await applyMigrations(pool, directory)).appliedVersions, [1, 2]);
  assert.deepEqual((await pool.query("SELECT id, label FROM migration_probe")).rows, [{ id: 1, label: "ready" }]);
  await assertMigrationsCurrent(pool, directory);
  assert.deepEqual((await applyMigrations(pool, directory)).appliedVersions, []);

  await writeFile(join(directory, "0001_base.sql"), "SELECT 999;\n");
  await assert.rejects(() => assertMigrationsCurrent(pool, directory), /does not match its immutable file/);
});

test("rolls back a failed migration and omits its ledger row", { skip: postgresSkipReason }, async (t) => {
  const directory = await temporaryDirectory(t);
  const pool = new pg.Pool({ connectionString: TEST_DATABASE_URL });
  t.after(() => pool.end());
  await pool.query("DROP TABLE IF EXISTS schema_migrations, migration_probe, rollback_probe CASCADE");
  await writeFile(join(directory, "0001_base.sql"),
    "CREATE TABLE migration_probe (id integer PRIMARY KEY);\n");
  await applyMigrations(pool, directory);
  await writeFile(join(directory, "0002_bad.sql"),
    "CREATE TABLE rollback_probe (id integer PRIMARY KEY);\nSELECT missing_column FROM rollback_probe;\n");

  await assert.rejects(() => applyMigrations(pool, directory), /missing_column/);
  assert.equal((await pool.query<{ name: string | null }>(
    "SELECT to_regclass('rollback_probe') AS name",
  )).rows[0].name, null);
  assert.deepEqual(
    (await pool.query<{ version: number }>("SELECT version FROM schema_migrations ORDER BY version")).rows,
    [{ version: 1 }],
  );
});

test("read-only assertion does not create a missing migration ledger", { skip: postgresSkipReason }, async (t) => {
  const directory = await temporaryDirectory(t);
  const pool = new pg.Pool({ connectionString: TEST_DATABASE_URL });
  t.after(() => pool.end());
  await pool.query("DROP TABLE IF EXISTS schema_migrations CASCADE");
  await writeFile(join(directory, "0001_base.sql"), "SELECT 1;\n");

  await assert.rejects(() => assertMigrationsCurrent(pool, directory), /have not been applied/);
  assert.equal((await pool.query<{ name: string | null }>(
    "SELECT to_regclass('schema_migrations') AS name",
  )).rows[0].name, null);
});

test("migration application times out while another session owns the lock", { skip: postgresSkipReason }, async (t) => {
  const directory = await temporaryDirectory(t);
  const pool = new pg.Pool({ connectionString: TEST_DATABASE_URL });
  const holder = await pool.connect();
  t.after(async () => {
    await holder.query("SELECT pg_advisory_unlock(hashtext('astryx-schema-migrations'))");
    holder.release();
    await pool.end();
  });
  await pool.query("DROP TABLE IF EXISTS schema_migrations CASCADE");
  await writeFile(join(directory, "0001_base.sql"), "SELECT 1;\n");
  await holder.query("SELECT pg_advisory_lock(hashtext('astryx-schema-migrations'))");

  await assert.rejects(
    () => applyMigrations(pool, directory, { lockTimeoutMs: 30, lockPollMs: 5 }),
    /migration lock timeout/i,
  );
});

test("ordinary database queries never bootstrap or mutate schema", async () => {
  const source = await readFile(new URL("./db.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /ensureSchema|schemaReady/);
  assert.doesNotMatch(source, /pool\.query\(`\s*(?:CREATE|ALTER|DROP)/i);

  const migration = await readFile(
    new URL("../migrations/0001_current_schema.sql", import.meta.url),
    "utf8",
  );
  for (const table of [
    "apps",
    "images",
    "app_versions",
    "crawl_plans",
    "crawl_runs",
    "crawl_evidence",
    "collections",
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`));
  }
  assert.match(migration, /images_platform_image_url_uidx/);
  assert.match(migration, /collection_items_kind_check/);
});

test("baseline migration preserves existing published and draft image membership", {
  skip: postgresSkipReason,
}, async (t) => {
  const pool = new pg.Pool({ connectionString: TEST_DATABASE_URL });
  t.after(() => pool.end());
  await pool.query("DROP SCHEMA public CASCADE");
  await pool.query("CREATE SCHEMA public");

  const [baseline] = await discoverMigrations();
  await pool.query(baseline.sql);
  await pool.query(await readFile(
    new URL("../tests/fixtures/current-schema-upgrade.sql", import.meta.url),
    "utf8",
  ));

  await applyMigrations(pool);

  assert.deepEqual((await pool.query(
    `SELECT version_id, array_agg(image_id ORDER BY image_id) AS image_ids
     FROM version_images GROUP BY version_id ORDER BY version_id`,
  )).rows, [
    { version_id: 501, image_ids: [301] },
    { version_id: 502, image_ids: [301, 302] },
  ]);
});

test("baseline migration consolidates legacy duplicate image references", {
  skip: postgresSkipReason,
}, async (t) => {
  const pool = new pg.Pool({ connectionString: TEST_DATABASE_URL });
  t.after(() => pool.end());
  await pool.query("DROP SCHEMA public CASCADE");
  await pool.query("CREATE SCHEMA public");

  const [baseline] = await discoverMigrations();
  await pool.query(baseline.sql);
  await pool.query(await readFile(
    new URL("../tests/fixtures/current-schema-upgrade.sql", import.meta.url),
    "utf8",
  ));
  await pool.query("DROP INDEX images_platform_image_url_uidx");
  await pool.query(
    `INSERT INTO images
       (id, platform_id, image_url, description, created_at, analysis, kind)
     SELECT 303, platform_id, image_url, 'Duplicate draft capture', created_at,
       analysis, kind FROM images WHERE id = 302`,
  );
  await pool.query(
    `INSERT INTO version_images
       (version_id, image_id, captured_at, source_url, viewport_width, viewport_height, state_context)
     VALUES (502, 303, '2025-01-04T00:02:00Z', 'https://fixture.example/draft',
       1280, 800, 'legacy-duplicate')`,
  );
  await pool.query("UPDATE crawl_evidence SET image_id = 303 WHERE id = 1301");

  await applyMigrations(pool);

  assert.deepEqual((await pool.query(
    "SELECT id FROM images WHERE image_url = 'capture:2222222222222222' ORDER BY id",
  )).rows, [{ id: 302 }]);
  assert.deepEqual((await pool.query(
    "SELECT image_id FROM crawl_evidence WHERE id = 1301",
  )).rows, [{ image_id: 302 }]);
  assert.deepEqual((await pool.query(
    "SELECT image_id FROM version_images WHERE version_id = 502 ORDER BY image_id",
  )).rows, [{ image_id: 301 }, { image_id: 302 }]);
});
