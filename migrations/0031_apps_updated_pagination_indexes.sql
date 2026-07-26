CREATE INDEX IF NOT EXISTS images_screen_platform_created_idx
  ON images (platform_id, created_at DESC, id DESC)
  WHERE kind = 'screen';

CREATE INDEX IF NOT EXISTS version_images_version_captured_idx
  ON version_images (version_id, captured_at DESC, image_id DESC);

CREATE INDEX IF NOT EXISTS app_versions_published_snapshot_idx
  ON app_versions (app_id, platform, published_at DESC, version_number DESC)
  WHERE published_at IS NOT NULL;
