CREATE TABLE project_documents (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  owner_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_key TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled',
  octobase_document_id TEXT NOT NULL UNIQUE,
  last_editor_mode TEXT NOT NULL DEFAULT 'page'
    CHECK (last_editor_mode IN ('page', 'edgeless')),
  integration_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, document_key)
);

CREATE INDEX project_documents_owner_project_idx
  ON project_documents(owner_user_id, project_id);
