CREATE TABLE color_palettes (
  id TEXT PRIMARY KEY CHECK (id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  mood TEXT NOT NULL CHECK (length(btrim(mood)) BETWEEN 1 AND 240),
  position SMALLINT NOT NULL UNIQUE CHECK (position > 0),
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE color_palette_colors (
  palette_id TEXT NOT NULL REFERENCES color_palettes(id) ON DELETE CASCADE,
  id TEXT NOT NULL CHECK (id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  hex TEXT NOT NULL CHECK (hex ~ '^#[0-9A-F]{6}$'),
  foreground TEXT NOT NULL CHECK (foreground ~ '^#[0-9A-F]{6}$'),
  role TEXT NOT NULL CHECK (role IN ('lead', 'accent', 'companion')),
  position SMALLINT NOT NULL CHECK (position BETWEEN 1 AND 3),
  outlined BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (palette_id, id),
  UNIQUE (palette_id, position)
);

CREATE INDEX color_palettes_published_position_idx
  ON color_palettes (is_published, position);

INSERT INTO color_palettes (id, name, mood, position) VALUES
  ('quiet-authority', 'Quiet Authority', 'Deep, intimate, and quietly editorial', 1),
  ('violet-afterglow', 'Violet Afterglow', 'Cinematic violet with an electric pulse', 2),
  ('tidal-focus', 'Tidal Focus', 'Clear, composed, and product-minded', 3),
  ('citrus-studio', 'Citrus Studio', 'Bright energy grounded by botanical depth', 4),
  ('rose-archive', 'Rose Archive', 'Romantic color with editorial restraint', 5),
  ('desert-current', 'Desert Current', 'Warm, tactile, and naturally confident', 6),
  ('arctic-signal', 'Arctic Signal', 'Cool clarity with a precise digital edge', 7),
  ('olive-atelier', 'Olive Atelier', 'Natural restraint with crafted editorial warmth', 8),
  ('solar-clay', 'Solar Clay', 'Sunlit craft with grounded, tactile energy', 9),
  ('midnight-bloom', 'Midnight Bloom', 'Nocturnal romance with a vivid floral charge', 10),
  ('concrete-mint', 'Concrete Mint', 'Architectural calm softened by a fresh signal', 11),
  ('saffron-paper', 'Saffron Paper', 'Optimistic warmth with archival sophistication', 12);

INSERT INTO color_palette_colors (palette_id, id, name, hex, foreground, role, position) VALUES
  ('quiet-authority', 'obsidian-ink', 'Obsidian Ink', '#151311', '#EED3BA', 'lead', 1),
  ('quiet-authority', 'velvet-curfew', 'Velvet Curfew', '#4B262F', '#EED3BA', 'accent', 2),
  ('quiet-authority', 'almond-hearth', 'Almond Hearth', '#EED3BA', '#151311', 'companion', 3),
  ('violet-afterglow', 'nocturne-ink', 'Nocturne Ink', '#1A1231', '#E4D7F0', 'lead', 1),
  ('violet-afterglow', 'electric-orchid', 'Electric Orchid', '#773389', '#E4D7F0', 'accent', 2),
  ('violet-afterglow', 'lilac-veil', 'Lilac Veil', '#E4D7F0', '#1A1231', 'companion', 3),
  ('tidal-focus', 'harbor-ink', 'Harbor Ink', '#102A43', '#D9F0EE', 'lead', 1),
  ('tidal-focus', 'tidal-glass', 'Tidal Glass', '#2C7A7B', '#FFFFFF', 'accent', 2),
  ('tidal-focus', 'seafoam-air', 'Seafoam Air', '#D9F0EE', '#102A43', 'companion', 3),
  ('citrus-studio', 'garden-ink', 'Garden Ink', '#24352B', '#F9E3B6', 'lead', 1),
  ('citrus-studio', 'burnt-citrus', 'Burnt Citrus', '#D85B2A', '#151311', 'accent', 2),
  ('citrus-studio', 'lemon-cream', 'Lemon Cream', '#F9E3B6', '#24352B', 'companion', 3),
  ('rose-archive', 'plum-script', 'Plum Script', '#3A1F2D', '#F2D7E5', 'lead', 1),
  ('rose-archive', 'archive-rose', 'Archive Rose', '#A64D79', '#FFFFFF', 'accent', 2),
  ('rose-archive', 'petal-paper', 'Petal Paper', '#F2D7E5', '#3A1F2D', 'companion', 3),
  ('desert-current', 'cocoa-shadow', 'Cocoa Shadow', '#3C2A21', '#F5E0C3', 'lead', 1),
  ('desert-current', 'terracotta-signal', 'Terracotta Signal', '#C36A2D', '#1C1511', 'accent', 2),
  ('desert-current', 'dune-linen', 'Dune Linen', '#F5E0C3', '#3C2A21', 'companion', 3),
  ('arctic-signal', 'night-current', 'Night Current', '#0B1F33', '#D9F4FF', 'lead', 1),
  ('arctic-signal', 'glacier-signal', 'Glacier Signal', '#1D6FA3', '#FFFFFF', 'accent', 2),
  ('arctic-signal', 'polar-mist', 'Polar Mist', '#D9F4FF', '#0B1F33', 'companion', 3),
  ('olive-atelier', 'olive-ink', 'Olive Ink', '#263126', '#E7E3C4', 'lead', 1),
  ('olive-atelier', 'moss-textile', 'Moss Textile', '#7C8B52', '#11170F', 'accent', 2),
  ('olive-atelier', 'canvas-grain', 'Canvas Grain', '#E7E3C4', '#263126', 'companion', 3),
  ('solar-clay', 'ember-umber', 'Ember Umber', '#3B2115', '#F4D7A1', 'lead', 1),
  ('solar-clay', 'kiln-orange', 'Kiln Orange', '#D9773D', '#23130C', 'accent', 2),
  ('solar-clay', 'sunwashed-clay', 'Sunwashed Clay', '#F4D7A1', '#3B2115', 'companion', 3),
  ('midnight-bloom', 'deep-iris', 'Deep Iris', '#17162B', '#F2D6EA', 'lead', 1),
  ('midnight-bloom', 'neon-peony', 'Neon Peony', '#C0448F', '#FFFFFF', 'accent', 2),
  ('midnight-bloom', 'blush-static', 'Blush Static', '#F2D6EA', '#17162B', 'companion', 3),
  ('concrete-mint', 'carbon-slate', 'Carbon Slate', '#202625', '#DDF4EA', 'lead', 1),
  ('concrete-mint', 'mint-circuit', 'Mint Circuit', '#61BFA5', '#10221D', 'accent', 2),
  ('concrete-mint', 'frosted-glass', 'Frosted Glass', '#DDF4EA', '#202625', 'companion', 3),
  ('saffron-paper', 'sepia-ink', 'Sepia Ink', '#392B13', '#FFF1C7', 'lead', 1),
  ('saffron-paper', 'saffron-note', 'Saffron Note', '#E3A72F', '#241A08', 'accent', 2),
  ('saffron-paper', 'cream-archive', 'Cream Archive', '#FFF1C7', '#392B13', 'companion', 3);
