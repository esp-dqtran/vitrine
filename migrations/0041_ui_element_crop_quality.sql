ALTER TABLE screen_ui_elements
  ADD COLUMN crop_quality JSONB;

ALTER TABLE screen_ui_elements
  ADD CONSTRAINT screen_ui_elements_crop_quality_object
  CHECK (crop_quality IS NULL OR jsonb_typeof(crop_quality) = 'object');
