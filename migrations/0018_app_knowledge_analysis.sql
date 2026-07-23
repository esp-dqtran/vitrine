CREATE TABLE app_knowledge_snapshots (
  id BIGSERIAL PRIMARY KEY,
  app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  platform_id INTEGER NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  capture_version_id INTEGER NOT NULL REFERENCES app_versions(id) ON DELETE RESTRICT,
  current_revision_id BIGINT,
  approved_revision_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (app_id, platform_id, capture_version_id)
);

CREATE TABLE app_knowledge_revisions (
  id BIGSERIAL PRIMARY KEY,
  snapshot_id BIGINT NOT NULL REFERENCES app_knowledge_snapshots(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL CHECK (revision_number > 0),
  author_type TEXT NOT NULL CHECK (author_type IN ('generated', 'user')),
  review_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (review_status IN ('draft', 'in_review', 'approved', 'superseded')),
  content JSONB NOT NULL CHECK (jsonb_typeof(content) = 'object'),
  evidence_manifest JSONB NOT NULL CHECK (jsonb_typeof(evidence_manifest) = 'array'),
  source_sha256 TEXT NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  provider_model TEXT NOT NULL CHECK (length(provider_model) BETWEEN 1 AND 160),
  prompt_version INTEGER NOT NULL CHECK (prompt_version > 0),
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (snapshot_id, revision_number),
  UNIQUE (snapshot_id, id)
);

ALTER TABLE app_knowledge_snapshots
  ADD CONSTRAINT app_knowledge_current_revision_fk
  FOREIGN KEY (id, current_revision_id)
  REFERENCES app_knowledge_revisions(snapshot_id, id)
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE app_knowledge_snapshots
  ADD CONSTRAINT app_knowledge_approved_revision_fk
  FOREIGN KEY (id, approved_revision_id)
  REFERENCES app_knowledge_revisions(snapshot_id, id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE app_knowledge_jobs (
  id BIGSERIAL PRIMARY KEY,
  snapshot_id BIGINT NOT NULL REFERENCES app_knowledge_snapshots(id) ON DELETE CASCADE,
  transport_job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  requested_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'done', 'error', 'cancelled', 'stale')),
  stage TEXT NOT NULL DEFAULT 'preparing'
    CHECK (stage IN (
      'preparing', 'validating_evidence', 'analyzing', 'synthesizing',
      'validating_output', 'saving', 'complete'
    )),
  done_count INTEGER NOT NULL DEFAULT 0 CHECK (done_count >= 0),
  total_count INTEGER NOT NULL DEFAULT 0 CHECK (total_count >= 0),
  cache_hit_count INTEGER NOT NULL DEFAULT 0 CHECK (cache_hit_count >= 0),
  failed_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  evidence_manifest JSONB CHECK (
    evidence_manifest IS NULL OR jsonb_typeof(evidence_manifest) = 'array'
  ),
  source_sha256 TEXT CHECK (source_sha256 IS NULL OR source_sha256 ~ '^[0-9a-f]{64}$'),
  provider_model TEXT NOT NULL CHECK (length(provider_model) BETWEEN 1 AND 160),
  prompt_version INTEGER NOT NULL CHECK (prompt_version > 0),
  cancel_requested BOOLEAN NOT NULL DEFAULT false,
  retry_failed_only BOOLEAN NOT NULL DEFAULT false,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CHECK (done_count <= total_count)
);
CREATE INDEX app_knowledge_jobs_snapshot_idx
  ON app_knowledge_jobs(snapshot_id, created_at DESC, id DESC);
CREATE INDEX app_knowledge_jobs_status_idx
  ON app_knowledge_jobs(status, created_at, id);
CREATE UNIQUE INDEX app_knowledge_one_active_job_per_snapshot
  ON app_knowledge_jobs(snapshot_id)
  WHERE status IN ('queued', 'running');

