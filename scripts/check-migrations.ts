import pg from "pg";
import { assertMigrationsCurrent, redactMigrationError } from "../src/migrations.ts";

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  console.error(JSON.stringify({ status: "error", error: "DATABASE_URL is required" }));
  process.exitCode = 1;
} else {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    await assertMigrationsCurrent(pool, process.env.MIGRATIONS_DIR ?? "migrations");
    console.log(JSON.stringify({ status: "ok", current: true }));
  } catch (error) {
    console.error(JSON.stringify({ status: "error", error: redactMigrationError(error, databaseUrl) }));
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
