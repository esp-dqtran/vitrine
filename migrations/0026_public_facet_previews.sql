CREATE TABLE public_facet_previews (
  version_id INTEGER NOT NULL REFERENCES app_versions(id) ON DELETE CASCADE,
  facet_group TEXT NOT NULL CHECK (facet_group IN ('screens', 'elements', 'flows')),
  facet_value TEXT NOT NULL,
  rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 3),
  image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  PRIMARY KEY (version_id, facet_group, facet_value, rank)
);

CREATE INDEX public_facet_previews_lookup_idx
  ON public_facet_previews (facet_group, facet_value, version_id, rank);

CREATE OR REPLACE FUNCTION refresh_public_facet_previews(target_version_id INTEGER)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public_facet_previews WHERE version_id = target_version_id;

  WITH facets(facet_value) AS (
    VALUES ('Filter & Sort'), ('Chat Bot'), ('Signup'),
      ('Settings & Preferences'), ('Charts')
  ),
  ranked AS (
    SELECT vi.version_id, facets.facet_value, i.id AS image_id,
      ROW_NUMBER() OVER (
        PARTITION BY facets.facet_value
        ORDER BY vi.captured_at DESC NULLS LAST, i.id DESC
      ) AS rank
    FROM version_images vi
    JOIN images i ON i.id = vi.image_id AND i.kind = 'screen'
    CROSS JOIN facets
    WHERE vi.version_id = target_version_id
      AND lower(concat_ws(' ', i.description, i.analysis->>'pageType',
        i.analysis->>'productArea', i.analysis->>'visibleStates'))
        LIKE '%' || lower(facets.facet_value) || '%'
      AND EXISTS (
        SELECT 1 FROM stored_objects so
        WHERE so.object_key = COALESCE(i.thumbnail_object_key, i.object_key)
          AND so.access_class IN ('protected', 'public-preview')
      )
  )
  INSERT INTO public_facet_previews (
    version_id, facet_group, facet_value, rank, image_id
  )
  SELECT version_id, 'screens', facet_value, rank::integer, image_id
  FROM ranked
  WHERE rank = 1;

  WITH facets(facet_value) AS (
    VALUES ('Navigation Menu'), ('Dialog'), ('Card'), ('Dropdown Menu'),
      ('Text Field')
  ),
  ranked AS (
    SELECT vi.version_id, facets.facet_value, i.id AS image_id,
      ROW_NUMBER() OVER (
        PARTITION BY facets.facet_value
        ORDER BY vi.captured_at DESC NULLS LAST, i.id DESC
      ) AS rank
    FROM version_images vi
    JOIN images i ON i.id = vi.image_id AND i.kind = 'ui_element'
    CROSS JOIN facets
    WHERE vi.version_id = target_version_id
      AND lower(concat_ws(' ', i.description, i.analysis->>'componentNames',
        i.analysis->>'layoutPatterns'))
        LIKE '%' || lower(facets.facet_value) || '%'
      AND EXISTS (
        SELECT 1 FROM stored_objects so
        WHERE so.object_key = COALESCE(i.thumbnail_object_key, i.object_key)
          AND so.access_class IN ('protected', 'public-preview')
      )
  )
  INSERT INTO public_facet_previews (
    version_id, facet_group, facet_value, rank, image_id
  )
  SELECT version_id, 'elements', facet_value, rank::integer, image_id
  FROM ranked
  WHERE rank = 1;

  WITH facets(facet_value) AS (
    VALUES ('Setting Up'), ('Searching & Finding'), ('Filtering & Sorting'),
      ('Resetting Password'), ('Reporting')
  ),
  candidates AS (
    SELECT target_version_id AS version_id, facets.facet_value,
      i.id AS image_id, flow.ordinality AS flow_ordinal,
      step.ordinality AS step_ordinal, evidence.ordinality AS evidence_ordinal
    FROM app_flow_versions afv
    CROSS JOIN LATERAL jsonb_array_elements(afv.flows)
      WITH ORDINALITY AS flow(value, ordinality)
    CROSS JOIN facets
    CROSS JOIN LATERAL jsonb_array_elements(flow.value->'steps')
      WITH ORDINALITY AS step(value, ordinality)
    CROSS JOIN LATERAL jsonb_array_elements_text(
      COALESCE(step.value->'evidence', '[]'::jsonb)
    ) WITH ORDINALITY AS evidence(value, ordinality)
    JOIN version_images vi
      ON vi.version_id = afv.version_id
     AND evidence.value ~ '^[1-9][0-9]*$'
     AND vi.image_id = evidence.value::integer
    JOIN images i ON i.id = vi.image_id AND i.kind IN ('screen', 'flow_step')
    WHERE afv.version_id = target_version_id
      AND lower(concat_ws(' ', flow.value->>'title', flow.value->>'description',
        flow.value->>'tags')) LIKE '%' || lower(facets.facet_value) || '%'
      AND EXISTS (
        SELECT 1 FROM stored_objects so
        WHERE so.object_key = COALESCE(i.thumbnail_object_key, i.object_key)
          AND so.access_class IN ('protected', 'public-preview')
      )
  ),
  deduplicated AS (
    SELECT DISTINCT ON (facet_value, image_id)
      version_id, facet_value, image_id, flow_ordinal, step_ordinal,
      evidence_ordinal
    FROM candidates
    ORDER BY facet_value, image_id, flow_ordinal, step_ordinal, evidence_ordinal
  ),
  ranked AS (
    SELECT version_id, facet_value, image_id,
      ROW_NUMBER() OVER (
        PARTITION BY facet_value
        ORDER BY flow_ordinal, step_ordinal, evidence_ordinal, image_id
      ) AS rank
    FROM deduplicated
  )
  INSERT INTO public_facet_previews (
    version_id, facet_group, facet_value, rank, image_id
  )
  SELECT version_id, 'flows', facet_value, rank::integer, image_id
  FROM ranked
  WHERE rank <= 3;
