ALTER TABLE color_palettes
  ADD COLUMN kind TEXT NOT NULL DEFAULT 'solid'
  CHECK (kind IN ('solid', 'gradient'));

ALTER TABLE color_palette_colors
  ADD COLUMN gradient_angle SMALLINT CHECK (gradient_angle BETWEEN 0 AND 359),
  ADD COLUMN gradient_end_hex TEXT CHECK (gradient_end_hex ~ '^#[0-9A-F]{6}$'),
  ADD CONSTRAINT color_palette_gradient_complete CHECK (
    (gradient_angle IS NULL AND gradient_end_hex IS NULL)
    OR (gradient_angle IS NOT NULL AND gradient_end_hex IS NOT NULL)
  );

INSERT INTO color_palettes (id, name, mood, kind, position) VALUES
  ('velvet-aurora', 'Velvet Aurora', 'Obsidian warmth dissolving into cinematic plum', 'gradient', 53),
  ('coastal-shift', 'Coastal Shift', 'Deep water moving toward clear polar light', 'gradient', 54),
  ('solar-grove', 'Solar Grove', 'Botanical shadow warmed by late-afternoon citrus', 'gradient', 55),
  ('rose-flux', 'Rose Flux', 'Editorial rose moving from nocturne to petal light', 'gradient', 56),
  ('desert-dawn', 'Desert Dawn', 'Earthen depth opening into sunlit linen', 'gradient', 57),
  ('arctic-pulse', 'Arctic Pulse', 'Digital blue shifting from midnight to atmospheric ice', 'gradient', 58);

INSERT INTO color_palette_colors
  (palette_id, id, name, hex, foreground, role, position, gradient_angle, gradient_end_hex)
VALUES
  ('velvet-aurora', 'midnight-bloom-gradient', 'Midnight Bloom', '#151311', '#F2D7E5', 'lead', 1, 135, '#3A1F2D'),
  ('velvet-aurora', 'orchid-current-gradient', 'Orchid Current', '#4B262F', '#FFFFFF', 'accent', 2, 145, '#773389'),
  ('velvet-aurora', 'almond-haze-gradient', 'Almond Haze', '#EED3BA', '#151311', 'companion', 3, 155, '#F2D7E5'),
  ('coastal-shift', 'harbor-depth-gradient', 'Harbor Depth', '#0B1F33', '#D9F4FF', 'lead', 1, 135, '#102A43'),
  ('coastal-shift', 'tidal-current-gradient', 'Tidal Current', '#174C55', '#FFFFFF', 'accent', 2, 145, '#2C7A7B'),
  ('coastal-shift', 'seafoam-sky-gradient', 'Seafoam Sky', '#D9F0EE', '#102A43', 'companion', 3, 155, '#D9F4FF'),
  ('solar-grove', 'forest-ember-gradient', 'Forest Ember', '#24352B', '#F9E3B6', 'lead', 1, 135, '#3B2115'),
  ('solar-grove', 'citrus-heat-gradient', 'Citrus Heat', '#713019', '#FFFFFF', 'accent', 2, 145, '#9A451F'),
  ('solar-grove', 'lemon-canvas-gradient', 'Lemon Canvas', '#F4D7A1', '#24352B', 'companion', 3, 155, '#F9E3B6'),
  ('rose-flux', 'plum-night-gradient', 'Plum Night', '#2B1830', '#F2D7E5', 'lead', 1, 135, '#3A1F2D'),
  ('rose-flux', 'peony-signal-gradient', 'Peony Signal', '#773389', '#FFFFFF', 'accent', 2, 145, '#8F3F70'),
  ('rose-flux', 'petal-glow-gradient', 'Petal Glow', '#F1D6E9', '#2B1830', 'companion', 3, 155, '#F2D7E5'),
  ('desert-dawn', 'cocoa-night-gradient', 'Cocoa Night', '#2A1B17', '#F5E0C3', 'lead', 1, 135, '#3C2A21'),
  ('desert-dawn', 'clay-ember-gradient', 'Clay Ember', '#71351F', '#FFFFFF', 'accent', 2, 145, '#934A27'),
  ('desert-dawn', 'linen-sand-gradient', 'Linen Sand', '#EED3BA', '#3C2A21', 'companion', 3, 155, '#F5E0C3'),
  ('arctic-pulse', 'night-signal-gradient', 'Night Signal', '#0B1F33', '#D9F4FF', 'lead', 1, 135, '#11162C'),
  ('arctic-pulse', 'glacier-cobalt-gradient', 'Glacier Cobalt', '#164B78', '#FFFFFF', 'accent', 2, 145, '#3157D5'),
  ('arctic-pulse', 'polar-halo-gradient', 'Polar Halo', '#D9F4FF', '#11162C', 'companion', 3, 155, '#DCE4FF');
