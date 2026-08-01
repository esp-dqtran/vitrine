ALTER TABLE project_documents
  ADD COLUMN created_by_user_id BIGINT REFERENCES users(id) ON DELETE RESTRICT,
  ADD COLUMN created_by_email TEXT,
  ADD COLUMN last_edited_by_user_id BIGINT REFERENCES users(id) ON DELETE RESTRICT,
  ADD COLUMN last_edited_by_email TEXT;

UPDATE project_documents document
SET created_by_user_id = document.owner_user_id,
    created_by_email = creator.email,
    last_edited_by_user_id = document.owner_user_id,
    last_edited_by_email = creator.email
FROM users creator
WHERE creator.id = document.owner_user_id;

ALTER TABLE project_documents
  ALTER COLUMN created_by_user_id SET NOT NULL,
  ALTER COLUMN created_by_email SET NOT NULL,
  ALTER COLUMN last_edited_by_user_id SET NOT NULL,
  ALTER COLUMN last_edited_by_email SET NOT NULL;

ALTER TABLE project_documents
  ADD CONSTRAINT project_documents_attribution_email_length
  CHECK (
    char_length(created_by_email) BETWEEN 1 AND 320
    AND char_length(last_edited_by_email) BETWEEN 1 AND 320
  );
