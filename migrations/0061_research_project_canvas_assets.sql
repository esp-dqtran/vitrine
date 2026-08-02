CREATE TABLE research_project_canvas_assets (
  project_id BIGINT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL CHECK (char_length(asset_id) BETWEEN 7 AND 240),
  object_key TEXT NOT NULL REFERENCES stored_objects(object_key) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, asset_id)
);

CREATE INDEX research_project_canvas_assets_object_idx
  ON research_project_canvas_assets (object_key);
