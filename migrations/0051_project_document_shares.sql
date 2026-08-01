CREATE TABLE project_document_shares (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  document_id BIGINT NOT NULL REFERENCES project_documents(id) ON DELETE CASCADE,
  owner_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_sha256 TEXT NOT NULL UNIQUE
    CHECK (token_sha256 ~ '^[0-9a-f]{64}$'),
  revoked_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX project_document_shares_document_idx
  ON project_document_shares(project_id, document_id, created_at DESC);

CREATE INDEX project_document_shares_active_idx
  ON project_document_shares(token_sha256)
  WHERE revoked_at IS NULL;
