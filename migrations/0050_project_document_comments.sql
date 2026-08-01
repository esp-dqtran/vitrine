CREATE TABLE project_document_comments (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  document_id BIGINT NOT NULL REFERENCES project_documents(id) ON DELETE CASCADE,
  author_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_document_comments_body_length
    CHECK (char_length(body) BETWEEN 1 AND 2000)
);

CREATE INDEX project_document_comments_document_idx
  ON project_document_comments(project_id, document_id, created_at, id);

CREATE INDEX project_document_comments_unresolved_idx
  ON project_document_comments(project_id, document_id, created_at, id)
  WHERE resolved_at IS NULL;
