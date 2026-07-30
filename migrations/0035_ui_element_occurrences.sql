CREATE TABLE ui_element_types (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name TEXT NOT NULL UNIQUE CHECK (length(name) BETWEEN 1 AND 120),
  group_name TEXT NOT NULL CHECK (group_name IN ('Control', 'View', 'Overlay', 'Imagery')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO ui_element_types (slug, name, group_name)
VALUES
  ('accordion', 'Accordion', 'Control'),
  ('breadcrumbs', 'Breadcrumbs', 'Control'),
  ('button', 'Button', 'Control'),
  ('checkbox', 'Checkbox', 'Control'),
  ('color-picker', 'Color Picker', 'Control'),
  ('combobox', 'Combobox', 'Control'),
  ('date-picker', 'Date Picker', 'Control'),
  ('editable-text', 'Editable Text', 'Control'),
  ('file-upload', 'File Upload', 'Control'),
  ('floating-action-button', 'Floating Action Button', 'Control'),
  ('link', 'Link', 'Control'),
  ('pagination', 'Pagination', 'Control'),
  ('radio-button', 'Radio Button', 'Control'),
  ('rating-control', 'Rating Control', 'Control'),
  ('search-bar', 'Search Bar', 'Control'),
  ('segmented-control', 'Segmented Control', 'Control'),
  ('select', 'Select', 'Control'),
  ('slider', 'Slider', 'Control'),
  ('stepper', 'Stepper', 'Control'),
  ('switch', 'Switch', 'Control'),
  ('tab', 'Tab', 'Control'),
  ('text-field', 'Text Field', 'Control'),
  ('tile', 'Tile', 'Control'),
  ('time-picker', 'Time Picker', 'Control'),
  ('badge', 'Badge', 'View'),
  ('banner', 'Banner', 'View'),
  ('card', 'Card', 'View'),
  ('carousel', 'Carousel', 'View'),
  ('chip', 'Chip', 'View'),
  ('divider', 'Divider', 'View'),
  ('gallery', 'Gallery', 'View'),
  ('grid-list', 'Grid List', 'View'),
  ('keyboard-key', 'Keyboard Key', 'View'),
  ('loading-indicator', 'Loading Indicator', 'View'),
  ('map-pin', 'Map Pin', 'View'),
  ('progress-indicator', 'Progress Indicator', 'View'),
  ('side-navigation', 'Side Navigation', 'View'),
  ('skeleton', 'Skeleton', 'View'),
  ('stacked-list', 'Stacked List', 'View'),
  ('status-dot', 'Status Dot', 'View'),
  ('table', 'Table', 'View'),
  ('table-of-contents', 'Table of Contents', 'View'),
  ('toolbar', 'Toolbar', 'View'),
  ('top-navigation-bar', 'Top Navigation Bar', 'View'),
  ('tree', 'Tree', 'View'),
  ('coach-marks', 'Coach Marks', 'Overlay'),
  ('context-menu', 'Context Menu', 'Overlay'),
  ('dialog', 'Dialog', 'Overlay'),
  ('drawer', 'Drawer', 'Overlay'),
  ('dropdown-menu', 'Dropdown Menu', 'Overlay'),
  ('full-screen-overlay', 'Full-Screen Overlay', 'Overlay'),
  ('navigation-menu', 'Navigation Menu', 'Overlay'),
  ('popover', 'Popover', 'Overlay'),
  ('toast', 'Toast', 'Overlay'),
  ('tooltip', 'Tooltip', 'Overlay'),
  ('avatar', 'Avatar', 'Imagery'),
  ('icon', 'Icon', 'Imagery'),
  ('illustration', 'Illustration', 'Imagery'),
  ('logo', 'Logo', 'Imagery'),
  ('photo', 'Photo', 'Imagery');

CREATE TABLE ui_element_extractions (
  version_id INTEGER NOT NULL REFERENCES app_versions(id) ON DELETE CASCADE,
  source_image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  screen_image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  provider_model TEXT NOT NULL CHECK (length(provider_model) BETWEEN 1 AND 160),
  prompt_version INTEGER NOT NULL CHECK (prompt_version > 0),
  status TEXT NOT NULL CHECK (status IN ('running', 'complete', 'failed')),
  component_count INTEGER NOT NULL DEFAULT 0 CHECK (component_count >= 0),
  analysis JSONB,
  error_code TEXT,
  analyzed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (version_id, source_image_id, provider_model, prompt_version),
  FOREIGN KEY (version_id, source_image_id)
    REFERENCES version_images(version_id, image_id) ON DELETE CASCADE,
  FOREIGN KEY (version_id, screen_image_id)
    REFERENCES version_images(version_id, image_id) ON DELETE CASCADE
);

CREATE TABLE screen_ui_elements (
  id BIGSERIAL PRIMARY KEY,
  version_id INTEGER NOT NULL REFERENCES app_versions(id) ON DELETE CASCADE,
  screen_image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  source_image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  ui_element_type_id BIGINT NOT NULL REFERENCES ui_element_types(id) ON DELETE RESTRICT,
  cropped_image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE RESTRICT,
  variant TEXT NOT NULL CHECK (length(variant) BETWEEN 1 AND 160),
  purpose TEXT NOT NULL CHECK (length(purpose) BETWEEN 1 AND 1000),
  anatomy TEXT[] NOT NULL DEFAULT '{}',
  visible_states TEXT[] NOT NULL DEFAULT '{}',
  observed_properties TEXT[] NOT NULL DEFAULT '{}',
  region_x DOUBLE PRECISION NOT NULL CHECK (region_x >= 0 AND region_x <= 1),
  region_y DOUBLE PRECISION NOT NULL CHECK (region_y >= 0 AND region_y <= 1),
  region_width DOUBLE PRECISION NOT NULL CHECK (region_width > 0 AND region_width <= 1),
  region_height DOUBLE PRECISION NOT NULL CHECK (region_height > 0 AND region_height <= 1),
  confidence DOUBLE PRECISION NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  provider_model TEXT NOT NULL CHECK (length(provider_model) BETWEEN 1 AND 160),
  prompt_version INTEGER NOT NULL CHECK (prompt_version > 0),
  review_status TEXT NOT NULL CHECK (review_status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (region_x + region_width <= 1),
  CHECK (region_y + region_height <= 1),
  FOREIGN KEY (version_id, screen_image_id)
    REFERENCES version_images(version_id, image_id) ON DELETE CASCADE,
  FOREIGN KEY (version_id, source_image_id)
    REFERENCES version_images(version_id, image_id) ON DELETE CASCADE,
  FOREIGN KEY (version_id, cropped_image_id)
    REFERENCES version_images(version_id, image_id) ON DELETE CASCADE,
  UNIQUE (
    version_id, screen_image_id, ui_element_type_id,
    region_x, region_y, region_width, region_height,
    provider_model, prompt_version
  )
);

CREATE INDEX screen_ui_elements_screen_idx
  ON screen_ui_elements (version_id, screen_image_id, id);
CREATE INDEX screen_ui_elements_type_idx
  ON screen_ui_elements (ui_element_type_id, version_id, id);
CREATE INDEX screen_ui_elements_review_idx
  ON screen_ui_elements (review_status, confidence DESC, id);

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
      AND source.kind = 'ui_element'
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

CREATE TRIGGER validate_screen_ui_element_kinds
BEFORE INSERT OR UPDATE OF screen_image_id, source_image_id, cropped_image_id
ON screen_ui_elements
FOR EACH ROW
EXECUTE FUNCTION enforce_screen_ui_element_kinds();
