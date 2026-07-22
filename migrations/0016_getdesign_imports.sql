ALTER TABLE design_systems
  ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'observed'
  CHECK (origin IN ('observed', 'imported'));

CREATE TABLE design_system_import_history (
  id BIGSERIAL PRIMARY KEY,
  run_id UUID NOT NULL,
  app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  source_slug TEXT NOT NULL,
  source_hash TEXT NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  previous_origin TEXT CHECK (previous_origin IN ('observed', 'imported')),
  previous_snapshot JSONB,
  imported_snapshot JSONB NOT NULL,
  created_platform BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  rolled_back_at TIMESTAMPTZ,
  UNIQUE (run_id, app_id, platform)
);

CREATE INDEX design_system_import_history_app_created_idx
  ON design_system_import_history (app_id, platform, created_at DESC);
