import assert from "node:assert/strict";
import { after, test } from "node:test";
import pg from "pg";
import type { AppKnowledgeSnapshot } from "./appKnowledge.ts";
import type { AppKnowledgeEvidenceManifestItem } from "./appKnowledgeEvidence.ts";
import { applyMigrations } from "./migrations.ts";

const ADMIN_URL = "postgres://postgres:postgres@localhost:5432/postgres";
const TEST_URL = "postgres://postgres:postgres@localhost:5432/astryx_app_knowledge_store_test";

async function ensureTestDb(): Promise<string | undefined> {
  const client = new pg.Client({ connectionString: ADMIN_URL });
  try {
    await client.connect();
  } catch {
    return "Postgres not running — docker compose up -d postgres";
  }
  try {
    const vector = await client.query(
      "SELECT 1 FROM pg_available_extensions WHERE name = 'vector'",
    );
    if (vector.rowCount === 0) {
      return "Postgres does not provide pgvector — docker compose --profile legacy-db up -d postgres";
    }
    await client.query("CREATE DATABASE astryx_app_knowledge_store_test");
  } catch (error) {
    if ((error as { code?: string }).code !== "42P04") throw error;
  } finally {
    await client.end();
  }
  return undefined;
}

const skipReason = await ensureTestDb();
process.env.DATABASE_URL = TEST_URL;

after(async () => {
  if (!skipReason) await (await import("./db.ts")).closePool();
});

const manifest: AppKnowledgeEvidenceManifestItem[] = [{
  evidenceId: "SCREEN-1",
  imageId: 1,
  kind: "screen",
  eligibility: "eligible",
  reason: "screen_capture",
  normalizedVisualSha256: "a".repeat(64),
  capturedAt: "2026-07-23T00:00:00.000Z",
  viewport: { width: 1440, height: 900 },
  object: { sha256: "b".repeat(64), byteSize: 10, contentType: "image/png" },
}];

function snapshot(sourceSha256 = "c".repeat(64)): AppKnowledgeSnapshot {
  return {
    identity: {
      app: "knowledge-app",
      platform: "web",
      captureVersionId: 1,
      sourceSha256,
      providerModel: "test-model",
      promptVersion: 1,
      generatedAt: "2026-07-23T00:00:00.000Z",
    },
    coverage: {
      total: 1,
      eligible: 1,
      analyzed: 1,
      cached: 0,
      quarantined: 0,
      skipped: 0,
      failed: 0,
      duplicateVisuals: 0,
      byKind: {
        screen: { total: 1, eligible: 1, analyzed: 1, cached: 0, quarantined: 0, failed: 0 },
        flow_step: { total: 0, eligible: 0, analyzed: 0, cached: 0, quarantined: 0, failed: 0 },
        ui_element: { total: 0, eligible: 0, analyzed: 0, cached: 0, quarantined: 0, failed: 0 },
      },
      flowReferences: { total: 0, resolved: 0, uniqueImages: 0 },
    },
    screens: [{
      id: "screen-home",
      evidenceId: "SCREEN-1",
      pageType: "Home",
      productArea: "Core",
      purpose: "Orient the user",
      viewport: "desktop",
      visibleText: ["Home"],
      theme: "light",
      visualHierarchy: ["Title"],
      layoutPatterns: ["Single column"],
      contentPatterns: [],
      imagery: [],
      icons: [],
      interactionPatterns: [],
      visibleStates: ["Default"],
      availableActions: [],
      systemFeedback: [],
      accessibilityObservations: [],
      claims: [],
      confidence: 0.9,
      reviewStatus: "needs_review",
    }],
    componentCandidates: [],
    designLanguage: {
      color: [], typography: [], spacing: [], radius: [], border: [], effects: [],
      layout: [], iconography: [], imagery: [], responsive: [], content: [], interaction: [],
    },
    flows: [],
    productKnowledge: {
      capabilities: [{
        id: "capability-home",
        kind: "observed",
        text: "Users can view the home screen.",
        evidenceIds: ["SCREEN-1"],
        confidence: 0.9,
      }],
      featureRelationships: [], userJourneys: [], actorResponsibilities: [],
      requirements: [], acceptanceCriteria: [], edgeCases: [], dependencies: [], risks: [],
      successMetrics: [], guardrails: [], analyticsEvents: [], openQuestions: [],
    },
  };
}

