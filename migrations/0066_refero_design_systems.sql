CREATE TABLE external_design_systems (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  app_id INTEGER REFERENCES apps(id) ON DELETE SET NULL,
  source_url TEXT NOT NULL,
  original_url TEXT,
  screenshot_url TEXT,
  thumbnail_url TEXT,
  upstream_modified_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ NOT NULL,
  content_hash TEXT NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  raw_payload JSONB NOT NULL CHECK (jsonb_typeof(raw_payload) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, external_id)
);

CREATE INDEX external_design_systems_app_idx
  ON external_design_systems (app_id, provider, upstream_modified_at DESC NULLS LAST);

CREATE INDEX external_design_systems_provider_updated_idx
  ON external_design_systems (provider, upstream_modified_at DESC NULLS LAST, external_id);
