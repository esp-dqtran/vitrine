CREATE TABLE IF NOT EXISTS stored_objects (
  object_key TEXT PRIMARY KEY CHECK (
    length(object_key) BETWEEN 1 AND 1024
    AND object_key ~ '^[a-z0-9][a-z0-9/_=.@-]*$'
    AND right(object_key, 1) <> '/'
    AND position('//' IN object_key) = 0
    AND object_key !~ '(^|/)\.{1,2}(/|$)'
  ),
  sha256 TEXT NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  byte_size BIGINT NOT NULL CHECK (byte_size > 0),
  content_type TEXT NOT NULL CHECK (content_type IN (
    'image/png', 'image/jpeg', 'image/webp', 'application/json',
    'application/zip', 'text/css', 'text/javascript', 'text/typescript'
  )),
  access_class TEXT NOT NULL CHECK (access_class IN ('protected', 'public-preview', 'internal')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE images
  ADD COLUMN IF NOT EXISTS object_key TEXT REFERENCES stored_objects(object_key);
CREATE UNIQUE INDEX IF NOT EXISTS images_object_key_uidx
  ON images(object_key) WHERE object_key IS NOT NULL;

ALTER TABLE exports
  ADD COLUMN IF NOT EXISTS object_key TEXT REFERENCES stored_objects(object_key);
ALTER TABLE crawl_run_steps
  ADD COLUMN IF NOT EXISTS failure_object_key TEXT REFERENCES stored_objects(object_key);

CREATE TABLE IF NOT EXISTS app_preview_images (
  version_id INTEGER NOT NULL REFERENCES app_versions(id) ON DELETE CASCADE,
  image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  rank SMALLINT NOT NULL CHECK (rank BETWEEN 1 AND 3),
  PRIMARY KEY (version_id, rank),
  UNIQUE (version_id, image_id),
  FOREIGN KEY (version_id, image_id)
    REFERENCES version_images(version_id, image_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS media_migration_state (
  image_id INTEGER PRIMARY KEY REFERENCES images(id) ON DELETE CASCADE,
  legacy_reference TEXT NOT NULL,
  object_key TEXT REFERENCES stored_objects(object_key),
  status TEXT NOT NULL CHECK (status IN ('pending', 'complete', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  error_code TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS object_gc_marks (
  object_key TEXT PRIMARY KEY REFERENCES stored_objects(object_key) ON DELETE CASCADE,
  first_unreferenced_at TIMESTAMPTZ NOT NULL,
  last_confirmed_at TIMESTAMPTZ NOT NULL
);