test("persists resumable jobs, cache, immutable manifests, revisions, review, and customer visibility", { skip: skipReason }, async () => {
  const db = await import("./db.ts");
  const { createAppKnowledgeStore } = await import("./appKnowledgeStore.ts");
  await applyMigrations(db.pool);
  await db.query(`
    TRUNCATE app_knowledge_review_events, app_knowledge_job_evidence,
      app_knowledge_evidence_cache, app_knowledge_evidence_overrides,
      app_knowledge_jobs, app_knowledge_revisions, app_knowledge_snapshots,
      version_images, app_versions, images, stored_objects, platforms, apps, jobs, users
    RESTART IDENTITY CASCADE
  `);
  await db.query(`
    INSERT INTO users (id, email, password_hash, role) VALUES
      (801, 'analyst@example.com', 'hash', 'admin'),
      (802, 'reviewer@example.com', 'hash', 'admin');
    INSERT INTO apps (id, name) VALUES (1, 'knowledge-app');
    INSERT INTO platforms (id, app_id, name) VALUES (1, 1, 'web');
    INSERT INTO app_versions (id, app_id, platform, version_number, label, status)
      VALUES (1, 1, 'web', 1, 'v1', 'published');
    INSERT INTO stored_objects (object_key, sha256, byte_size, content_type, access_class)
      VALUES ('images/1/source.png', '${"b".repeat(64)}', 10, 'image/png', 'protected');
    INSERT INTO images (id, platform_id, image_url, kind, object_key)
      VALUES (1, 1, 'capture:1', 'screen', 'images/1/source.png');
    INSERT INTO version_images (version_id, image_id) VALUES (1, 1);
  `);
  const transport = await db.query<{ id: number }>(
    "INSERT INTO jobs (type, payload) VALUES ('app-knowledge', '{}') RETURNING id",
  );
  const store = createAppKnowledgeStore();
  const target = {
    appId: 1,
    app: "knowledge-app",
    platformId: 1,
    platform: "web" as const,
    captureVersionId: 1,
    versionNumber: 1,
  };
  const created = await store.createJob(801, target, transport.rows[0].id, "test-model", 1);
  assert.equal(created.status, "queued");
  assert.equal(created.totalCount, 0);
  assert.equal(created.manifest, undefined);

  const sameSnapshotTransport = await db.query<{ id: number }>(
    "INSERT INTO jobs (type, payload) VALUES ('app-knowledge', '{}') RETURNING id",
  );
  const sameIdentity = await store.createJob(801, target, sameSnapshotTransport.rows[0].id, "test-model", 1);
  assert.equal(sameIdentity.snapshotId, created.snapshotId);

  const frozen = await store.freezeManifest(created.id, manifest, "c".repeat(64));
  assert.equal(frozen.totalCount, 1);
  await store.freezeManifest(created.id, manifest, "c".repeat(64));
  await assert.rejects(
    store.freezeManifest(created.id, manifest, "d".repeat(64)),
    /manifest is already frozen/i,
  );

  const [firstClaim, secondClaim] = await Promise.all([
    store.claimJob(created.id),
    store.claimJob(created.id),
  ]);
  assert.equal(firstClaim?.status, "running");
  assert.equal(secondClaim?.status, "running");
  await store.updateProgress(created.id, "analyzing", 0);

  const cacheKey = "e".repeat(64);
  await store.saveCachedAnalysis({
    cacheKey,
    normalizedVisualSha256: "a".repeat(64),
    platform: "web",
    promptVersion: 1,
    providerModel: "test-model",
    analysis: { evidenceId: "SCREEN-1", summary: "Home" },
  });
  await store.saveCachedAnalysis({
    cacheKey,
    normalizedVisualSha256: "a".repeat(64),
    platform: "web",
    promptVersion: 1,
    providerModel: "test-model",
    analysis: { evidenceId: "SCREEN-1", summary: "Ignored duplicate" },
  });
  assert.equal((await store.cachedAnalysis(cacheKey))?.analysis.summary, "Home");

  await store.recordEvidenceFailure(created.id, {
    evidenceId: "SCREEN-1",
    errorCode: "provider_timeout",
    attemptCount: 1,
  });
  assert.equal((await store.workerJob(created.id))?.failedCount, 1);
  const retryTransport = await db.query<{ id: number }>(
    "INSERT INTO jobs (type, payload) VALUES ('app-knowledge', '{}') RETURNING id",
  );
  await store.retryFailedEvidence(created.id, retryTransport.rows[0].id);
  await store.claimJob(created.id);
  await store.recordEvidenceResult(created.id, {
    evidenceId: "SCREEN-1",
    status: "complete",
    cacheKey,
    analysis: { evidenceId: "SCREEN-1", summary: "Home" },
    attemptCount: 2,
  });
  await store.updateProgress(created.id, "saving", 1);

  const generated = await store.completeGeneration(created.id, snapshot());
  assert.equal(generated.reviewStatus, "draft");
  const editedContent = snapshot();
  editedContent.screens[0].purpose = "Help users start";
  const edited = await store.saveRevision(created.snapshotId, generated.id, editedContent, 801);
  assert.equal(edited.revisionNumber, 2);
  await store.setReviewStatus(created.snapshotId, edited.id, "in_review", 802);
  await store.setReviewStatus(created.snapshotId, edited.id, "approved", 802);
  await assert.rejects(
    store.saveRevision(created.snapshotId, edited.id, editedContent, 801),
    /approved revision cannot be edited/i,
  );
  assert.equal(
    (await store.getApprovedSnapshotForApp("knowledge-app", "web", 1))?.currentRevision?.id,
    edited.id,
  );

  const next = await store.saveRevision(created.snapshotId, generated.id, snapshot(), 801);
  await store.setReviewStatus(created.snapshotId, next.id, "in_review", 802);
  await store.setReviewStatus(created.snapshotId, next.id, "approved", 802);
  const admin = await store.getAdminSnapshot(created.snapshotId);
  assert.equal(admin?.approvedRevisionId, next.id);
  assert.equal(admin?.revisions.find(({ id }) => id === edited.id)?.reviewStatus, "superseded");
  assert.ok((admin?.reviewEvents.length ?? 0) >= 4);

  await store.setEvidenceOverride({
    versionId: 1,
    imageId: 1,
    decision: "eligible",
    reason: "Verified isolated evidence",
    userId: 802,
  });
  assert.deepEqual((await store.evidenceOverrides(1)).map(({ imageId, decision }) => [imageId, decision]), [[1, "eligible"]]);

  const cancellableTransport = await db.query<{ id: number }>(
    "INSERT INTO jobs (type, payload) VALUES ('app-knowledge', '{}') RETURNING id",
  );
  const cancellable = await store.createJob(801, target, cancellableTransport.rows[0].id, "test-model", 1);
  await store.requestCancel(cancellable.id);
  assert.equal((await store.claimJob(cancellable.id))?.status, "cancelled");
  const resumedTransport = await db.query<{ id: number }>(
    "INSERT INTO jobs (type, payload) VALUES ('app-knowledge', '{}') RETURNING id",
  );
  assert.equal((await store.resumeJob(cancellable.id, resumedTransport.rows[0].id))?.status, "queued");
  await store.markStale(cancellable.id);
  await assert.rejects(
    store.completeGeneration(cancellable.id, snapshot("f".repeat(64))),
    /job is not active/i,
  );
});
