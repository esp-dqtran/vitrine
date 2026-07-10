// One-off: copies data/astryx.db (the old sqlite store) into Postgres. Read-only against
// sqlite — never modifies or deletes it, so it's safe to re-run.
import { DatabaseSync } from "node:sqlite";
import { query, closePool } from "../src/db.ts";

const SQLITE_PATH = "data/astryx.db";

interface Row {
  app: string;
  platform: string;
  source_url: string;
  local_path: string;
  description: string | null;
  created_at: string; // sqlite datetime('now') string, UTC without a timezone suffix
}

const sqlite = new DatabaseSync(SQLITE_PATH, { readOnly: true });
const rows = sqlite
  .prepare("SELECT app, platform, source_url, local_path, description, created_at FROM images")
  .all() as unknown as Row[];
sqlite.close();

let migrated = 0;
let skipped = 0;
for (const row of rows) {
  const res = await query(
    `WITH a AS (
       INSERT INTO apps (name) VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id
     ), p AS (
       INSERT INTO platforms (app_id, name) SELECT a.id, $2 FROM a
       ON CONFLICT (app_id, name) DO UPDATE SET name = EXCLUDED.name RETURNING id
     )
     INSERT INTO images (platform_id, image_url, description, created_at)
     SELECT p.id, $3, $4, $5::timestamptz FROM p
     WHERE NOT EXISTS (SELECT 1 FROM images WHERE image_url = $3)`,
    [row.app, row.platform, row.source_url, row.description, `${row.created_at}Z`]
  );
  if (res.rowCount) migrated++;
  else skipped++;
}

console.log(`Migrated ${migrated} row(s), skipped ${skipped} (already present).`);
await closePool();
