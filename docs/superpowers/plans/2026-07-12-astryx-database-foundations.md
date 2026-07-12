# Astryx Database Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace query-time PostgreSQL DDL with explicit checksummed migrations, startup schema gates, empty/upgrade verification, and proven backup/restore while preserving the current Astryx database.

**Architecture:** A small migration library discovers immutable SQL files, validates the applied ledger, takes one session advisory lock, and applies each pending file in its own transaction. API, worker, and normal query paths only assert the migration head; deployment owns mutation. Verification exercises an empty database, a sanitized unversioned upgrade fixture, and a real backup/restore target.

**Tech Stack:** Node.js 22 erasable TypeScript, PostgreSQL 17, `pg`, Node test runner, Docker Compose, `pg_dump`, and `pg_restore`.

**Execution choice:** The user explicitly selected inline execution on `main`; do not create another worktree or pause for an execution-choice prompt.

---

## File map

- `migrations/0001_current_schema.sql` — exact current schema, legacy flat-image catch-up, duplicate consolidation, indexes, and initial published-version backfill.
- `src/migrations.ts` — migration discovery, checksum/state validation, application, and read-only assertion.
- `src/migrations.test.ts` — pure manifest/state tests and PostgreSQL transaction behavior.
- `scripts/migrate.ts` — deployment mutation entry point.
- `scripts/check-migrations.ts` — read-only command used by operators and startup diagnostics.
- `scripts/verify-migrations.ts` — disposable empty/upgrade database verifier.
- `scripts/db-backup.ts` — custom-format dump, SHA-256 sidecar, and non-sensitive manifest.
- `scripts/db-restore-verify.ts` — checksum, restore, migration-head, count, and relationship verification.
- `tests/fixtures/current-schema-upgrade.sql` — sanitized unversioned current-schema fixture.
- `src/db.ts` — PostgreSQL pool and parameterized query helpers with no schema bootstrap.
- `src/db.test.ts` — migrates its disposable database explicitly before database behavior tests.
- `services/api/src/start.ts` — side-effect-free API startup orchestration with injected dependencies.
- `services/api/src/index.ts` — asserts migration head before configuration, admin bootstrap, or listen.
- `services/import-worker/src/start.ts` — side-effect-free worker startup orchestration with injected dependencies.
- `services/import-worker/src/index.ts` — asserts migration head before consuming RabbitMQ.
- `services/api/Dockerfile` and `services/import-worker/Dockerfile` — include migration manifests for read-only startup checks.
- `services/migrate/Dockerfile` — one-shot migration/recovery artifact.
- `docker-compose.yml` — migration job gates API and worker startup.
- `package.json` — migration, verification, backup, and restore commands.
- `docs/ARCHITECTURE.md` and `docs/operations/database.md` — actual schema/recovery contract and commands.

### Task 1: Migration manifest discovery and state validation

**Files:**
- Create: `src/migrations.test.ts`
- Create: `src/migrations.ts`

- [x] **Step 1: Write failing discovery and state tests**

Create tests that build a temporary migration directory and assert strict names, contiguous versions, SHA-256 checksums, forbidden transaction statements, applied checksum equality, pending detection, and unknown applied-version rejection:

