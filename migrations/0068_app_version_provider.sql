ALTER TABLE app_versions
  ADD COLUMN provider TEXT NOT NULL DEFAULT 'm';

ALTER TABLE app_versions
  ADD CONSTRAINT app_versions_provider_check
  CHECK (provider IN ('m', 'f'));
