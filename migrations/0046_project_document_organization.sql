CREATE TABLE project_document_folders (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  owner_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_folder_id BIGINT REFERENCES project_document_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (parent_folder_id IS NULL OR parent_folder_id <> id)
);

CREATE INDEX project_document_folders_owner_project_idx
  ON project_document_folders(owner_user_id, project_id, parent_folder_id);

CREATE TABLE project_document_folder_memberships (
  folder_id BIGINT NOT NULL REFERENCES project_document_folders(id) ON DELETE CASCADE,
  document_id BIGINT NOT NULL REFERENCES project_documents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (folder_id, document_id)
);

CREATE INDEX project_document_folder_memberships_document_idx
  ON project_document_folder_memberships(document_id, folder_id);

CREATE TABLE project_document_tags (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  owner_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  color TEXT NOT NULL DEFAULT 'blue'
    CHECK (color IN ('blue', 'purple', 'green', 'amber', 'rose', 'slate')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX project_document_tags_owner_project_name_idx
  ON project_document_tags(owner_user_id, project_id, lower(name));

CREATE TABLE project_document_tag_assignments (
  tag_id BIGINT NOT NULL REFERENCES project_document_tags(id) ON DELETE CASCADE,
  document_id BIGINT NOT NULL REFERENCES project_documents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tag_id, document_id)
);

CREATE INDEX project_document_tag_assignments_document_idx
  ON project_document_tag_assignments(document_id, tag_id);
