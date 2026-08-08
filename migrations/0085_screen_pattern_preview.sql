-- "Preview" is a screen-level pattern for store, gallery, and other external
-- presentations of an app. It must not be an app-level category: an app can
-- remain in Utilities, Finance, etc. while individual Screens are previews.
INSERT INTO screen_patterns (
  section_id,
  slug,
  name,
  description,
  aliases,
  position
)
SELECT
  section.id,
  'preview',
  'Preview',
  'Screens prepared to preview an app or feature in a store, gallery, or other external listing.',
  ARRAY['app store', 'app-store', 'store listing', 'product preview', 'marketing preview'],
  COALESCE(MAX(pattern.position), 0) + 1
FROM screen_pattern_sections section
LEFT JOIN screen_patterns pattern ON pattern.section_id = section.id
WHERE section.slug = 'content'
GROUP BY section.id
ON CONFLICT (slug) DO NOTHING;
