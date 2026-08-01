ALTER TABLE project_documents
  ADD COLUMN properties JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE project_documents
  ADD CONSTRAINT project_documents_properties_array
  CHECK (jsonb_typeof(properties) = 'array');

ALTER TABLE project_documents
  ADD CONSTRAINT project_documents_properties_limit
  CHECK (jsonb_array_length(properties) <= 50);
