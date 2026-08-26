ALTER TABLE app_versions
  ADD COLUMN IF NOT EXISTS analyzed_count INTEGER NOT NULL DEFAULT 0;

WITH counts AS (
  SELECT av.id AS version_id,
    COUNT(*) FILTER (WHERE i.kind = 'screen' AND i.analysis IS NOT NULL)::integer AS analyzed_count
  FROM app_versions av
  LEFT JOIN version_images vi ON vi.version_id = av.id
  LEFT JOIN images i ON i.id = vi.image_id
  GROUP BY av.id
)
UPDATE app_versions av
SET analyzed_count = counts.analyzed_count
FROM counts
WHERE av.id = counts.version_id;
