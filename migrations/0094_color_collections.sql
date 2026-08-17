CREATE TABLE color_collections (
  id TEXT PRIMARY KEY CHECK (id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 100),
  description TEXT NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 280),
  year SMALLINT CHECK (year BETWEEN 2000 AND 2200),
  featured_color_name TEXT CHECK (featured_color_name IS NULL OR length(btrim(featured_color_name)) BETWEEN 1 AND 80),
  featured_hex TEXT CHECK (featured_hex IS NULL OR featured_hex ~ '^#[0-9A-F]{6}$'),
  position SMALLINT NOT NULL UNIQUE CHECK (position > 0),
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE color_collection_palettes (
  collection_id TEXT NOT NULL REFERENCES color_collections(id) ON DELETE CASCADE,
  palette_id TEXT NOT NULL REFERENCES color_palettes(id) ON DELETE CASCADE,
  position SMALLINT NOT NULL CHECK (position > 0),
  PRIMARY KEY (collection_id, palette_id),
  UNIQUE (collection_id, position)
);

CREATE INDEX color_collections_published_position_idx
  ON color_collections (is_published, position);

INSERT INTO color_palettes (id, name, mood, position) VALUES
  ('cobalt-horizon', 'Cobalt Horizon', 'The defining blue of 2026, framed by midnight and light', 13),
  ('cobalt-citrus', 'Cobalt Citrus', 'Confident blue energized by a warm optimistic spark', 14),
  ('cobalt-petal', 'Cobalt Petal', 'Digital confidence softened by expressive editorial pink', 15),
  ('cobalt-mint', 'Cobalt Mint', 'A precise blue balanced by restorative botanical clarity', 16),
  ('cobalt-clay', 'Cobalt Clay', 'Future-facing blue grounded with tactile earthen warmth', 17),
  ('cobalt-graphite', 'Cobalt Graphite', 'A restrained product palette with one unmistakable signal', 18);

INSERT INTO color_palette_colors (palette_id, id, name, hex, foreground, role, position) VALUES
  ('cobalt-horizon', 'future-night', 'Future Night', '#11162C', '#DCE4FF', 'lead', 1),
  ('cobalt-horizon', 'future-cobalt', 'Future Cobalt', '#3157D5', '#FFFFFF', 'accent', 2),
  ('cobalt-horizon', 'cobalt-halo', 'Cobalt Halo', '#DCE4FF', '#11162C', 'companion', 3),
  ('cobalt-citrus', 'cobalt-field', 'Cobalt Field', '#3157D5', '#FFFFFF', 'lead', 1),
  ('cobalt-citrus', 'citrus-metal', 'Citrus Metal', '#E7A824', '#241B08', 'accent', 2),
  ('cobalt-citrus', 'sunlit-pulp', 'Sunlit Pulp', '#FFF0C8', '#29200C', 'companion', 3),
  ('cobalt-petal', 'blue-manuscript', 'Blue Manuscript', '#3157D5', '#FFFFFF', 'lead', 1),
  ('cobalt-petal', 'petal-signal', 'Petal Signal', '#C95D8E', '#24101A', 'accent', 2),
  ('cobalt-petal', 'rose-vellum', 'Rose Vellum', '#F5DCE8', '#321525', 'companion', 3),
  ('cobalt-mint', 'evergreen-code', 'Evergreen Code', '#15372F', '#D8F3E9', 'lead', 1),
  ('cobalt-mint', 'cobalt-current', 'Cobalt Current', '#3157D5', '#FFFFFF', 'accent', 2),
  ('cobalt-mint', 'mint-atmosphere', 'Mint Atmosphere', '#D8F3E9', '#15372F', 'companion', 3),
  ('cobalt-clay', 'cobalt-studio', 'Cobalt Studio', '#3157D5', '#FFFFFF', 'lead', 1),
  ('cobalt-clay', 'kiln-signal', 'Kiln Signal', '#C8623B', '#25110B', 'accent', 2),
  ('cobalt-clay', 'clay-veil', 'Clay Veil', '#F1D4C7', '#3D251D', 'companion', 3),
  ('cobalt-graphite', 'graphite-core', 'Graphite Core', '#171A22', '#D4D7DF', 'lead', 1),
  ('cobalt-graphite', 'cobalt-marker', 'Cobalt Marker', '#3157D5', '#FFFFFF', 'accent', 2),
  ('cobalt-graphite', 'alloy-paper', 'Alloy Paper', '#D4D7DF', '#171A22', 'companion', 3);

INSERT INTO color_collections (
  id,
  name,
  description,
  year,
  featured_color_name,
  featured_hex,
  position
) VALUES (
  'color-of-the-year-2026',
  'Color of the Year 2026',
  'Future Cobalt brings clarity, confidence, and digital optimism to the year ahead.',
  2026,
  'Future Cobalt',
  '#3157D5',
  1
);

INSERT INTO color_collection_palettes (collection_id, palette_id, position) VALUES
  ('color-of-the-year-2026', 'cobalt-horizon', 1),
  ('color-of-the-year-2026', 'cobalt-citrus', 2),
  ('color-of-the-year-2026', 'cobalt-petal', 3),
  ('color-of-the-year-2026', 'cobalt-mint', 4),
  ('color-of-the-year-2026', 'cobalt-clay', 5),
  ('color-of-the-year-2026', 'cobalt-graphite', 6);
