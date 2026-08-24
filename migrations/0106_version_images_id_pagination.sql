CREATE INDEX IF NOT EXISTS version_images_version_image_idx
  ON version_images (version_id, image_id DESC);
