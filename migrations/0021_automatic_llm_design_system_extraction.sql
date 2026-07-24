ALTER TABLE app_knowledge_jobs
  ALTER COLUMN requested_by DROP NOT NULL,
  ADD COLUMN request_origin TEXT NOT NULL DEFAULT 'manual'
    CHECK (request_origin IN ('manual', 'retry', 'regeneration', 'automatic')),
  ADD COLUMN synthesis_done_count INTEGER NOT NULL DEFAULT 0
    CHECK (synthesis_done_count >= 0),
  ADD COLUMN synthesis_total_count INTEGER NOT NULL DEFAULT 0
    CHECK (synthesis_total_count >= 0),
  ADD COLUMN design_system_seed_outcome TEXT
    CHECK (design_system_seed_outcome IN ('seeded', 'replaced', 'unchanged', 'conflict')),
  ADD CONSTRAINT app_knowledge_synthesis_progress_check
    CHECK (synthesis_done_count <= synthesis_total_count);

ALTER TABLE app_knowledge_jobs
  DROP CONSTRAINT app_knowledge_jobs_stage_check;

ALTER TABLE app_knowledge_jobs
  ADD CONSTRAINT app_knowledge_jobs_stage_check
  CHECK (stage IN (
    'preparing', 'validating_evidence', 'analyzing', 'synthesizing',
    'merging', 'validating_output', 'saving', 'complete'
  ));

ALTER TABLE app_knowledge_revisions
  ALTER COLUMN created_by DROP NOT NULL,
  ADD CONSTRAINT app_knowledge_generated_revision_actor_check
    CHECK (created_by IS NOT NULL OR author_type = 'generated');

ALTER TABLE design_systems
  ADD COLUMN capture_version_id INTEGER REFERENCES app_versions(id) ON DELETE SET NULL,
  ADD COLUMN source_app_knowledge_revision_id BIGINT
    REFERENCES app_knowledge_revisions(id) ON DELETE SET NULL,
  ADD COLUMN generated_at TIMESTAMPTZ;

ALTER TABLE design_systems
  DROP CONSTRAINT design_systems_origin_check;

ALTER TABLE design_systems
  ADD CONSTRAINT design_systems_origin_check
  CHECK (origin IN ('observed', 'automatic', 'imported'));

CREATE UNIQUE INDEX app_knowledge_automatic_generation_identity
  ON app_knowledge_jobs (
    snapshot_id, source_sha256, provider_model, prompt_version
  )
  WHERE request_origin = 'automatic' AND status <> 'cancelled';

CREATE TABLE app_knowledge_component_crops (
  id BIGSERIAL PRIMARY KEY,
  derived_image_id INTEGER NOT NULL UNIQUE REFERENCES images(id) ON DELETE RESTRICT,
  source_image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE RESTRICT,
  job_id BIGINT NOT NULL REFERENCES app_knowledge_jobs(id) ON DELETE CASCADE,
  revision_id BIGINT REFERENCES app_knowledge_revisions(id) ON DELETE SET NULL,
  component_family TEXT NOT NULL CHECK (length(component_family) BETWEEN 1 AND 160),
  component_variant TEXT NOT NULL CHECK (length(component_variant) BETWEEN 1 AND 160),
  region_x DOUBLE PRECISION NOT NULL CHECK (region_x >= 0 AND region_x <= 1),
  region_y DOUBLE PRECISION NOT NULL CHECK (region_y >= 0 AND region_y <= 1),
  region_width DOUBLE PRECISION NOT NULL CHECK (region_width > 0 AND region_width <= 1),
  region_height DOUBLE PRECISION NOT NULL CHECK (region_height > 0 AND region_height <= 1),
  source_sha256 TEXT NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  crop_sha256 TEXT NOT NULL CHECK (crop_sha256 ~ '^[0-9a-f]{64}$'),
  provider_model TEXT NOT NULL CHECK (length(provider_model) BETWEEN 1 AND 160),
  prompt_version INTEGER NOT NULL CHECK (prompt_version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (region_x + region_width <= 1),
  CHECK (region_y + region_height <= 1),
  UNIQUE (
    source_image_id, region_x, region_y, region_width, region_height,
    provider_model, prompt_version
  )
);

CREATE INDEX app_knowledge_component_crops_job_idx
  ON app_knowledge_component_crops(job_id, id);
