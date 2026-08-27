CREATE INDEX ui_element_extractions_completed_screen_idx
  ON ui_element_extractions (
    screen_image_id,
    prompt_version DESC,
    analyzed_at DESC,
    updated_at DESC
  )
  WHERE status = 'complete' AND analysis IS NOT NULL;
