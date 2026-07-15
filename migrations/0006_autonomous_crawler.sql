ALTER TABLE crawl_runs ADD COLUMN run_kind TEXT NOT NULL DEFAULT 'planned'
  CHECK (run_kind IN ('planned', 'autonomous'));
ALTER TABLE crawl_runs ADD COLUMN parent_run_id BIGINT REFERENCES crawl_runs(id) ON DELETE RESTRICT;
ALTER TABLE crawl_runs ADD COLUMN platform TEXT NOT NULL DEFAULT 'web';
ALTER TABLE crawl_runs ADD COLUMN allow_all BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE crawl_runs ADD COLUMN pause_requested_at TIMESTAMPTZ;
ALTER TABLE crawl_runs ALTER COLUMN plan_id DROP NOT NULL;
ALTER TABLE crawl_runs ADD CONSTRAINT crawl_runs_kind_plan_ck
  CHECK ((run_kind = 'planned' AND plan_id IS NOT NULL) OR (run_kind = 'autonomous' AND plan_id IS NULL));
CREATE INDEX crawl_runs_parent_idx ON crawl_runs(parent_run_id) WHERE parent_run_id IS NOT NULL;

CREATE TABLE crawl_dossiers (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT NOT NULL REFERENCES crawl_runs(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL CHECK (revision > 0),
  dossier JSONB NOT NULL CHECK (jsonb_typeof(dossier) = 'object'),
  content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, revision),
  UNIQUE (run_id, content_hash)
);

CREATE TABLE crawl_missions (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT NOT NULL REFERENCES crawl_runs(id) ON DELETE CASCADE,
  mission_key TEXT NOT NULL,
  goal TEXT NOT NULL,
  product_area TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('read', 'mutate')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'blocked', 'failed', 'interrupted', 'cancelled')),
  priority INTEGER NOT NULL DEFAULT 0,
  prerequisites JSONB NOT NULL DEFAULT '[]'::jsonb,
  budget JSONB NOT NULL,
  checkpoint JSONB,
  result JSONB,
  worker_id TEXT,
  heartbeat_at TIMESTAMPTZ,
  lease_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, mission_key)
);

CREATE TABLE crawl_states (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT NOT NULL REFERENCES crawl_runs(id) ON DELETE CASCADE,
  state_key TEXT NOT NULL,
  platform TEXT NOT NULL,
  account_state_version INTEGER NOT NULL,
  normalized_url TEXT NOT NULL,
  label TEXT NOT NULL,
  product_area TEXT NOT NULL,
  fingerprint JSONB NOT NULL,
  evidence_id BIGINT REFERENCES crawl_evidence(id) ON DELETE RESTRICT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, state_key)
);

CREATE TABLE crawl_transitions (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT NOT NULL REFERENCES crawl_runs(id) ON DELETE CASCADE,
  mission_id BIGINT NOT NULL REFERENCES crawl_missions(id) ON DELETE CASCADE,
  child_run_id BIGINT REFERENCES crawl_runs(id) ON DELETE RESTRICT,
  source_state_id BIGINT REFERENCES crawl_states(id) ON DELETE RESTRICT,
  destination_state_id BIGINT REFERENCES crawl_states(id) ON DELETE RESTRICT,
  action JSONB NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('read', 'mutate')),
  outcome TEXT NOT NULL CHECK (outcome IN ('completed', 'failed', 'blocked')),
  confidence DOUBLE PRECISION NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE crawl_account_sessions (
  id BIGSERIAL PRIMARY KEY,
  app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  encrypted_storage_state TEXT NOT NULL,
  state_version INTEGER NOT NULL CHECK (state_version > 0),
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (app_id)
);

CREATE TABLE crawl_account_leases (
  run_id BIGINT NOT NULL REFERENCES crawl_runs(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('mutation', 'authentication')),
  mission_id BIGINT REFERENCES crawl_missions(id) ON DELETE CASCADE,
  worker_id TEXT NOT NULL,
  heartbeat_at TIMESTAMPTZ NOT NULL,
  lease_expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (run_id, purpose)
);