```typescript
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { discoverMigrations, validateMigrationState } from "./migrations.ts";

test("discovers contiguous immutable migrations and validates applied state", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "astryx-migrations-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, "0001_base.sql"), "SELECT 1;\n");
  await writeFile(join(dir, "0002_more.sql"), "SELECT 2;\n");

  const files = await discoverMigrations(dir);
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

test("rejects gaps, edited migrations, unknown applied versions, and SQL transactions", async () => {
  const root = await mkdtemp(join(tmpdir(), "astryx-invalid-migrations-"));
  try {
    const gap = join(root, "gap");
    await mkdir(gap);
    await writeFile(join(gap, "0001_base.sql"), "SELECT 1;\n");
    await writeFile(join(gap, "0003_gap.sql"), "SELECT 3;\n");
    await assert.rejects(() => discoverMigrations(gap), /sequence gap.*0003_gap/i);

    const transaction = join(root, "transaction");
    await mkdir(transaction);
    await writeFile(join(transaction, "0001_bad.sql"), "BEGIN;\nSELECT 1;\nCOMMIT;\n");
    await assert.rejects(() => discoverMigrations(transaction), /contains a transaction statement/i);

    const valid = join(root, "valid");
    await mkdir(valid);
    await writeFile(join(valid, "0001_base.sql"), "SELECT 1;\n");
    const files = await discoverMigrations(valid);
    assert.throws(() => validateMigrationState(files, [{
      version: 1,
      name: "base",
      checksum: "0".repeat(64),
    }]), /does not match/);
    assert.throws(() => validateMigrationState([], [{
      version: 1,
      name: "unknown",
      checksum: "0".repeat(64),
    }]), /not present on disk/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
```

- [x] **Step 2: Run the test and confirm the module is missing**

Run: `node --experimental-strip-types --test src/migrations.test.ts`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/migrations.ts`.

- [x] **Step 3: Implement manifest discovery and validation**

Implement these public types and functions:

```typescript
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export interface MigrationFile {
  version: number;
  name: string;
  filename: string;
  checksum: string;
  sql: string;
}

export interface AppliedMigration {
  version: number;
  name: string;
  checksum: string;
}

const MIGRATION_NAME = /^(\d{4})_([a-z0-9_]+)\.sql$/;
const TRANSACTION_SQL = /^\s*(?:BEGIN|START\s+TRANSACTION|COMMIT|ROLLBACK)\s*;\s*$/imu;

export async function discoverMigrations(directory = "migrations"): Promise<MigrationFile[]> {
  const names = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
  const migrations = await Promise.all(names.map(async (filename) => {
    const match = filename.match(MIGRATION_NAME);
    if (!match) throw new Error(`Invalid migration filename: ${filename}`);
    const sql = await readFile(join(directory, filename), "utf8");
    if (TRANSACTION_SQL.test(sql)) throw new Error(`Migration ${filename} contains a transaction statement`);
    return {
      version: Number(match[1]),
      name: match[2],
      filename,
      checksum: createHash("sha256").update(sql).digest("hex"),
      sql,
    };
  }));
  migrations.forEach((migration, index) => {
    if (migration.version !== index + 1) throw new Error(`Migration sequence gap at ${migration.filename}`);
  });
  return migrations;
}

export function validateMigrationState(files: readonly MigrationFile[], applied: readonly AppliedMigration[]) {
  const byVersion = new Map(files.map((file) => [file.version, file]));
  const ordered = [...applied].sort((left, right) => left.version - right.version);
  ordered.forEach((row, index) => {
    if (row.version !== index + 1) throw new Error(`Applied migration sequence gap at version ${row.version}`);
    const file = byVersion.get(row.version);
    if (!file) throw new Error(`Applied migration ${row.version} is not present on disk`);
    if (file.name !== row.name || file.checksum !== row.checksum) {
      throw new Error(`Applied migration ${row.version}_${row.name} does not match its immutable file`);
    }
  });
  return { pending: files.filter((file) => !ordered.some((row) => row.version === file.version)) };
}
```

Complete the second test with real temporary files rather than comments.

- [x] **Step 4: Run the focused tests**

Run: `node --experimental-strip-types --test src/migrations.test.ts`

Expected: PASS with all manifest/state tests green.

- [x] **Step 5: Commit the manifest layer**

```bash
git add src/migrations.ts src/migrations.test.ts
git commit -m "feat: add immutable migration manifests"
```

### Task 2: Transactional migration runner and read-only assertion

**Files:**
- Modify: `src/migrations.ts`
- Modify: `src/migrations.test.ts`
- Create: `scripts/migrate.ts`
- Create: `scripts/check-migrations.ts`
- Modify: `package.json`

- [x] **Step 1: Write failing runner tests**

Use a disposable PostgreSQL database (skip only when local PostgreSQL is unavailable) to prove:

```typescript
test("applies each pending migration once and rejects a changed checksum", async (t) => {
  const pool = new pg.Pool({ connectionString: TEST_DATABASE_URL });
  t.after(() => pool.end());
  await pool.query("DROP TABLE IF EXISTS schema_migrations, migration_probe CASCADE");
  // Write 0001 that creates migration_probe and 0002 that inserts one row.
  const first = await applyMigrations(pool, directory);
  assert.deepEqual(first.appliedVersions, [1, 2]);
  assert.equal((await pool.query("SELECT * FROM migration_probe")).rowCount, 1);
  assert.deepEqual((await applyMigrations(pool, directory)).appliedVersions, []);
  await writeFile(join(directory, "0001_base.sql"), "SELECT 999;\n");
  await assert.rejects(() => assertMigrationsCurrent(pool, directory), /does not match/);
});

