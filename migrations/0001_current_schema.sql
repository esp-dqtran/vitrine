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
-- Catches up databases created by an earlier revision without deleting legacy
-- path metadata. Durable-storage migration owns any later removal.
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
    AND NOT EXISTS (
      SELECT 1
      FROM version_images existing_vi
      JOIN app_versions existing_av ON existing_av.id = existing_vi.version_id
      WHERE existing_av.app_id = av.app_id
    )
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
