ALTER TABLE sites
  ADD COLUMN description TEXT,
  ADD COLUMN logo_url TEXT,
  ADD COLUMN categories JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(categories) = 'array'),
  ADD COLUMN styles JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(styles) = 'array'),
  ADD COLUMN popularity INTEGER NOT NULL DEFAULT 0
    CHECK (popularity >= 0);
