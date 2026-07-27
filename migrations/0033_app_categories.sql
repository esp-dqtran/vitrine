CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
    CHECK (name = btrim(name) AND name <> ''),
  slug TEXT NOT NULL
    CHECK (
      slug = btrim(slug)
      AND slug = lower(slug)
      AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    )
);

CREATE UNIQUE INDEX categories_name_lower_unique
  ON categories (lower(name));

CREATE UNIQUE INDEX categories_slug_lower_unique
  ON categories (lower(slug));

CREATE TABLE app_categories (
  app_id INTEGER NOT NULL
    REFERENCES apps(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL
    REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (app_id, category_id)
);

CREATE INDEX app_categories_category_id_app_id_idx
  ON app_categories (category_id, app_id);

INSERT INTO categories (name, slug)
SELECT category_name,
  trim(BOTH '-' FROM regexp_replace(lower(category_name), '[^a-z0-9]+', '-', 'g'))
FROM (
  SELECT DISTINCT btrim(category) AS category_name
  FROM apps
  WHERE category IS NOT NULL AND btrim(category) <> ''
) existing_categories
ORDER BY lower(category_name), category_name;

INSERT INTO app_categories (app_id, category_id)
SELECT a.id, c.id
FROM apps a
JOIN categories c ON lower(c.name) = lower(btrim(a.category))
WHERE a.category IS NOT NULL AND btrim(a.category) <> ''
ON CONFLICT (app_id, category_id) DO NOTHING;

CREATE OR REPLACE FUNCTION sync_app_category_from_legacy()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  category_name TEXT;
  category_slug TEXT;
  target_category_id INTEGER;
BEGIN
  category_name := btrim(NEW.category);
  IF category_name IS NULL OR category_name = '' THEN RETURN NEW; END IF;
  category_slug := trim(
    BOTH '-' FROM regexp_replace(lower(category_name), '[^a-z0-9]+', '-', 'g')
  );

  SELECT id INTO target_category_id
  FROM categories
  WHERE lower(name) = lower(category_name);

  IF target_category_id IS NULL THEN
    INSERT INTO categories (name, slug)
    VALUES (category_name, category_slug)
    ON CONFLICT DO NOTHING
    RETURNING id INTO target_category_id;
  END IF;

  IF target_category_id IS NULL THEN
    SELECT id INTO target_category_id
    FROM categories
    WHERE lower(name) = lower(category_name);
  END IF;

  IF target_category_id IS NULL THEN
    RAISE EXCEPTION 'legacy app category conflicts with an existing category slug';
  END IF;

  INSERT INTO app_categories (app_id, category_id)
  VALUES (NEW.id, target_category_id)
  ON CONFLICT (app_id, category_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_apps_category_to_relationship
AFTER INSERT OR UPDATE OF category ON apps
FOR EACH ROW EXECUTE FUNCTION sync_app_category_from_legacy();

CREATE OR REPLACE FUNCTION enqueue_search_from_app_category()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  target_app_id INTEGER;
  target_platform TEXT;
BEGIN
  target_app_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.app_id ELSE NEW.app_id END;
  FOR target_platform IN
    SELECT DISTINCT platform FROM app_versions WHERE app_id = target_app_id
  LOOP
    PERFORM enqueue_search_index(target_app_id, target_platform);
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER app_categories_search_queue
AFTER INSERT OR DELETE ON app_categories
FOR EACH ROW EXECUTE FUNCTION enqueue_search_from_app_category();

CREATE OR REPLACE FUNCTION enqueue_search_from_category()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  target_app_id INTEGER;
  target_platform TEXT;
BEGIN
  FOR target_app_id IN
    SELECT app_id FROM app_categories WHERE category_id = NEW.id
  LOOP
    FOR target_platform IN
      SELECT DISTINCT platform FROM app_versions WHERE app_id = target_app_id
    LOOP
      PERFORM enqueue_search_index(target_app_id, target_platform);
    END LOOP;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER categories_search_queue
AFTER UPDATE OF name, slug ON categories
FOR EACH ROW EXECUTE FUNCTION enqueue_search_from_category();

INSERT INTO search_index_queue (app_id, platform)
SELECT DISTINCT av.app_id, av.platform
FROM app_versions av
JOIN app_categories ac ON ac.app_id = av.app_id
WHERE av.status = 'published'
ON CONFLICT (app_id, platform) DO UPDATE SET
  status = 'queued',
  attempts = 0,
  next_attempt_at = now(),
  locked_by = NULL,
  locked_at = NULL,
  last_error = NULL,
  requested_at = now(),
  updated_at = now();
