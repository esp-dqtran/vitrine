CREATE TABLE research_project_canvas_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id BIGINT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled canvas'
    CHECK (char_length(title) BETWEEN 1 AND 120),
  snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX research_project_canvas_files_project_updated_idx
  ON research_project_canvas_files(project_id, updated_at DESC, id);

INSERT INTO research_project_canvas_files (project_id, title, snapshot, revision, updated_at)
SELECT project_id, 'Canvas', snapshot, revision, updated_at
FROM research_project_canvases;

