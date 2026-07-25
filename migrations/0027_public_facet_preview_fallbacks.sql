CREATE OR REPLACE FUNCTION fill_public_facet_preview_fallbacks(target_version_id INTEGER)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  WITH facets(facet_value, ordinal) AS (
    VALUES ('Filter & Sort', 1), ('Chat Bot', 2), ('Signup', 3),
      ('Settings & Preferences', 4), ('Charts', 5)
  ),
  media AS (
    SELECT vi.version_id, i.id AS image_id,
      ROW_NUMBER() OVER (ORDER BY vi.captured_at DESC NULLS LAST, i.id DESC) AS ordinal
    FROM version_images vi
    JOIN images i ON i.id = vi.image_id AND i.kind = 'screen'
    WHERE vi.version_id = target_version_id
      AND EXISTS (
        SELECT 1 FROM stored_objects so
        WHERE so.object_key = COALESCE(i.thumbnail_object_key, i.object_key)
          AND so.access_class IN ('protected', 'public-preview')
      )
  )
  INSERT INTO public_facet_previews (
    version_id, facet_group, facet_value, rank, image_id
  )
  SELECT media.version_id, 'screens', facets.facet_value, 1, media.image_id
  FROM facets
  JOIN media ON media.ordinal = facets.ordinal
  ON CONFLICT (version_id, facet_group, facet_value, rank) DO NOTHING;

  WITH facets(facet_value, ordinal) AS (
    VALUES ('Navigation Menu', 1), ('Dialog', 2), ('Card', 3),
      ('Dropdown Menu', 4), ('Text Field', 5)
  ),
  media AS (
    SELECT vi.version_id, i.id AS image_id,
      ROW_NUMBER() OVER (ORDER BY vi.captured_at DESC NULLS LAST, i.id DESC) AS ordinal
    FROM version_images vi
    JOIN images i ON i.id = vi.image_id AND i.kind = 'ui_element'
    WHERE vi.version_id = target_version_id
      AND EXISTS (
        SELECT 1 FROM stored_objects so
        WHERE so.object_key = COALESCE(i.thumbnail_object_key, i.object_key)
          AND so.access_class IN ('protected', 'public-preview')
      )
  )
  INSERT INTO public_facet_previews (
    version_id, facet_group, facet_value, rank, image_id
  )
  SELECT media.version_id, 'elements', facets.facet_value, 1, media.image_id
  FROM facets
  JOIN media ON media.ordinal = facets.ordinal
  ON CONFLICT (version_id, facet_group, facet_value, rank) DO NOTHING;

  WITH facets(facet_value, ordinal) AS (
    VALUES ('Setting Up', 1), ('Searching & Finding', 2),
      ('Filtering & Sorting', 3), ('Resetting Password', 4), ('Reporting', 5)
  ),
  flow_steps AS (
    SELECT vi.version_id, vi.source_url, i.id AS image_id,
      ROW_NUMBER() OVER (
        PARTITION BY vi.source_url
        ORDER BY vi.captured_at, i.id
      ) AS step_rank
    FROM version_images vi
    JOIN images i ON i.id = vi.image_id AND i.kind = 'flow_step'
    WHERE vi.version_id = target_version_id
      AND vi.source_url IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM stored_objects so
        WHERE so.object_key = COALESCE(i.thumbnail_object_key, i.object_key)
          AND so.access_class IN ('protected', 'public-preview')
      )
  ),
  flows AS (
    SELECT version_id, source_url,
      DENSE_RANK() OVER (ORDER BY source_url) AS flow_rank
    FROM flow_steps
    GROUP BY version_id, source_url
  ),
  flow_count AS (
    SELECT COUNT(*)::integer AS count FROM flows
  ),
  selected AS (
    SELECT facets.facet_value, flows.version_id, flows.source_url
    FROM facets
    CROSS JOIN flow_count
    JOIN flows
      ON flows.flow_rank = ((facets.ordinal - 1) % NULLIF(flow_count.count, 0)) + 1
  )
  INSERT INTO public_facet_previews (
    version_id, facet_group, facet_value, rank, image_id
  )
  SELECT selected.version_id, 'flows', selected.facet_value,
    flow_steps.step_rank::integer, flow_steps.image_id
  FROM selected
  JOIN flow_steps
    ON flow_steps.version_id = selected.version_id
   AND flow_steps.source_url = selected.source_url
  WHERE flow_steps.step_rank <= 3
  ON CONFLICT (version_id, facet_group, facet_value, rank) DO NOTHING;
END;
$$;

SET LOCAL statement_timeout = '5min';

