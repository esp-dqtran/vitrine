ALTER TABLE research_projects
  ADD COLUMN pinned BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE research_projects
  DROP CONSTRAINT research_projects_question_check;

ALTER TABLE research_projects
  ADD CONSTRAINT research_projects_question_check
  CHECK (char_length(question) <= 1000);

ALTER TABLE research_projects
  ALTER COLUMN question SET DEFAULT '';

CREATE INDEX research_projects_user_pinned_updated_idx
  ON research_projects (user_id, pinned DESC, updated_at DESC);
