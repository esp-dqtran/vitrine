ALTER TABLE screen_ui_elements
  ADD COLUMN layer TEXT NOT NULL DEFAULT 'whole-screen';

ALTER TABLE screen_ui_elements
  ADD CONSTRAINT screen_ui_elements_layer_check
  CHECK (layer IN ('whole-screen', 'outer-presentation', 'embedded-ui'));

INSERT INTO ui_element_types (slug, name, group_name)
VALUES
  ('logo-wall', 'Logo Wall', 'View'),
  ('hero-image', 'Hero Image', 'Imagery'),
  ('product-image', 'Product Image', 'Imagery')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  group_name = EXCLUDED.group_name,
  updated_at = now();

CREATE OR REPLACE FUNCTION enforce_screen_ui_element_kinds()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM images screen
    JOIN images source ON source.id = NEW.source_image_id
    JOIN images crop ON crop.id = NEW.cropped_image_id
    WHERE screen.id = NEW.screen_image_id
      AND screen.kind = 'screen'
      AND source.kind IN ('screen', 'ui_element')
      AND crop.kind = 'ui_element'
      AND screen.platform_id = source.platform_id
      AND screen.platform_id = crop.platform_id
  ) THEN
    RAISE EXCEPTION 'screen UI element image context mismatch'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
