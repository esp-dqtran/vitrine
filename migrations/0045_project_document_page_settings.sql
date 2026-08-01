ALTER TABLE project_documents
  ADD COLUMN is_favorite BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN page_width TEXT NOT NULL DEFAULT 'standard'
    CHECK (page_width IN ('standard', 'full'));
