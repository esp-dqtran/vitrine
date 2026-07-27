LOCK TABLE app_flows, app_flow_versions IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM app_flows WHERE jsonb_typeof(flows) IS DISTINCT FROM 'array'
  ) THEN
    RAISE EXCEPTION 'Legacy app_flows.flows must be JSON arrays';
  END IF;
  IF EXISTS (
    SELECT 1 FROM app_flow_versions
    WHERE jsonb_typeof(flows) IS DISTINCT FROM 'array'
  ) THEN
    RAISE EXCEPTION 'Legacy app_flow_versions.flows must be JSON arrays';
  END IF;
END;
$$;

CREATE TEMP TABLE flow_migration_category_guard AS
SELECT
  (SELECT count(*) FROM categories) AS category_count,
  (SELECT count(*) FROM app_categories) AS assignment_count,
  (
    SELECT md5(COALESCE(
      string_agg(app_id::text || ':' || category_id::text, ',' ORDER BY app_id, category_id),
      ''
    ))
    FROM app_categories
  ) AS assignment_hash;

DROP TRIGGER IF EXISTS app_flow_versions_search_queue ON app_flow_versions;
ALTER TABLE app_flows RENAME CONSTRAINT app_flows_pkey
  TO legacy_app_flows_pkey;
ALTER TABLE app_flow_versions RENAME CONSTRAINT app_flow_versions_pkey
  TO legacy_app_flow_versions_pkey;
ALTER TABLE app_flows RENAME TO legacy_app_flows;
ALTER TABLE app_flow_versions RENAME TO legacy_app_flow_versions;

