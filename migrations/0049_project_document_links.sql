CREATE TABLE project_document_links (
  project_id BIGINT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  owner_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_document_id BIGINT NOT NULL REFERENCES project_documents(id) ON DELETE CASCADE,
  target_document_id BIGINT NOT NULL REFERENCES project_documents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source_document_id, target_document_id),
  CONSTRAINT project_document_links_no_self_link
    CHECK (source_document_id <> target_document_id)
);

CREATE INDEX project_document_links_source_idx
  ON project_document_links(owner_user_id, project_id, source_document_id);

CREATE INDEX project_document_links_target_idx
  ON project_document_links(owner_user_id, project_id, target_document_id);
