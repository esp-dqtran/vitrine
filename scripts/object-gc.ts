import pg from "pg";

import { assertMigrationsCurrent } from "../src/migrations.ts";
import { PostgresObjectGcDatabase, runObjectGc } from "../src/objectGc.ts";
import { createObjectStore, objectStoreConfigFromEnvironment } from "../src/objectStoreConfig.ts";

const databaseUrl = process.env.DATABASE_URL?.trim();
const graceDays = Number(process.env.OBJECT_GC_GRACE_DAYS ?? 7);

if (!databaseUrl || !Number.isFinite(graceDays) || graceDays < 0) {
  console.error(JSON.stringify({ status: "error", error_code: "GC_CONFIG_INVALID" }));
  process.exitCode = 1;
} else {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    await assertMigrationsCurrent(pool);
    const database = new PostgresObjectGcDatabase({
      async query(sql, values) {
        const result = await pool.query(sql, values ? [...values] : undefined);
        return { rows: result.rows, rowCount: result.rowCount };
      },
      async connect() {
        const client = await pool.connect();
        return {
          async query(sql, values) {
            const result = await client.query(sql, values ? [...values] : undefined);
            return { rows: result.rows, rowCount: result.rowCount };
          },
          release: () => client.release(),
        };
      },
    });
    const report = await runObjectGc({
      objectStore: createObjectStore(objectStoreConfigFromEnvironment(process.env)),
      database,
      apply: process.env.OBJECT_GC_APPLY === "1",
      graceMs: graceDays * 86_400_000,
    });
    console.log(JSON.stringify({ status: report.failed_count === 0 ? "ok" : "failed", ...report }));
    if (report.failed_count > 0) process.exitCode = 1;
  } catch {
    console.error(JSON.stringify({ status: "error", error_code: "GC_FAILED" }));
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
