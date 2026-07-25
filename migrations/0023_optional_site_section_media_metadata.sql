ALTER TABLE site_sections
  DROP CONSTRAINT site_sections_check;

ALTER TABLE site_sections
  ADD CONSTRAINT site_sections_media_metadata_check CHECK (
    (
      media_kind = 'image'
      AND video_start_seconds IS NULL
      AND video_end_seconds IS NULL
      AND (
        (crop_top IS NULL AND crop_bottom IS NULL)
        OR (
          crop_top IS NOT NULL
          AND crop_bottom IS NOT NULL
          AND crop_top >= 0
          AND crop_bottom > crop_top
        )
      )
    )
    OR
    (
      media_kind = 'video'
      AND crop_top IS NULL
      AND crop_bottom IS NULL
      AND (
        (video_start_seconds IS NULL AND video_end_seconds IS NULL)
        OR (
          video_start_seconds IS NOT NULL
          AND video_end_seconds IS NOT NULL
          AND video_start_seconds >= 0
          AND video_end_seconds > video_start_seconds
        )
      )
    )
  );
