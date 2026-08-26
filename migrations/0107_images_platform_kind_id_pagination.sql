CREATE INDEX IF NOT EXISTS images_platform_kind_id_idx
  ON images (platform_id, kind, id DESC);
