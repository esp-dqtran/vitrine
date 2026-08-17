UPDATE color_palettes
SET is_published = FALSE
WHERE id IN (
  'velvet-aurora',
  'coastal-shift',
  'solar-grove',
  'rose-flux',
  'desert-dawn',
  'arctic-pulse'
);