test("rolls back a failed migration and does not write its ledger row", async () => {
  const directory = await mkdtemp(join(tmpdir(), "astryx-rollback-migration-"));
  const pool = new pg.Pool({ connectionString: TEST_DATABASE_URL });
  try {
    await pool.query("DROP TABLE IF EXISTS schema_migrations, migration_probe, rollback_probe CASCADE");
    await writeFile(join(directory, "0001_base.sql"), "CREATE TABLE migration_probe (id integer PRIMARY KEY);\n");
    await applyMigrations(pool, directory);
    await writeFile(join(directory, "0002_bad.sql"),
      "CREATE TABLE rollback_probe (id integer PRIMARY KEY);\nSELECT missing_column FROM rollback_probe;\n");
    await assert.rejects(() => applyMigrations(pool, directory), /missing_column/);
    assert.equal((await pool.query("SELECT to_regclass('rollback_probe') AS name")).rows[0].name, null);
    assert.deepEqual(
      (await pool.query("SELECT version FROM schema_migrations ORDER BY version")).rows,
      [{ version: 1 }],
    );
  } finally {
    await pool.end();
    await rm(directory, { recursive: true, force: true });
  }
});
```

- [x] **Step 2: Run the tests and confirm exports are missing**

Run: `node --experimental-strip-types --test src/migrations.test.ts`

Expected: FAIL because `applyMigrations` and `assertMigrationsCurrent` are not exported.

- [x] **Step 3: Implement the PostgreSQL runner**

Add a ledger constant, session advisory lock, applied-row reader, and public operations:

```typescript
import pg from "pg";

const LOCK_SQL = "SELECT pg_advisory_lock(hashtext('astryx-schema-migrations'))";
const UNLOCK_SQL = "SELECT pg_advisory_unlock(hashtext('astryx-schema-migrations'))";

async function appliedMigrations(client: pg.PoolClient): Promise<AppliedMigration[]> {
  const result = await client.query<AppliedMigration>(
    "SELECT version, name, checksum FROM schema_migrations ORDER BY version",
  );
  return result.rows;
}

export async function assertMigrationsCurrent(pool: pg.Pool, directory = "migrations"): Promise<void> {
  const files = await discoverMigrations(directory);
  const ledger = await pool.query<{ present: boolean }>(
    "SELECT to_regclass('public.schema_migrations') IS NOT NULL AS present",
  );
  if (!ledger.rows[0].present) throw new Error("Database migrations have not been applied");
  const client = await pool.connect();
  try {
    const { pending } = validateMigrationState(files, await appliedMigrations(client));
    if (pending.length) throw new Error(`Database has ${pending.length} pending migration(s)`);
  } finally {
    client.release();
  }
}

