CREATE TABLE feature_documents (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE RESTRICT,
  platform_id INTEGER NOT NULL REFERENCES platforms(id) ON DELETE RESTRICT,
  source_flow_id TEXT NOT NULL CHECK (char_length(source_flow_id) BETWEEN 1 AND 240),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  current_revision_id BIGINT,
  source_change_acknowledged_sha256 TEXT
    CHECK (source_change_acknowledged_sha256 IS NULL OR source_change_acknowledged_sha256 ~ '^[0-9a-f]{64}$'),
  source_change_acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE feature_document_revisions (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES feature_documents(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL CHECK (revision_number > 0),
  author_type TEXT NOT NULL CHECK (author_type IN ('generated', 'user', 'restored')),
  review_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (review_status IN ('draft', 'in_review', 'approved', 'superseded')),
  content JSONB NOT NULL CHECK (jsonb_typeof(content) = 'object'),
  source_version_id INTEGER REFERENCES app_versions(id) ON DELETE RESTRICT,
  source_flow JSONB NOT NULL CHECK (jsonb_typeof(source_flow) = 'object'),
  evidence_manifest JSONB NOT NULL CHECK (jsonb_typeof(evidence_manifest) = 'array'),
  evidence_manifest_sha256 TEXT NOT NULL CHECK (evidence_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  focus_instruction TEXT NOT NULL DEFAULT '' CHECK (char_length(focus_instruction) <= 2000),
  prompt_version INTEGER NOT NULL CHECK (prompt_version > 0),
  provider_model TEXT NOT NULL CHECK (char_length(provider_model) BETWEEN 1 AND 160),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, revision_number),
  UNIQUE (id, document_id)
);

ALTER TABLE feature_documents
  ADD CONSTRAINT feature_documents_current_revision_fk
  FOREIGN KEY (current_revision_id, id) REFERENCES feature_document_revisions(id, document_id) ON DELETE RESTRICT;

CREATE TABLE feature_document_jobs (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES feature_documents(id) ON DELETE CASCADE,
  transport_job_id INTEGER NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE RESTRICT,
  requested_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'done', 'error', 'cancelled', 'stale')),
  stage TEXT NOT NULL DEFAULT 'preparing'
    CHECK (stage IN ('preparing', 'analyzing', 'synthesizing', 'validating', 'saving', 'complete')),
  done_count INTEGER NOT NULL DEFAULT 0 CHECK (done_count >= 0),
  total_count INTEGER NOT NULL CHECK (total_count > 0),
  source_version_id INTEGER REFERENCES app_versions(id) ON DELETE RESTRICT,
  source_flow JSONB NOT NULL CHECK (jsonb_typeof(source_flow) = 'object'),
  evidence_manifest JSONB NOT NULL CHECK (jsonb_typeof(evidence_manifest) = 'array'),
  evidence_manifest_sha256 TEXT NOT NULL CHECK (evidence_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  focus_instruction TEXT NOT NULL DEFAULT '' CHECK (char_length(focus_instruction) <= 2000),
  prompt_version INTEGER NOT NULL CHECK (prompt_version > 0),
  provider_model TEXT NOT NULL CHECK (char_length(provider_model) BETWEEN 1 AND 160),
  cancel_requested BOOLEAN NOT NULL DEFAULT false,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CHECK (done_count <= total_count),
  CHECK (error_code IS NULL OR status IN ('error', 'stale'))
);

CREATE TABLE feature_document_step_analyses (
  job_id BIGINT NOT NULL REFERENCES feature_document_jobs(id) ON DELETE CASCADE,
  step_index INTEGER NOT NULL CHECK (step_index >= 0),
  image_index INTEGER NOT NULL CHECK (image_index >= 0),
  image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE RESTRICT,
  evidence_id TEXT NOT NULL CHECK (char_length(evidence_id) BETWEEN 1 AND 240),
  status TEXT NOT NULL CHECK (status IN ('complete', 'failed')),
  result JSONB,
  attempt_count INTEGER NOT NULL DEFAULT 1 CHECK (attempt_count BETWEEN 1 AND 3),
  error_code TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (job_id, step_index, image_index),
  UNIQUE (job_id, evidence_id),
  CHECK (
    (status = 'complete' AND result IS NOT NULL AND error_code IS NULL)
    OR (status = 'failed' AND result IS NULL AND error_code IS NOT NULL)
  )
);

CREATE TABLE feature_document_shares (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES feature_documents(id) ON DELETE CASCADE,
  revision_id BIGINT NOT NULL REFERENCES feature_document_revisions(id) ON DELETE CASCADE,
  token_sha256 TEXT NOT NULL UNIQUE CHECK (token_sha256 ~ '^[0-9a-f]{64}$'),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at),
  FOREIGN KEY (revision_id, document_id)
    REFERENCES feature_document_revisions(id, document_id) ON DELETE CASCADE
);

CREATE INDEX feature_documents_owner_updated_idx
  ON feature_documents (user_id, updated_at DESC);
CREATE INDEX feature_document_jobs_document_idx
  ON feature_document_jobs (document_id, created_at DESC);
CREATE INDEX feature_document_shares_document_idx
  ON feature_document_shares (document_id, created_at DESC);

CREATE OR REPLACE FUNCTION notify_feature_document_job() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('feature_document_jobs', NEW.id::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER feature_document_job_notify
AFTER INSERT OR UPDATE ON feature_document_jobs
FOR EACH ROW EXECUTE FUNCTION notify_feature_document_job();
