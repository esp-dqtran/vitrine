import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  discoverMigrations,
  redactMigrationError,
  validateMigrationState,
} from "./migrations.ts";

const migrationDefinitions = [
  {
    file: "0015_feature_documents.sql",
    patterns: [
      /CREATE TABLE feature_documents/,
      /CREATE TABLE feature_document_revisions/,
      /CREATE TABLE feature_document_jobs/,
      /CREATE TABLE feature_document_step_analyses/,
      /CREATE TABLE feature_document_shares/,
      /pg_notify\('feature_document_jobs'/,
    ],
  },
  {
    file: "0016_getdesign_imports.sql",
    patterns: [
      /ADD COLUMN IF NOT EXISTS origin/,
      /CREATE TABLE design_system_import_history/,
      /previous_snapshot JSONB/,
      /rolled_back_at TIMESTAMPTZ/,
    ],
  },
  {
    file: "0017_adaptive_search.sql",
    patterns: [
      /CREATE EXTENSION IF NOT EXISTS vector/,
      /PRIMARY KEY \(index_version, document_id\)/,
      /embedding VECTOR\(1536\)/,
      /search_vector TSVECTOR GENERATED ALWAYS/,
      /CREATE TRIGGER images_search_queue/,
    ],
  },
  {
    file: "0018_app_knowledge_analysis.sql",
    patterns: [
      /CREATE TABLE app_knowledge_snapshots/,
      /CREATE TABLE app_knowledge_revisions/,
      /CREATE TABLE app_knowledge_jobs/,
      /CREATE TABLE app_knowledge_job_evidence/,
      /CREATE TABLE app_knowledge_evidence_cache/,
      /CREATE TABLE app_knowledge_review_events/,
      /CREATE TABLE app_knowledge_evidence_overrides/,
      /pg_notify\('app_knowledge_jobs'/,
    ],
  },
  {
    file: "0019_app_knowledge_design_system_chunks.sql",
    patterns: [
      /CREATE TABLE app_knowledge_design_system_chunks/,
      /UNIQUE \(job_id, chunk_key\)/,
      /UNIQUE \(job_id, ordinal\)/,
      /jsonb_typeof\(fragment\) = 'object'/,
    ],
  },
  {
    file: "0020_drop_flow_documents.sql",
    patterns: [/DROP TABLE IF EXISTS flow_documents/],
  },
  {
    file: "0030_context_aware_search.sql",
    patterns: [
      /ADD COLUMN catalog_scope TEXT NOT NULL DEFAULT 'apps'/,
      /entity_type IN \('app', 'site', 'screen', 'flow', 'component', 'pattern'\)/,
      /CREATE TABLE site_search_index_queue/,
      /CREATE TRIGGER site_versions_search_queue/,
      /CREATE TRIGGER site_sections_search_queue/,
    ],
  },
  {
    file: "0032_catalog_feature_documents.sql",
    patterns: [
      /ALTER COLUMN user_id DROP NOT NULL/,
      /ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private'/,
      /visibility = 'catalog' AND user_id IS NULL/,
      /feature_documents_catalog_flow_identity_idx/,
    ],
  },
  {
    file: "0033_app_categories.sql",
    patterns: [
      /CREATE TABLE categories/,
      /CREATE TABLE app_categories/,
      /PRIMARY KEY \(app_id, category_id\)/,
      /REFERENCES apps\(id\) ON DELETE CASCADE/,
      /REFERENCES categories\(id\) ON DELETE CASCADE/,
      /INSERT INTO categories/,
      /INSERT INTO app_categories/,
      /CREATE TRIGGER sync_apps_category_to_relationship/,
      /CREATE TRIGGER app_categories_search_queue/,
      /CREATE TRIGGER categories_search_queue/,
    ],
  },
  {
    file: "0034_hierarchical_flow_data.sql",
    patterns: [
      /CREATE TABLE flows/,
      /CREATE TABLE app_flows/,
      /CREATE TABLE app_flow_mappings/,
      /CREATE TABLE app_flow_versions/,
      /CREATE TABLE app_flow_version_mappings/,
      /DROP TABLE legacy_app_flow_versions/,
      /DROP TABLE legacy_app_flows/,
    ],
  },
  {
    file: "0036_site_version_catalog_snapshots.sql",
    patterns: [
      /ADD COLUMN catalog_snapshot JSONB/,
      /jsonb_typeof\(catalog_snapshot\) = 'object'/,
      /CREATE OR REPLACE FUNCTION populate_site_version_catalog_snapshot/,
      /NEW\.catalog_snapshot IS NULL\s+OR NEW\.catalog_snapshot = '\{\}'::jsonb/,
      /NOT \(NEW\.catalog_snapshot \?& ARRAY\[/,
      /BEFORE INSERT OR UPDATE ON site_versions/,
      /UPDATE site_versions sv/,
      /jsonb_build_object\(/,
      /'categoriesNormalized'/,
      /'stylesNormalized'/,
      /jsonb_agg\(lower\(value\)/,
      /'popularity'/,
      /ALTER COLUMN catalog_snapshot SET NOT NULL/,
      /ALTER COLUMN catalog_snapshot DROP DEFAULT/,
      /site_versions_catalog_ready_idx/,
      /site_versions_catalog_categories_normalized_gin_idx/,
      /site_versions_catalog_styles_normalized_gin_idx/,
      /site_pages_version_title_idx/,
      /site_sections_patterns_gin_idx/,
    ],
  },
  {
    file: "0037_flow_catalog_snapshot_guards.sql",
    patterns: [
      /BEFORE UPDATE OR DELETE ON flows/,
      /Published Flow taxonomy is append-only/,
      /BEFORE INSERT OR UPDATE OR DELETE ON app_flow_versions/,
      /BEFORE INSERT OR UPDATE OR DELETE ON app_flow_version_mappings/,
      /BEFORE INSERT OR UPDATE OR DELETE ON app_versions/,
      /Published App versions are immutable/,
      /Published App versions must use the in-review publication transition/,
      /app_versions_publication_markers_consistent/,
      /\(status = 'published'\) = \(published_at IS NOT NULL\)/,
      /\(NEW\.status = 'published'\) IS DISTINCT FROM \(NEW\.published_at IS NOT NULL\)/,
      /App version publication status and timestamp must agree/,
      /OLD\.published_at IS NOT NULL/,
      /OLD\.status = 'published'/,
      /OLD\.status <> 'in_review'/,
      /NEW\.status <> 'published'/,
      /owner_ids := CASE TG_OP/,
      /flow_version_ids := CASE TG_OP/,
      /FOR SHARE/,
      /FOR SHARE OF av, afv/,
      /published_at IS NOT NULL/,
      /publish a new App version/,
    ],
  },
  {
    file: "0039_screen_pattern_taxonomy.sql",
    patterns: [
      /CREATE TABLE screen_pattern_sections/,
      /CREATE TABLE screen_patterns/,
      /CREATE TABLE screen_pattern_assignments/,
      /PRIMARY KEY \(image_id, screen_pattern_id\)/,
      /source IN \('analysis', 'imported', 'manual'\)/,
      /INSERT INTO screen_pattern_sections/,
      /INSERT INTO screen_patterns/,
      /screen_pattern_matches_analysis/,
      /refresh_screen_pattern_previews/,
      /sync_screen_pattern_assignments_from_analysis/,
      /zz_refresh_screen_patterns_on_publish/,
    ],
  },
  {
    file: "0040_app_flow_reconciliations.sql",
    patterns: [
      /CREATE TABLE app_flow_reconciliations/,
      /source_fingerprint TEXT NOT NULL/,
      /visual_analysis_sha256 TEXT NOT NULL/,
      /research_context_sha256 TEXT NOT NULL/,
      /result_sha256 TEXT NOT NULL/,
      /UNIQUE \(app_id, platform, source_flow_id, revision_number\)/,
      /UNIQUE \(app_id, platform, source_flow_id, source_fingerprint\)/,
      /CREATE TRIGGER app_flow_reconciliation_immutable/,
      /App Flow reconciliation evidence is immutable/,
    ],
  },
  {
    file: "0102_flow_taxonomy.sql",
    patterns: [
      /CREATE TABLE flow_categories/,
      /CREATE TABLE flow_types/,
      /CREATE TABLE flow_classifications/,
      /status IN \('needs_review', 'approved'\)/,
      /flow_classifications_review_queue_idx/,
      /\('authentication', 'Authentication', 1\)/,
      /\('system-privacy-support', 'System, Privacy & Support', 13\)/,
      /\('monetization', 'paywall', 'Paywall', 2\)/,
      /\('billing', 'cancel-subscription', 'Cancel subscription', 5\)/,
    ],
  },
  {
    file: "0103_migrate_flow_taxonomy.sql",
    patterns: [
      /SET LOCAL statement_timeout = '30min'/,
      /\('authentication', 'sign-out', 'Sign out', 9\)/,
      /\('content-detail', 'analytics-report-detail', 'Analytics \/ report detail', 8\)/,
      /INSERT INTO flow_classifications/,
      /ON CONFLICT \(flow_id\) DO UPDATE/,
      /Every canonical Flow must receive a controlled taxonomy classification/,
    ],
  },
  {
    file: "0104_reclassify_flow_taxonomy.sql",
    patterns: [
      /Correct the word-boundary expressions/,
      /SET LOCAL statement_timeout = '30min'/,
      /name ~ '\\m\(log\(ging\)\? out\|sign\(ing\)\? out\)\\M'/,
      /INSERT INTO flow_classifications/,
      /ON CONFLICT \(flow_id\) DO UPDATE/,
    ],
  },
  {
    file: "0043_project_documents.sql",
    patterns: [
      /CREATE TABLE project_documents/,
      /UNIQUE \(project_id, document_key\)/,
      /last_editor_mode IN \('page', 'edgeless'\)/,
      /octobase_document_id TEXT NOT NULL UNIQUE/,
      /project_documents_owner_project_idx/,
    ],
  },
  {
    file: "0046_project_document_organization.sql",
    patterns: [
      /CREATE TABLE project_document_folders/,
      /parent_folder_id BIGINT REFERENCES project_document_folders/,
      /CREATE TABLE project_document_folder_memberships/,
      /PRIMARY KEY \(folder_id, document_id\)/,
      /CREATE TABLE project_document_tags/,
      /project_document_tags_owner_project_name_idx/,
      /CREATE TABLE project_document_tag_assignments/,
      /PRIMARY KEY \(tag_id, document_id\)/,
    ],
  },
  {
    file: "0047_project_document_collections_journals.sql",
    patterns: [
      /ADD COLUMN journal_date DATE/,
      /project_documents_owner_project_journal_date_idx/,
      /CREATE TABLE project_document_collections/,
      /mode IN \('manual', 'rules'\)/,
      /rules JSONB NOT NULL DEFAULT '\[\]'::jsonb/,
      /CREATE TABLE project_document_collection_memberships/,
      /PRIMARY KEY \(collection_id, document_id\)/,
    ],
  },
  {
    file: "0048_project_document_trash.sql",
    patterns: [
      /ADD COLUMN trashed_at TIMESTAMPTZ/,
      /project_documents_owner_project_trash_idx/,
      /WHERE trashed_at IS NOT NULL/,
    ],
  },
  {
    file: "0049_project_document_links.sql",
    patterns: [
      /CREATE TABLE project_document_links/,
      /PRIMARY KEY \(source_document_id, target_document_id\)/,
      /CHECK \(source_document_id <> target_document_id\)/,
      /project_document_links_source_idx/,
      /project_document_links_target_idx/,
    ],
  },
  {
    file: "0050_project_document_comments.sql",
    patterns: [
      /CREATE TABLE project_document_comments/,
      /author_user_id BIGINT NOT NULL REFERENCES users\(id\)/,
      /CHECK \(char_length\(body\) BETWEEN 1 AND 2000\)/,
      /project_document_comments_document_idx/,
      /project_document_comments_unresolved_idx/,
      /WHERE resolved_at IS NULL/,
    ],
  },
  {
    file: "0051_project_document_shares.sql",
    patterns: [
      /CREATE TABLE project_document_shares/,
      /token_sha256 TEXT NOT NULL UNIQUE/,
      /CHECK \(token_sha256 ~ '\^\[0-9a-f\]\{64\}\$'\)/,
      /project_document_shares_document_idx/,
      /project_document_shares_active_idx/,
      /WHERE revoked_at IS NULL/,
    ],
  },
  {
    file: "0053_project_document_comment_anchors.sql",
    patterns: [
      /ADD COLUMN block_id TEXT/,
      /ADD COLUMN quote TEXT/,
      /project_document_comments_anchor_shape/,
      /project_document_comments_anchor_idx/,
      /WHERE block_id IS NOT NULL/,
    ],
  },
  {
    file: "0054_project_document_versions.sql",
    patterns: [
      /CREATE TABLE project_document_versions/,
      /created_by_user_id BIGINT NOT NULL REFERENCES users\(id\)/,
      /snapshot BYTEA NOT NULL/,
      /byte_size BETWEEN 1 AND 8388608/,
      /octet_length\(snapshot\) = byte_size/,
      /project_document_versions_document_idx/,
    ],
  },
  {
    file: "0069_project_document_comment_threads.sql",
    patterns: [
      /ADD COLUMN parent_comment_id BIGINT/,
      /REFERENCES project_document_comments\(id\) ON DELETE CASCADE/,
      /project_document_comments_parent_not_self/,
      /project_document_comments_thread_idx/,
    ],
  },
  {
    file: "0055_project_document_search.sql",
    patterns: [
      /ADD COLUMN search_text TEXT NOT NULL DEFAULT ''/,
      /char_length\(search_text\) <= 200000/,
      /USING GIN/,
      /to_tsvector\(/,
      /coalesce\(title, ''\) \|\| ' ' \|\| coalesce\(search_text, ''\)/,
    ],
  },
  {
    file: "0056_project_document_properties.sql",
    patterns: [
      /ADD COLUMN properties JSONB NOT NULL DEFAULT '\[\]'::jsonb/,
      /jsonb_typeof\(properties\) = 'array'/,
      /jsonb_array_length\(properties\) <= 50/,
    ],
  },
  {
    file: "0057_project_document_templates.sql",
    patterns: [
      /ADD COLUMN is_template BOOLEAN NOT NULL DEFAULT false/,
      /ADD COLUMN template_snapshot BYTEA/,
      /octet_length\(template_snapshot\) BETWEEN 1 AND 8388608/,
      /project_documents_owner_project_templates_idx/,
      /WHERE is_template = true AND trashed_at IS NULL/,
    ],
  },
  {
    file: "0058_project_document_edit_attribution.sql",
    patterns: [
      /ADD COLUMN created_by_user_id BIGINT REFERENCES users\(id\)/,
      /ADD COLUMN last_edited_by_user_id BIGINT REFERENCES users\(id\)/,
      /SET created_by_user_id = document\.owner_user_id/,
      /ALTER COLUMN last_edited_by_email SET NOT NULL/,
      /project_documents_attribution_email_length/,
    ],
  },
  {
    file: "0063_project_document_realtime_state.sql",
    patterns: [
      /CREATE TABLE project_document_realtime_states/,
      /REFERENCES project_documents\(id\) ON DELETE CASCADE/,
      /state BYTEA NOT NULL/,
      /byte_size BETWEEN 1 AND 8388608/,
      /octet_length\(state\) = byte_size/,
      /project_document_realtime_states_updated_idx/,
    ],
  },
  {
    file: "0064_research_project_teams.sql",
    patterns: [
      /ADD COLUMN organization_id INTEGER REFERENCES organizations\(id\) ON DELETE RESTRICT/,
      /research_projects_organization_updated_idx/,
      /WHERE organization_id IS NOT NULL/,
    ],
  },
  {
    file: "0065_project_workspace_files.sql",
    patterns: [
      /CREATE TABLE research_project_canvas_files/,
      /id UUID PRIMARY KEY DEFAULT gen_random_uuid\(\)/,
      /REFERENCES research_projects\(id\) ON DELETE CASCADE/,
      /research_project_canvas_files_project_updated_idx/,
      /INSERT INTO research_project_canvas_files/,
      /FROM research_project_canvases/,
    ],
  },
  {
    file: "0067_research_project_icons.sql",
    patterns: [
      /ADD COLUMN icon TEXT NOT NULL DEFAULT 'initial'/,
      /CHECK \(icon IN \('initial', 'folder', 'grid', 'book', 'sparkle'\)\)/,
    ],
  },
  {
    file: "0068_app_version_provider.sql",
    patterns: [
      /ADD COLUMN provider TEXT NOT NULL DEFAULT 'm'/,
      /app_versions_provider_check/,
      /provider IN \('m', 'f'\)/,
    ],
  },
  {
    file: "0070_restore_password_auth_constraints.sql",
    patterns: [
      /password_hash IS NULL/,
      /ALTER COLUMN password_hash SET NOT NULL/,
      /DROP COLUMN IF EXISTS clerk_user_id/,
    ],
  },
  {
    file: "0071_drop_auth_sessions.sql",
    patterns: [
      /DROP TABLE IF EXISTS sessions/,
    ],
  },
  {
    file: "0110_published_screen_search.sql",
    patterns: [
      /CREATE TABLE published_screen_search_documents/,
      /GENERATED ALWAYS AS/,
      /analysis->>'visibleText'/,
      /USING GIN \(search_vector\)/,
      /image\.kind = 'screen'/,
      /CREATE TRIGGER app_versions_published_screen_search/,
      /refresh_published_screen_search_version/,
    ],
  },
] as const;

for (const definition of migrationDefinitions) {
  test(`${definition.file} retains its schema contract`, async () => {
    const sql = await readFile(
      new URL(`../migrations/${definition.file}`, import.meta.url),
      "utf8",
    );
    for (const pattern of definition.patterns) assert.match(sql, pattern);
  });
}

test("normal publication snapshots Flow children before the immutable transition", async () => {
  const source = await readFile(new URL("./db.ts", import.meta.url), "utf8");
  const start = source.indexOf("export async function publishAppVersion");
  const end = source.indexOf(
    "export async function getVersionDesignSystem",
    start,
  );
  assert.ok(start >= 0 && end > start);
  const publication = source.slice(start, end);
  const snapshot = publication.indexOf("await replaceVersionFlows");
  const transition = publication.indexOf(
    "SET status = 'published', published_at = now()",
  );
  assert.ok(snapshot >= 0);
  assert.ok(transition > snapshot);
});

test("Pantone archive backfills featured colors before enforcing the non-empty constraint", async () => {
  const sql = await readFile(
    new URL("../migrations/0097_pantone_color_year_archive.sql", import.meta.url),
    "utf8",
  );
  const backfill = sql.indexOf("ON CONFLICT (id) DO UPDATE SET");
  const constraint = sql.indexOf("ADD CONSTRAINT color_collections_featured_colors_array_check");
  assert.ok(backfill >= 0);
  assert.ok(constraint > backfill);
});

async function temporaryDirectory(t: {
  after(fn: () => Promise<void>): void;
}): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "astryx-migrations-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test("discovers contiguous immutable migrations and identifies pending versions", async (t) => {
  const directory = await temporaryDirectory(t);
  await writeFile(join(directory, "0001_base.sql"), "SELECT 1;\n");
  await writeFile(join(directory, "0002_more.sql"), "SELECT 2;\n");

  const files = await discoverMigrations(directory);

  assert.deepEqual(
    files.map(({ version, name }) => [version, name]),
    [
      [1, "base"],
      [2, "more"],
    ],
  );
  assert.match(files[0].checksum, /^[0-9a-f]{64}$/);
  assert.deepEqual(
    validateMigrationState(files, [
      {
        version: 1,
        name: "base",
        checksum: files[0].checksum,
      },
    ]).pending.map(({ version }) => version),
    [2],
  );
});

test("rejects invalid names, sequence gaps, and top-level transactions", async (t) => {
  const root = await temporaryDirectory(t);
  const invalidName = join(root, "invalid-name");
  await mkdir(invalidName);
  await writeFile(join(invalidName, "1_base.sql"), "SELECT 1;\n");
  await assert.rejects(
    () => discoverMigrations(invalidName),
    /Invalid migration filename/,
  );

  const gap = join(root, "gap");
  await mkdir(gap);
  await writeFile(join(gap, "0001_base.sql"), "SELECT 1;\n");
  await writeFile(join(gap, "0003_gap.sql"), "SELECT 3;\n");
  await assert.rejects(() => discoverMigrations(gap), /sequence gap/i);

  const transaction = join(root, "transaction");
  await mkdir(transaction);
  await writeFile(
    join(transaction, "0001_bad.sql"),
    "BEGIN;\nSELECT 1;\nCOMMIT;\n",
  );
  await assert.rejects(
    () => discoverMigrations(transaction),
    /contains a transaction statement/i,
  );
});

test("rejects changed, missing, and discontinuous applied migrations", async (t) => {
  const directory = await temporaryDirectory(t);
  await writeFile(join(directory, "0001_base.sql"), "SELECT 1;\n");
  await writeFile(join(directory, "0002_more.sql"), "SELECT 2;\n");
  const files = await discoverMigrations(directory);

  assert.throws(
    () =>
      validateMigrationState(files, [
        {
          version: 1,
          name: "base",
          checksum: "0".repeat(64),
        },
      ]),
    /does not match its immutable file/,
  );
  assert.throws(
    () =>
      validateMigrationState(
        [],
        [
          {
            version: 1,
            name: "missing",
            checksum: "0".repeat(64),
          },
        ],
      ),
    /not present on disk/,
  );
  assert.throws(
    () =>
      validateMigrationState(files, [
        {
          version: 2,
          name: "more",
          checksum: files[1].checksum,
        },
      ]),
    /sequence gap at version 2/,
  );
});

test("redacts database URLs and decoded passwords from errors", () => {
  const databaseUrl = "postgres://operator:p%40ssword@db.internal:5432/astryx";
  const message = redactMigrationError(
    new Error(`connection failed for ${databaseUrl} with password p@ssword`),
    databaseUrl,
  );
  assert.doesNotMatch(message, /operator|p%40ssword|p@ssword|db\.internal/);
  assert.match(message, /redacted/);
});

test("ordinary database queries never bootstrap or mutate schema", async () => {
  const source = await readFile(new URL("./db.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /ensureSchema|schemaReady/);
  assert.doesNotMatch(source, /pool\.query\(`\s*(?:CREATE|ALTER|DROP)/i);
});
