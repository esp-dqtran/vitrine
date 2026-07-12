import pg from "pg";
import { mkdirSync } from "node:fs";
import type { DesignFlow, DesignSystemSnapshot } from "./designSystem.ts";
import type { ScreenAnalysis } from "./screenAnalysis.ts";
import { markSnapshotReviewed, validatePublication, type AppVersionStatus, type PublicationBlocker } from "./versioning.ts";

// db.ts used to create data/ for the sqlite file; progress.json and images still live
// there and other modules assume it exists, so keep creating it here.
mkdirSync("data", { recursive: true });

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/astryx";

export const pool = new pg.Pool({ connectionString: DATABASE_URL });

let schemaReady: Promise<unknown> | undefined;

const IMAGE_CONSOLIDATION_SQL = `
  DO $image_consolidation$
  DECLARE duplicate_group RECORD;
  BEGIN
    FOR duplicate_group IN
      SELECT MIN(id) AS canonical_id, ARRAY_AGG(id ORDER BY id) AS image_ids
      FROM images
      GROUP BY platform_id, image_url
      HAVING COUNT(*) > 1
    LOOP
      UPDATE images canonical
      SET description = COALESCE(canonical.description, (
            SELECT candidate.description FROM images candidate
            WHERE candidate.id = ANY (duplicate_group.image_ids) AND candidate.description IS NOT NULL
            ORDER BY candidate.id LIMIT 1
          )),
          analysis = COALESCE(canonical.analysis, (
            SELECT candidate.analysis FROM images candidate
            WHERE candidate.id = ANY (duplicate_group.image_ids) AND candidate.analysis IS NOT NULL
            ORDER BY candidate.id LIMIT 1
          )),
          kind = CASE WHEN EXISTS (
            SELECT 1 FROM images candidate
            WHERE candidate.id = ANY (duplicate_group.image_ids) AND candidate.kind = 'screen'
          ) THEN 'screen' ELSE canonical.kind END,
          created_at = (
            SELECT MIN(candidate.created_at) FROM images candidate
            WHERE candidate.id = ANY (duplicate_group.image_ids)
          )
      WHERE canonical.id = duplicate_group.canonical_id;

      INSERT INTO version_images
        (version_id, image_id, captured_at, source_url, viewport_width, viewport_height, state_context)
      SELECT vi.version_id, duplicate_group.canonical_id, MIN(vi.captured_at),
        (ARRAY_AGG(vi.source_url ORDER BY vi.image_id) FILTER (WHERE vi.source_url IS NOT NULL))[1],
        MAX(vi.viewport_width), MAX(vi.viewport_height),
        (ARRAY_AGG(vi.state_context ORDER BY vi.image_id) FILTER (WHERE vi.state_context IS NOT NULL))[1]
      FROM version_images vi
      WHERE vi.image_id = ANY (duplicate_group.image_ids)
      GROUP BY vi.version_id
      ON CONFLICT (version_id, image_id) DO UPDATE SET
        captured_at = LEAST(version_images.captured_at, EXCLUDED.captured_at),
        source_url = COALESCE(version_images.source_url, EXCLUDED.source_url),
        viewport_width = COALESCE(version_images.viewport_width, EXCLUDED.viewport_width),
        viewport_height = COALESCE(version_images.viewport_height, EXCLUDED.viewport_height),
        state_context = COALESCE(version_images.state_context, EXCLUDED.state_context);

      UPDATE crawl_evidence
      SET image_id = duplicate_group.canonical_id
      WHERE image_id = ANY (duplicate_group.image_ids)
        AND image_id <> duplicate_group.canonical_id;
      DELETE FROM version_images
      WHERE image_id = ANY (duplicate_group.image_ids)
        AND image_id <> duplicate_group.canonical_id;
      DELETE FROM images
      WHERE id = ANY (duplicate_group.image_ids)
        AND id <> duplicate_group.canonical_id;
    END LOOP;
  END
  $image_consolidation$;
`;

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
    ALTER TABLE apps ADD COLUMN IF NOT EXISTS icon_url TEXT;
    ALTER TABLE apps ADD COLUMN IF NOT EXISTS category TEXT;
    ALTER TABLE images ADD COLUMN IF NOT EXISTS analysis JSONB;
    -- 'screen' (full app screen) or 'ui_element' (cropped component from Mobbin's UI Elements tab).
    ALTER TABLE images ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'screen';

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
          WHERE NOT EXISTS (
            SELECT 1 FROM images i WHERE i.platform_id = p.id AND i.image_url = f.source_url
          );
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
    CREATE TABLE IF NOT EXISTS app_versions (
      id SERIAL PRIMARY KEY,
      app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL CHECK (version_number > 0),
      label TEXT NOT NULL,
      source_url TEXT,
      status TEXT NOT NULL CHECK (status IN ('draft', 'in_review', 'published', 'archived')),
      notes TEXT NOT NULL DEFAULT '',
      captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      submitted_at TIMESTAMPTZ,
      published_at TIMESTAMPTZ,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE (app_id, version_number)
    );
    CREATE INDEX IF NOT EXISTS app_versions_app_status_idx ON app_versions(app_id, status, version_number DESC);
    CREATE TABLE IF NOT EXISTS version_images (
      version_id INTEGER NOT NULL REFERENCES app_versions(id) ON DELETE CASCADE,
      image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
      captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      source_url TEXT,
      viewport_width INTEGER,
      viewport_height INTEGER,
      state_context TEXT,
      PRIMARY KEY (version_id, image_id)
    );
    CREATE TABLE IF NOT EXISTS design_system_versions (
      version_id INTEGER PRIMARY KEY REFERENCES app_versions(id) ON DELETE CASCADE,
      snapshot JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS app_flow_versions (
      version_id INTEGER PRIMARY KEY REFERENCES app_versions(id) ON DELETE CASCADE,
      flows JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS review_issues (
      id SERIAL PRIMARY KEY,
      version_id INTEGER NOT NULL REFERENCES app_versions(id) ON DELETE CASCADE,
      entity_kind TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'blocker')),
      message TEXT NOT NULL,
      resolved BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      resolved_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS exports (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
      version_id INTEGER REFERENCES app_versions(id) ON DELETE SET NULL,
      scope JSONB NOT NULL,
      format TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('generating', 'complete', 'failed')),
      output_filename TEXT,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      completed_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS crawl_plans (
      id BIGSERIAL PRIMARY KEY,
      app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
      revision INTEGER NOT NULL CHECK (revision > 0),
      plan JSONB NOT NULL CHECK (jsonb_typeof(plan) = 'object'),
      content_hash TEXT NOT NULL CHECK (length(content_hash) = 64),
      status TEXT NOT NULL CHECK (status IN ('draft', 'approved', 'superseded')),
      research_metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(research_metadata) = 'object'),
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      approved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (app_id, revision),
      UNIQUE (app_id, content_hash)
    );
    CREATE INDEX IF NOT EXISTS crawl_plans_app_status_idx
      ON crawl_plans(app_id, status, revision DESC);

    CREATE TABLE IF NOT EXISTS crawl_runs (
      id BIGSERIAL PRIMARY KEY,
      app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
      version_id INTEGER NOT NULL REFERENCES app_versions(id),
      plan_id BIGINT NOT NULL REFERENCES crawl_plans(id),
      job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
      status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled', 'interrupted')),
      current_flow_id TEXT,
      current_step_id TEXT,
      completed_count INTEGER NOT NULL DEFAULT 0 CHECK (completed_count >= 0),
      failed_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
      skipped_count INTEGER NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
      cancel_requested_at TIMESTAMPTZ,
      retry_of_run_id BIGINT REFERENCES crawl_runs(id) ON DELETE SET NULL,
      retry_mode TEXT NOT NULL DEFAULT 'all',
      environment JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(environment) = 'object'),
      worker_id TEXT,
      heartbeat_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      started_at TIMESTAMPTZ,
      finished_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT crawl_runs_retry_mode_check CHECK (retry_mode IN ('all', 'failed', 'remaining'))
    );
    ALTER TABLE crawl_runs ADD COLUMN IF NOT EXISTS retry_mode TEXT NOT NULL DEFAULT 'all';
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'crawl_runs'::regclass AND conname = 'crawl_runs_retry_mode_check'
      ) THEN
        ALTER TABLE crawl_runs ADD CONSTRAINT crawl_runs_retry_mode_check
          CHECK (retry_mode IN ('all', 'failed', 'remaining'));
      END IF;
    END $$;
    CREATE INDEX IF NOT EXISTS crawl_runs_app_status_idx
      ON crawl_runs(app_id, status, created_at DESC);
    CREATE INDEX IF NOT EXISTS crawl_runs_status_heartbeat_idx
      ON crawl_runs(status, heartbeat_at) WHERE status = 'running';

    CREATE TABLE IF NOT EXISTS crawl_evidence (
      id BIGSERIAL PRIMARY KEY,
      version_id INTEGER NOT NULL REFERENCES app_versions(id),
      plan_id BIGINT NOT NULL REFERENCES crawl_plans(id),
      image_id INTEGER NOT NULL REFERENCES images(id),
      flow_id TEXT NOT NULL,
      step_id TEXT NOT NULL,
      source_url TEXT NOT NULL,
      final_url TEXT NOT NULL,
      state_label TEXT NOT NULL,
      screenshot_hash TEXT NOT NULL,
      viewport_width INTEGER NOT NULL CHECK (viewport_width > 0),
      viewport_height INTEGER NOT NULL CHECK (viewport_height > 0),
      captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (version_id, plan_id, flow_id, step_id, final_url, viewport_width, viewport_height)
    );
    CREATE INDEX IF NOT EXISTS crawl_evidence_version_plan_idx
      ON crawl_evidence(version_id, plan_id, captured_at DESC);

    CREATE TABLE IF NOT EXISTS crawl_run_steps (
      run_id BIGINT NOT NULL REFERENCES crawl_runs(id) ON DELETE CASCADE,
      flow_id TEXT NOT NULL,
      step_id TEXT NOT NULL,
      flow_order INTEGER NOT NULL CHECK (flow_order >= 0),
      step_order INTEGER NOT NULL CHECK (step_order >= 0),
      status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'skipped', 'failed')),
      attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
      source_url TEXT,
      final_url TEXT,
      expected JSONB,
      actual JSONB,
      observed_screenshot_hash TEXT,
      evidence_id BIGINT REFERENCES crawl_evidence(id) ON DELETE SET NULL,
      error_class TEXT,
      error_message TEXT,
      failure_screenshot TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      started_at TIMESTAMPTZ,
      finished_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (run_id, flow_id, step_id)
    );
    CREATE INDEX IF NOT EXISTS crawl_run_steps_status_idx
      ON crawl_run_steps(run_id, status, flow_order, step_order);

    CREATE TABLE IF NOT EXISTS crawl_repairs (
      id BIGSERIAL PRIMARY KEY,
      plan_id BIGINT NOT NULL REFERENCES crawl_plans(id),
      run_id BIGINT NOT NULL REFERENCES crawl_runs(id),
      flow_id TEXT NOT NULL,
      step_id TEXT NOT NULL,
      proposed_step JSONB NOT NULL CHECK (jsonb_typeof(proposed_step) = 'object'),
      failure JSONB NOT NULL CHECK (jsonb_typeof(failure) = 'object'),
      provider TEXT,
      status TEXT NOT NULL CHECK (status IN ('proposed', 'applied', 'rejected')),
      reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at TIMESTAMPTZ,
      applied_plan_id BIGINT REFERENCES crawl_plans(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS crawl_repairs_plan_status_idx
      ON crawl_repairs(plan_id, status, created_at DESC);

    ${IMAGE_CONSOLIDATION_SQL}
    CREATE UNIQUE INDEX IF NOT EXISTS images_platform_image_url_uidx
      ON images(platform_id, image_url);

    INSERT INTO app_versions (app_id, version_number, label, status, captured_at, published_at)
      SELECT a.id, 1, 'v1', 'published', COALESCE(MIN(i.created_at), now()), now()
      FROM apps a
      JOIN platforms p ON p.app_id = a.id
      JOIN images i ON i.platform_id = p.id
      WHERE NOT EXISTS (SELECT 1 FROM app_versions av WHERE av.app_id = a.id)
      GROUP BY a.id;
    INSERT INTO version_images (version_id, image_id, captured_at, source_url)
      SELECT av.id, i.id, i.created_at, i.image_url
      FROM app_versions av
      JOIN platforms p ON p.app_id = av.app_id
      JOIN images i ON i.platform_id = p.id
      WHERE av.version_number = 1
      ON CONFLICT DO NOTHING;
    INSERT INTO design_system_versions (version_id, snapshot)
      SELECT av.id, ds.snapshot FROM app_versions av JOIN design_systems ds ON ds.app_id = av.app_id
      WHERE av.version_number = 1 ON CONFLICT DO NOTHING;
    INSERT INTO app_flow_versions (version_id, flows)
      SELECT av.id, af.flows FROM app_versions av JOIN app_flows af ON af.app_id = av.app_id
      WHERE av.version_number = 1 ON CONFLICT DO NOTHING;
    CREATE TABLE IF NOT EXISTS collections (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS collections_user_updated_idx ON collections(user_id, updated_at DESC);
    CREATE TABLE IF NOT EXISTS collection_items (
      id SERIAL PRIMARY KEY,
      collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('app', 'screen', 'component', 'token', 'flow')),
      app TEXT NOT NULL,
      reference_id TEXT NOT NULL,
      title TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (collection_id, kind, app, reference_id)
    );
    ALTER TABLE collection_items DROP CONSTRAINT IF EXISTS collection_items_kind_check;
    ALTER TABLE collection_items ADD CONSTRAINT collection_items_kind_check CHECK (kind IN ('app', 'screen', 'component', 'token', 'flow', 'pattern'));
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

// Narrow migration seam: the caller owns the surrounding transaction so startup and
// integration tests can use the exact same consolidation without nesting BEGIN/COMMIT.
export async function consolidateDuplicateImages(client: pg.PoolClient): Promise<void> {
  await client.query(IMAGE_CONSOLIDATION_SQL);
}

export async function closePool(): Promise<void> {
  await pool.end();
}

// Upserts the app and platform rows on the way to the image, so callers keep passing
// plain names and never have to know about the ids.
export async function insertImage(
  app: string,
  platform: string,
  imageUrl: string,
  capture: { sourceUrl?: string; viewportWidth?: number; viewportHeight?: number; stateContext?: string; kind?: ImageKind } = {},
): Promise<number> {
  return withTransaction(async (client) => {
    // The app-row upsert also serializes concurrent inserts for the same app while this
    // transaction establishes its active draft and version membership.
    const appRow = await client.query<{ id: number }>(
      `INSERT INTO apps (name) VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [app],
    );
    const appId = appRow.rows[0].id;
    const platformRow = await client.query<{ id: number }>(
      `INSERT INTO platforms (app_id, name) VALUES ($1, $2)
       ON CONFLICT (app_id, name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [appId, platform],
    );
    const imageRow = await client.query<{ id: number }>(
      `INSERT INTO images (platform_id, image_url, kind) VALUES ($1, $2, $3)
       ON CONFLICT (platform_id, image_url) DO UPDATE SET image_url = EXCLUDED.image_url
       RETURNING id`,
      [platformRow.rows[0].id, imageUrl, capture.kind ?? "screen"],
    );
    const imageId = imageRow.rows[0].id;

    await client.query(
      `WITH next AS (
         SELECT COALESCE(MAX(version_number), 0) + 1 AS revision
         FROM app_versions WHERE app_id = $1
       )
       INSERT INTO app_versions (app_id, version_number, label, status)
       SELECT $1, revision, 'v' || revision, 'draft' FROM next
       WHERE NOT EXISTS (
         SELECT 1 FROM app_versions WHERE app_id = $1 AND status IN ('draft', 'in_review')
       )`,
      [appId],
    );
    await client.query(
      `INSERT INTO version_images (version_id, image_id, source_url, viewport_width, viewport_height, state_context)
       SELECT av.id, $2, COALESCE($3, $4), $5, $6, $7
       FROM app_versions av
       WHERE av.app_id = $1 AND av.status IN ('draft', 'in_review')
       ORDER BY av.version_number DESC LIMIT 1
       ON CONFLICT (version_id, image_id) DO UPDATE SET
         source_url = COALESCE(EXCLUDED.source_url, version_images.source_url),
         viewport_width = COALESCE(EXCLUDED.viewport_width, version_images.viewport_width),
         viewport_height = COALESCE(EXCLUDED.viewport_height, version_images.viewport_height),
         state_context = COALESCE(EXCLUDED.state_context, version_images.state_context)`,
      [
        appId,
        imageId,
        capture.sourceUrl ?? null,
        imageUrl,
        capture.viewportWidth ?? null,
        capture.viewportHeight ?? null,
        capture.stateContext ?? null,
      ],
    );
    return imageId;
  });
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
  await query("UPDATE version_images SET state_context = $1 WHERE image_id = $2", [analysis.visibleStates.join(", ") || null, id]);
}

// Store app metadata captured from Mobbin at crawl time (icon, category). COALESCE only
// fills a null so a manual/backfilled value isn't clobbered by a later crawl that missed it.
export async function setAppMeta(app: string, meta: { iconUrl?: string | null; category?: string | null }): Promise<void> {
  await query(
    "UPDATE apps SET icon_url = COALESCE(icon_url, $2), category = COALESCE(category, $3) WHERE name = $1",
    [app, meta.iconUrl ?? null, meta.category ?? null],
  );
}

export type ImageKind = "screen" | "ui_element";

export interface CrawledImage {
  id: number;
  app: string;
  platform: string;
  image_url: string;
  kind?: ImageKind;
  description: string | null;
  analysis?: ScreenAnalysis | null;
  capture_url?: string | null;
  icon_url?: string | null;
  category?: string | null;
  viewport_width?: number | null;
  viewport_height?: number | null;
  state_context?: string | null;
  captured_at?: string | null;
}

export async function allImages(): Promise<CrawledImage[]> {
  const res = await query<CrawledImage>(
    `SELECT i.id, a.name AS app, p.name AS platform, i.image_url, i.kind, i.description, i.analysis, a.icon_url, a.category,
       i.image_url AS capture_url, i.created_at AS captured_at
     FROM images i
     JOIN platforms p ON p.id = i.platform_id
     JOIN apps a ON a.id = p.app_id
     WHERE i.kind = 'screen'
     ORDER BY i.created_at ASC`
  );
  return res.rows;
}

export async function appImages(app: string, kind: ImageKind = "screen"): Promise<CrawledImage[]> {
  const res = await query<CrawledImage>(
    `SELECT i.id, a.name AS app, p.name AS platform, i.image_url, i.kind, i.description, i.analysis, a.icon_url, a.category,
       i.image_url AS capture_url, i.created_at AS captured_at
     FROM images i
     JOIN platforms p ON p.id = i.platform_id
     JOIN apps a ON a.id = p.app_id
     WHERE a.name = $1 AND i.kind = $2 ORDER BY i.created_at ASC`,
    [app, kind]
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

export async function listDesignSystems(): Promise<DesignSystemSnapshot[]> {
  const res = await query<{ snapshot: DesignSystemSnapshot }>(
    `SELECT ds.snapshot FROM design_systems ds JOIN apps a ON a.id = ds.app_id ORDER BY a.name`
  );
  return res.rows.map(({ snapshot }) => snapshot);
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

export async function listAppFlowSets(): Promise<Array<{ app: string; flows: DesignFlow[] }>> {
  const res = await query<{ app: string; flows: DesignFlow[] }>(
    `SELECT a.name AS app, f.flows FROM app_flows f JOIN apps a ON a.id = f.app_id ORDER BY a.name`
  );
  return res.rows;
}

export interface AppVersion {
  id: number;
  app: string;
  version_number: number;
  label: string;
  source_url: string | null;
  status: AppVersionStatus;
  notes: string;
  captured_at: string;
  submitted_at: string | null;
  published_at: string | null;
  screen_count: number;
  analyzed_count: number;
  component_count: number;
  token_count: number;
  flow_count: number;
}

const versionSelect = `SELECT av.id, a.name AS app, av.version_number, av.label, av.source_url, av.status,
  av.notes, av.captured_at, av.submitted_at, av.published_at,
  COUNT(DISTINCT vi.image_id) FILTER (WHERE i.kind = 'screen')::int AS screen_count,
  COUNT(DISTINCT vi.image_id) FILTER (WHERE i.kind = 'screen' AND i.analysis IS NOT NULL)::int AS analyzed_count,
  COALESCE(jsonb_array_length((CASE WHEN av.status IN ('draft','in_review') THEN ds.snapshot ELSE dsv.snapshot END)->'components'), 0)::int AS component_count,
  COALESCE(jsonb_array_length((CASE WHEN av.status IN ('draft','in_review') THEN ds.snapshot ELSE dsv.snapshot END)->'tokens'), 0)::int AS token_count,
  COALESCE(jsonb_array_length(CASE WHEN av.status IN ('draft','in_review') THEN af.flows ELSE afv.flows END), 0)::int AS flow_count
  FROM app_versions av JOIN apps a ON a.id = av.app_id
  LEFT JOIN version_images vi ON vi.version_id = av.id
  LEFT JOIN images i ON i.id = vi.image_id
  LEFT JOIN design_system_versions dsv ON dsv.version_id = av.id
  LEFT JOIN app_flow_versions afv ON afv.version_id = av.id
  LEFT JOIN design_systems ds ON ds.app_id = av.app_id
  LEFT JOIN app_flows af ON af.app_id = av.app_id`;

export async function listAppVersions(app: string, publishedOnly = false): Promise<AppVersion[]> {
  const res = await query<AppVersion>(
    `${versionSelect} WHERE a.name = $1 AND ($2::boolean = false OR av.status = 'published')
     GROUP BY av.id, a.name, dsv.snapshot, afv.flows, ds.snapshot, af.flows ORDER BY av.version_number DESC`,
    [app, publishedOnly]
  );
  return res.rows;
}

async function appVersionById(id: number): Promise<AppVersion | undefined> {
  const res = await query<AppVersion>(
    `${versionSelect} WHERE av.id = $1 GROUP BY av.id, a.name, dsv.snapshot, afv.flows, ds.snapshot, af.flows`, [id]
  );
  return res.rows[0];
}

export async function createAppVersion(app: string, userId?: number, sourceUrl?: string): Promise<AppVersion> {
  const id = await withTransaction(async (client) => {
    const appRow = await client.query<{ id: number }>(
      `INSERT INTO apps (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`, [app]
    );
    const appId = appRow.rows[0].id;
    const active = await client.query<{ id: number }>(
      `SELECT id FROM app_versions WHERE app_id = $1 AND status IN ('draft', 'in_review') LIMIT 1`, [appId]
    );
    if (active.rowCount) throw new Error('This app already has an active draft or review version');
    const created = await client.query<{ id: number }>(
      `INSERT INTO app_versions (app_id, version_number, label, source_url, status, created_by)
       SELECT $1, COALESCE(MAX(version_number), 0) + 1, 'v' || (COALESCE(MAX(version_number), 0) + 1), $2, 'draft', $3
       FROM app_versions WHERE app_id = $1 RETURNING id`,
      [appId, sourceUrl ?? null, userId ?? null]
    );
    const versionId = created.rows[0].id;
    await client.query(
      `INSERT INTO version_images (version_id, image_id, captured_at, source_url, viewport_width, viewport_height, state_context)
       SELECT $1, vi.image_id, now(), vi.source_url, vi.viewport_width, vi.viewport_height, vi.state_context
       FROM version_images vi JOIN app_versions prior ON prior.id = vi.version_id
       WHERE prior.app_id = $2 AND prior.status = 'published'
         AND prior.version_number = (SELECT MAX(version_number) FROM app_versions WHERE app_id = $2 AND status = 'published')
       ON CONFLICT DO NOTHING`,
      [versionId, appId]
    );
    return versionId;
  });
  return (await appVersionById(id))!;
}

async function publicationCandidate(versionId: number) {
  const version = await appVersionById(versionId);
  if (!version) return undefined;
  const images = await query<{ id: number; analysis: ScreenAnalysis | null }>(
    `SELECT i.id, i.analysis FROM version_images vi JOIN images i ON i.id = vi.image_id
     WHERE vi.version_id = $1 AND i.kind = 'screen'`, [versionId]
  );
  const snapshot = await getDesignSystem(version.app);
  const flows = await getAppFlows(version.app);
  return { version, images: images.rows, snapshot, flows };
}

export async function getVersionPublicationBlockers(versionId: number): Promise<PublicationBlocker[]> {
  const candidate = await publicationCandidate(versionId);
  if (!candidate) return [{ code: 'screens_missing', message: 'Version not found.' }];
  const issues = await query<{ message: string }>(
    `SELECT message FROM review_issues WHERE version_id = $1 AND severity = 'blocker' AND resolved = false`, [versionId]
  );
  return [
    ...validatePublication(candidate),
    ...issues.rows.map(({ message }) => ({ code: 'invalid_evidence' as const, message })),
  ];
}

export async function submitAppVersionForReview(versionId: number, userId: number): Promise<AppVersion> {
  const blockers = await getVersionPublicationBlockers(versionId);
  if (blockers.length) throw new Error(blockers.map(({ message }) => message).join(' '));
  const res = await query<{ id: number }>(
    `UPDATE app_versions SET status = 'in_review', submitted_at = now(), reviewed_by = $2
     WHERE id = $1 AND status = 'draft' RETURNING id`, [versionId, userId]
  );
  if (!res.rowCount) throw new Error('Only a draft version can be submitted for review');
  return (await appVersionById(versionId))!;
}

export async function publishAppVersion(versionId: number, userId: number): Promise<AppVersion> {
  const outcome = await withTransaction(async (client) => {
    // READ COMMITTED is intentional: after waiting for a prior version lock holder,
    // every candidate/run query below must see what that transaction committed.
    const version = await client.query<{ app_id: number; status: AppVersionStatus }>(
      `SELECT app_id, status FROM app_versions WHERE id = $1 FOR UPDATE`,
      [versionId],
    );
    if (!version.rowCount || version.rows[0].status !== 'in_review') {
      throw new Error('Only an in-review version can be published');
    }
    const images = await client.query<{ id: number; analysis: ScreenAnalysis | null }>(
      `SELECT i.id, i.analysis FROM version_images vi JOIN images i ON i.id = vi.image_id
       WHERE vi.version_id = $1 AND i.kind = 'screen'`,
      [versionId],
    );
    const snapshot = await client.query<{ snapshot: DesignSystemSnapshot }>(
      `SELECT snapshot FROM design_systems WHERE app_id = $1`,
      [version.rows[0].app_id],
    );
    const flows = await client.query<{ flows: DesignFlow[] }>(
      `SELECT flows FROM app_flows WHERE app_id = $1`,
      [version.rows[0].app_id],
    );
    const issues = await client.query<{ message: string }>(
      `SELECT message FROM review_issues
       WHERE version_id = $1 AND severity = 'blocker' AND resolved = false`,
      [versionId],
    );
    const candidate = {
      images: images.rows,
      snapshot: snapshot.rows[0]?.snapshot,
      flows: flows.rows[0]?.flows ?? [],
    };
    const blockers = [
      ...validatePublication(candidate),
      ...issues.rows.map(({ message }) => ({ code: 'invalid_evidence' as const, message })),
    ];
    if (blockers.length) throw new Error(blockers.map(({ message }) => message).join(' '));

    await client.query(
      `UPDATE crawl_runs
       SET status = 'cancelled', worker_id = NULL, cancel_requested_at = COALESCE(cancel_requested_at, now()),
           finished_at = now(), updated_at = now()
       WHERE version_id = $1 AND status IN ('queued', 'interrupted')`,
      [versionId],
    );
    const running = await client.query(
      `UPDATE crawl_runs
       SET cancel_requested_at = COALESCE(cancel_requested_at, now()), updated_at = now()
       WHERE version_id = $1 AND status = 'running'`,
      [versionId],
    );
    if (running.rowCount) return { blocked: true as const };

    await client.query(
      `INSERT INTO design_system_versions (version_id, snapshot) VALUES ($1, $2::jsonb)
       ON CONFLICT (version_id) DO UPDATE SET snapshot = EXCLUDED.snapshot, created_at = now()`,
      [versionId, JSON.stringify(markSnapshotReviewed(candidate.snapshot!))]
    );
    await client.query(
      `INSERT INTO app_flow_versions (version_id, flows) VALUES ($1, $2::jsonb)
       ON CONFLICT (version_id) DO UPDATE SET flows = EXCLUDED.flows, created_at = now()`,
      [versionId, JSON.stringify(candidate.flows)]
    );
    const updated = await client.query(
      `UPDATE app_versions SET status = 'published', published_at = now(), reviewed_by = $2
       WHERE id = $1 AND status = 'in_review'`, [versionId, userId]
    );
    if (!updated.rowCount) throw new Error('Version changed while publishing');
    return { blocked: false as const };
  });
  if (outcome.blocked) throw new Error('Version has an active crawl run; cancellation was requested');
  return (await appVersionById(versionId))!;
}

export async function getVersionDesignSystem(app: string, versionNumber?: number): Promise<{
  version: AppVersion;
  snapshot: DesignSystemSnapshot;
  flows: DesignFlow[];
} | undefined> {
  const versions = await listAppVersions(app);
  const version = versionNumber == null
    ? versions.find(({ status }) => status === 'published')
    : versions.find(({ version_number }) => version_number === versionNumber);
  if (!version) return undefined;
  if (version.status === 'draft' || version.status === 'in_review') {
    const snapshot = await getDesignSystem(app);
    if (!snapshot) return undefined;
    return { version, snapshot, flows: await getAppFlows(app) };
  }
  const res = await query<{ snapshot: DesignSystemSnapshot; flows: DesignFlow[] }>(
    `SELECT dsv.snapshot, COALESCE(afv.flows, '[]'::jsonb) AS flows
     FROM design_system_versions dsv LEFT JOIN app_flow_versions afv ON afv.version_id = dsv.version_id
     WHERE dsv.version_id = $1`, [version.id]
  );
  return res.rows[0] ? { version, ...res.rows[0] } : undefined;
}

export async function versionImages(app: string, versionNumber?: number): Promise<CrawledImage[]> {
  const res = await query<CrawledImage>(
    `SELECT i.id, a.name AS app, p.name AS platform, i.image_url, i.kind, i.description, i.analysis,
       vi.source_url AS capture_url, vi.viewport_width, vi.viewport_height, vi.state_context, vi.captured_at
     FROM app_versions av JOIN apps a ON a.id = av.app_id
     JOIN version_images vi ON vi.version_id = av.id JOIN images i ON i.id = vi.image_id
     JOIN platforms p ON p.id = i.platform_id
     WHERE i.kind = 'screen' AND a.name = $1 AND av.version_number = COALESCE($2, (
       SELECT MAX(latest.version_number) FROM app_versions latest WHERE latest.app_id = a.id AND latest.status = 'published'
     )) ORDER BY i.id`,
    [app, versionNumber ?? null]
  );
  return res.rows;
}

export async function publishedImages(): Promise<CrawledImage[]> {
  const res = await query<CrawledImage>(
    `SELECT i.id, a.name AS app, p.name AS platform, i.image_url, i.kind, i.description, i.analysis,
       vi.source_url AS capture_url, vi.viewport_width, vi.viewport_height, vi.state_context, vi.captured_at
     FROM apps a JOIN app_versions av ON av.app_id = a.id
     JOIN version_images vi ON vi.version_id = av.id JOIN images i ON i.id = vi.image_id
     JOIN platforms p ON p.id = i.platform_id
     WHERE i.kind = 'screen' AND av.status = 'published' AND av.version_number = (
       SELECT MAX(latest.version_number) FROM app_versions latest WHERE latest.app_id = a.id AND latest.status = 'published'
     ) ORDER BY i.created_at`,
  );
  return res.rows;
}

export async function listPublishedDesignSystems(): Promise<DesignSystemSnapshot[]> {
  const res = await query<{ snapshot: DesignSystemSnapshot }>(
    `SELECT dsv.snapshot FROM design_system_versions dsv JOIN app_versions av ON av.id = dsv.version_id
     WHERE av.status = 'published' AND av.version_number = (
       SELECT MAX(latest.version_number) FROM app_versions latest WHERE latest.app_id = av.app_id AND latest.status = 'published'
     ) ORDER BY av.app_id`
  );
  return res.rows.map(({ snapshot }) => snapshot);
}

export async function listPublishedFlowSets(): Promise<Array<{ app: string; flows: DesignFlow[] }>> {
  const res = await query<{ app: string; flows: DesignFlow[] }>(
    `SELECT a.name AS app, COALESCE(afv.flows, '[]'::jsonb) AS flows
     FROM app_versions av JOIN apps a ON a.id = av.app_id
     LEFT JOIN app_flow_versions afv ON afv.version_id = av.id
     WHERE av.status = 'published' AND av.version_number = (
       SELECT MAX(latest.version_number) FROM app_versions latest WHERE latest.app_id = av.app_id AND latest.status = 'published'
     ) ORDER BY a.name`
  );
  return res.rows;
}

export async function recordExport(
  userId: number,
  app: string,
  versionId: number | undefined,
  scope: unknown,
  format: string,
  filename: string,
): Promise<number> {
  const res = await query<{ id: number }>(
    `INSERT INTO exports (user_id, app_id, version_id, scope, format, status, output_filename, completed_at)
     SELECT $1, a.id, $3, $4::jsonb, $5, 'complete', $6, now() FROM apps a WHERE a.name = $2 RETURNING id`,
    [userId, app, versionId ?? null, JSON.stringify(scope), format, filename]
  );
  return res.rows[0].id;
}

export type CollectionItemKind = "app" | "screen" | "component" | "token" | "flow" | "pattern";

export interface CollectionItem {
  id: number;
  kind: CollectionItemKind;
  app: string;
  reference_id: string;
  title: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ResearchCollection {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  items: CollectionItem[];
}

export interface NewCollectionItem {
  kind: CollectionItemKind;
  app: string;
  referenceId: string;
  title: string;
  notes: string;
}

export async function createCollection(userId: number, name: string, description = ""): Promise<ResearchCollection> {
  const res = await query<Omit<ResearchCollection, "items">>(
    `INSERT INTO collections (user_id, name, description) VALUES ($1, $2, $3)
     RETURNING id, name, description, created_at, updated_at`,
    [userId, name, description]
  );
  return { ...res.rows[0], items: [] };
}

export async function listCollections(userId: number): Promise<ResearchCollection[]> {
  const res = await query<ResearchCollection>(
    `SELECT c.id, c.name, c.description, c.created_at, c.updated_at,
       COALESCE(
         jsonb_agg(to_jsonb(ci) - 'collection_id' ORDER BY ci.created_at)
           FILTER (WHERE ci.id IS NOT NULL),
         '[]'::jsonb
       ) AS items
     FROM collections c
     LEFT JOIN collection_items ci ON ci.collection_id = c.id
     WHERE c.user_id = $1
     GROUP BY c.id
     ORDER BY c.updated_at DESC`,
    [userId]
  );
  return res.rows;
}

export async function addCollectionItem(
  userId: number,
  collectionId: number,
  item: NewCollectionItem,
): Promise<CollectionItem | undefined> {
  const res = await query<CollectionItem>(
    `INSERT INTO collection_items (collection_id, kind, app, reference_id, title, notes)
     SELECT c.id, $3, $4, $5, $6, $7 FROM collections c WHERE c.id = $2 AND c.user_id = $1
     ON CONFLICT (collection_id, kind, app, reference_id)
       DO UPDATE SET title = EXCLUDED.title, notes = EXCLUDED.notes, updated_at = now()
     RETURNING id, kind, app, reference_id, title, notes, created_at, updated_at`,
    [userId, collectionId, item.kind, item.app, item.referenceId, item.title, item.notes]
  );
  if (res.rowCount) await query("UPDATE collections SET updated_at = now() WHERE id = $1", [collectionId]);
  return res.rows[0];
}

export async function updateCollectionItemNotes(
  userId: number,
  collectionId: number,
  itemId: number,
  notes: string,
): Promise<CollectionItem | undefined> {
  const res = await query<CollectionItem>(
    `UPDATE collection_items ci SET notes = $4, updated_at = now()
     FROM collections c
     WHERE ci.id = $3 AND ci.collection_id = $2 AND c.id = ci.collection_id AND c.user_id = $1
     RETURNING ci.id, ci.kind, ci.app, ci.reference_id, ci.title, ci.notes, ci.created_at, ci.updated_at`,
    [userId, collectionId, itemId, notes]
  );
  if (res.rowCount) await query("UPDATE collections SET updated_at = now() WHERE id = $1", [collectionId]);
  return res.rows[0];
}

export async function removeCollectionItem(userId: number, collectionId: number, itemId: number): Promise<boolean> {
  const res = await query(
    `DELETE FROM collection_items ci USING collections c
     WHERE ci.id = $3 AND ci.collection_id = $2 AND c.id = ci.collection_id AND c.user_id = $1`,
    [userId, collectionId, itemId]
  );
  return Boolean(res.rowCount);
}

export async function deleteCollection(userId: number, collectionId: number): Promise<boolean> {
  const res = await query("DELETE FROM collections WHERE id = $2 AND user_id = $1", [userId, collectionId]);
  return Boolean(res.rowCount);
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
