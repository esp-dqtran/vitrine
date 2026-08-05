-- App icons are hotlinked today: apps.icon_url points at an App Store CDN, a
-- Play Store image or a site's own favicon. Those hosts 403 direct <img> loads
-- (Deliveroo went blank that way), rate-limit us, and change without notice.
--
-- Store the icon like every other piece of catalog media instead: one
-- stored_objects row, served from R2 by the Worker. icon_url keeps holding the
-- URL the browser loads — now the local /assets/<key> path — so every existing
-- consumer keeps working; this column is the real reference that keeps the
-- object alive for GC.
ALTER TABLE apps
  ADD COLUMN IF NOT EXISTS icon_object_key TEXT
    REFERENCES stored_objects(object_key) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS apps_icon_object_key_idx
  ON apps (icon_object_key)
  WHERE icon_object_key IS NOT NULL;
