CREATE TABLE project_document_realtime_states (
  document_id BIGINT PRIMARY KEY
    REFERENCES project_documents(id) ON DELETE CASCADE,
  state BYTEA NOT NULL,
  byte_size INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_document_realtime_states_size
    CHECK (
      byte_size BETWEEN 1 AND 8388608
      AND octet_length(state) = byte_size
    )
);

CREATE INDEX project_document_realtime_states_updated_idx
  ON project_document_realtime_states(updated_at DESC, document_id);
