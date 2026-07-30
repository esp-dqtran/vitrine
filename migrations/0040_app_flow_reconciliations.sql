CREATE TABLE app_flow_reconciliations (
  id BIGSERIAL PRIMARY KEY,
  app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  source_flow_id TEXT NOT NULL CHECK (btrim(source_flow_id) <> ''),
  app_flow_id BIGINT REFERENCES app_flows(id) ON DELETE SET NULL,
  revision_number INTEGER NOT NULL CHECK (revision_number > 0),
  source_fingerprint TEXT NOT NULL CHECK (source_fingerprint ~ '^[0-9a-f]{64}$'),
  visual_analysis_sha256 TEXT NOT NULL CHECK (visual_analysis_sha256 ~ '^[0-9a-f]{64}$'),
  research_context_sha256 TEXT NOT NULL CHECK (research_context_sha256 ~ '^[0-9a-f]{64}$'),
  result_sha256 TEXT NOT NULL CHECK (result_sha256 ~ '^[0-9a-f]{64}$'),
  provider_model TEXT NOT NULL CHECK (length(provider_model) BETWEEN 1 AND 160),
  effort TEXT NOT NULL CHECK (effort IN ('low', 'medium', 'high', 'xhigh', 'max')),
  prompt_version INTEGER NOT NULL CHECK (prompt_version > 0),
  result JSONB NOT NULL CHECK (
    jsonb_typeof(result) = 'object'
    AND result ?& ARRAY[
      'flowId', 'modelAssessment', 'claimReconciliation',
      'implementationKnowledge', 'risks', 'qualityChecks'
    ]
  ),
  usage JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(usage) = 'object'),
  review_recommendation JSONB NOT NULL CHECK (
    jsonb_typeof(review_recommendation) = 'object'
    AND review_recommendation ?& ARRAY['solReview', 'reasons']
  ),
  review_status TEXT NOT NULL DEFAULT 'needs_review'
    CHECK (review_status IN ('needs_review', 'approved', 'rejected', 'superseded')),
  generated_at TIMESTAMPTZ NOT NULL,
  validated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (app_id, platform, source_flow_id, revision_number),
  UNIQUE (app_id, platform, source_flow_id, source_fingerprint)
);

CREATE INDEX app_flow_reconciliations_flow_revision_idx
  ON app_flow_reconciliations(app_id, platform, source_flow_id, revision_number DESC);
CREATE INDEX app_flow_reconciliations_app_flow_idx
  ON app_flow_reconciliations(app_flow_id, revision_number DESC)
  WHERE app_flow_id IS NOT NULL;
CREATE INDEX app_flow_reconciliations_review_idx
  ON app_flow_reconciliations(review_status, imported_at, id);
CREATE INDEX app_flow_reconciliations_sol_review_idx
  ON app_flow_reconciliations(app_id, platform, imported_at, id)
  WHERE (review_recommendation->>'solReview')::boolean;

CREATE OR REPLACE FUNCTION protect_app_flow_reconciliation() RETURNS trigger AS $$
BEGIN
  IF
    NEW.app_id IS DISTINCT FROM OLD.app_id
    OR NEW.platform IS DISTINCT FROM OLD.platform
    OR NEW.source_flow_id IS DISTINCT FROM OLD.source_flow_id
    OR NEW.app_flow_id IS DISTINCT FROM OLD.app_flow_id
    OR NEW.revision_number IS DISTINCT FROM OLD.revision_number
    OR NEW.source_fingerprint IS DISTINCT FROM OLD.source_fingerprint
    OR NEW.visual_analysis_sha256 IS DISTINCT FROM OLD.visual_analysis_sha256
    OR NEW.research_context_sha256 IS DISTINCT FROM OLD.research_context_sha256
    OR NEW.result_sha256 IS DISTINCT FROM OLD.result_sha256
    OR NEW.provider_model IS DISTINCT FROM OLD.provider_model
    OR NEW.effort IS DISTINCT FROM OLD.effort
    OR NEW.prompt_version IS DISTINCT FROM OLD.prompt_version
    OR NEW.result IS DISTINCT FROM OLD.result
    OR NEW.usage IS DISTINCT FROM OLD.usage
    OR NEW.review_recommendation IS DISTINCT FROM OLD.review_recommendation
    OR NEW.generated_at IS DISTINCT FROM OLD.generated_at
    OR NEW.validated_at IS DISTINCT FROM OLD.validated_at
    OR NEW.imported_at IS DISTINCT FROM OLD.imported_at
  THEN
    RAISE EXCEPTION 'App Flow reconciliation evidence is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER app_flow_reconciliation_immutable
BEFORE UPDATE ON app_flow_reconciliations
FOR EACH ROW EXECUTE FUNCTION protect_app_flow_reconciliation();
