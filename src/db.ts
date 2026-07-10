import pg from "pg";
import { mkdirSync } from "node:fs";
import type { DesignFlow, DesignSystemSnapshot } from "./designSystem.ts";
import type { ScreenAnalysis } from "./screenAnalysis.ts";

// db.ts used to create data/ for the sqlite file; progress.json and images still live
// there and other modules assume it exists, so keep creating it here.
mkdirSync("data", { recursive: true });

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/astryx";

export const pool = new pg.Pool({ connectionString: DATABASE_URL });

let schemaReady: Promise<unknown> | undefined;

// jobs is the lifecycle ledger the UI lists and cancels through; live per-item counters
// stay in data/progress.json (single-slot, one job runs at a time via prefetch(1)).
function ensureSchema(): Promise<unknown> {
  schemaReady ??= pool.query(`
    -- The old flat images(app, platform, source_url, ...) table is moved aside so the
    -- normalized tables below can be created, then backfilled from it and dropped.
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'images' AND column_name = 'app') THEN
        ALTER TABLE images RENAME TO images_flat;
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS apps (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS platforms (
      id SERIAL PRIMARY KEY,
      app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      UNIQUE (app_id, name)
    );
    CREATE TABLE IF NOT EXISTS images (
      id SERIAL PRIMARY KEY,
      platform_id INTEGER NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
      image_url TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    -- Catches up databases created by an earlier revision that had both of these.
    ALTER TABLE images DROP COLUMN IF EXISTS local_path;
    ALTER TABLE images DROP CONSTRAINT IF EXISTS images_image_url_key;
    ALTER TABLE images ADD COLUMN IF NOT EXISTS analysis JSONB;

    DO $$ BEGIN
      IF to_regclass('images_flat') IS NOT NULL THEN
        INSERT INTO apps (name) SELECT DISTINCT app FROM images_flat
          ON CONFLICT (name) DO NOTHING;
        INSERT INTO platforms (app_id, name)
          SELECT DISTINCT a.id, f.platform FROM images_flat f JOIN apps a ON a.name = f.app
          ON CONFLICT (app_id, name) DO NOTHING;
        INSERT INTO images (platform_id, image_url, description, created_at)
          SELECT p.id, f.source_url, f.description, f.created_at
          FROM images_flat f
          JOIN apps a ON a.name = f.app
          JOIN platforms p ON p.app_id = a.id AND p.name = f.platform
          WHERE NOT EXISTS (SELECT 1 FROM images i WHERE i.image_url = f.source_url);
        DROP TABLE images_flat;
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS jobs (
      id SERIAL PRIMARY KEY,
      parent_id INTEGER REFERENCES jobs(id),
      type TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'queued',
      message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS revoked_reason TEXT;

    CREATE TABLE IF NOT EXISTS subscriptions (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      stripe_customer_id TEXT UNIQUE,
      stripe_subscription_id TEXT UNIQUE,
      stripe_price_id TEXT,
      billing_interval TEXT CHECK (billing_interval IN ('month', 'year')),
      status TEXT CHECK (status IN ('incomplete', 'incomplete_expired', 'active', 'past_due', 'canceled', 'unpaid', 'paused')),
      current_period_start TIMESTAMPTZ,
      current_period_end TIMESTAMPTZ,
      cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
      grace_expires_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS free_app_unlocks (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
      unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, app_id)
    );
    CREATE TABLE IF NOT EXISTS stripe_events (
      event_id TEXT PRIMARY KEY,
      processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS export_usage (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      window_start TIMESTAMPTZ NOT NULL,
      operation_count INTEGER NOT NULL DEFAULT 0 CHECK (operation_count >= 0),
      PRIMARY KEY (user_id, window_start)
    );
    CREATE TABLE IF NOT EXISTS access_events (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      session_hash TEXT,
      ip_prefix TEXT,
      app_slug TEXT,
      action TEXT NOT NULL,
      volume INTEGER NOT NULL DEFAULT 1,
      outcome TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS access_events_user_created_idx ON access_events(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS design_systems (
      app_id INTEGER PRIMARY KEY REFERENCES apps(id) ON DELETE CASCADE,
      snapshot JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS app_flows (
      app_id INTEGER PRIMARY KEY REFERENCES apps(id) ON DELETE CASCADE,
      flows JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  return schemaReady;
}

export async function query<R extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<R>> {
  await ensureSchema();
  return pool.query<R>(text, params);
}

export async function withTransaction<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  await ensureSchema();
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

export async function closePool(): Promise<void> {
  await pool.end();
}

// Upserts the app and platform rows on the way to the image, so callers keep passing
// plain names and never have to know about the ids.
// ponytail: image_url has no unique index, so the NOT EXISTS guard races under concurrent
// writers — harmless with the single-worker pipeline, add the index back if that changes.
export async function insertImage(
  app: string,
  platform: string,
  imageUrl: string
): Promise<void> {
  await query(
    `WITH a AS (
       INSERT INTO apps (name) VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id
     ), p AS (
       INSERT INTO platforms (app_id, name) SELECT a.id, $2 FROM a
       ON CONFLICT (app_id, name) DO UPDATE SET name = EXCLUDED.name RETURNING id
     )
     INSERT INTO images (platform_id, image_url) SELECT p.id, $3 FROM p
     WHERE NOT EXISTS (SELECT 1 FROM images WHERE image_url = $3)`,
    [app, platform, imageUrl]
  );
}

export async function imageExists(imageUrl: string): Promise<boolean> {
  const res = await query("SELECT 1 FROM images WHERE image_url = $1", [imageUrl]);
  return res.rowCount! > 0;
}

export async function appHasImages(app: string): Promise<boolean> {
  const res = await query(
    `SELECT 1 FROM images i
     JOIN platforms p ON p.id = i.platform_id
     JOIN apps a ON a.id = p.app_id
     WHERE a.name = $1 LIMIT 1`,
    [app]
  );
  return res.rowCount! > 0;
}

export async function uncaptionedImages(app?: string): Promise<{ id: number; app: string; image_url: string }[]> {
  const res = await query<{ id: number; app: string; image_url: string }>(
    `SELECT i.id, a.name AS app, i.image_url FROM images i
     JOIN platforms p ON p.id = i.platform_id
     JOIN apps a ON a.id = p.app_id
     WHERE i.description IS NULL
       AND ($1::text IS NULL OR a.name = $1)
     ORDER BY i.id`,
    [app ?? null]
  );
  return res.rows;
}

export async function saveDescription(id: number, description: string): Promise<void> {
  await query("UPDATE images SET description = $1 WHERE id = $2", [description, id]);
}

export async function saveScreenAnalysis(id: number, analysis: ScreenAnalysis): Promise<void> {
  await query("UPDATE images SET description = $1, analysis = $2::jsonb WHERE id = $3", [
    analysis.description,
    JSON.stringify(analysis),
    id,
  ]);
}

export interface CrawledImage {
  id: number;
  app: string;
  platform: string;
  image_url: string;
  description: string | null;
  analysis?: ScreenAnalysis | null;
}

export async function allImages(): Promise<CrawledImage[]> {
  const res = await query<CrawledImage>(
    `SELECT i.id, a.name AS app, p.name AS platform, i.image_url, i.description, i.analysis
     FROM images i
     JOIN platforms p ON p.id = i.platform_id
     JOIN apps a ON a.id = p.app_id
     ORDER BY i.created_at ASC`
  );
  return res.rows;
}

export async function appImages(app: string): Promise<CrawledImage[]> {
  const res = await query<CrawledImage>(
    `SELECT i.id, a.name AS app, p.name AS platform, i.image_url, i.description, i.analysis
     FROM images i
     JOIN platforms p ON p.id = i.platform_id
     JOIN apps a ON a.id = p.app_id
     WHERE a.name = $1 ORDER BY i.created_at ASC`,
    [app]
  );
  return res.rows;
}

export async function saveDesignSystem(app: string, snapshot: DesignSystemSnapshot): Promise<void> {
  await query(
    `INSERT INTO design_systems (app_id, snapshot)
     SELECT id, $2::jsonb FROM apps WHERE name = $1
     ON CONFLICT (app_id) DO UPDATE SET snapshot = EXCLUDED.snapshot, updated_at = now()`,
    [app, JSON.stringify(snapshot)]
  );
}

export async function getDesignSystem(app: string): Promise<DesignSystemSnapshot | undefined> {
  const res = await query<{ snapshot: DesignSystemSnapshot }>(
    `SELECT ds.snapshot
     FROM design_systems ds JOIN apps a ON a.id = ds.app_id
     WHERE a.name = $1`,
    [app]
  );
  return res.rows[0]?.snapshot;
}

export async function saveAppFlows(app: string, flows: DesignFlow[]): Promise<void> {
  await query(
    `INSERT INTO app_flows (app_id, flows)
     SELECT id, $2::jsonb FROM apps WHERE name = $1
     ON CONFLICT (app_id) DO UPDATE SET flows = EXCLUDED.flows, updated_at = now()`,
    [app, JSON.stringify(flows)]
  );
}

export async function getAppFlows(app: string): Promise<DesignFlow[]> {
  const res = await query<{ flows: DesignFlow[] }>(
    `SELECT f.flows FROM app_flows f JOIN apps a ON a.id = f.app_id WHERE a.name = $1`,
    [app]
  );
  return res.rows[0]?.flows ?? [];
}

export type JobStatus = "queued" | "running" | "done" | "error" | "cancelled";

export interface JobRow {
  id: number;
  parent_id: number | null;
  type: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  message: string | null;
  created_at: string;
  updated_at: string | null;
}

export async function createJob(
  type: string,
  payload: Record<string, unknown>,
  parentId?: number
): Promise<number> {
  const res = await query<{ id: number }>(
    "INSERT INTO jobs (type, payload, parent_id) VALUES ($1, $2, $3) RETURNING id",
    [type, JSON.stringify(payload), parentId ?? null]
  );
  return res.rows[0].id;
}

export async function setJobStatus(id: number, status: JobStatus, message?: string): Promise<void> {
  await query("UPDATE jobs SET status = $1, message = $2, updated_at = now() WHERE id = $3", [
    status,
    message ?? null,
    id,
  ]);
}

export async function getJob(id: number): Promise<JobRow | undefined> {
  const res = await query<JobRow>("SELECT * FROM jobs WHERE id = $1", [id]);
  return res.rows[0];
}

export async function listJobs(limit = 100): Promise<JobRow[]> {
  const res = await query<JobRow>("SELECT * FROM jobs ORDER BY id DESC LIMIT $1", [limit]);
  return res.rows;
}
