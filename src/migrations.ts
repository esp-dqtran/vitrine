import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";

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
const LOCK_NAME = "astryx-schema-migrations";
const LEDGER_SQL = `CREATE TABLE IF NOT EXISTS schema_migrations (
  version integer PRIMARY KEY,
  name text NOT NULL UNIQUE,
  checksum text NOT NULL,
  execution_ms integer NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
)`;

export interface MigrationRunOptions {
  lockTimeoutMs?: number;
  lockPollMs?: number;
}

export async function discoverMigrations(directory = "migrations"): Promise<MigrationFile[]> {
  const filenames = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
  const migrations = await Promise.all(filenames.map(async (filename) => {
    const match = filename.match(MIGRATION_NAME);
    if (!match) throw new Error(`Invalid migration filename: ${filename}`);
    const sql = await readFile(join(directory, filename), "utf8");
    if (TRANSACTION_SQL.test(sql)) {
      throw new Error(`Migration ${filename} contains a transaction statement`);
    }
    return {
      version: Number(match[1]),
      name: match[2],
      filename,
      checksum: createHash("sha256").update(sql).digest("hex"),
      sql,
    };
  }));
  migrations.forEach((migration, index) => {
    if (migration.version !== index + 1) {
      throw new Error(`Migration sequence gap at ${migration.filename}`);
    }
  });
  return migrations;
}

export function validateMigrationState(
  files: readonly MigrationFile[],
  applied: readonly AppliedMigration[],
): { pending: MigrationFile[] } {
  const byVersion = new Map(files.map((file) => [file.version, file]));
  const ordered = [...applied].sort((left, right) => left.version - right.version);
  ordered.forEach((row, index) => {
    if (row.version !== index + 1) {
      throw new Error(`Applied migration sequence gap at version ${row.version}`);
    }
    const file = byVersion.get(row.version);
    if (!file) throw new Error(`Applied migration ${row.version} is not present on disk`);
    if (file.name !== row.name || file.checksum !== row.checksum) {
      throw new Error(`Applied migration ${row.version}_${row.name} does not match its immutable file`);
    }
  });
  return {
    pending: files.filter((file) => !ordered.some((row) => row.version === file.version)),
  };
}

export function redactMigrationError(error: unknown, databaseUrl: string): string {
  let message = error instanceof Error ? error.message : "Database migration failed";
  const secrets = new Set([databaseUrl]);
  try {
    const parsed = new URL(databaseUrl);
    secrets.add(decodeURIComponent(parsed.username));
    secrets.add(decodeURIComponent(parsed.password));
  } catch {
    // The configuration validator reports malformed URLs separately.
  }
  for (const secret of [...secrets].filter(Boolean).sort((left, right) => right.length - left.length)) {
    message = message.split(secret).join("[redacted]");
  }
  return message;
}

async function appliedMigrations(client: pg.PoolClient): Promise<AppliedMigration[]> {
  const result = await client.query<AppliedMigration>(
    "SELECT version, name, checksum FROM schema_migrations ORDER BY version",
  );
  return result.rows;
}

async function acquireMigrationLock(
  client: pg.PoolClient,
  { lockTimeoutMs = 30_000, lockPollMs = 100 }: MigrationRunOptions,
): Promise<void> {
  if (!Number.isInteger(lockTimeoutMs) || lockTimeoutMs < 0) {
    throw new Error("Migration lock timeout must be a non-negative integer");
  }
  if (!Number.isInteger(lockPollMs) || lockPollMs <= 0) {
    throw new Error("Migration lock poll interval must be a positive integer");
  }
  const deadline = Date.now() + lockTimeoutMs;
  while (true) {
    const result = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock(hashtext($1)::bigint) AS locked",
      [LOCK_NAME],
    );
    if (result.rows[0].locked) return;
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("Database migration lock timeout");
    await delay(Math.min(lockPollMs, remaining));
  }
}

async function releaseMigrationLock(client: pg.PoolClient): Promise<void> {
  await client.query("SELECT pg_advisory_unlock(hashtext($1)::bigint)", [LOCK_NAME]);
}

export async function assertMigrationsCurrent(
  pool: pg.Pool,
  directory = "migrations",
): Promise<void> {
  const files = await discoverMigrations(directory);
  const client = await pool.connect();
  try {
    const ledger = await client.query<{ present: boolean }>(
      "SELECT to_regclass('public.schema_migrations') IS NOT NULL AS present",
    );
    if (!ledger.rows[0].present) throw new Error("Database migrations have not been applied");
    const { pending } = validateMigrationState(files, await appliedMigrations(client));
    if (pending.length) throw new Error(`Database has ${pending.length} pending migration(s)`);
  } finally {
    client.release();
  }
}

export async function applyMigrations(
  pool: pg.Pool,
  directory = "migrations",
  options: MigrationRunOptions = {},
): Promise<{ appliedVersions: number[] }> {
  const files = await discoverMigrations(directory);
  const client = await pool.connect();
  const appliedVersions: number[] = [];
  let locked = false;
  try {
    await acquireMigrationLock(client, options);
    locked = true;
    await client.query(LEDGER_SQL);
    const { pending } = validateMigrationState(files, await appliedMigrations(client));
    for (const migration of pending) {
      const started = Date.now();
      await client.query("BEGIN");
      try {
        await client.query(migration.sql);
        await client.query(
          `INSERT INTO schema_migrations (version, name, checksum, execution_ms)
           VALUES ($1, $2, $3, $4)`,
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
    if (locked) await releaseMigrationLock(client).catch(() => undefined);
    client.release();
  }
}