export async function applyMigrations(pool: pg.Pool, directory = "migrations") {
  const files = await discoverMigrations(directory);
  const client = await pool.connect();
  const appliedVersions: number[] = [];
  try {
    await client.query(LOCK_SQL);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version integer PRIMARY KEY,
      name text NOT NULL UNIQUE,
      checksum text NOT NULL,
      execution_ms integer NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const { pending } = validateMigrationState(files, await appliedMigrations(client));
    for (const migration of pending) {
      const started = Date.now();
      await client.query("BEGIN");
      try {
        await client.query(migration.sql);
        await client.query(
          "INSERT INTO schema_migrations (version, name, checksum, execution_ms) VALUES ($1, $2, $3, $4)",
          [migration.version, migration.name, migration.checksum, Date.now() - started],
        );
        await client.query("COMMIT");
        appliedVersions.push(migration.version);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
    return { appliedVersions };
  } finally {
    await client.query(UNLOCK_SQL).catch(() => undefined);
    client.release();
  }
}
```

Use `pg_try_advisory_lock` with bounded polling instead of an unbounded wait in the final implementation; the test injects a short timeout and proves the distinct lock-timeout error.

- [x] **Step 4: Add explicit commands**

`scripts/migrate.ts` validates `DATABASE_URL`, creates a pool, calls `applyMigrations`, emits one JSON summary, and closes the pool in `finally`. `scripts/check-migrations.ts` does the same with `assertMigrationsCurrent` and never creates the ledger.

Add package scripts using the production-compatible Node runtime:

```json
"db:migrate": "node --experimental-strip-types scripts/migrate.ts",
"db:check": "node --experimental-strip-types scripts/check-migrations.ts",
"db:verify": "node --experimental-strip-types scripts/verify-migrations.ts",
"db:backup": "node --experimental-strip-types scripts/db-backup.ts",
"db:restore-verify": "node --experimental-strip-types scripts/db-restore-verify.ts"
```

- [x] **Step 5: Run focused tests and command argument checks**

Run:

```bash
node --experimental-strip-types --test src/migrations.test.ts
env -u DATABASE_URL npm run db:migrate
```

Expected: tests PASS; the command without `DATABASE_URL` exits non-zero with `DATABASE_URL is required` and prints no connection string.

- [x] **Step 6: Commit the runner**

```bash
git add src/migrations.ts src/migrations.test.ts scripts/migrate.ts scripts/check-migrations.ts package.json
git commit -m "feat: run transactional database migrations"
```

### Task 3: Baseline the current schema and remove query-time DDL

**Files:**
- Create: `migrations/0001_current_schema.sql`
- Modify: `src/db.ts:1-486`
- Modify: `src/db.test.ts:1-30`

- [x] **Step 1: Add a failing source-boundary test**

Add a test that reads `src/db.ts` and asserts there is no `ensureSchema`, no `schemaReady`, and no query helper call that runs DDL. Also assert the migration file contains the current tables, crawler constraints, duplicate consolidation, and unique image index.

```typescript
test("ordinary database queries never mutate schema", async () => {
  const source = await readFile(new URL("./db.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /ensureSchema|schemaReady/);
  assert.doesNotMatch(source, /pool\.query\(`\s*(?:CREATE|ALTER|DROP)/i);
  const migration = await readFile(new URL("../migrations/0001_current_schema.sql", import.meta.url), "utf8");
  for (const table of ["apps", "images", "app_versions", "crawl_plans", "crawl_runs", "crawl_evidence"]) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`));
  }
  assert.match(migration, /images_platform_image_url_uidx/);
});
```

- [x] **Step 2: Run the boundary test and confirm it fails**

Run: `node --experimental-strip-types --test src/migrations.test.ts`

Expected: FAIL because `src/db.ts` still contains `ensureSchema` and the baseline SQL file is absent.

- [x] **Step 3: Create the exact baseline migration**

Move the literal SQL currently inside `ensureSchema()` (`src/db.ts:83-451`) into `migrations/0001_current_schema.sql`. Expand `${IMAGE_CONSOLIDATION_SQL}` with the exact SQL currently at `src/db.ts:18-78`. Retain the guarded legacy `images_flat` conversion, all current customer/version/crawler/collection tables, duplicate consolidation, unique image index, and version snapshot backfills. Do not add new product schema in migration 0001.

The migration starts with:

```sql
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'images' AND column_name = 'app'
  ) THEN
    ALTER TABLE images RENAME TO images_flat;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS apps (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE
);
```

It ends with the existing collection-item check constraint:

```sql
ALTER TABLE collection_items DROP CONSTRAINT IF EXISTS collection_items_kind_check;
ALTER TABLE collection_items ADD CONSTRAINT collection_items_kind_check
  CHECK (kind IN ('app', 'screen', 'component', 'token', 'flow', 'pattern'));
```

- [x] **Step 4: Remove runtime schema mutation**

Delete `mkdirSync("data")`, `schemaReady`, `ensureSchema`, `IMAGE_CONSOLIDATION_SQL`, and the test-only `consolidateDuplicateImages`. Make `query()` and `withTransaction()` operate directly:

```typescript
export async function query<R extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<R>> {
  return pool.query<R>(text, params);
}

export async function withTransaction<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
```

Update `src/db.test.ts` to run `applyMigrations` against `astryx_test` before importing database behavior and move duplicate-consolidation assertions into the upgrade verifier.

- [x] **Step 5: Run migration and database tests**

Run:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/astryx_test npm run db:migrate
node --experimental-strip-types --test src/migrations.test.ts src/db.test.ts src/crawlStore.test.ts
```

Expected: migration applies version 1 once; all focused tests PASS; a second `db:migrate` reports an empty `appliedVersions` array.

- [x] **Step 6: Commit the baseline migration**

```bash
git add migrations/0001_current_schema.sql src/db.ts src/db.test.ts src/migrations.test.ts
git commit -m "refactor: move schema changes into migration"
```

### Task 4: Gate API and worker startup on migration head

**Files:**
- Modify: `services/api/src/index.ts`
- Create: `services/api/src/start.ts`
- Create: `services/api/src/startup.test.ts`
- Modify: `services/import-worker/src/index.ts`
- Create: `services/import-worker/src/start.ts`
- Create: `services/import-worker/src/startup.test.ts`
- Modify: `services/api/Dockerfile`
- Modify: `services/import-worker/Dockerfile`
- Create: `services/migrate/Dockerfile`
- Modify: `docker-compose.yml`

- [x] **Step 1: Write failing startup-order tests**

Extract minimal `startApi()` and `startImportWorker()` functions with injected migration assertion and runtime start callbacks. Tests prove the assertion runs first and a rejection prevents listen/consume:

```typescript
test("API refuses to listen when migrations are pending", async () => {
  let listened = false;
  await assert.rejects(() => startApi({
    assertMigrations: async () => { throw new Error("pending migrations"); },
    listen: () => { listened = true; },
  }), /pending migrations/);
  assert.equal(listened, false);
});

test("worker refuses to consume when migrations are pending", async () => {
  let consumed = false;
  await assert.rejects(() => startImportWorker({
    assertMigrations: async () => { throw new Error("pending migrations"); },
    consume: async () => { consumed = true; },
  }), /pending migrations/);
  assert.equal(consumed, false);
});
```

- [x] **Step 2: Run the tests and confirm startup seams are absent**

Run: `node --experimental-strip-types --test services/api/src/startup.test.ts`

Expected: FAIL because the injectable startup functions do not exist.

- [x] **Step 3: Add migration assertions before traffic or queue consumption**

Put the orchestration functions in `services/api/src/start.ts` and `services/import-worker/src/start.ts`; importing either module performs no startup side effect. Use the shared `pool` and `assertMigrationsCurrent(pool)` before reading secrets, seeding the current administrator, creating Stripe, listening, or consuming RabbitMQ. Keep administrator rotation behavior unchanged in this slice; the identity slice replaces it.

- [x] **Step 4: Add migration artifacts and Compose gate**

Copy `migrations/` into API and worker images. Add `services/migrate/Dockerfile` using `node:22-slim`, `npm ci --omit=dev`, copied `src/migrations.ts`, `scripts/migrate.ts`, and migration SQL, with:

```dockerfile
CMD ["node", "--experimental-strip-types", "scripts/migrate.ts"]
```

Add a `migrate` Compose service and require successful completion before API and worker start:

```yaml
  migrate:
    build:
      context: .
      dockerfile: services/migrate/Dockerfile
    environment:
      DATABASE_URL: postgres://postgres:postgres@postgres:5432/astryx
    depends_on:
      postgres:
        condition: service_healthy
    restart: "no"
```

- [x] **Step 5: Verify startup and Compose behavior**

Run:

```bash
node --experimental-strip-types --test services/api/src/startup.test.ts services/import-worker/src/startup.test.ts src/migrations.test.ts
docker compose config --quiet
docker compose run --rm migrate
docker compose run --rm migrate
```

Expected: tests PASS; Compose validates; first migration run applies pending files if any; second applies zero files.

- [x] **Step 6: Commit startup gating**

```bash
git add services/api/src/index.ts services/api/src/start.ts services/api/src/startup.test.ts services/import-worker/src/index.ts services/import-worker/src/start.ts services/import-worker/src/startup.test.ts services/api/Dockerfile services/import-worker/Dockerfile services/migrate/Dockerfile docker-compose.yml
git commit -m "feat: gate services on database migrations"
```

### Task 5: Empty-install and current-schema upgrade verifier

**Files:**
- Create: `tests/fixtures/current-schema-upgrade.sql`
- Create: `scripts/verify-migrations.ts`
- Modify: `src/migrations.test.ts`
- Modify: `migrations/0001_current_schema.sql`
- Modify: `tsconfig.json`

- [x] **Step 1: Write a sanitized unversioned fixture**

The verifier first executes `migrations/0001_current_schema.sql` directly on the upgrade database without creating the migration ledger. That produces the exact unversioned current schema. It then executes a data-only fixture with synthetic rows for one app, both image-reference kinds, a published version, a draft, snapshots, version-image links, a user/session, subscription, job, collection, and crawler plan/run/evidence. Use deterministic IDs and fake hashes/Stripe values. The migration runner subsequently applies version 1 against that populated but unversioned schema, proving the baseline SQL is idempotent and data-preserving rather than merely accepting its own ledger.

The fixture starts with deterministic relational ownership:

```sql
INSERT INTO apps (id, name, category) VALUES (101, 'fixture-app', 'Productivity');
INSERT INTO platforms (id, app_id, name) VALUES (201, 101, 'web');
INSERT INTO images (id, platform_id, image_url, description, kind) VALUES
  (301, 201, 'mobbin-bulk:1111111111111111', 'Published screen', 'screen'),
  (302, 201, 'capture:2222222222222222', 'Draft capture', 'screen');
INSERT INTO users (id, email, password_hash, role) VALUES
  (401, 'fixture-user@example.invalid', 'synthetic-password-hash', 'user'),
  (402, 'fixture-admin@example.invalid', 'synthetic-admin-hash', 'admin');
INSERT INTO app_versions
  (id, app_id, version_number, label, status, created_by, reviewed_by, published_at)
VALUES
  (501, 101, 1, 'v1', 'published', 402, 402, now()),
  (502, 101, 2, 'v2', 'draft', 402, NULL, NULL);
INSERT INTO version_images (version_id, image_id, source_url) VALUES
  (501, 301, 'https://fixture.example/published'),
  (502, 301, 'https://fixture.example/published'),
  (502, 302, 'https://fixture.example/draft');
```

Complete the fixture with valid rows for every protected relationship named above and reset each affected sequence with `setval(..., max(id), true)`.

- [x] **Step 2: Implement disposable database safety**

The verifier requires `MIGRATION_TEST_DATABASE_URL`, `MIGRATION_TEST_ALLOW_DROP=1`, and generated database names beginning with `astryx_migration_test_`. It connects to the URL's maintenance database, creates two temporary databases, and drops only those generated names in `finally`.

- [x] **Step 3: Verify both scenarios**

For empty install, apply migrations, assert schema/ledger, apply again, and prove no-op. For upgrade, load the fixture, capture stable IDs/counts/JSON hashes, apply migrations, and compare them afterward. Verify all foreign keys and sequence next values.

Emit one JSON result shaped as:

```typescript
interface MigrationVerificationResult {
  empty: { migrationHead: number; tableCount: number; rerunApplied: number };
  upgrade: {
    migrationHead: number;
    preservedCounts: Record<string, number>;
    preservedSnapshotHashes: Record<string, string>;
    rerunApplied: number;
  };
}
```

- [x] **Step 4: Run the verifier**

Run:

```bash
MIGRATION_TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres \
MIGRATION_TEST_ALLOW_DROP=1 npm run db:verify
```

Expected: exit 0; both scenarios report migration head 1 and `rerunApplied: 0`.

- [x] **Step 5: Commit verification fixtures**

```bash
git add tests/fixtures/current-schema-upgrade.sql scripts/verify-migrations.ts src/migrations.test.ts migrations/0001_current_schema.sql tsconfig.json
git commit -m "test: verify empty and upgrade migrations"
```

### Task 6: Backup and restore verification

**Files:**
- Create: `src/dbRecovery.ts`
- Create: `scripts/db-backup.ts`
- Create: `scripts/db-restore-verify.ts`
- Create: `src/dbRecovery.test.ts`
- Modify: `services/migrate/Dockerfile`

- [x] **Step 1: Write failing manifest and safety tests**

Test checksum calculation, manifest redaction, fixed argument-array construction, disposable target-name validation, checksum mismatch rejection, and missing-tool errors. Inject `spawn` so tests never invoke real tools.

- [x] **Step 2: Implement backup command**

Parse `DATABASE_URL` with `URL`, reject non-PostgreSQL protocols, and pass connection fields through libpq environment variables rather than process arguments:

```typescript
function libpqEnv(databaseUrl: string): NodeJS.ProcessEnv {
  const url = new URL(databaseUrl);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must use PostgreSQL");
  }
  return {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
  };
}

await runTool("pg_dump", ["--format=custom", "--file", dumpPath], {
  env: libpqEnv(databaseUrl),
});
```

Compute SHA-256, query migration head and non-sensitive counts, then atomically write `.sha256` and `.json` manifest files. A pre-migration backup records `migrationHead: null`. Redact the URL and libpq environment from every thrown error and JSON summary.

- [x] **Step 3: Implement restore verification**

Require `RESTORE_TEST_ALLOW_DROP=1` and a target database name beginning `astryx_restore_test_`. Verify the sidecar checksum before creating the target. Run `pg_restore --clean --if-exists --no-owner --no-acl --exit-on-error <dump>` with the target supplied only through `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, and `PGPASSWORD`; compare migration head, counts, and core version/image relationships, then drop the target only after recording the result. A manifest with `migrationHead: null` must restore to a database without a migration ledger; a numbered head must pass the current-migration assertion.

- [x] **Step 4: Add PostgreSQL client tools to migration image**

Install the PostgreSQL 17 client in the build image using a pinned base and remove apt metadata. The later container-hardening slice pins image digests and creates the final non-root/read-only layout.

- [x] **Step 5: Run unit and live recovery tests**

Run:

```bash
node --experimental-strip-types --test src/dbRecovery.test.ts
mkdir -p data/backups
DATABASE_URL=postgres://postgres:postgres@localhost:5432/astryx_test \
BACKUP_DIR=data/backups BACKUP_BASENAME=astryx-local-verification npm run db:backup
RESTORE_TEST_ALLOW_DROP=1 npm run db:restore-verify -- data/backups/astryx-local-verification.dump \
  postgres://postgres:postgres@localhost:5432/astryx_restore_test_local
```

Expected: unit tests PASS; backup writes dump/checksum/manifest; restore of the migrated integration database reports matching migration head, counts, and relationships. Task 7 separately proves the unversioned real pre-migration snapshot.

- [x] **Step 6: Commit recovery tooling**

```bash
git add scripts/db-backup.ts scripts/db-restore-verify.ts src/dbRecovery.ts src/dbRecovery.test.ts services/migrate/Dockerfile
git commit -m "feat: verify database backup and restore"
```

### Task 7: Baseline and verify the real local database

**Files:**
- Create runtime evidence under ignored `data/backups/` and `data/verification/`

- [ ] **Step 1: Record pre-migration evidence**

Query all public table counts, app/version/image/job relationships, image-reference categories, sequence maxima, and non-secret snapshot hashes into a JSON evidence file. Do not include emails, password/session hashes, Stripe IDs, or row payloads.

- [ ] **Step 2: Create the pre-migration backup**

Run `npm run db:backup` against the current `astryx` database and verify its checksum before any migration.

- [ ] **Step 3: Apply migration 0001 explicitly**

Run:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/astryx npm run db:migrate
DATABASE_URL=postgres://postgres:postgres@localhost:5432/astryx npm run db:check
```

Expected: migration 1 applies once; check exits 0.

- [ ] **Step 4: Compare post-migration evidence**

Re-run the same safe queries and assert stable counts, IDs, relationships, sequence maxima or valid advancement, and snapshot hashes. Run migration again and assert zero applied versions.

- [ ] **Step 5: Restore the real snapshot into a disposable database**

Run `db:restore-verify` using the newly created dump and a generated `astryx_restore_test_*` target. Retain the safe JSON result for final handoff.

### Task 8: Documentation and full regression

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Create: `docs/operations/database.md`
- Modify: `docs/superpowers/plans/2026-07-12-astryx-database-foundations.md`

- [ ] **Step 1: Reconcile architecture documentation**

Replace SQLite/query-time schema claims with PostgreSQL, explicit migration job, startup check, backup/restore, forward-only recovery, and actual API/worker responsibilities. Preserve the evidence, draft, and serial-browser-worker invariants.

- [ ] **Step 2: Write operator commands**

Document development, staging, and production command order; backup and restore arguments; expected JSON outputs; checksum mismatch handling; failed-uncommitted migration recovery; application rollback with backward-compatible schema; and declared disaster restore.

- [ ] **Step 3: Run the complete verification gate**

Run:

```bash
npm test
npx tsc --noEmit
npm run build
npm run build-storybook
MIGRATION_TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres \
MIGRATION_TEST_ALLOW_DROP=1 npm run db:verify
docker compose config --quiet
docker compose build migrate api import-worker
git diff --check
```

Expected: every command exits 0; test output records exact Node and rendered React counts; the Vite warning remains a later frontend-splitting task, not a failure of this slice.

- [ ] **Step 4: Re-run real backup restore after final code**

Create a fresh dump from the migrated local database and restore it to a new disposable target. Record checksum, migration head, table counts, and relationship result.

- [ ] **Step 5: Mark this plan's completed checkboxes and commit**

```bash
git add docs/ARCHITECTURE.md docs/operations/database.md docs/superpowers/plans/2026-07-12-astryx-database-foundations.md
git commit -m "docs: record database migration operations"
```

## Slice completion gate

Do not claim the database-foundation slice complete until current evidence proves:

- empty install and unversioned upgrade both reach migration head;
- reruns apply zero migrations;
- edited migration files and missing/pending ledgers are rejected;
- API and worker cannot start on stale schema;
- ordinary database queries execute no DDL;
- current local rows, IDs, relationships, and snapshot hashes are preserved;
- a current realistic dump restores into a disposable database with matching checksum and counts;
- full tests, TypeScript, builds, Compose validation, container builds, and diff checks pass;
- architecture and runbooks match the code.
