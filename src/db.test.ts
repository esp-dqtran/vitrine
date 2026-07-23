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
    resolveAppVersion,
    getVersionPublicationBlockers,
    submitAppVersionForReview,
    publishAppVersion,
    createAppVersion,
    ensureActiveAppVersion,
    getVersionDesignSystem,
    listPublishedDesignSystems,
    listPublishedFlowSets,
    appMetadata,
    adminAppPage,
    appEvidencePage,
    getVersionFlows,
    flowEvidenceImages,
    versionImages,
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
    VALUES (-103, 'db-admin@example.com', 'hash', 'admin')
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = EXCLUDED.role`);

  const scopedWebImage = await insertImage("scope-app", "web", "https://cdn.example.com/scope-web.png");
  const scopedWebElement = await insertImage("scope-app", "web", "https://cdn.example.com/scope-web-element.png", { kind: "ui_element" });
  const scopedIosImage = await insertImage("scope-app", "ios", "https://cdn.example.com/scope-ios.png");
  const scopedWebVersion = (await listAppVersions("scope-app", "web"))[0];
  const scopedIosVersion = (await listAppVersions("scope-app", "ios"))[0];
  assert.ok(scopedWebVersion);
  assert.ok(scopedIosVersion);
  assert.deepEqual(
    (await versionImages("scope-app", "web", scopedWebVersion.version_number)).map(({ id }) => id),
    [scopedWebImage],
  );
  assert.deepEqual(
    (await versionImages("scope-app", "ios", scopedIosVersion.version_number)).map(({ id }) => id),
    [scopedIosImage],
  );
  await saveScreenAnalysis(scopedWebImage, {
    description: "Web home", purpose: "Use the web app", pageType: "Home", productArea: "Core",
    theme: "light", visibleStates: ["default"], componentNames: [],
  });
  await saveScreenAnalysis(scopedIosImage, {
    description: "iOS home", purpose: "Use the iOS app", pageType: "Home", productArea: "Core",
    theme: "light", visibleStates: ["default"], componentNames: [],
  });
  await saveDesignSystem("scope-app", "web", {
    app: "scope-app", generatedAt: "2026-07-16T00:00:00.000Z",
    tokens: [{ id: "web-token", kind: "color", name: "Web", value: "#000000", role: "web", evidence: [scopedWebImage] }],
    components: [], flows: [],
  });
  await saveDesignSystem("scope-app", "ios", {
    app: "scope-app", generatedAt: "2026-07-16T00:00:00.000Z",
    tokens: [{ id: "ios-token", kind: "color", name: "iOS", value: "#ffffff", role: "ios", evidence: [scopedIosImage] }],
    components: [], flows: [],
  });
  await saveAppFlows("scope-app", "web", [{
    id: "web-flow", title: "Web", description: "Web flow", tags: [],
    steps: [{ label: "Web", evidence: [scopedWebImage] }],
  }]);
  await saveAppFlows("scope-app", "ios", [{
    id: "ios-flow", title: "iOS", description: "iOS flow", tags: [],
    steps: [{ label: "iOS", evidence: [scopedIosImage] }],
  }]);
  assert.equal((await submitAppVersionForReview(scopedIosVersion.id, -103)).status, "in_review");
  assert.equal((await publishAppVersion(scopedIosVersion.id, -103)).status, "published");
  const scopedPublished = await getVersionDesignSystem("scope-app", "ios", scopedIosVersion.version_number);
  assert.equal(scopedPublished?.snapshot.tokens[0].id, "ios-token");
  assert.equal(scopedPublished?.flows[0].id, "ios-flow");
  assert.equal((await submitAppVersionForReview(scopedWebVersion.id, -103)).status, "in_review");
  assert.equal((await publishAppVersion(scopedWebVersion.id, -103)).status, "published");
  const scopedWebV2 = await createAppVersion("scope-app", "web", -103, "https://example.com/web-v2");
  const resolvedPublished = await resolveAppVersion("scope-app", "web", undefined, false);
  assert.equal(resolvedPublished?.id, scopedWebVersion.id);
  assert.equal(resolvedPublished?.screen_count, 1);
  assert.equal((await resolveAppVersion("scope-app", "web", scopedWebV2.version_number, false))?.status, "draft");
  assert.equal(await resolveAppVersion("scope-app", "web", scopedWebV2.version_number, true), undefined);
  await saveDesignSystem("scope-app", "web", {
    app: "scope-app", generatedAt: "2026-07-16T01:00:00.000Z",
    tokens: [{ id: "web-token-v2", kind: "color", name: "Web v2", value: "#111111", role: "web", evidence: [scopedWebImage] }],
    components: [], flows: [],
  });
  await saveAppFlows("scope-app", "web", [{
    id: "web-flow-v2", title: "Web v2", description: "Web flow v2", tags: [],
    steps: [{ label: "Web v2", evidence: [scopedWebImage] }],
  }]);
  assert.equal((await submitAppVersionForReview(scopedWebV2.id, -103)).status, "in_review");
  assert.equal((await publishAppVersion(scopedWebV2.id, -103)).status, "published");
  assert.deepEqual(
    (await listPublishedDesignSystems()).map(({ tokens }) => tokens[0].id).sort(),
    ["ios-token", "web-token-v2"],
  );
  assert.deepEqual(
    (await listPublishedFlowSets()).map(({ flows }) => flows[0].id).sort(),
    ["ios-flow", "web-flow-v2"],
  );
  const adminMetadata = await appMetadata("scope-app", false);
  assert.equal(adminMetadata?.total_screens, 2);
  assert.equal(adminMetadata?.total_ui_elements, 1);
  assert.equal(adminMetadata?.total_flows, 2);
  assert.deepEqual(adminMetadata?.available_platforms, ["web", "ios"]);
  const scopeGallery = await adminAppPage(undefined, 24);
  assert.equal(scopeGallery.total, 1);
  assert.equal(scopeGallery.nextCursor, null);
  assert.deepEqual(scopeGallery.images.map(({ id }) => id), [scopedWebImage, scopedIosImage]);
  assert.ok(scopeGallery.images.every(({ total_screens }) => total_screens === 2));
  assert.ok(scopeGallery.images.every(({ analyzed_screens }) => analyzed_screens === 2));
  assert.ok(scopeGallery.images.every(({ available_platforms }) =>
    JSON.stringify(available_platforms) === JSON.stringify(["web", "ios"])));
  const customerMetadata = await appMetadata("scope-app", true);
  assert.equal(customerMetadata?.total_screens, 2);
  assert.equal(customerMetadata?.total_ui_elements, 1);
  assert.equal(customerMetadata?.total_flows, 2);
  const webElements = await appEvidencePage({
    app: "scope-app", platform: "web", kind: "ui_element",
    versionNumber: scopedWebV2.version_number, publishedOnly: true, limit: 48,
  });
  assert.deepEqual(webElements.rows.map(({ id }) => id), [scopedWebElement]);
  assert.equal(webElements.nextCursor, null);
  const webFlows = await getVersionFlows("scope-app", "web", scopedWebV2.version_number, true);
  assert.deepEqual(webFlows.map(({ id }) => id), ["web-flow-v2"]);
  const flowImages = await flowEvidenceImages({
    app: "scope-app", platform: "web", versionNumber: scopedWebV2.version_number,
    imageIds: [scopedWebImage, scopedIosImage], publishedOnly: true,
  });
  assert.deepEqual(flowImages.map(({ id }) => id), [scopedWebImage]);
  const scopedWebDraft = await createAppVersion("scope-app", "web", -103, "https://example.com/web-v3");
  assert.deepEqual(
    (await getVersionFlows("scope-app", "web", scopedWebDraft.version_number, false)).map(({ id }) => id),
    ["web-flow-v2"],
  );

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
  const airbnbSearchId = await insertImage("airbnb", "web", "https://cdn.example.com/b.png");
  await insertImage("linear", "web", "https://cdn.example.com/linear.png");
  const firstGalleryPage = await adminAppPage(undefined, 1);
  assert.equal(firstGalleryPage.total, 2);
  assert.equal(firstGalleryPage.nextCursor, "airbnb");
  assert.deepEqual([...new Set(firstGalleryPage.images.map(({ app }) => app))], ["airbnb"]);

  const secondGalleryPage = await adminAppPage(firstGalleryPage.nextCursor ?? undefined, 1);
  assert.equal(secondGalleryPage.total, 2);
  assert.equal(secondGalleryPage.nextCursor, null);
  assert.deepEqual([...new Set(secondGalleryPage.images.map(({ app }) => app))], ["linear"]);

  // Two apps, two platforms, three images — duplicate URLs are still ignored.
  assert.equal((await query("SELECT 1 FROM apps")).rowCount, 2);
  assert.equal((await query("SELECT 1 FROM platforms")).rowCount, 2);

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

  await saveAppFlows("airbnb", "web", [{
    id: "login",
    title: "Login",
    description: "Authenticate with email",
    tags: ["Authentication"],
    steps: [
      { label: "Enter email", evidence: [airbnbLoginId] },
      { label: "Enter password", evidence: [airbnbSearchId] },
    ],
  }]);
  assert.deepEqual((await getAppFlows("airbnb", "web"))[0].steps.map((step) => step.evidence[0]), [airbnbLoginId, airbnbSearchId]);

  await saveAppFlows("airbnb", "web", []);
  assert.deepEqual(await getAppFlows("airbnb", "web"), []);

  await saveDesignSystem("airbnb", "web", {
    app: "airbnb",
    generatedAt: "2026-07-10T00:00:00.000Z",
    tokens: [{ id: "color-primary", kind: "color", name: "Primary", value: "#FF5A5F", role: "primary action", evidence: [airbnbLoginId] }],
    components: [],
    flows: [],
  });
  assert.equal((await getDesignSystem("airbnb", "web"))?.tokens[0].value, "#FF5A5F");

  await saveDesignSystem("airbnb", "web", {
    app: "airbnb",
    generatedAt: "2026-07-10T01:00:00.000Z",
    tokens: [{ id: "color-primary", kind: "color", name: "Primary", value: "#E31C5F", role: "primary action", evidence: [airbnbLoginId] }],
    components: [],
    flows: [],
  });
  assert.equal((await getDesignSystem("airbnb", "web"))?.tokens[0].value, "#E31C5F");
  assert.deepEqual((await listDesignSystems()).map(({ app }) => app), ["airbnb"]);
  assert.deepEqual((await listAppFlowSets()).map(({ app }) => app), ["airbnb"]);

  const firstVersion = (await listAppVersions("airbnb", "web"))[0];
  assert.equal(firstVersion.status, "draft");
  assert.deepEqual(await getVersionPublicationBlockers(firstVersion.id), []);
  assert.equal((await submitAppVersionForReview(firstVersion.id, -101)).status, "in_review");
  assert.equal((await publishAppVersion(firstVersion.id, -101)).status, "published");
  assert.equal((await publishedImages()).filter(({ app }) => app === "airbnb").length, 2);
  assert.equal((await getVersionDesignSystem("airbnb", "web", 1))?.snapshot.tokens[0].value, "#E31C5F");

  const secondVersion = await createAppVersion("airbnb", "web", -101, "https://mobbin.com/apps/airbnb/version/screens");
  assert.equal(secondVersion.version_number, 2);
  assert.equal(secondVersion.status, "draft");
  assert.equal((await listAppVersions("airbnb", "web"))[0].version_number, 2);
  assert.equal(secondVersion.screen_count, 2);
  assert.equal((await ensureActiveAppVersion("airbnb", "web", -101)).id, secondVersion.id);
  const [ensuredDraftA, ensuredDraftB] = await Promise.all([
    ensureActiveAppVersion("ensure-draft-app", "web", -101, "https://example.com/source-a"),
    ensureActiveAppVersion("ensure-draft-app", "web", -101, "https://example.com/source-b"),
  ]);
  assert.equal(ensuredDraftA.id, ensuredDraftB.id);
  assert.equal(ensuredDraftA.status, "draft");
  assert.equal((await listAppVersions("ensure-draft-app", "web")).length, 1);

  const publishedBefore = (await publishedImages()).filter(({ app }) => app === "airbnb");
  const publishedDesignBefore = await getVersionDesignSystem("airbnb", "web");
  const publishedIdBefore = (await listAppVersions("airbnb", "web")).find(({ status }) => status === "published")?.id;
  assert.ok(publishedDesignBefore);
  assert.ok(publishedIdBefore);

  const draftImageId = await insertImage("airbnb", "web", "https://cdn.example.com/draft-failure.png");
  await saveDesignSystem("airbnb", "web", {
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
  assert.deepEqual(await getVersionDesignSystem("airbnb", "web"), publishedDesignBefore);
  assert.equal(
    (await listAppVersions("airbnb", "web")).find(({ status }) => status === "published")?.id,
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
  await saveDesignSystem("coordination-app", "web", {
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
  await saveAppFlows("coordination-app", "web", []);
  const coordinationV1 = (await listAppVersions("coordination-app", "web"))[0];
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

  const coordinationV2 = await createAppVersion("coordination-app", "web", -101, "https://coordination.example/v2");
  const runningAtPublish = await createRun({
    app: "coordination-app",
    versionId: coordinationV2.id,
    planId: coordinationPlan.id,
    environment: { browserName: "chromium" },
  });
  assert.equal((await claimRun("publication-worker"))?.id, runningAtPublish.id);
  await submitAppVersionForReview(coordinationV2.id, -101);
  await assert.rejects(() => publishAppVersion(coordinationV2.id, -103), /active crawl/i);
  assert.equal((await listAppVersions("coordination-app", "web"))[0].status, "in_review");
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

  const raceVersion = await createAppVersion("coordination-app", "web", -101, "https://coordination.example/race");
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
