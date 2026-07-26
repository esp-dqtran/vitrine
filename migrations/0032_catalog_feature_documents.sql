ALTER TABLE feature_documents
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'catalog'));

ALTER TABLE feature_documents
  ADD CONSTRAINT feature_documents_visibility_owner_check
  CHECK (
    (visibility = 'private' AND user_id IS NOT NULL)
    OR (visibility = 'catalog' AND user_id IS NULL)
  );

CREATE UNIQUE INDEX feature_documents_catalog_flow_identity_idx
  ON feature_documents (app_id, platform_id, source_flow_id)
  WHERE visibility = 'catalog';

CREATE INDEX feature_documents_catalog_updated_idx
  ON feature_documents (updated_at DESC, id DESC)
  WHERE visibility = 'catalog';
