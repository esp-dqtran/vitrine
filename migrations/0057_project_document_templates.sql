ALTER TABLE project_documents
  ADD COLUMN is_template BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN template_snapshot BYTEA;

ALTER TABLE project_documents
  ADD CONSTRAINT project_documents_template_snapshot
  CHECK (
    (is_template = false AND template_snapshot IS NULL)
    OR (
      is_template = true
      AND octet_length(template_snapshot) BETWEEN 1 AND 8388608
    )
  );

CREATE INDEX project_documents_owner_project_templates_idx
  ON project_documents(owner_user_id, project_id, updated_at DESC, id DESC)
  WHERE is_template = true AND trashed_at IS NULL;
