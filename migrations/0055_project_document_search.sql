ALTER TABLE project_documents
  ADD COLUMN search_text TEXT NOT NULL DEFAULT '';

ALTER TABLE project_documents
  ADD CONSTRAINT project_documents_search_text_length
  CHECK (char_length(search_text) <= 200000);

CREATE INDEX project_documents_search_idx
  ON project_documents
  USING GIN (
    to_tsvector(
      'simple',
      coalesce(title, '') || ' ' || coalesce(search_text, '')
    )
  );
