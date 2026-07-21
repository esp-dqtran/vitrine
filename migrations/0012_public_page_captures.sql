ALTER TABLE stored_objects
  DROP CONSTRAINT stored_objects_content_type_check;

ALTER TABLE stored_objects
  ADD CONSTRAINT stored_objects_content_type_check CHECK (content_type IN (
    'image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/webm',
    'application/json', 'application/zip', 'text/css', 'text/javascript',
    'text/typescript', 'text/markdown'
  ));

ALTER TABLE apps ADD COLUMN IF NOT EXISTS source_domain TEXT;
ALTER TABLE apps ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE apps ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE apps ADD COLUMN IF NOT EXISTS website_url TEXT;
ALTER TABLE apps ADD COLUMN IF NOT EXISTS accent_color TEXT;

CREATE UNIQUE INDEX apps_source_domain_unique
  ON apps (source_domain)
  WHERE source_domain IS NOT NULL;

CREATE TABLE web_pages (
  id BIGSERIAL PRIMARY KEY,
  app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  canonical_url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE web_page_versions (
  id BIGSERIAL PRIMARY KEY,
  page_id BIGINT NOT NULL REFERENCES web_pages(id) ON DELETE CASCADE,
  content_hash TEXT NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  status TEXT NOT NULL CHECK (status IN ('importing', 'ready', 'failed')),
  viewport_width INTEGER NOT NULL CHECK (viewport_width > 0),
  viewport_height INTEGER NOT NULL CHECK (viewport_height > 0),
  source_object_key TEXT REFERENCES stored_objects(object_key) ON DELETE RESTRICT,
  preview_object_key TEXT REFERENCES stored_objects(object_key) ON DELETE RESTRICT,
  screenshot_image_id INTEGER REFERENCES images(id) ON DELETE RESTRICT,
  failure_message TEXT,
  captured_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (page_id, content_hash)
);

CREATE TABLE web_page_sections (
  id BIGSERIAL PRIMARY KEY,
  version_id BIGINT NOT NULL REFERENCES web_page_versions(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  selector TEXT NOT NULL,
  tag_name TEXT NOT NULL,
  role TEXT,
  heading TEXT,
  text_excerpt TEXT NOT NULL,
  x DOUBLE PRECISION NOT NULL CHECK (x >= 0),
  y DOUBLE PRECISION NOT NULL CHECK (y >= 0),
  width DOUBLE PRECISION NOT NULL CHECK (width > 0),
  height DOUBLE PRECISION NOT NULL CHECK (height > 0),
  image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE RESTRICT,
  source_metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(source_metadata) = 'object'),
  UNIQUE (version_id, position)
);

CREATE INDEX web_pages_app_idx ON web_pages (app_id, updated_at DESC);
CREATE INDEX web_page_versions_ready_idx
  ON web_page_versions (page_id, captured_at DESC, id DESC)
  WHERE status = 'ready';
CREATE INDEX web_page_sections_version_position_idx
  ON web_page_sections (version_id, position);
