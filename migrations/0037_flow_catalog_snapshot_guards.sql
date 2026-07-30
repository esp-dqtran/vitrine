CREATE OR REPLACE FUNCTION reject_canonical_flow_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION
    'Published Flow taxonomy is append-only; publish a new App version and canonical Flow row'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER flows_append_only
BEFORE UPDATE OR DELETE ON flows
FOR EACH ROW EXECUTE FUNCTION reject_canonical_flow_mutation();

ALTER TABLE app_versions
  ADD CONSTRAINT app_versions_publication_markers_consistent CHECK (
    (status = 'published') = (published_at IS NOT NULL)
  ) NOT VALID;

CREATE OR REPLACE FUNCTION guard_published_app_version_immutability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.published_at IS NOT NULL OR OLD.status = 'published' THEN
      RAISE EXCEPTION
        'Published App versions are immutable; publish a new App version'
        USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP <> 'INSERT'
    AND (OLD.published_at IS NOT NULL OR OLD.status = 'published')
  THEN
    RAISE EXCEPTION
      'Published App versions are immutable; publish a new App version'
      USING ERRCODE = '55000';
  END IF;

  IF (NEW.status = 'published') IS DISTINCT FROM (NEW.published_at IS NOT NULL) THEN
    RAISE EXCEPTION
      'App version publication status and timestamp must agree'
      USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.published_at IS NOT NULL OR NEW.status = 'published' THEN
      RAISE EXCEPTION
        'Published App versions must use the in-review publication transition'
        USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'published' AND (
    OLD.status <> 'in_review'
    OR NEW.status <> 'published'
    OR NEW.app_id IS DISTINCT FROM OLD.app_id
    OR NEW.platform IS DISTINCT FROM OLD.platform
  ) THEN
    RAISE EXCEPTION
      'Invalid App version publication transition'
      USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER app_versions_published_immutable
BEFORE INSERT OR UPDATE OR DELETE ON app_versions
FOR EACH ROW EXECUTE FUNCTION guard_published_app_version_immutability();

CREATE OR REPLACE FUNCTION reject_published_app_flow_version_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  owner RECORD;
  owner_ids INTEGER[];
BEGIN
  owner_ids := CASE TG_OP
    WHEN 'INSERT' THEN ARRAY[NEW.version_id]
    WHEN 'DELETE' THEN ARRAY[OLD.version_id]
    ELSE ARRAY[OLD.version_id, NEW.version_id]
  END;
  FOR owner IN
    SELECT av.published_at, av.status
    FROM app_versions av
    WHERE av.id = ANY(owner_ids)
    ORDER BY av.id
    FOR SHARE OF av
  LOOP
    IF owner.published_at IS NOT NULL OR owner.status = 'published' THEN
      RAISE EXCEPTION
        'Published Flow versions are immutable; publish a new App version'
        USING ERRCODE = '55000';
    END IF;
  END LOOP;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER app_flow_versions_published_immutable
BEFORE INSERT OR UPDATE OR DELETE ON app_flow_versions
FOR EACH ROW EXECUTE FUNCTION reject_published_app_flow_version_mutation();

CREATE OR REPLACE FUNCTION reject_published_app_flow_mapping_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  owner RECORD;
  flow_version_ids BIGINT[];
BEGIN
  flow_version_ids := CASE TG_OP
    WHEN 'INSERT' THEN ARRAY[NEW.app_flow_version_id]
    WHEN 'DELETE' THEN ARRAY[OLD.app_flow_version_id]
    ELSE ARRAY[OLD.app_flow_version_id, NEW.app_flow_version_id]
  END;
  FOR owner IN
    SELECT av.published_at, av.status
    FROM app_flow_versions afv
    JOIN app_versions av ON av.id = afv.version_id
    WHERE afv.id = ANY(flow_version_ids)
    ORDER BY av.id, afv.id
    FOR SHARE OF av, afv
  LOOP
    IF owner.published_at IS NOT NULL OR owner.status = 'published' THEN
      RAISE EXCEPTION
        'Published Flow mappings are immutable; publish a new App version'
        USING ERRCODE = '55000';
    END IF;
  END LOOP;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER app_flow_version_mappings_published_immutable
BEFORE INSERT OR UPDATE OR DELETE ON app_flow_version_mappings
FOR EACH ROW EXECUTE FUNCTION reject_published_app_flow_mapping_mutation();
