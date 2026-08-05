-- Site logos are still hotlinked from the source website or a Mobbin CDN: some
-- 404, some serve formats sharp cannot decode, and none are sized for the 44px
-- card tile. Store a resolved copy the way apps.icon_object_key already does.
ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS icon_object_key TEXT
    REFERENCES stored_objects(object_key) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS sites_icon_object_key_idx
  ON sites (icon_object_key)
  WHERE icon_object_key IS NOT NULL;