CREATE TABLE app_knowledge_job_evidence (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES app_knowledge_jobs(id) ON DELETE CASCADE,
  evidence_id TEXT NOT NULL CHECK (length(evidence_id) BETWEEN 1 AND 300),
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL CHECK (kind IN ('screen', 'flow_step', 'ui_element')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'complete', 'failed', 'cached', 'quarantined', 'duplicate')),
  cache_key TEXT CHECK (cache_key IS NULL OR cache_key ~ '^[0-9a-f]{64}$'),
  analysis JSONB CHECK (analysis IS NULL OR jsonb_typeof(analysis) = 'object'),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  error_code TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, evidence_id),
  UNIQUE (job_id, ordinal)
);

CREATE TABLE app_knowledge_evidence_cache (
  cache_key TEXT PRIMARY KEY CHECK (cache_key ~ '^[0-9a-f]{64}$'),
  normalized_visual_sha256 TEXT NOT NULL
    CHECK (normalized_visual_sha256 ~ '^[0-9a-f]{64}$'),
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  prompt_version INTEGER NOT NULL CHECK (prompt_version > 0),
  provider_model TEXT NOT NULL CHECK (length(provider_model) BETWEEN 1 AND 160),
  analysis JSONB NOT NULL CHECK (jsonb_typeof(analysis) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE app_knowledge_review_events (
  id BIGSERIAL PRIMARY KEY,
  snapshot_id BIGINT NOT NULL REFERENCES app_knowledge_snapshots(id) ON DELETE CASCADE,
  revision_id BIGINT REFERENCES app_knowledge_revisions(id) ON DELETE SET NULL,
  actor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (length(action) BETWEEN 1 AND 80),
  from_status TEXT CHECK (
    from_status IS NULL OR from_status IN ('draft', 'in_review', 'approved', 'superseded')
  ),
  to_status TEXT CHECK (
    to_status IS NULL OR to_status IN ('draft', 'in_review', 'approved', 'superseded')
  ),
  details JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX app_knowledge_review_events_snapshot_idx
  ON app_knowledge_review_events(snapshot_id, created_at, id);

CREATE TABLE app_knowledge_evidence_overrides (
  id BIGSERIAL PRIMARY KEY,
  version_id INTEGER NOT NULL REFERENCES app_versions(id) ON DELETE CASCADE,
  image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('eligible', 'quarantined')),
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 1000),
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (version_id, image_id)
);

CREATE OR REPLACE FUNCTION protect_approved_app_knowledge_revision() RETURNS trigger AS $$
BEGIN
  IF OLD.review_status = 'approved' AND (
    NEW.content IS DISTINCT FROM OLD.content
    OR NEW.evidence_manifest IS DISTINCT FROM OLD.evidence_manifest
    OR NEW.source_sha256 IS DISTINCT FROM OLD.source_sha256
    OR NEW.provider_model IS DISTINCT FROM OLD.provider_model
    OR NEW.prompt_version IS DISTINCT FROM OLD.prompt_version
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
  ) THEN
    RAISE EXCEPTION 'approved App Knowledge revision is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER app_knowledge_revision_immutable
BEFORE UPDATE ON app_knowledge_revisions
FOR EACH ROW EXECUTE FUNCTION protect_approved_app_knowledge_revision();

CREATE OR REPLACE FUNCTION protect_app_knowledge_review_event() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'App Knowledge review events are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER app_knowledge_review_event_immutable
BEFORE UPDATE OR DELETE ON app_knowledge_review_events
FOR EACH ROW EXECUTE FUNCTION protect_app_knowledge_review_event();

CREATE OR REPLACE FUNCTION notify_app_knowledge_job() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('app_knowledge_jobs', NEW.id::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER app_knowledge_job_notify
AFTER INSERT OR UPDATE ON app_knowledge_jobs
FOR EACH ROW EXECUTE FUNCTION notify_app_knowledge_job();
