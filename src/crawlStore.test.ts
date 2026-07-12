import assert from "node:assert/strict";
import { test } from "node:test";
import pg from "pg";

const ADMIN_URL = "postgres://postgres:postgres@localhost:5432/postgres";
const TEST_URL = "postgres://postgres:postgres@localhost:5432/astryx_crawl_store_test";

async function ensureTestDb(): Promise<string | undefined> {
  const client = new pg.Client({ connectionString: ADMIN_URL });
  try {
    await client.connect();
  } catch {
    return "Postgres not running — docker compose up -d postgres";
  }
  try {
    await client.query("CREATE DATABASE astryx_crawl_store_test");
  } catch (error) {
    if ((error as { code?: string }).code !== "42P04") throw error;
  } finally {
    await client.end();
  }
  return undefined;
}

const skipReason = await ensureTestDb();

test("durable crawl lifecycle keeps plans, runs, evidence, and repairs consistent", { skip: skipReason }, async () => {
  process.env.DATABASE_URL = TEST_URL;
  const db = await import("./db.ts");

  try {
    for (const table of ["crawl_plans", "crawl_runs", "crawl_run_steps", "crawl_evidence", "crawl_repairs"]) {
      const result = await db.query<{ name: string | null }>("SELECT to_regclass($1) AS name", [table]);
      assert.equal(result.rows[0].name, table);
    }

    const constraints = await db.query<{ definition: string }>(`
      SELECT pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conrelid = ANY (ARRAY[
        'crawl_plans'::regclass,
        'crawl_runs'::regclass,
        'crawl_run_steps'::regclass,
        'crawl_evidence'::regclass,
        'crawl_repairs'::regclass
      ])
    `);
    const definitions = constraints.rows.map(({ definition }) => definition).join("\n").replace(/\s+/g, " ");
    assert.match(definitions, /UNIQUE \(app_id, revision\)/);
    assert.match(definitions, /UNIQUE \(app_id, content_hash\)/);
    assert.match(definitions, /PRIMARY KEY \(run_id, flow_id, step_id\)/);
    assert.match(definitions, /UNIQUE \(version_id, plan_id, flow_id, step_id, final_url, viewport_width, viewport_height\)/);
    for (const status of [
      "draft", "approved", "superseded",
      "queued", "running", "succeeded", "failed", "cancelled", "interrupted",
      "completed", "skipped",
      "proposed", "applied", "rejected",
    ]) {
      assert.ok(definitions.includes(`'${status}'::text`), `missing database status constraint for ${status}`);
    }

    const imageIdentity = await db.query<{ indexdef: string }>(`
      SELECT indexdef FROM pg_indexes
      WHERE tablename = 'images' AND indexdef LIKE 'CREATE UNIQUE INDEX%platform_id%image_url%'
    `);
    assert.equal(imageIdentity.rowCount, 1);

    const store = await import("./crawlStore.ts");

    await db.query(`
      TRUNCATE crawl_repairs, crawl_run_steps, crawl_evidence, crawl_runs, crawl_plans,
        collection_items, collections, app_flow_versions, design_system_versions,
        version_images, app_versions, app_flows, design_systems, jobs, platforms, images, apps
      RESTART IDENTITY CASCADE
    `);
    await db.query(`
      INSERT INTO users (id, email, password_hash, role, active)
      VALUES
        (-201, 'crawl-admin@example.com', 'hash', 'admin', true),
        (-202, 'crawl-user@example.com', 'hash', 'user', true)
      ON CONFLICT (id) DO UPDATE
      SET email = EXCLUDED.email, role = EXCLUDED.role, active = EXCLUDED.active
    `);

    const imageUrl = "https://cdn.example.com/durable-home.png";
    const [imageId, repeatedImageId] = await Promise.all([
      db.insertImage("durable-app", "web", imageUrl, { sourceUrl: "https://example.com/home", viewportWidth: 1440, viewportHeight: 900 }),
      db.insertImage("durable-app", "web", imageUrl, { sourceUrl: "https://example.com/home", viewportWidth: 1440, viewportHeight: 900 }),
    ]);
    assert.equal(repeatedImageId, imageId);
    assert.equal((await db.query(
      `SELECT 1 FROM images i JOIN platforms p ON p.id = i.platform_id
       WHERE p.name = 'web' AND i.image_url = $1`,
      [imageUrl],
    )).rowCount, 1);

    const version = (await db.listAppVersions("durable-app"))[0];
    assert.equal(version.status, "draft");

    const planV1 = {
      app: "durable-app",
      revision: 1,
      startUrl: "https://example.com/app",
      domain: "example.com",
      sources: ["https://example.com/docs"],
      reviewed: false,
      flows: [{
        id: "core",
        title: "Core navigation",
        description: "Open the app and observe its dashboard.",
        safe: true,
        requiredSecrets: [],
        steps: [
          {
            id: "open",
            action: "goto",
            url: "/home",
            safety: "read",
            expected: { state: "home", url: "https://example.com/home" },
          },
          {
            id: "dashboard",
            action: "waitFor",
            text: "Dashboard",
            safety: "read",
            expected: { state: "dashboard", visible: { text: "Dashboard" } },
          },
        ],
      }],
    };

    const draft = await store.saveDraftPlan(planV1, -202, { source: "official-docs" });
    assert.equal(draft.revision, 1);
    assert.equal(draft.status, "draft");
    assert.equal(draft.content_hash.length, 64);
    assert.deepEqual(draft.research_metadata, { source: "official-docs" });
    await assert.rejects(
      () => store.createRun({ app: "durable-app", versionId: version.id, planId: draft.id, environment: {} }),
      /approved plan/i,
    );

    const approved = await store.approvePlan(draft.id, -201);
    assert.equal(approved.status, "approved");
    assert.equal(approved.plan.reviewed, true);
    assert.equal((await store.listPlans("durable-app")).length, 1);
    const approvedSnapshot = structuredClone(approved.plan);
    const approvedHash = approved.content_hash;

    await db.insertImage("wrong-app", "web", "https://cdn.example.com/wrong.png");
    const wrongVersion = (await db.listAppVersions("wrong-app"))[0];
    await assert.rejects(
      () => store.createRun({ app: "wrong-app", versionId: wrongVersion.id, planId: approved.id, environment: {} }),
      /same app/i,
    );
    await assert.rejects(
      () => store.createRun({ app: "durable-app", versionId: 999_999, planId: approved.id, environment: {} }),
      /draft or in-review version/i,
    );

    const secret = "never-echo-this-value";
    try {
      await store.createRun({
        app: "durable-app",
        versionId: version.id,
        planId: approved.id,
        environment: { password: secret } as never,
      });
      assert.fail("secret-like environment metadata was accepted");
    } catch (error) {
      const message = (error as Error).message;
      assert.match(message, /secret-like/i);
      assert.equal(message.includes(secret), false);
    }

    const arbitraryEnvironmentValue = "ordinary-but-not-allowlisted";
    try {
      await store.createRun({
        app: "durable-app",
        versionId: version.id,
        planId: approved.id,
        environment: { notes: arbitraryEnvironmentValue } as never,
      });
      assert.fail("unknown environment metadata was accepted");
    } catch (error) {
      const message = (error as Error).message;
      assert.match(message, /unsupported/i);
      assert.equal(message.includes(arbitraryEnvironmentValue), false);
    }

    const jobId = await db.createJob("smart-crawl", { app: "durable-app" });
    const runEnvironment = {
      headless: true,
      browserName: "chromium",
      browserVersion: "126",
      platform: "linux",
      workerVersion: "1.0.0",
      locale: "en-US",
      timezone: "UTC",
      viewport: { width: 1440, height: 900 },
    };
    const run = await store.createRun({
      app: "durable-app",
      versionId: version.id,
      planId: approved.id,
      jobId,
      environment: runEnvironment,
    });
    assert.equal(run.status, "queued");
    assert.equal(run.retry_mode, "all");
    assert.equal(run.version_id, version.id);
    assert.equal(run.plan_id, approved.id);
    assert.deepEqual(run.environment, runEnvironment);

    const claimed = await store.claimRun("crawler-1");
    assert.equal(claimed?.id, run.id);
    assert.equal(claimed?.status, "running");
    assert.equal(claimed?.worker_id, "crawler-1");
    const heartbeat = await store.heartbeatRun(run.id, "crawler-1");
    assert.equal(heartbeat.status, "running");
    assert.ok(heartbeat.heartbeat_at);

    const otherDraft = await db.query<{ id: number }>(
      `INSERT INTO app_versions (app_id, version_number, label, status)
       SELECT app_id, 999, 'other-active-draft', 'draft' FROM app_versions WHERE id = $1
       RETURNING id`,
      [version.id],
    );
    const bundleInput = {
      runId: run.id,
      workerId: "crawler-1",
      app: "durable-app",
      versionId: version.id,
      planId: approved.id,
      imageUrl: "capture:1111111111111111",
      flowId: "core",
      stepId: "dashboard",
      sourceUrl: "https://example.com/home",
      finalUrl: "https://example.com/dashboard",
      stateLabel: "dashboard",
      screenshotHash: "1".repeat(64),
      viewportWidth: 1440,
      viewportHeight: 900,
    };
    const bundle = await store.persistEvidenceBundle(bundleInput);
    assert.deepEqual(
      { imageCreated: bundle.imageCreated, evidenceCreated: bundle.evidenceCreated, reused: bundle.reused },
      { imageCreated: true, evidenceCreated: true, reused: false },
    );
    const repeatedBundle = await store.persistEvidenceBundle(bundleInput);
    assert.equal(repeatedBundle.imageId, bundle.imageId);
    assert.equal(repeatedBundle.evidence.id, bundle.evidence.id);
    assert.deepEqual(
      { imageCreated: repeatedBundle.imageCreated, evidenceCreated: repeatedBundle.evidenceCreated, reused: repeatedBundle.reused },
      { imageCreated: false, evidenceCreated: false, reused: true },
    );
    assert.deepEqual(
      (await db.query<{ version_id: number }>(
        "SELECT version_id FROM version_images WHERE image_id = $1 ORDER BY version_id",
        [bundle.imageId],
      )).rows.map(({ version_id }) => version_id),
      [version.id],
    );
    await assert.rejects(
      () => store.persistEvidenceBundle({ ...bundleInput, versionId: otherDraft.rows[0].id }),
      /pinned version|run version/i,
    );

    const failedImageUrl = "capture:2222222222222222";
    await assert.rejects(
      () => store.persistEvidenceBundle({
        ...bundleInput,
        imageUrl: failedImageUrl,
        finalUrl: "https://example.com/evidence-failure",
        screenshotHash: "2".repeat(64),
        capturedAt: "not-a-timestamp",
      }),
      /date|time|timestamp/i,
    );
    assert.equal((await db.query(
      `SELECT 1 FROM images i JOIN platforms p ON p.id = i.platform_id
       WHERE p.app_id = (SELECT app_id FROM app_versions WHERE id = $1) AND p.name = 'web' AND i.image_url = $2`,
      [version.id, failedImageUrl],
    )).rowCount, 0);
    assert.equal((await db.query(
      "SELECT 1 FROM crawl_evidence WHERE version_id = $1 AND final_url = 'https://example.com/evidence-failure'",
      [version.id],
    )).rowCount, 0);
    await db.query("DELETE FROM app_versions WHERE id = $1", [otherDraft.rows[0].id]);

    await assert.rejects(
      () => store.upsertRunStep({
        runId: run.id,
        workerId: "crawler-1",
        flowId: "missing-flow",
        stepId: "missing-step",
        flowOrder: 1,
        stepOrder: 0,
        status: "completed",
        attempts: 1,
      }),
      /pinned plan/i,
    );
    assert.equal((await db.query(
      "SELECT 1 FROM crawl_run_steps WHERE run_id = $1 AND flow_id = 'missing-flow'",
      [run.id],
    )).rowCount, 0);
    await assert.rejects(
      () => store.createEvidence({
        runId: run.id,
        workerId: "crawler-1",
        versionId: version.id,
        planId: approved.id,
        imageId,
        flowId: "missing-flow",
        stepId: "missing-step",
        sourceUrl: "https://example.com/app",
        finalUrl: "https://example.com/missing",
        stateLabel: "missing",
        screenshotHash: "screen-missing",
        viewportWidth: 1440,
        viewportHeight: 900,
      }),
      /pinned plan/i,
    );

    const completedStep = await store.upsertRunStep({
      runId: run.id,
      workerId: "crawler-1",
      flowId: "core",
      stepId: "open",
      flowOrder: 0,
      stepOrder: 0,
      status: "completed",
      attempts: 1,
      sourceUrl: "https://example.com/app",
      finalUrl: "https://example.com/home",
      expected: { state: "home", url: "https://example.com/home" },
      actual: { state: "home", url: "https://example.com/home" },
      observedScreenshotHash: "screen-home",
    });
    assert.equal(completedStep.status, "completed");

    const failedStep = await store.upsertRunStep({
      runId: run.id,
      workerId: "crawler-1",
      flowId: "core",
      stepId: "dashboard",
      flowOrder: 0,
      stepOrder: 1,
      status: "failed",
      attempts: 2,
      sourceUrl: "https://example.com/home",
      finalUrl: "https://example.com/home",
      expected: { state: "dashboard", visible: { text: "Dashboard" } },
      actual: { state: "home", visible: [] },
      errorClass: "ExpectedStateMismatch",
      errorMessage: "Dashboard marker was absent",
      failureScreenshot: "screen-dashboard-failed",
    });
    assert.equal(failedStep.status, "failed");

    const updated = await store.updateRun(run.id, "crawler-1", {
      currentFlowId: "core",
      currentStepId: "dashboard",
      completedCount: 1,
      failedCount: 1,
      skippedCount: 0,
    });
    assert.equal(updated.completed_count, 1);
    assert.equal(updated.failed_count, 1);
    assert.equal((await store.listRuns("durable-app")).length, 1);
    assert.equal((await store.getRun(run.id))?.current_step_id, "dashboard");

    await store.requestRunCancellation(run.id);
    assert.equal(await store.isRunCancellationRequested(run.id), true);

    const evidenceInput = {
      runId: run.id,
      workerId: "crawler-1",
      versionId: version.id,
      planId: approved.id,
      imageId,
      flowId: "core",
      stepId: "open",
      sourceUrl: "https://example.com/app",
      finalUrl: "https://example.com/home",
      stateLabel: "home",
      screenshotHash: "screen-home",
      viewportWidth: 1440,
      viewportHeight: 900,
    };
    const evidence = await store.createEvidence(evidenceInput);
    const repeatedEvidence = await store.createEvidence(evidenceInput);
    assert.equal(repeatedEvidence.id, evidence.id);
    assert.equal((await store.findEvidence(evidenceInput))?.id, evidence.id);

    const fixedStartedAt = "2026-07-12T01:00:00.000Z";
    const fixedFinishedAt = "2026-07-12T01:00:03.000Z";
    const fullStepInput = {
      runId: run.id,
      workerId: "crawler-1",
      flowId: "core",
      stepId: "open",
      flowOrder: 0,
      stepOrder: 0,
      status: "failed" as const,
      attempts: 2,
      sourceUrl: "https://example.com/app",
      finalUrl: "https://example.com/home",
      expected: { state: "home", url: "https://example.com/home" },
      actual: { state: "unexpected", url: "https://example.com/home" },
      observedScreenshotHash: "screen-home-failed",
      evidenceId: evidence.id,
      errorClass: "ExpectedStateMismatch",
      errorMessage: "Home state changed",
      failureScreenshot: "screen-home-failure",
      startedAt: fixedStartedAt,
      finishedAt: fixedFinishedAt,
    };
    const fullStepInputBefore = structuredClone(fullStepInput);
    const fullyStoredStep = await store.upsertRunStep(fullStepInput);
    assert.deepEqual(fullStepInput, fullStepInputBefore);

    const partialStepInput = {
      runId: run.id,
      workerId: "crawler-1",
      flowId: "core",
      stepId: "open",
      flowOrder: 0,
      stepOrder: 0,
      status: "completed" as const,
      attempts: 3,
    };
    const partialStepInputBefore = structuredClone(partialStepInput);
    const partiallyUpdatedStep = await store.upsertRunStep(partialStepInput);
    assert.deepEqual(partialStepInput, partialStepInputBefore);
    assert.deepEqual(
      {
        source_url: partiallyUpdatedStep.source_url,
        final_url: partiallyUpdatedStep.final_url,
        expected: partiallyUpdatedStep.expected,
        actual: partiallyUpdatedStep.actual,
        observed_screenshot_hash: partiallyUpdatedStep.observed_screenshot_hash,
        evidence_id: partiallyUpdatedStep.evidence_id,
        error_class: partiallyUpdatedStep.error_class,
        error_message: partiallyUpdatedStep.error_message,
        failure_screenshot: partiallyUpdatedStep.failure_screenshot,
      },
      {
        source_url: fullyStoredStep.source_url,
        final_url: fullyStoredStep.final_url,
        expected: fullyStoredStep.expected,
        actual: fullyStoredStep.actual,
        observed_screenshot_hash: fullyStoredStep.observed_screenshot_hash,
        evidence_id: fullyStoredStep.evidence_id,
        error_class: fullyStoredStep.error_class,
        error_message: fullyStoredStep.error_message,
        failure_screenshot: fullyStoredStep.failure_screenshot,
      },
    );
    assert.equal(partiallyUpdatedStep.status, "completed");
    assert.equal(partiallyUpdatedStep.attempts, 3);
    assert.equal(partiallyUpdatedStep.started_at?.toISOString(), fixedStartedAt);
    assert.equal(partiallyUpdatedStep.finished_at?.toISOString(), fixedFinishedAt);

    const clearFailureInput = {
      runId: run.id,
      workerId: "crawler-1",
      flowId: "core",
      stepId: "open",
      flowOrder: 0,
      stepOrder: 0,
      status: "completed" as const,
      attempts: 4,
      errorClass: null,
      errorMessage: null,
      failureScreenshot: null,
      startedAt: null,
      finishedAt: null,
    };
    const clearFailureInputBefore = structuredClone(clearFailureInput);
    const clearedFailureStep = await store.upsertRunStep(clearFailureInput);
    assert.deepEqual(clearFailureInput, clearFailureInputBefore);
    assert.equal(clearedFailureStep.error_class, null);
    assert.equal(clearedFailureStep.error_message, null);
    assert.equal(clearedFailureStep.failure_screenshot, null);
    assert.equal(clearedFailureStep.started_at, null);
    assert.equal(clearedFailureStep.finished_at, null);
    assert.equal(clearedFailureStep.evidence_id, evidence.id);
    assert.equal(clearedFailureStep.source_url, fullyStoredStep.source_url);

    await assert.rejects(
      () => store.upsertRunStep({
        runId: run.id,
        workerId: "crawler-1",
        flowId: "core",
        stepId: "dashboard",
        flowOrder: 0,
        stepOrder: 1,
        status: "completed",
        attempts: 1,
        evidenceId: evidence.id,
      }),
      /flow and step/i,
    );
    assert.equal((await db.query<{ evidence_id: string | null }>(
      "SELECT evidence_id FROM crawl_run_steps WHERE run_id = $1 AND flow_id = 'core' AND step_id = 'dashboard'",
      [run.id],
    )).rows[0].evidence_id, null);

    await db.query("UPDATE crawl_runs SET heartbeat_at = now() - interval '2 hours' WHERE id = $1", [run.id]);
    assert.equal(await store.markStaleRunsInterrupted(new Date(Date.now() - 60_000)), 1);
    assert.equal((await store.getRun(run.id))?.status, "interrupted");

    const reclaimed = await store.claimRun("crawler-2");
    assert.equal(reclaimed?.id, run.id);
    assert.equal(reclaimed?.worker_id, "crawler-2");
    const beforeLostLease = await store.getRun(run.id);
    const beforeLostLeaseStep = await db.query<{ attempts: number }>(
      "SELECT attempts FROM crawl_run_steps WHERE run_id = $1 AND flow_id = 'core' AND step_id = 'open'",
      [run.id],
    );
    const beforeLostLeaseEvidence = await db.query("SELECT 1 FROM crawl_evidence WHERE version_id = $1", [version.id]);
    await assert.rejects(() => store.heartbeatRun(run.id, "crawler-1"), /worker|lease|owned/i);
    await assert.rejects(
      () => store.updateRun(run.id, "crawler-1", { completedCount: 99, status: "succeeded" }),
      /worker|lease|transition/i,
    );
    await assert.rejects(
      () => store.upsertRunStep({
        runId: run.id,
        workerId: "crawler-1",
        flowId: "core",
        stepId: "open",
        flowOrder: 0,
        stepOrder: 0,
        status: "completed",
        attempts: 99,
      }),
      /worker|lease|running/i,
    );
    await assert.rejects(
      () => store.createEvidence({ ...evidenceInput, workerId: "crawler-1", screenshotHash: "lost-lease-write" }),
      /worker|lease|running/i,
    );
    assert.equal((await store.getRun(run.id))?.completed_count, beforeLostLease?.completed_count);
    assert.equal((await db.query<{ attempts: number }>(
      "SELECT attempts FROM crawl_run_steps WHERE run_id = $1 AND flow_id = 'core' AND step_id = 'open'",
      [run.id],
    )).rows[0].attempts, beforeLostLeaseStep.rows[0].attempts);
    assert.equal((await db.query("SELECT 1 FROM crawl_evidence WHERE version_id = $1", [version.id])).rowCount, beforeLostLeaseEvidence.rowCount);

    const terminalRun = await store.updateRun(run.id, "crawler-2", { status: "failed", failedCount: 2 });
    assert.equal(terminalRun.status, "failed");
    await assert.rejects(
      () => store.updateRun(run.id, "crawler-2", { status: "running" }),
      /transition|terminal|lease/i,
    );
    await assert.rejects(
      () => store.updateRun(run.id, "crawler-2", { failedCount: 3 }),
      /transition|terminal|lease/i,
    );
    await assert.rejects(
      () => store.upsertRunStep({
        runId: run.id,
        workerId: "crawler-2",
        flowId: "core",
        stepId: "open",
        flowOrder: 0,
        stepOrder: 0,
        status: "completed",
        attempts: 5,
      }),
      /terminal|lease|running/i,
    );
    await assert.rejects(
      () => store.createEvidence({ ...evidenceInput, workerId: "crawler-2", screenshotHash: "terminal-write" }),
      /terminal|lease|running/i,
    );

    const invalidTransitionRun = await store.createRun({
      app: "durable-app",
      versionId: version.id,
      planId: approved.id,
      environment: { browserName: "chromium" },
    });
    await assert.rejects(
      () => store.updateRun(invalidTransitionRun.id, "not-claimed", { status: "succeeded" }),
      /transition|lease|running/i,
    );
    assert.equal((await store.requestRunCancellation(invalidTransitionRun.id)).status, "cancelled");

    const retryModes = ["all", "failed", "remaining"] as const;
    const retries = [];
    for (const mode of retryModes) {
      const retry = await store.createRetry(run.id, {
        mode,
        environment: { browserName: "chromium", locale: "en-US" },
      });
      assert.equal(retry.retry_of_run_id, run.id);
      assert.equal(retry.version_id, version.id);
      assert.equal(retry.plan_id, approved.id);
      assert.equal(retry.status, "queued");
      assert.equal(retry.retry_mode, mode);
      assert.equal((await store.getRun(retry.id))?.retry_mode, mode);
      retries.push(retry);
    }
    const listedRetries = (await store.listRuns("durable-app")).filter(({ retry_of_run_id }) => retry_of_run_id === run.id);
    assert.deepEqual(new Set(listedRetries.map(({ retry_mode }) => retry_mode)), new Set(retryModes));
    const defaultRetry = await store.createRetry(run.id, { environment: { browserName: "chromium" } });
    assert.equal(defaultRetry.retry_mode, "all");
    await assert.rejects(
      () => store.createRetry(run.id, { mode: "invalid" as never, environment: { browserName: "chromium" } }),
      /retry mode/i,
    );
    for (const retry of [...retries, defaultRetry]) {
      assert.equal((await store.requestRunCancellation(retry.id)).status, "cancelled");
    }

    const repairedStep = {
      id: "dashboard",
      action: "waitFor",
      text: "Workspace",
      safety: "read",
      expected: { state: "workspace", visible: { text: "Workspace" } },
    };
    const rejectedProposal = await store.proposeRepair({
      planId: approved.id,
      runId: run.id,
      flowId: "core",
      stepId: "dashboard",
      proposedStep: repairedStep,
      failure: { errorClass: "ExpectedStateMismatch", state: "home" },
      provider: "test-provider",
    });
    const rejected = await store.rejectRepair(rejectedProposal.id, -201);
    assert.equal(rejected.status, "rejected");
    await assert.rejects(() => store.applyRepair(rejected.id, -201), /already reviewed/i);

    const appliedProposal = await store.proposeRepair({
      planId: approved.id,
      runId: run.id,
      flowId: "core",
      stepId: "dashboard",
      proposedStep: repairedStep,
      failure: { errorClass: "ExpectedStateMismatch", state: "home" },
    });
    const appliedRepair = await store.applyRepair(appliedProposal.id, -201);
    assert.equal(appliedRepair.status, "applied");
    assert.ok(appliedRepair.applied_plan_id);
    await assert.rejects(() => store.rejectRepair(appliedRepair.id, -201), /already reviewed/i);

    const planV2 = await store.getPlan(appliedRepair.applied_plan_id!);
    assert.ok(planV2);
    assert.equal(planV2.revision, 2);
    assert.equal(planV2.status, "draft");
    assert.equal(planV2.plan.reviewed, false);
    assert.deepEqual(planV2.plan.flows[0].steps[0], approvedSnapshot.flows[0].steps[0]);
    assert.deepEqual(planV2.plan.flows[0].steps[1], repairedStep);

    const unchangedApproved = await store.getPlan(approved.id);
    assert.deepEqual(unchangedApproved?.plan, approvedSnapshot);
    assert.equal(unchangedApproved?.content_hash, approvedHash);
    assert.equal(unchangedApproved?.status, "approved");
    assert.deepEqual((await store.listPlans("durable-app")).map(({ revision }) => revision), [2, 1]);

    const pinnedQueuedRun = await store.createRun({
      app: "durable-app",
      versionId: version.id,
      planId: approved.id,
      environment: { browserName: "chromium" },
    });
    const approvedV2 = await store.approvePlan(planV2.id, -201);
    assert.equal(approvedV2.status, "approved");
    assert.equal((await store.getPlan(approved.id))?.status, "superseded");
    await assert.rejects(
      () => store.createRun({
        app: "durable-app",
        versionId: version.id,
        planId: approved.id,
        environment: { browserName: "chromium" },
      }),
      /approved plan/i,
    );
    const claimedPinnedRun = await store.claimRun("pinned-worker");
    assert.equal(claimedPinnedRun?.id, pinnedQueuedRun.id);
    assert.equal(claimedPinnedRun?.plan_id, approved.id);
    await store.updateRun(pinnedQueuedRun.id, "pinned-worker", { status: "interrupted" });
    const pinnedRetry = await store.createRetry(pinnedQueuedRun.id, {
      mode: "failed",
      environment: { browserName: "chromium" },
    });
    assert.equal(pinnedRetry.plan_id, approved.id);
    assert.equal(pinnedRetry.retry_mode, "failed");
    assert.equal(pinnedRetry.retry_of_run_id, pinnedQueuedRun.id);
    assert.equal((await store.requestRunCancellation(pinnedRetry.id)).status, "cancelled");

    const invalidVersionRun = await store.createRun({
      app: "durable-app",
      versionId: version.id,
      planId: approvedV2.id,
      environment: { browserName: "chromium" },
    });
    await db.query("UPDATE app_versions SET status = 'published', published_at = now() WHERE id = $1", [version.id]);
    assert.equal(await store.claimRun("published-version-worker"), undefined);
    const cancelledInvalidVersionRun = await store.getRun(invalidVersionRun.id);
    assert.equal(cancelledInvalidVersionRun?.status, "cancelled");
    assert.ok(cancelledInvalidVersionRun?.finished_at);

    await db.query(
      "UPDATE crawl_plans SET plan = jsonb_set(plan, '{domain}', '\"tampered.example\"'::jsonb) WHERE id = $1",
      [planV2.id],
    );
    await assert.rejects(() => store.getPlan(planV2.id), /content hash/i);
    await assert.rejects(() => store.listPlans("durable-app"), /content hash/i);
    await assert.rejects(() => store.approvePlan(planV2.id, -201), /content hash/i);

    await db.query("UPDATE crawl_plans SET plan = '{\"broken\": true}'::jsonb WHERE id = $1", [planV2.id]);
    await assert.rejects(() => store.getPlan(planV2.id), /plan\.revision/i);
    await assert.rejects(() => store.listPlans("durable-app"), /plan\.revision/i);
    await assert.rejects(() => store.approvePlan(planV2.id, -201), /plan\.revision/i);
  } finally {
    await db.closePool();
  }
});
