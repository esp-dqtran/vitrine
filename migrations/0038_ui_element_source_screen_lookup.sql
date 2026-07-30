CREATE INDEX screen_ui_elements_accepted_crop_screen_idx
  ON screen_ui_elements (cropped_image_id, version_id, screen_image_id, id)
  WHERE review_status = 'accepted';

CREATE INDEX screen_ui_elements_accepted_source_screen_idx
  ON screen_ui_elements (source_image_id, version_id, screen_image_id, id)
  WHERE review_status = 'accepted';
