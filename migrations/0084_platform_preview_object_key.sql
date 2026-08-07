-- apps.preview_object_key is one image for an app that appears under several
-- platform tabs. 237 apps are on both Android and iOS and show the same iOS
-- screenshot in both places, because the fallback picks one screen per app.
--
-- The platform row is the natural owner: one preview per app-platform pair, so
-- the Android tab shows an Android capture and the iOS tab an iOS one.
-- apps.preview_object_key stays as the app-level default for callers that do
-- not filter by platform.
ALTER TABLE platforms
  ADD COLUMN IF NOT EXISTS preview_object_key TEXT
    REFERENCES stored_objects(object_key) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS platforms_preview_object_key_idx
  ON platforms (preview_object_key)
  WHERE preview_object_key IS NOT NULL;
