-- A project keeps its creating user for attribution, while an optional
-- organization owns access for every current Team member.
ALTER TABLE research_projects
  ADD COLUMN organization_id INTEGER REFERENCES organizations(id) ON DELETE RESTRICT;

CREATE INDEX research_projects_organization_updated_idx
  ON research_projects (organization_id, updated_at DESC)
  WHERE organization_id IS NOT NULL;
