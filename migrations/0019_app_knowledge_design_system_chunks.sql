CREATE TABLE app_knowledge_design_system_chunks (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES app_knowledge_jobs(id) ON DELETE CASCADE,
  chunk_key TEXT NOT NULL CHECK (chunk_key ~ '^[0-9a-f]{64}$'),
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'complete', 'failed')),
  fragment JSONB CHECK (fragment IS NULL OR jsonb_typeof(fragment) = 'object'),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  error_code TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, chunk_key),
  UNIQUE (job_id, ordinal)
);

CREATE INDEX app_knowledge_design_system_chunks_job_status_idx
  ON app_knowledge_design_system_chunks (job_id, status, ordinal);
