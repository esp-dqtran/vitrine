ALTER TABLE project_document_comments
  ADD COLUMN block_id TEXT,
  ADD COLUMN quote TEXT,
  ADD CONSTRAINT project_document_comments_block_id_length
    CHECK (block_id IS NULL OR char_length(block_id) BETWEEN 1 AND 200),
  ADD CONSTRAINT project_document_comments_quote_length
    CHECK (quote IS NULL OR char_length(quote) BETWEEN 1 AND 500),
  ADD CONSTRAINT project_document_comments_anchor_shape
    CHECK (quote IS NULL OR block_id IS NOT NULL);

CREATE INDEX project_document_comments_anchor_idx
  ON project_document_comments(project_id, document_id, block_id, created_at, id)
  WHERE block_id IS NOT NULL;
