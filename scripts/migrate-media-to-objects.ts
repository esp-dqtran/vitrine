import pg from "pg";

import {
  migrateLegacyMedia,
  PostgresMediaMigrationDatabase,
  selectPublishedPreviews,
} from "../src/mediaMigration.ts";
import { createObjectStore, objectStoreConfigFromEnvironment } from "../src/objectStoreConfig.ts";
import { assertMigrationsCurrent } from "../src/migrations.ts";

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  console.error(JSON.stringify({ status: "error", error_code: "DATABASE_CONFIG_INVALID" }));
  process.exitCode = 1;
} else {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const database = new PostgresMediaMigrationDatabase({
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
  try {
    await assertMigrationsCurrent(pool);
    const apply = process.env.MEDIA_MIGRATION_APPLY === "1";
    const report = await migrateLegacyMedia({
      dataDir: process.env.DATA_DIR ?? "data",
      database,
      objectStore: createObjectStore(objectStoreConfigFromEnvironment(process.env)),
      apply,
      concurrency: Number(process.env.MEDIA_MIGRATION_CONCURRENCY ?? 4),
    });
    const previews = process.argv.includes("--seed-published-previews") && (!apply || report.failed === 0)
      ? await selectPublishedPreviews(database, apply)
      : [];
    console.log(JSON.stringify({
      status: report.failed === 0 ? "ok" : "failed",
      ...report,
      preview_selections: previews.map(({ appId, versionId, imageId, rank }) => ({
        app_id: appId, version_id: versionId, image_id: imageId, rank,
      })),
    }));
    if (report.failed > 0) process.exitCode = 1;
  } catch {
    console.error(JSON.stringify({ status: "error", error_code: "MIGRATION_FAILED" }));
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
