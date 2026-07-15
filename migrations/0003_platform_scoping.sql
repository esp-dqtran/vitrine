-- Platform (ios/android/web) becomes a first-class dimension of the version/design-system/
-- flows workflow instead of being silently merged across an app's screens. DEFAULT 'web'
-- keeps existing rows valid without a backfill — it matches platformFromUrl()'s own default
-- for URLs that don't encode a platform.

ALTER TABLE app_versions ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'web';
ALTER TABLE app_versions DROP CONSTRAINT IF EXISTS app_versions_app_id_version_number_key;
ALTER TABLE app_versions ADD CONSTRAINT app_versions_app_id_platform_version_number_key
  UNIQUE (app_id, platform, version_number);
DROP INDEX IF EXISTS app_versions_app_status_idx;
CREATE INDEX IF NOT EXISTS app_versions_app_platform_status_idx
  ON app_versions(app_id, platform, status, version_number DESC);

ALTER TABLE design_systems ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'web';
ALTER TABLE design_systems DROP CONSTRAINT IF EXISTS design_systems_pkey;
ALTER TABLE design_systems ADD PRIMARY KEY (app_id, platform);

ALTER TABLE app_flows ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'web';
ALTER TABLE app_flows DROP CONSTRAINT IF EXISTS app_flows_pkey;
ALTER TABLE app_flows ADD PRIMARY KEY (app_id, platform);
