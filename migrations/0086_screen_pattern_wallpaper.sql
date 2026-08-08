-- "Wallpaper" identifies phone background and lock-screen presentations. It
-- belongs in the Screen taxonomy so it is filterable independently of an
-- app's product category.
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
  'wallpaper',
  'Wallpaper',
  'Screens that present a phone wallpaper, lock screen, or background image.',
  ARRAY['lock screen', 'phone background', 'background image', 'home screen wallpaper'],
  COALESCE(MAX(pattern.position), 0) + 1
FROM screen_pattern_sections section
LEFT JOIN screen_patterns pattern ON pattern.section_id = section.id
WHERE section.slug = 'content'
GROUP BY section.id
ON CONFLICT (slug) DO NOTHING;
