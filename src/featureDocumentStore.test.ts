import assert from "node:assert/strict";
import { after, test } from "node:test";
import pg from "pg";
import { applyMigrations } from "./migrations.ts";
import type {
  CreateFeatureGenerationInput,
  FeatureDocumentContent,
  FeatureEvidenceManifestItem,
  FeatureSourceFlow,
} from "./featureDocument.ts";

const ADMIN_URL = "postgres://postgres:postgres@localhost:5432/postgres";
const TEST_URL = "postgres://postgres:postgres@localhost:5432/astryx_feature_document_store_test";

async function ensureTestDb(): Promise<string | undefined> {
  const client = new pg.Client({ connectionString: ADMIN_URL });
  try {
    await client.connect();
  } catch {
    return "Postgres not running — docker compose up -d postgres";
  }
  try {
    await client.query("CREATE DATABASE astryx_feature_document_store_test");
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

const source: FeatureSourceFlow = {
  app: "checkout-app",
  platform: "web",
  flowId: "checkout",
  title: "Checkout",
  description: "Complete a purchase",
  tags: ["commerce"],
};

const evidenceManifest: FeatureEvidenceManifestItem[] = [{
  stepIndex: 0,
  imageIndex: 0,
  imageId: 1,
  evidenceId: "IMAGE-1",
  stepLabel: "Review cart",
  description: "Cart review",
  capturedAt: "2026-07-22T00:00:00.000Z",
}];

const claim = (
  id: string,
  text: string,
  kind: "observed" | "inferred" | "proposed" | "unknown" = "proposed",
  evidenceIds: string[] = [],
) => ({ id, kind, text, evidenceIds });

function content(suffix = ""): FeatureDocumentContent {
  return {
    executiveSummary: {
      purpose: claim(`purpose${suffix}`, "Make checkout resilient"),
      userValue: claim(`value${suffix}`, "Finish a purchase"),
      recommendation: claim(`recommendation${suffix}`, "Preserve progress"),
    },
    observedFlow: {
      userGoal: claim(`user-goal${suffix}`, "Complete checkout", "observed", ["IMAGE-1"]),
      entryPoint: claim(`entry${suffix}`, "Cart", "observed", ["IMAGE-1"]),
      completionPoint: claim(`completion${suffix}`, "Order confirmation", "unknown"),
      journey: [], actors: [], visibleStates: [],
    },
    flowAnalysis: {
      effectivePatterns: [], friction: [], missingStates: [], inconsistencies: [], risksAndAssumptions: [],
    },
    proposedFeature: {
      problem: claim(`problem${suffix}`, "Progress can be lost"),
      targetUsers: [], goals: [], nonGoals: [], behavior: [], journey: [],
    },
    requirements: [{
      ...claim(`requirement${suffix}`, "Preserve checkout progress"),
      priority: "must",
      acceptanceCriteria: [{
        id: `criterion${suffix}`,
        given: "checkout has started",
        when: "the session is interrupted",
        then: "progress is restored",
        evidenceIds: ["IMAGE-1"],
      }],
    }],
    edgeCases: [], successMetrics: [], guardrailMetrics: [], analyticsEvents: [], dependencies: [], openQuestions: [],
  };
}

test("keeps generation, revisions, ownership, review, media, and shares durable", { skip: skipReason }, async () => {
  const db = await import("./db.ts");
  const { createFeatureDocumentStore } = await import("./featureDocumentStore.ts");
  await applyMigrations(db.pool);
  await db.query(`
    TRUNCATE feature_document_shares, feature_document_step_analyses, feature_document_jobs,
      feature_document_revisions, feature_documents, jobs, version_images, app_versions,
      app_flows, images, stored_objects, platforms, apps, sessions, users
    RESTART IDENTITY CASCADE
  `);
  await db.query(`
    INSERT INTO users (id, email, password_hash, role) VALUES
      (701, 'owner@example.com', 'hash', 'user'),
      (702, 'other@example.com', 'hash', 'user');
    INSERT INTO apps (id, name) VALUES (1, 'checkout-app');
    INSERT INTO platforms (id, app_id, name) VALUES (1, 1, 'web');
    INSERT INTO stored_objects (object_key, sha256, byte_size, content_type, access_class)
      VALUES ('images/checkout.png', '${"a".repeat(64)}', 10, 'image/png', 'protected');
    INSERT INTO images (id, platform_id, image_url, description, object_key, created_at)
      VALUES (1, 1, 'https://example.com/checkout.png', 'Cart review', 'images/checkout.png', '2026-07-22T00:00:00.000Z');
  `);
  const transport = await db.query<{ id: number }>(
    "INSERT INTO jobs (type, payload) VALUES ('feature-document', '{}') RETURNING id",
  );
  const generation: CreateFeatureGenerationInput = {
    transportJobId: transport.rows[0].id,
    source,
    evidenceManifest,
    evidenceManifestSha256: "b".repeat(64),
    focusInstruction: "Focus on recovery",
    promptVersion: 1,
    providerModel: "research-model",
  };
  const store = createFeatureDocumentStore();

  const created = await store.createGeneration(701, generation);
  assert.equal(created.document.reviewStatus, "draft");
  assert.equal(created.job.stage, "preparing");
  assert.equal(created.job.totalCount, 1);
  assert.equal(await store.getDocument(702, created.document.id), undefined);
  assert.equal(await store.getJob(702, created.job.id), undefined);

  const claimed = await store.claimJob(created.job.id);
  assert.equal(claimed?.status, "running");
  await store.updateProgress(created.job.id, "analyzing", 1);
  assert.equal((await store.getJob(701, created.job.id))?.doneCount, 1);
  await store.recordStepAnalysis(created.job.id, {
    stepIndex: 0,
    imageIndex: 0,
    imageId: 1,
    evidenceId: "IMAGE-1",
    attemptCount: 1,
    result: {
      evidenceId: "IMAGE-1",
      visibleUi: ["Cart"],
      visibleText: ["Checkout"],
      likelyIntent: "Review cart",
      availableActions: ["Checkout"],
      systemFeedback: [], friction: [], missingOrUncertainStates: [], accessibility: [], confidence: 0.9,
    },
  });
  assert.equal((await store.completedStepAnalyses(created.job.id)).length, 1);

  const generated = await store.completeGeneration(created.job.id, {
    content: content("-generated"),
    source,
    evidenceManifest,
    evidenceManifestSha256: generation.evidenceManifestSha256,
    focusInstruction: generation.focusInstruction,
    promptVersion: generation.promptVersion,
    providerModel: generation.providerModel,
  });
  const edited = await store.saveRevision(701, created.document.id, generated.id, content("-edited"));
  assert.ok(edited);
  const restored = await store.restoreRevision(701, created.document.id, generated.id);
  assert.deepEqual(
    [generated.revisionNumber, edited?.revisionNumber, restored?.revisionNumber],
    [1, 2, 3],
  );
  assert.equal(restored?.authorType, "restored");
  assert.equal(await store.saveRevision(702, created.document.id, restored!.id, content("-forbidden")), undefined);

  const firstApproval = await store.setReviewStatus(701, created.document.id, restored!.id, "approved");
  assert.equal(firstApproval?.reviewStatus, "approved");
  const next = await store.saveRevision(701, created.document.id, restored!.id, content("-next"));
  const secondApproval = await store.setReviewStatus(701, created.document.id, next!.id, "approved");
  assert.equal(secondApproval?.reviewStatus, "approved");
  assert.equal(secondApproval?.revisions.find(({ id }) => id === restored!.id)?.reviewStatus, "superseded");
  assert.equal((await store.getDocument(701, created.document.id, "e".repeat(64)))?.sourceChanged, true);
  assert.equal((await store.acknowledgeSourceChange(701, created.document.id, "e".repeat(64)))?.sourceChanged, false);
  assert.equal((await store.getDocument(701, created.document.id, "e".repeat(64)))?.sourceChanged, false);

  const image = await store.documentImage(701, created.document.id, next!.id, 1);
  assert.equal(image?.key, "images/checkout.png");
  assert.equal(await store.documentImage(702, created.document.id, next!.id, 1), undefined);

  const now = new Date("2026-07-22T00:00:00.000Z");
  const tokenSha256 = "c".repeat(64);
  const grant = await store.createShare(701, created.document.id, next!.id, tokenSha256, now);
  assert.equal(grant?.expiresAt, "2026-07-29T00:00:00.000Z");
  assert.ok(await store.publicShare(tokenSha256, new Date("2026-07-28T23:59:59.000Z")));
  assert.equal(await store.publicShare(tokenSha256, new Date("2026-07-29T00:00:00.000Z")), undefined);
  assert.equal((await store.publicShareImage(tokenSha256, 1, new Date("2026-07-28T00:00:00.000Z")))?.key, "images/checkout.png");
  assert.equal(await store.revokeShare(702, created.document.id, grant!.id), false);
  assert.equal(await store.revokeShare(701, created.document.id, grant!.id), true);
  assert.equal(await store.publicShare(tokenSha256, new Date("2026-07-23T00:00:00.000Z")), undefined);

  const regenerationTransport = await db.query<{ id: number }>(
    "INSERT INTO jobs (type, payload) VALUES ('feature-document', '{}') RETURNING id",
  );
  const regeneration = await store.createRegeneration(701, created.document.id, {
    ...generation,
    transportJobId: regenerationTransport.rows[0].id,
    evidenceManifestSha256: "d".repeat(64),
  });
  assert.ok(regeneration);
  assert.equal((await store.getDocument(701, created.document.id))?.sourceChanged, true);
  assert.equal((await store.acknowledgeSourceChange(701, created.document.id, "d".repeat(64)))?.sourceChanged, false);
  await store.markStale(regeneration!.id);
  assert.equal((await store.getJob(701, regeneration!.id))?.status, "stale");

  const cancellationTransport = await db.query<{ id: number }>(
    "INSERT INTO jobs (type, payload) VALUES ('feature-document', '{}') RETURNING id",
  );
  const cancellable = await store.createRegeneration(701, created.document.id, {
    ...generation,
    transportJobId: cancellationTransport.rows[0].id,
  });
  assert.equal((await store.requestCancel(702, cancellable!.id)), undefined);
  assert.equal((await store.requestCancel(701, cancellable!.id))?.status, "queued");
  assert.equal((await store.claimJob(cancellable!.id))?.status, "cancelled");
});