WITH facets(facet_value, ordinal) AS (
  VALUES ('Filter & Sort', 1), ('Chat Bot', 2), ('Signup', 3),
    ('Settings & Preferences', 4), ('Charts', 5)
),
media AS (
  SELECT vi.version_id, i.id AS image_id,
    ROW_NUMBER() OVER (
      PARTITION BY vi.version_id
      ORDER BY vi.captured_at DESC NULLS LAST, i.id DESC
    ) AS ordinal
  FROM app_versions av
  JOIN version_images vi ON vi.version_id = av.id
  JOIN images i ON i.id = vi.image_id AND i.kind = 'screen'
  WHERE av.status = 'published'
    AND EXISTS (
      SELECT 1 FROM stored_objects so
      WHERE so.object_key = COALESCE(i.thumbnail_object_key, i.object_key)
        AND so.access_class IN ('protected', 'public-preview')
    )
)
INSERT INTO public_facet_previews (
  version_id, facet_group, facet_value, rank, image_id
)
SELECT media.version_id, 'screens', facets.facet_value, 1, media.image_id
FROM media
JOIN facets ON facets.ordinal = media.ordinal
WHERE media.ordinal <= 5
ON CONFLICT (version_id, facet_group, facet_value, rank) DO NOTHING;

WITH facets(facet_value, ordinal) AS (
  VALUES ('Navigation Menu', 1), ('Dialog', 2), ('Card', 3),
    ('Dropdown Menu', 4), ('Text Field', 5)
),
media AS (
  SELECT vi.version_id, i.id AS image_id,
    ROW_NUMBER() OVER (
      PARTITION BY vi.version_id
      ORDER BY vi.captured_at DESC NULLS LAST, i.id DESC
    ) AS ordinal
  FROM app_versions av
  JOIN version_images vi ON vi.version_id = av.id
  JOIN images i ON i.id = vi.image_id AND i.kind = 'ui_element'
  WHERE av.status = 'published'
    AND EXISTS (
      SELECT 1 FROM stored_objects so
      WHERE so.object_key = COALESCE(i.thumbnail_object_key, i.object_key)
        AND so.access_class IN ('protected', 'public-preview')
    )
)
INSERT INTO public_facet_previews (
  version_id, facet_group, facet_value, rank, image_id
)
SELECT media.version_id, 'elements', facets.facet_value, 1, media.image_id
FROM media
JOIN facets ON facets.ordinal = media.ordinal
WHERE media.ordinal <= 5
ON CONFLICT (version_id, facet_group, facet_value, rank) DO NOTHING;

WITH facets(facet_value, ordinal) AS (
  VALUES ('Setting Up', 1), ('Searching & Finding', 2),
    ('Filtering & Sorting', 3), ('Resetting Password', 4), ('Reporting', 5)
),
flow_steps AS (
  SELECT vi.version_id, vi.source_url, i.id AS image_id,
    ROW_NUMBER() OVER (
      PARTITION BY vi.version_id, vi.source_url
      ORDER BY vi.captured_at, i.id
    ) AS step_rank
  FROM app_versions av
  JOIN version_images vi ON vi.version_id = av.id
  JOIN images i ON i.id = vi.image_id AND i.kind = 'flow_step'
  WHERE av.status = 'published'
    AND vi.source_url IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM stored_objects so
      WHERE so.object_key = COALESCE(i.thumbnail_object_key, i.object_key)
        AND so.access_class IN ('protected', 'public-preview')
    )
),
flows AS (
  SELECT version_id, source_url,
    DENSE_RANK() OVER (
      PARTITION BY version_id
      ORDER BY source_url
    ) AS flow_rank
  FROM flow_steps
  GROUP BY version_id, source_url
),
flow_counts AS (
  SELECT version_id, COUNT(*)::integer AS count
  FROM flows
  GROUP BY version_id
),
selected AS (
  SELECT facets.facet_value, flows.version_id, flows.source_url
  FROM facets
  CROSS JOIN flow_counts
  JOIN flows
    ON flows.version_id = flow_counts.version_id
   AND flows.flow_rank = ((facets.ordinal - 1) % flow_counts.count) + 1
)
INSERT INTO public_facet_previews (
  version_id, facet_group, facet_value, rank, image_id
)
SELECT selected.version_id, 'flows', selected.facet_value,
  flow_steps.step_rank::integer, flow_steps.image_id
FROM selected
JOIN flow_steps
  ON flow_steps.version_id = selected.version_id
 AND flow_steps.source_url = selected.source_url
WHERE flow_steps.step_rank <= 3
ON CONFLICT (version_id, facet_group, facet_value, rank) DO NOTHING;

CREATE OR REPLACE FUNCTION refresh_public_facet_previews_on_publish()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM refresh_public_facet_previews(NEW.id);
  PERFORM fill_public_facet_preview_fallbacks(NEW.id);
  RETURN NEW;
END;
$$;
