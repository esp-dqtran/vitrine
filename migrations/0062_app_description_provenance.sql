ALTER TABLE apps
  ADD COLUMN IF NOT EXISTS description_source TEXT,
  ADD COLUMN IF NOT EXISTS description_source_url TEXT,
  ADD COLUMN IF NOT EXISTS description_updated_at TIMESTAMPTZ;