END;
$$;

WITH facets(facet_value) AS (
  VALUES ('Filter & Sort'), ('Chat Bot'), ('Signup'),
    ('Settings & Preferences'), ('Charts')
),
ranked AS (
  SELECT vi.version_id, facets.facet_value, i.id AS image_id,
    ROW_NUMBER() OVER (
      PARTITION BY vi.version_id, facets.facet_value
      ORDER BY vi.captured_at DESC NULLS LAST, i.id DESC
    ) AS rank
  FROM app_versions av
  JOIN version_images vi ON vi.version_id = av.id
  JOIN images i ON i.id = vi.image_id AND i.kind = 'screen'
  CROSS JOIN facets
  WHERE av.status = 'published'
    AND lower(concat_ws(' ', i.description, i.analysis->>'pageType',
      i.analysis->>'productArea', i.analysis->>'visibleStates'))
      LIKE '%' || lower(facets.facet_value) || '%'
    AND EXISTS (
      SELECT 1 FROM stored_objects so
      WHERE so.object_key = COALESCE(i.thumbnail_object_key, i.object_key)
        AND so.access_class IN ('protected', 'public-preview')
    )
)
INSERT INTO public_facet_previews (
  version_id, facet_group, facet_value, rank, image_id
)
SELECT version_id, 'screens', facet_value, rank::integer, image_id
FROM ranked
WHERE rank = 1;

