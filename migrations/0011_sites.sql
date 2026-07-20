CREATE TABLE sites (
  id BIGSERIAL PRIMARY KEY,
  source_site_id TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE stored_objects
  DROP CONSTRAINT stored_objects_content_type_check;

ALTER TABLE stored_objects
  ADD CONSTRAINT stored_objects_content_type_check CHECK (content_type IN (
    'image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'application/json',
    'application/zip', 'text/css', 'text/javascript', 'text/typescript',
    'text/markdown'
  ));

CREATE TABLE site_versions (
  id BIGSERIAL PRIMARY KEY,
  site_id BIGINT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  source_version_id TEXT NOT NULL,
  canonical_url TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  is_latest BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL CHECK (status IN ('importing', 'ready', 'failed')),
  preview_object_key TEXT REFERENCES stored_objects(object_key) ON DELETE RESTRICT,
  source_object_key TEXT REFERENCES stored_objects(object_key) ON DELETE RESTRICT,
  failure_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_id, source_version_id)
);

CREATE TABLE site_pages (
  id BIGSERIAL PRIMARY KEY,
  version_id BIGINT NOT NULL REFERENCES site_versions(id) ON DELETE CASCADE,
  source_page_id TEXT NOT NULL,
  title TEXT NOT NULL,
  page_url TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  full_page_object_key TEXT NOT NULL REFERENCES stored_objects(object_key) ON DELETE RESTRICT,
  UNIQUE (version_id, source_page_id),
  UNIQUE (version_id, position)
);

CREATE TABLE site_sections (
  id BIGSERIAL PRIMARY KEY,
  page_id BIGINT NOT NULL REFERENCES site_pages(id) ON DELETE CASCADE,
  source_section_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  media_kind TEXT NOT NULL CHECK (media_kind IN ('image', 'video')),
  media_object_key TEXT NOT NULL REFERENCES stored_objects(object_key) ON DELETE RESTRICT,
  poster_object_key TEXT REFERENCES stored_objects(object_key) ON DELETE RESTRICT,
  crop_top DOUBLE PRECISION,
  crop_bottom DOUBLE PRECISION,
  video_start_seconds DOUBLE PRECISION,
  video_end_seconds DOUBLE PRECISION,
  ocr_boxes JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(ocr_boxes) = 'array'),
  source_metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(source_metadata) = 'object'),
  UNIQUE (page_id, source_section_id),
  UNIQUE (page_id, position),
  CHECK (
    (media_kind = 'image' AND crop_top IS NOT NULL AND crop_bottom IS NOT NULL AND video_start_seconds IS NULL AND video_end_seconds IS NULL)
    OR
    (media_kind = 'video' AND crop_top IS NULL AND crop_bottom IS NULL AND video_start_seconds IS NOT NULL AND video_end_seconds IS NOT NULL)
  )
);

CREATE INDEX site_versions_ready_idx ON site_versions (site_id, updated_at DESC) WHERE status = 'ready';
CREATE INDEX site_pages_version_position_idx ON site_pages (version_id, position);
CREATE INDEX site_sections_page_position_idx ON site_sections (page_id, position);
