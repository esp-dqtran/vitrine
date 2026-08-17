CREATE TABLE crawl_agent_trace_events (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT NOT NULL REFERENCES crawl_runs(id) ON DELETE CASCADE,
  mission_id BIGINT REFERENCES crawl_missions(id) ON DELETE CASCADE,
  child_run_id BIGINT REFERENCES crawl_runs(id) ON DELETE SET NULL,
  stage TEXT NOT NULL,
  event_type TEXT NOT NULL,
  rationale TEXT NOT NULL,
  confidence DOUBLE PRECISION,
  evidence_id BIGINT REFERENCES crawl_evidence(id) ON DELETE SET NULL,
  credential_capability TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX crawl_agent_trace_events_run_created_idx
  ON crawl_agent_trace_events (run_id, created_at, id);