WITH facets(facet_value) AS (
  VALUES ('Navigation Menu'), ('Dialog'), ('Card'), ('Dropdown Menu'),
    ('Text Field')
),
ranked AS (
  SELECT vi.version_id, facets.facet_value, i.id AS image_id,
    ROW_NUMBER() OVER (
      PARTITION BY vi.version_id, facets.facet_value
      ORDER BY vi.captured_at DESC NULLS LAST, i.id DESC
    ) AS rank
  FROM app_versions av
  JOIN version_images vi ON vi.version_id = av.id
  JOIN images i ON i.id = vi.image_id AND i.kind = 'ui_element'
  CROSS JOIN facets
  WHERE av.status = 'published'
    AND lower(concat_ws(' ', i.description, i.analysis->>'componentNames',
      i.analysis->>'layoutPatterns'))
      LIKE '%' || lower(facets.facet_value) || '%'
    AND EXISTS (
      SELECT 1 FROM stored_objects so
      WHERE so.object_key = COALESCE(i.thumbnail_object_key, i.object_key)
        AND so.access_class IN ('protected', 'public-preview')
    )
)
INSERT INTO public_facet_previews (
  version_id, facet_group, facet_value, rank, image_id
)
SELECT version_id, 'elements', facet_value, rank::integer, image_id
FROM ranked
WHERE rank = 1;

WITH facets(facet_value) AS (
  VALUES ('Setting Up'), ('Searching & Finding'), ('Filtering & Sorting'),
    ('Resetting Password'), ('Reporting')
),
candidates AS (
  SELECT av.id AS version_id, facets.facet_value, i.id AS image_id,
    flow.ordinality AS flow_ordinal, step.ordinality AS step_ordinal,
    evidence.ordinality AS evidence_ordinal
  FROM app_versions av
  JOIN app_flow_versions afv ON afv.version_id = av.id
  CROSS JOIN LATERAL jsonb_array_elements(afv.flows)
    WITH ORDINALITY AS flow(value, ordinality)
  CROSS JOIN facets
  CROSS JOIN LATERAL jsonb_array_elements(flow.value->'steps')
    WITH ORDINALITY AS step(value, ordinality)
  CROSS JOIN LATERAL jsonb_array_elements_text(
    COALESCE(step.value->'evidence', '[]'::jsonb)
  ) WITH ORDINALITY AS evidence(value, ordinality)
  JOIN version_images vi
    ON vi.version_id = av.id
   AND evidence.value ~ '^[1-9][0-9]*$'
   AND vi.image_id = evidence.value::integer
  JOIN images i ON i.id = vi.image_id AND i.kind IN ('screen', 'flow_step')
  WHERE av.status = 'published'
    AND lower(concat_ws(' ', flow.value->>'title', flow.value->>'description',
      flow.value->>'tags')) LIKE '%' || lower(facets.facet_value) || '%'
    AND EXISTS (
      SELECT 1 FROM stored_objects so
      WHERE so.object_key = COALESCE(i.thumbnail_object_key, i.object_key)
        AND so.access_class IN ('protected', 'public-preview')
    )
),
deduplicated AS (
  SELECT DISTINCT ON (version_id, facet_value, image_id)
    version_id, facet_value, image_id, flow_ordinal, step_ordinal,
    evidence_ordinal
  FROM candidates
  ORDER BY version_id, facet_value, image_id, flow_ordinal, step_ordinal,
    evidence_ordinal
),
ranked AS (
  SELECT version_id, facet_value, image_id,
    ROW_NUMBER() OVER (
      PARTITION BY version_id, facet_value
      ORDER BY flow_ordinal, step_ordinal, evidence_ordinal, image_id
    ) AS rank
  FROM deduplicated
)
INSERT INTO public_facet_previews (
  version_id, facet_group, facet_value, rank, image_id
)
SELECT version_id, 'flows', facet_value, rank::integer, image_id
FROM ranked
WHERE rank <= 3;

CREATE OR REPLACE FUNCTION refresh_public_facet_previews_on_publish()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM refresh_public_facet_previews(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER refresh_public_facet_previews_on_publish
AFTER INSERT OR UPDATE OF status ON app_versions
FOR EACH ROW
WHEN (NEW.status = 'published')
EXECUTE FUNCTION refresh_public_facet_previews_on_publish();
