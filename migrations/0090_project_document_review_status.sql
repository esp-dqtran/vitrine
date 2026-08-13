ALTER TABLE project_documents
  ADD COLUMN review_status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN review_requested_at TIMESTAMPTZ,
  ADD COLUMN approved_at TIMESTAMPTZ,
  ADD COLUMN approved_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE project_documents
  ADD CONSTRAINT project_documents_review_status_check
  CHECK (review_status IN ('draft', 'in_review', 'approved'));

CREATE INDEX project_documents_review_status_idx
  ON project_documents(project_id, review_status, updated_at DESC)
  WHERE trashed_at IS NULL;
