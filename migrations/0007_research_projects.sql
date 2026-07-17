CREATE TABLE research_projects (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  question TEXT NOT NULL CHECK (char_length(question) BETWEEN 1 AND 1000),
  platform_filter TEXT NOT NULL DEFAULT 'all'
    CHECK (platform_filter IN ('all', 'ios', 'android', 'web')),
  constraints TEXT NOT NULL DEFAULT '' CHECK (char_length(constraints) <= 4000),
  decision TEXT NOT NULL DEFAULT '' CHECK (char_length(decision) <= 8000),
  rationale TEXT NOT NULL DEFAULT '' CHECK (char_length(rationale) <= 8000),
  open_questions TEXT NOT NULL DEFAULT '' CHECK (char_length(open_questions) <= 4000),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX research_projects_user_updated_idx
  ON research_projects (user_id, updated_at DESC);

CREATE TABLE research_project_lanes (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 4),
  conclusion TEXT NOT NULL DEFAULT '' CHECK (char_length(conclusion) <= 4000),
  UNIQUE (project_id, position)
);

CREATE TABLE research_project_items (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  lane_id BIGINT NOT NULL REFERENCES research_project_lanes(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 99),
  source_kind TEXT NOT NULL
    CHECK (source_kind IN ('catalog_screen', 'catalog_flow_step', 'private_upload')),
  catalog_app TEXT,
  catalog_version_id INTEGER REFERENCES app_versions(id) ON DELETE RESTRICT,
  catalog_image_id INTEGER REFERENCES images(id) ON DELETE RESTRICT,
  catalog_flow_id TEXT,
  catalog_step_index INTEGER CHECK (catalog_step_index IS NULL OR catalog_step_index >= 0),
  private_object_key TEXT REFERENCES stored_objects(object_key) ON DELETE RESTRICT,
  step_label TEXT NOT NULL DEFAULT '' CHECK (char_length(step_label) <= 240),
  note TEXT NOT NULL DEFAULT '' CHECK (char_length(note) <= 4000),
  tags JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(tags) = 'array'),
  important BOOLEAN NOT NULL DEFAULT false,
  source_snapshot JSONB NOT NULL CHECK (jsonb_typeof(source_snapshot) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT research_project_items_lane_position_unique
    UNIQUE (lane_id, position) DEFERRABLE INITIALLY IMMEDIATE,
  CHECK (
    (source_kind = 'private_upload' AND private_object_key IS NOT NULL AND catalog_app IS NULL)
    OR
    (source_kind <> 'private_upload' AND private_object_key IS NULL AND catalog_app IS NOT NULL)
  )
);

CREATE INDEX research_project_items_project_idx
  ON research_project_items (project_id);

CREATE TABLE research_project_syntheses (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  project_revision INTEGER NOT NULL CHECK (project_revision > 0),
  status TEXT NOT NULL CHECK (status IN ('complete', 'failed')),
  result JSONB,
  error_code TEXT,
  model TEXT NOT NULL,
  schema_version INTEGER NOT NULL CHECK (schema_version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (status = 'complete' AND result IS NOT NULL AND error_code IS NULL)
    OR
    (status = 'failed' AND result IS NULL AND error_code IS NOT NULL)
  )
);

CREATE INDEX research_project_syntheses_project_created_idx
  ON research_project_syntheses (project_id, created_at DESC);
