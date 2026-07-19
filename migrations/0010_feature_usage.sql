ALTER TABLE access_events ADD COLUMN IF NOT EXISTS feature_key TEXT;
ALTER TABLE access_events ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS access_events_feature_created_idx
  ON access_events(feature_key, created_at DESC)
  WHERE feature_key IS NOT NULL;
