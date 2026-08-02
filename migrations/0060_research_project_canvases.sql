CREATE TABLE research_project_canvases (
  project_id BIGINT PRIMARY KEY REFERENCES research_projects(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
