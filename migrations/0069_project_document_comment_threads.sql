ALTER TABLE project_document_comments
  ADD COLUMN parent_comment_id BIGINT
    REFERENCES project_document_comments(id) ON DELETE CASCADE,
  ADD CONSTRAINT project_document_comments_parent_not_self
    CHECK (parent_comment_id IS NULL OR parent_comment_id <> id);

CREATE INDEX project_document_comments_thread_idx
  ON project_document_comments(document_id, parent_comment_id, created_at, id)
  WHERE parent_comment_id IS NOT NULL;
