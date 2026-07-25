ALTER TABLE app_versions
  ADD COLUMN IF NOT EXISTS screen_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ui_element_count INTEGER NOT NULL DEFAULT 0;

WITH counts AS (
  SELECT av.id AS version_id,
    COUNT(*) FILTER (WHERE i.kind = 'screen')::integer AS screen_count,
    COUNT(*) FILTER (WHERE i.kind = 'ui_element')::integer AS ui_element_count
  FROM app_versions av
  LEFT JOIN version_images vi ON vi.version_id = av.id
  LEFT JOIN images i ON i.id = vi.image_id
  GROUP BY av.id
)
UPDATE app_versions av
SET screen_count = counts.screen_count,
  ui_element_count = counts.ui_element_count
FROM counts
WHERE av.id = counts.version_id;
