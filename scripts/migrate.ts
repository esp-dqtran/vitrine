import pg from "pg";
import { applyMigrations, redactMigrationError } from "../src/migrations.ts";

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  console.error(JSON.stringify({ status: "error", error: "DATABASE_URL is required" }));
  process.exitCode = 1;
} else {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    const lockTimeout = process.env.MIGRATION_LOCK_TIMEOUT_MS;
    const result = await applyMigrations(
      pool,
      process.env.MIGRATIONS_DIR ?? "migrations",
      lockTimeout === undefined ? {} : { lockTimeoutMs: Number(lockTimeout) },
    );
    console.log(JSON.stringify({ status: "ok", ...result }));
  } catch (error) {
    console.error(JSON.stringify({ status: "error", error: redactMigrationError(error, databaseUrl) }));
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
