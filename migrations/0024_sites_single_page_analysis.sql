ALTER TABLE sites
  ADD COLUMN source_kind TEXT NOT NULL DEFAULT 'mobbin'
    CHECK (source_kind IN ('mobbin', 'public-page'));

ALTER TABLE site_versions
  DROP CONSTRAINT site_versions_canonical_url_key,
  ADD COLUMN content_hash TEXT
    CHECK (content_hash IS NULL OR content_hash ~ '^[0-9a-f]{64}$'),
  ADD COLUMN analysis_status TEXT NOT NULL DEFAULT 'evidence-only'
    CHECK (analysis_status IN ('ready', 'evidence-only')),
  ADD COLUMN analysis JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(analysis) = 'object'),
  ADD COLUMN analysis_model TEXT,
  ADD COLUMN analysis_object_key TEXT
    REFERENCES stored_objects(object_key) ON DELETE RESTRICT,
  ADD COLUMN mobile_page_object_key TEXT
    REFERENCES stored_objects(object_key) ON DELETE RESTRICT;

CREATE UNIQUE INDEX site_versions_public_content_unique
  ON site_versions (site_id, content_hash)
  WHERE content_hash IS NOT NULL;

CREATE UNIQUE INDEX site_versions_mobbin_canonical_unique
  ON site_versions (canonical_url)
  WHERE content_hash IS NULL;

CREATE INDEX site_versions_public_canonical_ready
  ON site_versions (canonical_url, updated_at DESC)
  WHERE content_hash IS NOT NULL AND status = 'ready';
