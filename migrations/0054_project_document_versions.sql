CREATE TABLE project_document_versions (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  document_id BIGINT NOT NULL REFERENCES project_documents(id) ON DELETE CASCADE,
  created_by_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  label VARCHAR(120) NOT NULL,
  snapshot BYTEA NOT NULL,
  byte_size INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_document_versions_label_length
    CHECK (char_length(label) BETWEEN 1 AND 120),
  CONSTRAINT project_document_versions_snapshot_size
    CHECK (
      byte_size BETWEEN 1 AND 8388608
      AND octet_length(snapshot) = byte_size
    )
);

CREATE INDEX project_document_versions_document_idx
  ON project_document_versions(project_id, document_id, created_at DESC, id DESC);
