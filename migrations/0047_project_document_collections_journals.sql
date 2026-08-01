ALTER TABLE project_documents
  ADD COLUMN journal_date DATE;

CREATE UNIQUE INDEX project_documents_owner_project_journal_date_idx
  ON project_documents(owner_user_id, project_id, journal_date)
  WHERE journal_date IS NOT NULL;

CREATE TABLE project_document_collections (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  owner_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  mode TEXT NOT NULL DEFAULT 'manual'
    CHECK (mode IN ('manual', 'rules')),
  rules JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(rules) = 'array'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX project_document_collections_owner_project_name_idx
  ON project_document_collections(owner_user_id, project_id, lower(name));

CREATE TABLE project_document_collection_memberships (
  collection_id BIGINT NOT NULL
    REFERENCES project_document_collections(id) ON DELETE CASCADE,
  document_id BIGINT NOT NULL REFERENCES project_documents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, document_id)
);

CREATE INDEX project_document_collection_memberships_document_idx
  ON project_document_collection_memberships(document_id, collection_id);
