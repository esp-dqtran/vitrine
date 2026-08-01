ALTER TABLE research_projects
  ADD COLUMN public_id UUID NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE research_projects
  ADD CONSTRAINT research_projects_public_id_unique UNIQUE (public_id);

CREATE INDEX research_projects_user_public_id_idx
  ON research_projects (user_id, public_id);