CREATE TABLE flows (
  id BIGSERIAL PRIMARY KEY,
  parent_id BIGINT REFERENCES flows(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (btrim(name) <> ''),
  normalized_name TEXT NOT NULL CHECK (btrim(normalized_name) <> ''),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE UNIQUE INDEX flows_root_name_unique
  ON flows (normalized_name)
  WHERE parent_id IS NULL;
CREATE UNIQUE INDEX flows_child_name_unique
  ON flows (parent_id, normalized_name)
  WHERE parent_id IS NOT NULL;
CREATE INDEX flows_parent_idx ON flows (parent_id, name);

CREATE TABLE app_flows (
  id BIGSERIAL PRIMARY KEY,
  app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  source_flow_id TEXT NOT NULL CHECK (btrim(source_flow_id) <> ''),
  position INTEGER NOT NULL CHECK (position > 0),
  title TEXT NOT NULL CHECK (btrim(title) <> ''),
  source_category TEXT,
  description TEXT NOT NULL,
  tags JSONB NOT NULL CHECK (jsonb_typeof(tags) = 'array'),
  steps JSONB NOT NULL CHECK (jsonb_typeof(steps) = 'array'),
  provenance JSONB,
  insights JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (app_id, platform, source_flow_id),
  UNIQUE (app_id, platform, position)
);

CREATE INDEX app_flows_scope_position_idx
  ON app_flows (app_id, platform, position);

CREATE TABLE app_flow_mappings (
  app_flow_id BIGINT NOT NULL REFERENCES app_flows(id) ON DELETE CASCADE,
  flow_id BIGINT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  PRIMARY KEY (app_flow_id, flow_id)
);
CREATE INDEX app_flow_mappings_flow_idx
  ON app_flow_mappings (flow_id, app_flow_id);

CREATE TABLE app_flow_versions (
  id BIGSERIAL PRIMARY KEY,
  version_id INTEGER NOT NULL REFERENCES app_versions(id) ON DELETE CASCADE,
  source_flow_id TEXT NOT NULL CHECK (btrim(source_flow_id) <> ''),
  position INTEGER NOT NULL CHECK (position > 0),
  title TEXT NOT NULL CHECK (btrim(title) <> ''),
  source_category TEXT,
  description TEXT NOT NULL,
  tags JSONB NOT NULL CHECK (jsonb_typeof(tags) = 'array'),
  steps JSONB NOT NULL CHECK (jsonb_typeof(steps) = 'array'),
  provenance JSONB,
  insights JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (version_id, source_flow_id),
  UNIQUE (version_id, position)
);

CREATE INDEX app_flow_versions_version_position_idx
  ON app_flow_versions (version_id, position);

CREATE TABLE app_flow_version_mappings (
  app_flow_version_id BIGINT NOT NULL
    REFERENCES app_flow_versions(id) ON DELETE CASCADE,
  flow_id BIGINT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  PRIMARY KEY (app_flow_version_id, flow_id)
);
CREATE INDEX app_flow_version_mappings_flow_idx
  ON app_flow_version_mappings (flow_id, app_flow_version_id);

CREATE TEMP TABLE flow_migration_rows (
  source_kind TEXT NOT NULL CHECK (source_kind IN ('current', 'version')),
  app_id INTEGER NOT NULL,
  platform TEXT NOT NULL,
  version_id INTEGER,
  source_flow_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  source_category TEXT,
  normalized_title TEXT NOT NULL,
  normalized_category TEXT,
  description TEXT NOT NULL,
  tags JSONB NOT NULL,
  steps JSONB NOT NULL,
  provenance JSONB,
  insights JSONB,
  source_timestamp TIMESTAMPTZ NOT NULL
) ON COMMIT DROP;

INSERT INTO flow_migration_rows (
  source_kind, app_id, platform, version_id, source_flow_id, position,
  title, source_category, normalized_title, normalized_category,
  description, tags, steps, provenance, insights, source_timestamp
)
SELECT
  'current', legacy.app_id, legacy.platform, NULL,
  item.value->>'id', item.position::integer,
  item.value->>'title',
  CASE
    WHEN NULLIF(btrim(item.value->>'category'), '') IS NULL THEN NULL
    ELSE item.value->>'category'
  END,
  lower(regexp_replace(btrim(item.value->>'title'), '[[:space:]]+', ' ', 'g')),
  CASE
    WHEN NULLIF(btrim(item.value->>'category'), '') IS NULL THEN NULL
    ELSE lower(regexp_replace(
      btrim(item.value->>'category'), '[[:space:]]+', ' ', 'g'
    ))
  END,
  item.value->>'description',
  item.value->'tags',
  item.value->'steps',
  item.value->'provenance',
  item.value->'insights',
  legacy.updated_at
FROM legacy_app_flows legacy
CROSS JOIN LATERAL jsonb_array_elements(legacy.flows)
  WITH ORDINALITY AS item(value, position);

INSERT INTO flow_migration_rows (
  source_kind, app_id, platform, version_id, source_flow_id, position,
  title, source_category, normalized_title, normalized_category,
  description, tags, steps, provenance, insights, source_timestamp
)
SELECT
  'version', version.app_id, version.platform, legacy.version_id,
  item.value->>'id', item.position::integer,
  item.value->>'title',
  CASE
    WHEN NULLIF(btrim(item.value->>'category'), '') IS NULL THEN NULL
    ELSE item.value->>'category'
  END,
  lower(regexp_replace(btrim(item.value->>'title'), '[[:space:]]+', ' ', 'g')),
  CASE
    WHEN NULLIF(btrim(item.value->>'category'), '') IS NULL THEN NULL
    ELSE lower(regexp_replace(
      btrim(item.value->>'category'), '[[:space:]]+', ' ', 'g'
    ))
  END,
  item.value->>'description',
  item.value->'tags',
  item.value->'steps',
  item.value->'provenance',
  item.value->'insights',
  legacy.created_at
FROM legacy_app_flow_versions legacy
JOIN app_versions version ON version.id = legacy.version_id
CROSS JOIN LATERAL jsonb_array_elements(legacy.flows)
  WITH ORDINALITY AS item(value, position);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM flow_migration_rows
    WHERE NULLIF(btrim(source_flow_id), '') IS NULL
       OR NULLIF(btrim(title), '') IS NULL
       OR description IS NULL
       OR jsonb_typeof(tags) IS DISTINCT FROM 'array'
       OR jsonb_typeof(steps) IS DISTINCT FROM 'array'
  ) THEN
    RAISE EXCEPTION 'Flow rows require id, title, description, tag array, and step array';
  END IF;

  IF EXISTS (
    SELECT 1 FROM flow_migration_rows
    WHERE source_kind = 'current'
    GROUP BY app_id, platform, source_flow_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Current flow source IDs must be unique per app and platform';
  END IF;

  IF EXISTS (
    SELECT 1 FROM flow_migration_rows
    WHERE source_kind = 'version'
    GROUP BY version_id, source_flow_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Historical flow source IDs must be unique per version';
  END IF;
END;
$$;

WITH root_candidates AS (
  SELECT
    CASE
      WHEN normalized_category IS NOT NULL
       AND normalized_category <> normalized_title
        THEN regexp_replace(
          btrim(source_category), '[[:space:]]+', ' ', 'g'
        )
      ELSE regexp_replace(btrim(title), '[[:space:]]+', ' ', 'g')
    END AS name,
    CASE
      WHEN normalized_category IS NOT NULL
       AND normalized_category <> normalized_title
        THEN normalized_category
      ELSE normalized_title
    END AS normalized_name
  FROM flow_migration_rows
),
spellings AS (
  SELECT normalized_name, name, count(*) AS occurrence_count
  FROM root_candidates
  GROUP BY normalized_name, name
),
ranked AS (
  SELECT normalized_name, name,
    ROW_NUMBER() OVER (
      PARTITION BY normalized_name
      ORDER BY occurrence_count DESC, name ASC
    ) AS spelling_rank
  FROM spellings
)
INSERT INTO flows (parent_id, name, normalized_name)
SELECT NULL, name, normalized_name
FROM ranked
WHERE spelling_rank = 1;

WITH child_candidates AS (
  SELECT
    normalized_category AS parent_normalized_name,
    normalized_title,
    regexp_replace(btrim(title), '[[:space:]]+', ' ', 'g') AS name
  FROM flow_migration_rows
  WHERE normalized_category IS NOT NULL
    AND normalized_category <> normalized_title
),
spellings AS (
  SELECT parent_normalized_name, normalized_title, name,
    count(*) AS occurrence_count
  FROM child_candidates
  GROUP BY parent_normalized_name, normalized_title, name
),
ranked AS (
  SELECT parent_normalized_name, normalized_title, name,
    ROW_NUMBER() OVER (
      PARTITION BY parent_normalized_name, normalized_title
      ORDER BY occurrence_count DESC, name ASC
    ) AS spelling_rank
  FROM spellings
)
INSERT INTO flows (parent_id, name, normalized_name)
SELECT parent.id, ranked.name, ranked.normalized_title
FROM ranked
JOIN flows parent
  ON parent.parent_id IS NULL
 AND parent.normalized_name = ranked.parent_normalized_name
WHERE ranked.spelling_rank = 1;

INSERT INTO app_flows (
  app_id, platform, source_flow_id, position, title, source_category,
  description, tags, steps, provenance, insights, updated_at
)
SELECT
  app_id, platform, source_flow_id, position, title, source_category,
  description, tags, steps, provenance, insights, source_timestamp
FROM flow_migration_rows
WHERE source_kind = 'current';

INSERT INTO app_flow_mappings (app_flow_id, flow_id)
SELECT app_flow.id, child.id
FROM flow_migration_rows staged
JOIN app_flows app_flow
  ON app_flow.app_id = staged.app_id
 AND app_flow.platform = staged.platform
 AND app_flow.source_flow_id = staged.source_flow_id
JOIN flows parent
  ON parent.parent_id IS NULL
 AND parent.normalized_name = staged.normalized_category
JOIN flows child
  ON child.parent_id = parent.id
 AND child.normalized_name = staged.normalized_title
WHERE staged.source_kind = 'current'
  AND staged.normalized_category IS NOT NULL
  AND staged.normalized_category <> staged.normalized_title;

INSERT INTO app_flow_mappings (app_flow_id, flow_id)
SELECT app_flow.id, root.id
FROM flow_migration_rows staged
JOIN app_flows app_flow
  ON app_flow.app_id = staged.app_id
 AND app_flow.platform = staged.platform
 AND app_flow.source_flow_id = staged.source_flow_id
JOIN flows root
  ON root.parent_id IS NULL
 AND root.normalized_name = staged.normalized_title
WHERE staged.source_kind = 'current'
  AND (
    staged.source_category IS NULL
    OR staged.normalized_category = staged.normalized_title
  );

INSERT INTO app_flow_versions (
  version_id, source_flow_id, position, title, source_category,
  description, tags, steps, provenance, insights, created_at
)
SELECT
  version_id, source_flow_id, position, title, source_category,
  description, tags, steps, provenance, insights, source_timestamp
FROM flow_migration_rows
WHERE source_kind = 'version';

INSERT INTO app_flow_version_mappings (app_flow_version_id, flow_id)
SELECT app_flow_version.id, child.id
FROM flow_migration_rows staged
JOIN app_flow_versions app_flow_version
  ON app_flow_version.version_id = staged.version_id
 AND app_flow_version.source_flow_id = staged.source_flow_id
JOIN flows parent
  ON parent.parent_id IS NULL
 AND parent.normalized_name = staged.normalized_category
JOIN flows child
  ON child.parent_id = parent.id
 AND child.normalized_name = staged.normalized_title
WHERE staged.source_kind = 'version'
  AND staged.normalized_category IS NOT NULL
  AND staged.normalized_category <> staged.normalized_title;

INSERT INTO app_flow_version_mappings (app_flow_version_id, flow_id)
SELECT app_flow_version.id, root.id
FROM flow_migration_rows staged
JOIN app_flow_versions app_flow_version
  ON app_flow_version.version_id = staged.version_id
 AND app_flow_version.source_flow_id = staged.source_flow_id
JOIN flows root
  ON root.parent_id IS NULL
 AND root.normalized_name = staged.normalized_title
WHERE staged.source_kind = 'version'
  AND (
    staged.source_category IS NULL
    OR staged.normalized_category = staged.normalized_title
  );

DO $$
DECLARE
  category_guard RECORD;
BEGIN
  IF (SELECT count(*) FROM app_flows) <>
     (SELECT count(*) FROM flow_migration_rows WHERE source_kind = 'current')
  THEN
    RAISE EXCEPTION 'Current flow row count mismatch';
  END IF;

  IF (SELECT count(*) FROM app_flow_versions) <>
     (SELECT count(*) FROM flow_migration_rows WHERE source_kind = 'version')
  THEN
    RAISE EXCEPTION 'Historical flow row count mismatch';
  END IF;

  IF EXISTS (
    SELECT app_flow_id
    FROM app_flow_mappings
    GROUP BY app_flow_id
    HAVING count(*) <> 1
  ) OR (SELECT count(*) FROM app_flow_mappings) <>
       (SELECT count(*) FROM app_flows)
  THEN
    RAISE EXCEPTION 'Current flow mapping count mismatch';
  END IF;

  IF EXISTS (
    SELECT app_flow_version_id
    FROM app_flow_version_mappings
    GROUP BY app_flow_version_id
    HAVING count(*) <> 1
  ) OR (SELECT count(*) FROM app_flow_version_mappings) <>
       (SELECT count(*) FROM app_flow_versions)
  THEN
    RAISE EXCEPTION 'Historical flow mapping count mismatch';
  END IF;

  IF EXISTS (SELECT 1 FROM flows WHERE parent_id = id) THEN
    RAISE EXCEPTION 'Flow hierarchy contains a self-reference';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM flow_migration_rows staged
    JOIN app_flows migrated
      ON migrated.app_id = staged.app_id
     AND migrated.platform = staged.platform
     AND migrated.source_flow_id = staged.source_flow_id
    WHERE staged.source_kind = 'current'
      AND (
        migrated.position IS DISTINCT FROM staged.position
        OR migrated.title IS DISTINCT FROM staged.title
        OR migrated.source_category IS DISTINCT FROM staged.source_category
        OR migrated.description IS DISTINCT FROM staged.description
        OR migrated.tags IS DISTINCT FROM staged.tags
        OR migrated.steps IS DISTINCT FROM staged.steps
        OR migrated.provenance IS DISTINCT FROM staged.provenance
        OR migrated.insights IS DISTINCT FROM staged.insights
      )
  ) OR EXISTS (
    SELECT 1
    FROM flow_migration_rows staged
    JOIN app_flow_versions migrated
      ON migrated.version_id = staged.version_id
     AND migrated.source_flow_id = staged.source_flow_id
    WHERE staged.source_kind = 'version'
      AND (
        migrated.position IS DISTINCT FROM staged.position
        OR migrated.title IS DISTINCT FROM staged.title
        OR migrated.source_category IS DISTINCT FROM staged.source_category
        OR migrated.description IS DISTINCT FROM staged.description
        OR migrated.tags IS DISTINCT FROM staged.tags
        OR migrated.steps IS DISTINCT FROM staged.steps
        OR migrated.provenance IS DISTINCT FROM staged.provenance
        OR migrated.insights IS DISTINCT FROM staged.insights
      )
  ) THEN
    RAISE EXCEPTION 'Flow content mismatch';
  END IF;

  SELECT * INTO category_guard FROM flow_migration_category_guard;
  IF category_guard.category_count <> (SELECT count(*) FROM categories)
    OR category_guard.assignment_count <> (SELECT count(*) FROM app_categories)
    OR category_guard.assignment_hash <> (
      SELECT md5(COALESCE(
        string_agg(app_id::text || ':' || category_id::text, ',' ORDER BY app_id, category_id),
        ''
      ))
      FROM app_categories
    )
  THEN
    RAISE EXCEPTION 'App category relationships changed during flow migration';
  END IF;
END;
$$;

CREATE TRIGGER app_flow_versions_search_queue
AFTER INSERT OR UPDATE OR DELETE ON app_flow_versions
FOR EACH ROW EXECUTE FUNCTION enqueue_search_from_version_child();

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
      image.id AS image_id, afv.position AS flow_ordinal,
      step.position AS step_ordinal, evidence.position AS evidence_ordinal
    FROM app_flow_versions afv
    CROSS JOIN facets
    CROSS JOIN LATERAL jsonb_array_elements(afv.steps)
      WITH ORDINALITY AS step(value, position)
    CROSS JOIN LATERAL jsonb_array_elements_text(
      COALESCE(step.value->'evidence', '[]'::jsonb)
    ) WITH ORDINALITY AS evidence(value, position)
    JOIN version_images version_image
      ON version_image.version_id = afv.version_id
     AND evidence.value ~ '^[1-9][0-9]*$'
     AND version_image.image_id = evidence.value::integer
    JOIN images image
      ON image.id = version_image.image_id
     AND image.kind IN ('screen', 'flow_step')
    WHERE afv.version_id = target_version_id
      AND lower(concat_ws(' ', afv.title, afv.description, afv.tags::text))
        LIKE '%' || lower(facets.facet_value) || '%'
      AND EXISTS (
        SELECT 1
        FROM stored_objects object
        WHERE object.object_key = COALESCE(
          image.thumbnail_object_key, image.object_key
        )
          AND object.access_class IN ('protected', 'public-preview')
      )
  ),
  deduplicated AS (
    SELECT DISTINCT ON (facet_value, image_id)
      version_id, facet_value, image_id, flow_ordinal, step_ordinal,
      evidence_ordinal
    FROM candidates
    ORDER BY facet_value, image_id, flow_ordinal, step_ordinal,
      evidence_ordinal
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

DROP TABLE legacy_app_flow_versions;
DROP TABLE legacy_app_flows;
