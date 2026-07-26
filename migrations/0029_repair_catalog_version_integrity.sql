SET LOCAL statement_timeout = '10min';

CREATE TEMP TABLE catalog_integrity_impacted_versions (
  version_id INTEGER PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO catalog_integrity_impacted_versions (version_id)
SELECT DISTINCT vi.version_id
FROM version_images vi
JOIN app_versions av ON av.id = vi.version_id
JOIN images i ON i.id = vi.image_id
JOIN platforms image_platform ON image_platform.id = i.platform_id
WHERE image_platform.app_id <> av.app_id
   OR image_platform.name <> av.platform
ON CONFLICT DO NOTHING;

INSERT INTO catalog_integrity_impacted_versions (version_id)
SELECT DISTINCT target.id
FROM version_images vi
JOIN app_versions av ON av.id = vi.version_id
JOIN images i ON i.id = vi.image_id
JOIN platforms image_platform ON image_platform.id = i.platform_id
JOIN LATERAL (
  SELECT candidate.id
  FROM app_versions candidate
  WHERE candidate.app_id = av.app_id
    AND candidate.platform = image_platform.name
    AND candidate.status = 'published'
  ORDER BY candidate.version_number DESC
  LIMIT 1
) target ON true
WHERE image_platform.app_id <> av.app_id
   OR image_platform.name <> av.platform
ON CONFLICT DO NOTHING;

INSERT INTO version_images (
  version_id,
  image_id,
  captured_at,
  source_url,
  viewport_width,
  viewport_height,
  state_context
)
SELECT
  target.id,
  vi.image_id,
  vi.captured_at,
  vi.source_url,
  vi.viewport_width,
  vi.viewport_height,
  vi.state_context
FROM version_images vi
JOIN app_versions av ON av.id = vi.version_id
JOIN images i ON i.id = vi.image_id
JOIN platforms image_platform ON image_platform.id = i.platform_id
JOIN LATERAL (
  SELECT target.id
  FROM app_versions target
  WHERE target.app_id = av.app_id
    AND target.platform = image_platform.name
    AND target.status = 'published'
  ORDER BY target.version_number DESC
  LIMIT 1
) target ON true
WHERE image_platform.app_id <> av.app_id
   OR image_platform.name <> av.platform
ON CONFLICT (version_id, image_id) DO NOTHING;

DELETE FROM version_images vi
USING app_versions av, images i, platforms image_platform
WHERE av.id = vi.version_id
  AND i.id = vi.image_id
  AND image_platform.id = i.platform_id
  AND (
    image_platform.app_id <> av.app_id
    OR image_platform.name <> av.platform
  );

DELETE FROM public_facet_previews preview
WHERE NOT EXISTS (
  SELECT 1
  FROM version_images vi
  WHERE vi.version_id = preview.version_id
    AND vi.image_id = preview.image_id
);

DELETE FROM app_versions av
WHERE NOT EXISTS (
  SELECT 1
  FROM platforms platform_identity
  WHERE platform_identity.app_id = av.app_id
    AND platform_identity.name = av.platform
);

WITH counts AS (
  SELECT
    av.id AS version_id,
    COUNT(*) FILTER (WHERE i.kind = 'screen')::integer AS screen_count,
    COUNT(*) FILTER (WHERE i.kind = 'ui_element')::integer AS ui_element_count
  FROM app_versions av
  JOIN catalog_integrity_impacted_versions impacted ON impacted.version_id = av.id
  LEFT JOIN version_images vi ON vi.version_id = av.id
  LEFT JOIN images i ON i.id = vi.image_id
  GROUP BY av.id
)
UPDATE app_versions
SET screen_count = counts.screen_count,
  ui_element_count = counts.ui_element_count
FROM counts
WHERE app_versions.id = counts.version_id;

WITH latest_published AS (
  SELECT DISTINCT ON (av.app_id, av.platform)
    av.id AS version_id,
    av.app_id,
    av.platform
  FROM app_versions av
  WHERE av.status = 'published'
  ORDER BY av.app_id, av.platform, av.version_number DESC
)
INSERT INTO design_system_versions (version_id, snapshot)
SELECT latest.version_id, current.snapshot
FROM latest_published latest
JOIN design_systems current
  ON current.app_id = latest.app_id
  AND current.platform = latest.platform
LEFT JOIN design_system_versions existing ON existing.version_id = latest.version_id
WHERE existing.version_id IS NULL
ON CONFLICT (version_id) DO NOTHING;

SELECT refresh_public_facet_previews(av.id)
FROM app_versions av
JOIN catalog_integrity_impacted_versions impacted ON impacted.version_id = av.id
WHERE av.status = 'published';

SELECT fill_public_facet_preview_fallbacks(av.id)
FROM app_versions av
JOIN catalog_integrity_impacted_versions impacted ON impacted.version_id = av.id
WHERE av.status = 'published';

DELETE FROM search_index_queue queue
WHERE NOT EXISTS (
  SELECT 1
  FROM platforms platform_identity
  WHERE platform_identity.app_id = queue.app_id
    AND platform_identity.name = queue.platform
);

ALTER TABLE app_versions
  ADD CONSTRAINT app_versions_platform_fkey
  FOREIGN KEY (app_id, platform)
  REFERENCES platforms (app_id, name)
  ON DELETE CASCADE;

ALTER TABLE search_index_queue
  ADD CONSTRAINT search_index_queue_platform_fkey
  FOREIGN KEY (app_id, platform)
  REFERENCES platforms (app_id, name)
  ON DELETE CASCADE;

ALTER TABLE public_facet_previews
  ADD CONSTRAINT public_facet_previews_version_image_fkey
  FOREIGN KEY (version_id, image_id)
  REFERENCES version_images (version_id, image_id)
  ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION enforce_version_image_context()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM app_versions av
    JOIN images i ON i.id = NEW.image_id
    JOIN platforms image_platform ON image_platform.id = i.platform_id
    WHERE av.id = NEW.version_id
      AND av.app_id = image_platform.app_id
      AND av.platform = image_platform.name
  ) THEN
    RAISE EXCEPTION 'version image context mismatch'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_version_image_context
BEFORE INSERT OR UPDATE OF version_id, image_id ON version_images
FOR EACH ROW
EXECUTE FUNCTION enforce_version_image_context();

CREATE OR REPLACE FUNCTION enforce_app_version_context()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM version_images vi
    JOIN images i ON i.id = vi.image_id
    JOIN platforms image_platform ON image_platform.id = i.platform_id
    WHERE vi.version_id = OLD.id
      AND (
        image_platform.app_id <> NEW.app_id
        OR image_platform.name <> NEW.platform
      )
  ) THEN
    RAISE EXCEPTION 'app version context mismatch'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_app_version_context
BEFORE UPDATE OF app_id, platform ON app_versions
FOR EACH ROW
EXECUTE FUNCTION enforce_app_version_context();

CREATE OR REPLACE FUNCTION enforce_image_platform_context()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM version_images vi
    JOIN app_versions av ON av.id = vi.version_id
    JOIN platforms image_platform ON image_platform.id = NEW.platform_id
    WHERE vi.image_id = OLD.id
      AND (
        image_platform.app_id <> av.app_id
        OR image_platform.name <> av.platform
      )
  ) THEN
    RAISE EXCEPTION 'image platform context mismatch'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_image_platform_context
BEFORE UPDATE OF platform_id ON images
FOR EACH ROW
EXECUTE FUNCTION enforce_image_platform_context();
