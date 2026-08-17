INSERT INTO color_collections (
  id,
  name,
  description,
  year,
  featured_color_name,
  featured_hex,
  position
) VALUES
  (
    'color-of-the-year-2025',
    'Color of the Year 2025',
    'Burnt Citrus pairs creative momentum with natural, tactile confidence.',
    2025,
    'Burnt Citrus',
    '#D85B2A',
    2
  ),
  (
    'color-of-the-year-2024',
    'Color of the Year 2024',
    'Electric Orchid captures expressive technology, nightlife, and editorial imagination.',
    2024,
    'Electric Orchid',
    '#773389',
    3
  ),
  (
    'color-of-the-year-2023',
    'Color of the Year 2023',
    'Tidal Glass reflects composure, renewal, and quietly capable product thinking.',
    2023,
    'Tidal Glass',
    '#2C7A7B',
    4
  ),
  (
    'color-of-the-year-2022',
    'Color of the Year 2022',
    'Almond Hearth restores warmth, material comfort, and enduring human presence.',
    2022,
    'Almond Hearth',
    '#EED3BA',
    5
  );

INSERT INTO color_collection_palettes (collection_id, palette_id, position) VALUES
  ('color-of-the-year-2025', 'citrus-studio', 1),
  ('color-of-the-year-2025', 'solar-clay', 2),
  ('color-of-the-year-2025', 'desert-current', 3),
  ('color-of-the-year-2024', 'violet-afterglow', 1),
  ('color-of-the-year-2024', 'midnight-bloom', 2),
  ('color-of-the-year-2024', 'rose-archive', 3),
  ('color-of-the-year-2023', 'tidal-focus', 1),
  ('color-of-the-year-2023', 'arctic-signal', 2),
  ('color-of-the-year-2023', 'concrete-mint', 3),
  ('color-of-the-year-2022', 'quiet-authority', 1),
  ('color-of-the-year-2022', 'olive-atelier', 2),
  ('color-of-the-year-2022', 'saffron-paper', 3);
