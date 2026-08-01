ALTER TABLE project_documents
  ADD COLUMN icon TEXT NOT NULL DEFAULT 'none'
    CHECK (icon IN ('none', 'document', 'idea', 'task', 'schedule', 'build'));
