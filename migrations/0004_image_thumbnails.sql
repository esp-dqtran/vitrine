-- Grid views (Screens, UI Elements) were loading full-resolution originals (400KB-1.3MB)
-- to render ~200px-wide tiles. A precomputed thumbnail cuts that by 10-20x. Nullable +
-- FK'd the same way as images.object_key: existing rows keep serving full-res via the
-- media route's fallback until a thumbnail is backfilled or the image is re-crawled.
ALTER TABLE images ADD COLUMN thumbnail_object_key TEXT REFERENCES stored_objects(object_key);
