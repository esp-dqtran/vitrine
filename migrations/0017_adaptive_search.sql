CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE search_documents (
  document_id TEXT NOT NULL,
  index_version INTEGER NOT NULL DEFAULT 1 CHECK (index_version > 0),
  version_id INTEGER NOT NULL REFERENCES app_versions(id) ON DELETE CASCADE,
  app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  app_name TEXT NOT NULL,
  platform TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('app', 'screen', 'flow', 'component', 'pattern')),
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  aliases TEXT[] NOT NULL DEFAULT '{}',
  visible_text TEXT NOT NULL DEFAULT '',
  page_type TEXT,
  product_area TEXT,
  flow_id TEXT,
  flow_name TEXT,
  flow_step_index INTEGER CHECK (flow_step_index IS NULL OR flow_step_index >= 0),
  components TEXT[] NOT NULL DEFAULT '{}',
  states TEXT[] NOT NULL DEFAULT '{}',
  theme TEXT CHECK (theme IS NULL OR theme IN ('light', 'dark', 'mixed')),
  layout_patterns TEXT[] NOT NULL DEFAULT '{}',
  app_category TEXT,
  published_at TIMESTAMPTZ NOT NULL,
  captured_at TIMESTAMPTZ,
  media_image_id INTEGER REFERENCES images(id) ON DELETE SET NULL,
  source_payload JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(source_payload) = 'object'),
  search_text TEXT NOT NULL,
  search_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', search_text)) STORED,
  embedding VECTOR(1536),
  source_revision TEXT NOT NULL,
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (index_version, document_id),
  UNIQUE (index_version, entity_type, source_id)
);

CREATE INDEX search_documents_vector_hnsw_idx
  ON search_documents USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;
CREATE INDEX search_documents_fts_idx ON search_documents USING gin (search_vector);
CREATE INDEX search_documents_type_idx ON search_documents(index_version, entity_type);
CREATE INDEX search_documents_app_idx ON search_documents(index_version, app_id, platform);
CREATE INDEX search_documents_components_idx ON search_documents USING gin (components);
CREATE INDEX search_documents_states_idx ON search_documents USING gin (states);
CREATE INDEX search_documents_layouts_idx ON search_documents USING gin (layout_patterns);
CREATE INDEX search_documents_filters_idx
  ON search_documents(index_version, platform, app_category, page_type, product_area, theme);

CREATE TABLE search_index_queue (
  app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_by TEXT,
  locked_at TIMESTAMPTZ,
  last_error TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (app_id, platform)
);
CREATE INDEX search_index_queue_claim_idx
  ON search_index_queue(status, next_attempt_at, requested_at);

CREATE OR REPLACE FUNCTION enqueue_search_index(target_app_id INTEGER, target_platform TEXT)
RETURNS VOID LANGUAGE sql AS $$
  INSERT INTO search_index_queue (app_id, platform, status, attempts, next_attempt_at, requested_at, updated_at)
  VALUES (target_app_id, target_platform, 'queued', 0, now(), now(), now())
  ON CONFLICT (app_id, platform) DO UPDATE SET
    status = 'queued',
    attempts = 0,
    next_attempt_at = now(),
    locked_by = NULL,
    locked_at = NULL,
    last_error = NULL,
    requested_at = now(),
    updated_at = now();
$$;

CREATE OR REPLACE FUNCTION enqueue_search_from_version()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM enqueue_search_index(OLD.app_id, OLD.platform);
    RETURN OLD;
  END IF;
  PERFORM enqueue_search_index(NEW.app_id, NEW.platform);
  RETURN NEW;
END;
$$;

CREATE TRIGGER app_versions_search_queue
AFTER INSERT OR UPDATE OR DELETE ON app_versions
FOR EACH ROW EXECUTE FUNCTION enqueue_search_from_version();

CREATE OR REPLACE FUNCTION enqueue_search_from_version_child()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  target_version_id INTEGER;
  target_app_id INTEGER;
  target_platform TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_version_id := OLD.version_id;
  ELSE
    target_version_id := NEW.version_id;
  END IF;
  SELECT app_id, platform INTO target_app_id, target_platform FROM app_versions WHERE id = target_version_id;
  IF target_app_id IS NOT NULL THEN
    PERFORM enqueue_search_index(target_app_id, target_platform);
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER version_images_search_queue
AFTER INSERT OR UPDATE OR DELETE ON version_images
FOR EACH ROW EXECUTE FUNCTION enqueue_search_from_version_child();
CREATE TRIGGER design_system_versions_search_queue
AFTER INSERT OR UPDATE OR DELETE ON design_system_versions
FOR EACH ROW EXECUTE FUNCTION enqueue_search_from_version_child();
CREATE TRIGGER app_flow_versions_search_queue
AFTER INSERT OR UPDATE OR DELETE ON app_flow_versions
FOR EACH ROW EXECUTE FUNCTION enqueue_search_from_version_child();

CREATE OR REPLACE FUNCTION enqueue_search_from_image()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  target_image_id INTEGER;
  target RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN target_image_id := OLD.id; ELSE target_image_id := NEW.id; END IF;
  FOR target IN
    SELECT DISTINCT av.app_id, av.platform
    FROM version_images vi JOIN app_versions av ON av.id = vi.version_id
    WHERE vi.image_id = target_image_id AND av.status = 'published'
  LOOP
    PERFORM enqueue_search_index(target.app_id, target.platform);
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER images_search_queue
AFTER UPDATE OF description, analysis, kind ON images
FOR EACH ROW EXECUTE FUNCTION enqueue_search_from_image();

CREATE OR REPLACE FUNCTION enqueue_search_from_app()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  target_platform TEXT;
BEGIN
  FOR target_platform IN SELECT DISTINCT platform FROM app_versions WHERE app_id = NEW.id
  LOOP
    PERFORM enqueue_search_index(NEW.id, target_platform);
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER apps_search_queue
AFTER UPDATE OF name, category ON apps
FOR EACH ROW EXECUTE FUNCTION enqueue_search_from_app();

INSERT INTO search_index_queue (app_id, platform)
SELECT DISTINCT app_id, platform FROM app_versions WHERE status = 'published'
ON CONFLICT (app_id, platform) DO NOTHING;
