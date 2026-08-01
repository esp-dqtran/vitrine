ALTER TABLE project_documents
  ADD COLUMN trashed_at TIMESTAMPTZ;

CREATE INDEX project_documents_owner_project_trash_idx
  ON project_documents(owner_user_id, project_id, trashed_at DESC)
  WHERE trashed_at IS NOT NULL;
