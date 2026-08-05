-- Site cards show a still until you hover, and today that still is the page
-- poster: a full-page screenshot, 1440x7008 and ~2.5MB, while the preview video
-- it hands over to is a single 1440x900 viewport. Different framing, different
-- content, so hovering visibly jumps — and every card pays megabytes at rest.
--
-- Store a poster derived from the video's own first meaningful frame instead,
-- so the resting image IS where playback starts.
ALTER TABLE site_versions
  ADD COLUMN IF NOT EXISTS poster_object_key TEXT
    REFERENCES stored_objects(object_key) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS site_versions_poster_object_key_idx
  ON site_versions (poster_object_key)
  WHERE poster_object_key IS NOT NULL;
