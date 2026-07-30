ALTER TABLE site_versions
  ADD COLUMN catalog_snapshot JSONB
    CHECK (jsonb_typeof(catalog_snapshot) = 'object');

CREATE OR REPLACE FUNCTION populate_site_version_catalog_snapshot()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.catalog_snapshot IS NULL
    OR NEW.catalog_snapshot = '{}'::jsonb
    OR NOT (NEW.catalog_snapshot ?& ARRAY[
      'name', 'slug', 'sourceUrl', 'description', 'logoUrl',
      'categories', 'categoriesNormalized',
      'styles', 'stylesNormalized', 'popularity'
    ])
  THEN
    SELECT jsonb_build_object(
      'name', s.name,
      'slug', s.slug,
      'sourceUrl', s.source_url,
      'description', s.description,
      'logoUrl', s.logo_url,
      'categories', s.categories,
      'categoriesNormalized', (
        SELECT COALESCE(
          jsonb_agg(lower(value) ORDER BY ordinal),
          '[]'::jsonb
        )
        FROM jsonb_array_elements_text(s.categories)
          WITH ORDINALITY AS category_value(value, ordinal)
      ),
      'styles', s.styles,
      'stylesNormalized', (
        SELECT COALESCE(
          jsonb_agg(lower(value) ORDER BY ordinal),
          '[]'::jsonb
        )
        FROM jsonb_array_elements_text(s.styles)
          WITH ORDINALITY AS style_value(value, ordinal)
      ),
      'popularity', s.popularity
    )
    INTO NEW.catalog_snapshot
    FROM sites s
    WHERE s.id = NEW.site_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER site_versions_catalog_snapshot
BEFORE INSERT OR UPDATE ON site_versions
FOR EACH ROW EXECUTE FUNCTION populate_site_version_catalog_snapshot();

UPDATE site_versions sv
SET catalog_snapshot = jsonb_build_object(
  'name', s.name,
  'slug', s.slug,
  'sourceUrl', s.source_url,
  'description', s.description,
  'logoUrl', s.logo_url,
  'categories', s.categories,
  'categoriesNormalized', (
    SELECT COALESCE(
      jsonb_agg(lower(value) ORDER BY ordinal),
      '[]'::jsonb
    )
    FROM jsonb_array_elements_text(s.categories)
      WITH ORDINALITY AS category_value(value, ordinal)
  ),
  'styles', s.styles,
  'stylesNormalized', (
    SELECT COALESCE(
      jsonb_agg(lower(value) ORDER BY ordinal),
      '[]'::jsonb
    )
    FROM jsonb_array_elements_text(s.styles)
      WITH ORDINALITY AS style_value(value, ordinal)
  ),
  'popularity', s.popularity
)
FROM sites s
WHERE s.id = sv.site_id;

ALTER TABLE site_versions
  ALTER COLUMN catalog_snapshot SET NOT NULL,
  ALTER COLUMN catalog_snapshot DROP DEFAULT,
  ADD CONSTRAINT site_versions_catalog_snapshot_complete CHECK (
    catalog_snapshot <> '{}'::jsonb
    AND catalog_snapshot ?& ARRAY[
      'name', 'slug', 'sourceUrl', 'description', 'logoUrl',
      'categories', 'categoriesNormalized',
      'styles', 'stylesNormalized', 'popularity'
    ]
    AND jsonb_typeof(catalog_snapshot->'name') = 'string'
    AND jsonb_typeof(catalog_snapshot->'slug') = 'string'
    AND jsonb_typeof(catalog_snapshot->'sourceUrl') = 'string'
    AND (
      jsonb_typeof(catalog_snapshot->'description') = 'string'
      OR catalog_snapshot->'description' = 'null'::jsonb
    )
    AND (
      jsonb_typeof(catalog_snapshot->'logoUrl') = 'string'
      OR catalog_snapshot->'logoUrl' = 'null'::jsonb
    )
    AND jsonb_typeof(catalog_snapshot->'categories') = 'array'
    AND jsonb_typeof(catalog_snapshot->'categoriesNormalized') = 'array'
    AND jsonb_typeof(catalog_snapshot->'styles') = 'array'
    AND jsonb_typeof(catalog_snapshot->'stylesNormalized') = 'array'
    AND jsonb_typeof(catalog_snapshot->'popularity') = 'number'
    AND (catalog_snapshot->>'popularity')::numeric >= 0
  );

CREATE INDEX site_versions_catalog_ready_idx
  ON site_versions (site_id, is_latest DESC, updated_at DESC, id DESC)
  INCLUDE (catalog_snapshot)
  WHERE status = 'ready';

CREATE INDEX site_versions_catalog_categories_normalized_gin_idx
  ON site_versions USING gin ((catalog_snapshot->'categoriesNormalized'))
  WHERE status = 'ready';

CREATE INDEX site_versions_catalog_styles_normalized_gin_idx
  ON site_versions USING gin ((catalog_snapshot->'stylesNormalized'))
  WHERE status = 'ready';

CREATE INDEX site_pages_version_title_idx
  ON site_pages (version_id, title);

CREATE INDEX site_sections_patterns_gin_idx
  ON site_sections USING gin ((source_metadata->'patterns'));
