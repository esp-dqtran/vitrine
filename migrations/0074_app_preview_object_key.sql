-- Reference the stored image itself rather than a URL that indirects through
-- the Sites route. An app and the Site version it was captured from point at
-- the SAME stored_objects row: one image, two references.
--
-- This matches how every other media reference in the schema already works
-- (site_versions.preview_object_key, web_page_versions.preview_object_key,
-- images.object_key, and 14 others). It also means the FK keeps the object
-- alive for GC, and the app's thumbnail cannot break if Sites routes change.
--
-- Replaces the URL column added in 0073, which only ever held a derived path.
ALTER TABLE apps
  ADD COLUMN IF NOT EXISTS preview_object_key TEXT
    REFERENCES stored_objects(object_key) ON DELETE RESTRICT;

ALTER TABLE apps DROP COLUMN IF EXISTS preview_url;

CREATE INDEX IF NOT EXISTS apps_preview_object_key_idx
  ON apps (preview_object_key)
  WHERE preview_object_key IS NOT NULL;
