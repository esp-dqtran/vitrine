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
