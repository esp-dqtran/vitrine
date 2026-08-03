ALTER TABLE research_projects
  ADD COLUMN icon TEXT NOT NULL DEFAULT 'initial'
  CHECK (icon IN ('initial', 'folder', 'grid', 'book', 'sparkle'));

