SET LOCAL statement_timeout = '30min';

CREATE TABLE published_screen_search_documents (
  version_id INTEGER NOT NULL REFERENCES app_versions(id) ON DELETE CASCADE,
  image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  search_text TEXT NOT NULL,
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english', search_text)
  ) STORED,
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (version_id, image_id)
);

CREATE OR REPLACE FUNCTION refresh_published_screen_search_version(target_version_id INTEGER)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  target_app_id INTEGER;
  target_platform TEXT;
  target_status TEXT;
  target_version_number INTEGER;
BEGIN
  SELECT app_id, platform, status, version_number
  INTO target_app_id, target_platform, target_status, target_version_number
  FROM app_versions
  WHERE id = target_version_id;

  IF target_app_id IS NULL THEN
    RETURN;
  END IF;

  IF target_status <> 'published' OR EXISTS (
    SELECT 1
    FROM app_versions newer
    WHERE newer.app_id = target_app_id
      AND newer.platform = target_platform
      AND newer.status = 'published'
      AND newer.version_number > target_version_number
  ) THEN
    DELETE FROM published_screen_search_documents
    WHERE version_id = target_version_id;
    RETURN;
  END IF;

  DELETE FROM published_screen_search_documents document
  USING app_versions version
  WHERE document.version_id = version.id
    AND version.app_id = target_app_id
    AND version.platform = target_platform;

  INSERT INTO published_screen_search_documents (
    version_id, image_id, search_text
  )
  SELECT
    target_version_id,
    image.id,
    concat_ws(' ',
      app.name,
      app.display_name,
      target_platform,
      image.description,
      image.analysis->>'description',
      image.analysis->>'purpose',
      image.analysis->>'pageType',
      image.analysis->>'productArea',
      image.analysis->>'componentNames',
      image.analysis->>'visibleText',
      image.analysis->>'visibleStates',
      image.analysis->>'layoutPatterns',
      image.analysis->>'interactionPatterns'
    )
  FROM version_images version_image
  JOIN images image ON image.id = version_image.image_id
  JOIN apps app ON app.id = target_app_id
  WHERE version_image.version_id = target_version_id
    AND image.kind = 'screen'
    AND (
      image.analysis IS NOT NULL
      OR NULLIF(btrim(image.description), '') IS NOT NULL
    );
END;
$$;

CREATE OR REPLACE FUNCTION upsert_published_screen_search_document(
  target_version_id INTEGER,
  target_image_id INTEGER
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM published_screen_search_documents
  WHERE version_id = target_version_id AND image_id = target_image_id;

  INSERT INTO published_screen_search_documents (
    version_id, image_id, search_text
  )
  SELECT
    version.id,
    image.id,
    concat_ws(' ',
      app.name,
      app.display_name,
      version.platform,
      image.description,
      image.analysis->>'description',
      image.analysis->>'purpose',
      image.analysis->>'pageType',
      image.analysis->>'productArea',
      image.analysis->>'componentNames',
      image.analysis->>'visibleText',
      image.analysis->>'visibleStates',
      image.analysis->>'layoutPatterns',
      image.analysis->>'interactionPatterns'
    )
  FROM app_versions version
  JOIN apps app ON app.id = version.app_id
  JOIN version_images version_image
    ON version_image.version_id = version.id
   AND version_image.image_id = target_image_id
  JOIN images image ON image.id = version_image.image_id
  WHERE version.id = target_version_id
    AND version.status = 'published'
    AND image.kind = 'screen'
    AND (
      image.analysis IS NOT NULL
      OR NULLIF(btrim(image.description), '') IS NOT NULL
    )
    AND NOT EXISTS (
      SELECT 1
      FROM app_versions newer
      WHERE newer.app_id = version.app_id
        AND newer.platform = version.platform
        AND newer.status = 'published'
        AND newer.version_number > version.version_number
    )
  ON CONFLICT (version_id, image_id) DO UPDATE
  SET search_text = EXCLUDED.search_text,
      indexed_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION refresh_published_screen_search_from_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM published_screen_search_documents WHERE version_id = OLD.id;
    RETURN OLD;
  END IF;
  IF NEW.status = 'published' THEN
    PERFORM refresh_published_screen_search_version(NEW.id);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'published' THEN
      PERFORM refresh_published_screen_search_version(NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER app_versions_published_screen_search
AFTER INSERT OR UPDATE OF status ON app_versions
FOR EACH ROW EXECUTE FUNCTION refresh_published_screen_search_from_version();

CREATE OR REPLACE FUNCTION refresh_published_screen_search_from_version_child()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM published_screen_search_documents
    WHERE version_id = OLD.version_id AND image_id = OLD.image_id;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE'
     AND (OLD.version_id <> NEW.version_id OR OLD.image_id <> NEW.image_id) THEN
    DELETE FROM published_screen_search_documents
    WHERE version_id = OLD.version_id AND image_id = OLD.image_id;
  END IF;
  PERFORM upsert_published_screen_search_document(NEW.version_id, NEW.image_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER version_images_published_screen_search
AFTER INSERT OR UPDATE OR DELETE ON version_images
FOR EACH ROW EXECUTE FUNCTION refresh_published_screen_search_from_version_child();

CREATE OR REPLACE FUNCTION refresh_published_screen_search_from_image()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_version_id INTEGER;
BEGIN
  FOR target_version_id IN
    SELECT version_image.version_id
    FROM version_images version_image
    WHERE version_image.image_id = NEW.id
  LOOP
    PERFORM upsert_published_screen_search_document(target_version_id, NEW.id);
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER images_published_screen_search
AFTER UPDATE OF description, analysis, kind ON images
FOR EACH ROW EXECUTE FUNCTION refresh_published_screen_search_from_image();

DO $$
DECLARE
  target_version_id INTEGER;
BEGIN
  FOR target_version_id IN
    SELECT DISTINCT ON (app_id, platform) id
    FROM app_versions
    WHERE status = 'published'
    ORDER BY app_id, platform, version_number DESC
  LOOP
    PERFORM refresh_published_screen_search_version(target_version_id);
  END LOOP;
END;
$$;

CREATE INDEX published_screen_search_documents_fts_idx
  ON published_screen_search_documents USING GIN (search_vector);
CREATE INDEX published_screen_search_documents_image_idx
  ON published_screen_search_documents (image_id, version_id);
