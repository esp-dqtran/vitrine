ALTER TABLE search_documents
  ALTER COLUMN version_id DROP NOT NULL,
  ALTER COLUMN app_id DROP NOT NULL,
  ADD COLUMN catalog_scope TEXT NOT NULL DEFAULT 'apps'
    CHECK (catalog_scope IN ('apps', 'sites')),
  ADD COLUMN catalog_name TEXT,
  ADD COLUMN site_id BIGINT REFERENCES sites(id) ON DELETE CASCADE,
  ADD COLUMN site_version_id BIGINT REFERENCES site_versions(id) ON DELETE CASCADE,
  ADD COLUMN catalog_categories TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN site_sections TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN site_styles TEXT[] NOT NULL DEFAULT '{}';

UPDATE search_documents
SET catalog_name = app_name
WHERE catalog_name IS NULL;

UPDATE search_documents
SET catalog_categories = CASE
  WHEN app_category IS NULL THEN '{}'
  ELSE ARRAY[app_category]
END;

ALTER TABLE search_documents
  ALTER COLUMN catalog_name SET NOT NULL;

ALTER TABLE search_documents
  DROP CONSTRAINT search_documents_entity_type_check;

ALTER TABLE search_documents
  ADD CONSTRAINT search_documents_entity_type_check
    CHECK (entity_type IN ('app', 'site', 'screen', 'flow', 'component', 'pattern'));

ALTER TABLE search_documents
  ADD CONSTRAINT search_documents_source_identity_check CHECK (
    (
      catalog_scope = 'apps'
      AND version_id IS NOT NULL
      AND app_id IS NOT NULL
      AND site_id IS NULL
      AND site_version_id IS NULL
    )
    OR
    (
      catalog_scope = 'sites'
      AND version_id IS NULL
      AND app_id IS NULL
      AND site_id IS NOT NULL
      AND site_version_id IS NOT NULL
    )
  );

CREATE INDEX search_documents_scope_idx
  ON search_documents(index_version, catalog_scope, entity_type);
CREATE INDEX search_documents_site_sections_idx
  ON search_documents USING gin(site_sections);
CREATE INDEX search_documents_site_styles_idx
  ON search_documents USING gin(site_styles);

CREATE TABLE site_search_index_queue (
  site_id BIGINT PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_by TEXT,
  locked_at TIMESTAMPTZ,
  last_error TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX site_search_index_queue_claim_idx
  ON site_search_index_queue(status, next_attempt_at, requested_at);

CREATE OR REPLACE FUNCTION enqueue_site_search_index(target_site_id BIGINT)
RETURNS VOID LANGUAGE sql AS $$
  INSERT INTO site_search_index_queue(site_id)
  VALUES (target_site_id)
  ON CONFLICT (site_id) DO UPDATE SET
    status = 'queued',
    attempts = 0,
    next_attempt_at = now(),
    locked_by = NULL,
    locked_at = NULL,
    last_error = NULL,
    requested_at = now(),
    updated_at = now();
$$;

CREATE OR REPLACE FUNCTION enqueue_site_search_from_version()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  target_site_id BIGINT;
BEGIN
  target_site_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.site_id ELSE NEW.site_id END;
  PERFORM enqueue_site_search_index(target_site_id);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER site_versions_search_queue
AFTER INSERT OR UPDATE OR DELETE ON site_versions
FOR EACH ROW EXECUTE FUNCTION enqueue_site_search_from_version();

CREATE OR REPLACE FUNCTION enqueue_site_search_from_content()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  target_version_id BIGINT;
  target_page_id BIGINT;
  target_site_id BIGINT;
BEGIN
  IF TG_TABLE_NAME = 'site_pages' THEN
    target_version_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.version_id ELSE NEW.version_id END;
  ELSE
    target_page_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.page_id ELSE NEW.page_id END;
    SELECT version_id INTO target_version_id FROM site_pages WHERE id = target_page_id;
  END IF;

  SELECT site_id INTO target_site_id FROM site_versions WHERE id = target_version_id;
  IF target_site_id IS NOT NULL THEN
    PERFORM enqueue_site_search_index(target_site_id);
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER site_pages_search_queue
AFTER INSERT OR UPDATE OR DELETE ON site_pages
FOR EACH ROW EXECUTE FUNCTION enqueue_site_search_from_content();

CREATE TRIGGER site_sections_search_queue
AFTER INSERT OR UPDATE OR DELETE ON site_sections
FOR EACH ROW EXECUTE FUNCTION enqueue_site_search_from_content();

CREATE OR REPLACE FUNCTION enqueue_site_search_from_site()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM enqueue_site_search_index(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER sites_search_queue
AFTER UPDATE OF name, description, categories, styles ON sites
FOR EACH ROW EXECUTE FUNCTION enqueue_site_search_from_site();

INSERT INTO site_search_index_queue(site_id)
SELECT DISTINCT site_id
FROM site_versions
WHERE status = 'ready'
ON CONFLICT (site_id) DO NOTHING;
