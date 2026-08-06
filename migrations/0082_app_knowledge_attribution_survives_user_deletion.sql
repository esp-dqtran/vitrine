-- App Knowledge holds four foreign keys into users, all ON DELETE RESTRICT, two of
-- them NOT NULL. They record who ran a job, who authored a revision, who acted on a
-- review and who overrode evidence — attribution, not ownership. RESTRICT makes that
-- attribution outrank the account: with any of these rows present, deleting the user
-- is impossible, and the error names a table nobody would think to look in.
--
-- The tables are nearly empty today (0 review events, 0 evidence overrides), so this
-- has not bitten yet. It is waiting: the first approved revision writes a review event,
-- and from then on that reviewer can never be deleted. app_versions.reviewed_by taught
-- this lesson already — 1,723 published rows made ordinary account cleanup fail, and
-- 0080 had to drop a trigger to get out of it.
--
-- Every other attribution column in the schema is ON DELETE SET NULL. Match them:
-- the work survives, the dead user reference does not.
ALTER TABLE app_knowledge_review_events ALTER COLUMN actor_id DROP NOT NULL;
ALTER TABLE app_knowledge_evidence_overrides ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE app_knowledge_jobs DROP CONSTRAINT app_knowledge_jobs_requested_by_fkey;
ALTER TABLE app_knowledge_jobs ADD CONSTRAINT app_knowledge_jobs_requested_by_fkey
  FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE app_knowledge_revisions DROP CONSTRAINT app_knowledge_revisions_created_by_fkey;
ALTER TABLE app_knowledge_revisions ADD CONSTRAINT app_knowledge_revisions_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE app_knowledge_review_events DROP CONSTRAINT app_knowledge_review_events_actor_id_fkey;
ALTER TABLE app_knowledge_review_events ADD CONSTRAINT app_knowledge_review_events_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE app_knowledge_evidence_overrides DROP CONSTRAINT app_knowledge_evidence_overrides_created_by_fkey;
ALTER TABLE app_knowledge_evidence_overrides ADD CONSTRAINT app_knowledge_evidence_overrides_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- SET NULL is an UPDATE, and both immutability guards reject the writes it performs:
-- the review-event guard rejects every UPDATE unconditionally, and the revision guard
-- lists created_by among the columns frozen once a revision is approved. Narrow both to
-- permit exactly one write — clearing attribution — and nothing else. Deletes stay
-- blocked, content stays frozen.
CREATE OR REPLACE FUNCTION protect_app_knowledge_review_event()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD.actor_id IS NOT NULL AND NEW.actor_id IS NULL
    AND NEW.id = OLD.id
    AND NEW.snapshot_id = OLD.snapshot_id
    AND NEW.revision_id IS NOT DISTINCT FROM OLD.revision_id
    AND NEW.action = OLD.action
    AND NEW.from_status IS NOT DISTINCT FROM OLD.from_status
    AND NEW.to_status IS NOT DISTINCT FROM OLD.to_status
    AND NEW.details IS NOT DISTINCT FROM OLD.details
    AND NEW.created_at = OLD.created_at
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'App Knowledge review events are append-only';
END;
$$;

CREATE OR REPLACE FUNCTION protect_approved_app_knowledge_revision()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.review_status = 'approved' AND (
    NEW.content IS DISTINCT FROM OLD.content
    OR NEW.evidence_manifest IS DISTINCT FROM OLD.evidence_manifest
    OR NEW.source_sha256 IS DISTINCT FROM OLD.source_sha256
    OR NEW.provider_model IS DISTINCT FROM OLD.provider_model
    OR NEW.prompt_version IS DISTINCT FROM OLD.prompt_version
    -- created_by may only be cleared, and only by the ON DELETE SET NULL cascade.
    OR (NEW.created_by IS DISTINCT FROM OLD.created_by AND NEW.created_by IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'approved App Knowledge revision is immutable';
  END IF;
  RETURN NEW;
END;
$$;
