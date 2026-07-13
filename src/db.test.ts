import { test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { applyMigrations } from "./migrations.ts";

const ADMIN_URL = "postgres://postgres:postgres@localhost:5432/postgres";
const TEST_URL = "postgres://postgres:postgres@localhost:5432/astryx_test";

async function ensureTestDb(): Promise<string | undefined> {
  const client = new pg.Client({ connectionString: ADMIN_URL });
  try {
    await client.connect();
  } catch {
    return "Postgres not running — docker compose up -d postgres";
  }
  try {
    await client.query("CREATE DATABASE astryx_test");
  } catch (err) {
    if ((err as { code?: string }).code !== "42P04") throw err; // 42P04 = already exists
  } finally {
    await client.end();
  }
  const pool = new pg.Pool({ connectionString: TEST_URL });
  try {
    await applyMigrations(pool);
  } finally {
    await pool.end();
  }
  return undefined;
}

const skipReason = await ensureTestDb();

test("insert, list uncaptioned, then save description", { skip: skipReason }, async (t) => {
  process.env.DATABASE_URL = TEST_URL;
  const {
    insertImage,
    uncaptionedImages,
    saveDescription,
    saveScreenAnalysis,
    appImages,
    saveAppFlows,
    getAppFlows,
    saveDesignSystem,
    getDesignSystem,
    listDesignSystems,
    listAppFlowSets,
    createCollection,
    listCollections,
    addCollectionItem,
    updateCollectionItemNotes,
    removeCollectionItem,
    deleteCollection,
    listAppVersions,
    getVersionPublicationBlockers,
    submitAppVersionForReview,
    publishAppVersion,
    createAppVersion,
    ensureActiveAppVersion,
    getVersionDesignSystem,
    publishedImages,
    pool,
    query,
    closePool,
  } = await import("./db.ts");
  t.after(closePool);
  const {
    approvePlan,
    createEvidence,
    createRun,
    claimRun,
    getRun,
    requestRunCancellation,
    saveDraftPlan,
    upsertRunStep,
    updateRun,
  } = await import("./crawlStore.ts");

  for (const table of [
    "subscriptions", "free_app_unlocks", "stripe_events", "export_usage", "access_events", "exports",
    "crawl_plans", "crawl_runs", "crawl_run_steps", "crawl_evidence", "crawl_repairs",
  ]) {
    const result = await query<{ name: string | null }>("SELECT to_regclass($1) AS name", [table]);
    assert.equal(result.rows[0].name, table);
  }

  await query("TRUNCATE crawl_repairs, crawl_run_steps, crawl_evidence, crawl_runs, crawl_plans, collection_items, collections, app_flow_versions, design_system_versions, version_images, app_versions, app_flows, design_systems, apps, platforms, images RESTART IDENTITY CASCADE");
  await query(`INSERT INTO users (id, email, password_hash, role)
    VALUES
      (-101, 'db-designer@example.com', 'hash', 'user'),
      (-102, 'db-other@example.com', 'hash', 'user'),
      (-103, 'db-admin@example.com', 'hash', 'admin')
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = EXCLUDED.role`);

  const airbnbLoginId = await insertImage("airbnb", "web", "https://cdn.example.com/a.png");
  const duplicateLoginId = await insertImage("airbnb", "web", "https://cdn.example.com/a.png");
  assert.equal(duplicateLoginId, airbnbLoginId);
  const airbnbSearchId = await insertImage("airbnb", "ios", "https://cdn.example.com/b.png");
  await insertImage("linear", "web", "https://cdn.example.com/linear.png");

  // Two apps, three platforms, three images — duplicate URLs are still ignored.
  assert.equal((await query("SELECT 1 FROM apps")).rowCount, 2);
  assert.equal((await query("SELECT 1 FROM platforms")).rowCount, 3);

  const airbnbPending = await uncaptionedImages("airbnb");
  assert.equal(airbnbPending.length, 2);
  assert.ok(airbnbPending.every((image) => image.app === "airbnb"));

  const allPending = await uncaptionedImages();
  assert.equal(allPending.length, 3);
  for (const image of allPending) {
    await saveDescription(image.id, `Caption for ${image.app}`);
  }
  assert.equal((await uncaptionedImages()).length, 0);

  await saveScreenAnalysis(airbnbLoginId, {
    description: "Airbnb login",
    purpose: "Authenticate an existing guest",
    pageType: "Login",
    productArea: "Authentication",
    theme: "light",
    visibleStates: ["default"],
    componentNames: ["Text input", "Primary button"],
  });
  await saveScreenAnalysis(airbnbSearchId, {
    description: "Airbnb search",
    purpose: "Find a stay",
    pageType: "Search",
    productArea: "Discovery",
    theme: "light",
    visibleStates: ["default"],
    componentNames: ["Search input"],
  });
  assert.equal((await appImages("airbnb"))[0].analysis?.pageType, "Login");

  await saveAppFlows("airbnb", [{
    id: "login",
    title: "Login",
    description: "Authenticate with email",
    tags: ["Authentication"],
    steps: [
      { label: "Enter email", evidence: [airbnbLoginId] },
      { label: "Enter password", evidence: [airbnbSearchId] },
    ],
  }]);
  assert.deepEqual((await getAppFlows("airbnb"))[0].steps.map((step) => step.evidence[0]), [airbnbLoginId, airbnbSearchId]);

  await saveAppFlows("airbnb", []);
  assert.deepEqual(await getAppFlows("airbnb"), []);

  await saveDesignSystem("airbnb", {
    app: "airbnb",
    generatedAt: "2026-07-10T00:00:00.000Z",
    tokens: [{ id: "color-primary", kind: "color", name: "Primary", value: "#FF5A5F", role: "primary action", evidence: [airbnbLoginId] }],
    components: [],
    flows: [],
  });
  assert.equal((await getDesignSystem("airbnb"))?.tokens[0].value, "#FF5A5F");

  await saveDesignSystem("airbnb", {
    app: "airbnb",
    generatedAt: "2026-07-10T01:00:00.000Z",
    tokens: [{ id: "color-primary", kind: "color", name: "Primary", value: "#E31C5F", role: "primary action", evidence: [airbnbLoginId] }],
    components: [],
    flows: [],
  });
  assert.equal((await getDesignSystem("airbnb"))?.tokens[0].value, "#E31C5F");
  assert.deepEqual((await listDesignSystems()).map(({ app }) => app), ["airbnb"]);
  assert.deepEqual((await listAppFlowSets()).map(({ app }) => app), ["airbnb"]);

  const firstVersion = (await listAppVersions("airbnb"))[0];
  assert.equal(firstVersion.status, "draft");
  assert.deepEqual(await getVersionPublicationBlockers(firstVersion.id), []);
  assert.equal((await submitAppVersionForReview(firstVersion.id, -101)).status, "in_review");
  assert.equal((await publishAppVersion(firstVersion.id, -101)).status, "published");
  assert.equal((await publishedImages()).filter(({ app }) => app === "airbnb").length, 2);
  assert.equal((await getVersionDesignSystem("airbnb", 1))?.snapshot.tokens[0].value, "#E31C5F");

  const secondVersion = await createAppVersion("airbnb", -101, "https://mobbin.com/apps/airbnb/version/screens");
  assert.equal(secondVersion.version_number, 2);
  assert.equal(secondVersion.status, "draft");
  assert.equal((await listAppVersions("airbnb"))[0].version_number, 2);
  assert.equal(secondVersion.screen_count, 2);
  assert.equal((await ensureActiveAppVersion("airbnb", -101)).id, secondVersion.id);
  const [ensuredDraftA, ensuredDraftB] = await Promise.all([
    ensureActiveAppVersion("ensure-draft-app", -101, "https://example.com/source-a"),
    ensureActiveAppVersion("ensure-draft-app", -101, "https://example.com/source-b"),
  ]);
  assert.equal(ensuredDraftA.id, ensuredDraftB.id);
  assert.equal(ensuredDraftA.status, "draft");
  assert.equal((await listAppVersions("ensure-draft-app")).length, 1);

  const publishedBefore = (await publishedImages()).filter(({ app }) => app === "airbnb");
  const publishedDesignBefore = await getVersionDesignSystem("airbnb");
  const publishedIdBefore = (await listAppVersions("airbnb")).find(({ status }) => status === "published")?.id;
  assert.ok(publishedDesignBefore);
  assert.ok(publishedIdBefore);

  const draftImageId = await insertImage("airbnb", "web", "https://cdn.example.com/draft-failure.png");
  await saveDesignSystem("airbnb", {
    app: "airbnb",
    generatedAt: "2026-07-12T00:00:00.000Z",
    tokens: [{ id: "color-primary", kind: "color", name: "Primary", value: "#000000", role: "draft only", evidence: [draftImageId] }],
    components: [],
    flows: [],
  });
  const draftPlan = await saveDraftPlan({
    app: "airbnb",
    revision: 1,
    startUrl: "https://example.com/app",
    domain: "example.com",
    sources: [],
    reviewed: false,
    flows: [{
      id: "published-isolation",
      title: "Published isolation",
      description: "A failing draft crawl must stay isolated.",
      safe: true,
      requiredSecrets: [],
      steps: [{
        id: "open",
        action: "goto",
        url: "/draft",
        safety: "read",
        expected: { state: "draft", url: "https://example.com/draft" },
      }],
    }],
  }, -101);
  const approvedPlan = await approvePlan(draftPlan.id, -103);
  const failedRun = await createRun({
    app: "airbnb",
    versionId: secondVersion.id,
    planId: approvedPlan.id,
    environment: { browserName: "chromium" },
  });
  assert.equal((await claimRun("db-worker-failed"))?.id, failedRun.id);
  await updateRun(failedRun.id, "db-worker-failed", { status: "failed", failedCount: 1 });
  const cancelledRun = await createRun({
    app: "airbnb",
    versionId: secondVersion.id,
    planId: approvedPlan.id,
    environment: { browserName: "chromium" },
  });
  await requestRunCancellation(cancelledRun.id);

  assert.deepEqual(
    (await publishedImages()).filter(({ app }) => app === "airbnb").map(({ id }) => id),
    publishedBefore.map(({ id }) => id),
  );
  assert.deepEqual(await getVersionDesignSystem("airbnb"), publishedDesignBefore);
  assert.equal(
    (await listAppVersions("airbnb")).find(({ status }) => status === "published")?.id,
    publishedIdBefore,
  );

  const coordinationImageId = await insertImage(
    "coordination-app",
    "web",
    "https://cdn.example.com/coordination.png",
    { sourceUrl: "https://coordination.example/app", viewportWidth: 1440, viewportHeight: 900 },
  );
  await saveScreenAnalysis(coordinationImageId, {
    description: "Coordination screen",
    purpose: "Verify publication coordination",
    pageType: "Dashboard",
    productArea: "Coordination",
    theme: "light",
    visibleStates: ["default"],
    componentNames: ["Dashboard"],
  });
  await saveDesignSystem("coordination-app", {
    app: "coordination-app",
    generatedAt: "2026-07-12T02:00:00.000Z",
    tokens: [{
      id: "color-coordination",
      kind: "color",
      name: "Coordination",
      value: "#123456",
      role: "coordination",
      evidence: [coordinationImageId],
    }],
    components: [],
    flows: [],
  });
  await saveAppFlows("coordination-app", []);
  const coordinationV1 = (await listAppVersions("coordination-app"))[0];
  const coordinationDraftPlan = await saveDraftPlan({
    app: "coordination-app",
    revision: 1,
    startUrl: "https://coordination.example/app",
    domain: "coordination.example",
    sources: [],
    reviewed: false,
    flows: [{
      id: "coordination",
      title: "Coordination",
      description: "Observe publication coordination.",
      safe: true,
      requiredSecrets: [],
      steps: [{
        id: "open",
        action: "goto",
        url: "/app",
        safety: "read",
        expected: { state: "app", url: "https://coordination.example/app" },
      }],
    }],
  }, -101);
  const coordinationPlan = await approvePlan(coordinationDraftPlan.id, -103);
  await submitAppVersionForReview(coordinationV1.id, -101);
  const queuedAtPublish = await createRun({
    app: "coordination-app",
    versionId: coordinationV1.id,
    planId: coordinationPlan.id,
    environment: { browserName: "chromium" },
  });
  assert.equal((await publishAppVersion(coordinationV1.id, -103)).status, "published");
  assert.equal((await getRun(queuedAtPublish.id))?.status, "cancelled");

  const coordinationV2 = await createAppVersion("coordination-app", -101, "https://coordination.example/v2");
  const runningAtPublish = await createRun({
    app: "coordination-app",
    versionId: coordinationV2.id,
    planId: coordinationPlan.id,
    environment: { browserName: "chromium" },
  });
  assert.equal((await claimRun("publication-worker"))?.id, runningAtPublish.id);
  await submitAppVersionForReview(coordinationV2.id, -101);
  await assert.rejects(() => publishAppVersion(coordinationV2.id, -103), /active crawl/i);
  assert.equal((await listAppVersions("coordination-app"))[0].status, "in_review");
  const cancellationRequested = await getRun(runningAtPublish.id);
  assert.equal(cancellationRequested?.status, "running");
  assert.ok(cancellationRequested?.cancel_requested_at);
  await updateRun(runningAtPublish.id, "publication-worker", { status: "cancelled" });
  assert.equal((await publishAppVersion(coordinationV2.id, -103)).status, "published");
  await assert.rejects(
    () => upsertRunStep({
      runId: runningAtPublish.id,
      workerId: "publication-worker",
      flowId: "coordination",
      stepId: "open",
      flowOrder: 0,
      stepOrder: 0,
      status: "completed",
      attempts: 1,
    }),
    /lease|running|terminal/i,
  );
  await assert.rejects(
    () => createEvidence({
      runId: runningAtPublish.id,
      workerId: "publication-worker",
      versionId: coordinationV2.id,
      planId: coordinationPlan.id,
      imageId: coordinationImageId,
      flowId: "coordination",
      stepId: "open",
      sourceUrl: "https://coordination.example/app",
      finalUrl: "https://coordination.example/app",
      stateLabel: "app",
      screenshotHash: "post-publish-write",
      viewportWidth: 1440,
      viewportHeight: 900,
    }),
    /lease|running|terminal/i,
  );

  const raceVersion = await createAppVersion("coordination-app", -101, "https://coordination.example/race");
  await submitAppVersionForReview(raceVersion.id, -101);
  const raceApp = await query<{ app_id: number }>("SELECT app_id FROM app_versions WHERE id = $1", [raceVersion.id]);
  const writer = await pool.connect();
  const observer = await pool.connect();
  let writerTransactionOpen = false;
  let racingPublish: ReturnType<typeof publishAppVersion> | undefined;
  try {
    await writer.query("BEGIN");
    writerTransactionOpen = true;
    const writerPid = await writer.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
    await writer.query("SELECT id FROM app_versions WHERE id = $1 FOR SHARE", [raceVersion.id]);
    const raceRun = await writer.query<{ id: string }>(
      `INSERT INTO crawl_runs (app_id, version_id, plan_id, status, environment)
       VALUES ($1, $2, $3, 'queued', '{}'::jsonb) RETURNING id`,
      [raceApp.rows[0].app_id, raceVersion.id, coordinationPlan.id],
    );

    racingPublish = publishAppVersion(raceVersion.id, -103);
    let publicationBlockedOnVersion = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      const waiting = await observer.query<{ waiting: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM pg_stat_activity
           WHERE datname = current_database()
             AND pid <> pg_backend_pid() AND pid <> $1
             AND wait_event_type = 'Lock'
             AND query LIKE '%app_versions%FOR UPDATE%'
         ) AS waiting`,
        [writerPid.rows[0].pid],
      );
      if (waiting.rows[0].waiting) {
        publicationBlockedOnVersion = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(publicationBlockedOnVersion, true, "publication did not block on the held version lock");

    await writer.query("COMMIT");
    writerTransactionOpen = false;
    assert.equal((await racingPublish).status, "published");
    assert.equal((await getRun(raceRun.rows[0].id))?.status, "cancelled");
    assert.equal((await query(
      `SELECT 1 FROM crawl_runs
       WHERE version_id = $1 AND status IN ('queued', 'running', 'interrupted')`,
      [raceVersion.id],
    )).rowCount, 0);
  } finally {
    if (writerTransactionOpen) await writer.query("ROLLBACK");
    if (racingPublish) await racingPublish.catch(() => undefined);
    writer.release();
    observer.release();
  }

  const collection = await createCollection(-101, "Checkout research", "Patterns to revisit");
  assert.equal(collection.name, "Checkout research");
  const item = await addCollectionItem(-101, collection.id, {
    kind: "screen",
    app: "airbnb",
    referenceId: "1",
    title: "Login screen",
    notes: "Strong progressive disclosure",
  });
  assert.equal(item?.notes, "Strong progressive disclosure");
  assert.equal((await addCollectionItem(-102, collection.id, {
    kind: "screen", app: "airbnb", referenceId: "1", title: "Stolen", notes: "",
  })), undefined);
  assert.equal((await listCollections(-101))[0].items[0].title, "Login screen");
  assert.equal((await listCollections(-102)).length, 0);
  assert.equal((await updateCollectionItemNotes(-101, collection.id, item!.id, "Use in onboarding"))?.notes, "Use in onboarding");
  assert.equal(await removeCollectionItem(-102, collection.id, item!.id), false);
  assert.equal(await removeCollectionItem(-101, collection.id, item!.id), true);
  assert.equal(await deleteCollection(-102, collection.id), false);
  assert.equal(await deleteCollection(-101, collection.id), true);

});
