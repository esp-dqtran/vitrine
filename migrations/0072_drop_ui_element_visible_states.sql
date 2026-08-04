-- Per-occurrence UI element states were an unbounded free-text field (140
-- distinct strings for one app, including case duplicates like "default" vs
-- "Default") with no review workflow. Screen-level visibleStates (images.analysis)
-- is unaffected and remains in use elsewhere.
ALTER TABLE screen_ui_elements DROP COLUMN IF EXISTS visible_states;
