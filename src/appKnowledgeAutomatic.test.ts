import assert from "node:assert/strict";
import { test } from "node:test";
import type { QueryResult } from "pg";
import {
  createAppKnowledgeStore,
  type AppKnowledgeJobView,
  type DatabaseQuery,
} from "./appKnowledgeStore.ts";
import {
  automaticAppKnowledgeAllowlistFromEnvironment,
  completeCatalogCrawlAndHandoff,
  ensureAutomaticAppKnowledgeJob,
  reconcileQueuedAppKnowledgeJobs,
  type AutomaticAppKnowledgeDependencies,
  type AutomaticAppKnowledgeTarget,
  type CatalogAutomaticHandoffJob,
} from "./appKnowledgeAutomatic.ts";
import type { Job } from "./queue.ts";

const SHA_A = "a".repeat(64);

function databaseResult(
  rows: Record<string, unknown>[] = [],
): QueryResult<Record<string, unknown>> {
  return {
    command: "",
    rowCount: rows.length,
    oid: 0,
    fields: [],
    rows,
  };
}

function databaseJobRow(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 31,
    snapshot_id: 7,
    transport_job_id: 101,
    requested_by: null,
    request_origin: "automatic",
    status: "queued",
    stage: "preparing",
    done_count: 0,
    total_count: 0,
    synthesis_done_count: 0,
    synthesis_total_count: 0,
    cache_hit_count: 0,
    failed_count: 0,
    evidence_manifest: null,
    source_sha256: SHA_A,
    provider_model: "gemini-2.5-pro",
    prompt_version: 1,
    cancel_requested: false,
    retry_failed_only: false,
    design_system_seed_outcome: null,
    error_code: null,
    error_message: null,
    updated_at: "2026-07-24T00:00:00.000Z",
    ...overrides,
  };
}

function target(
  overrides: Partial<AutomaticAppKnowledgeTarget> = {},
): AutomaticAppKnowledgeTarget {
  return {
    app: "linear",
    platform: "web",
    captureVersionId: 7,
    sourceSha256: SHA_A,
    providerModel: "gemini-2.5-pro",
    promptVersion: 1,
    ...overrides,
  };
}

function job(
  id: number,
  transportJobId: number,
  input: AutomaticAppKnowledgeTarget,
  status: AppKnowledgeJobView["status"] = "queued",
): AppKnowledgeJobView {
  return {
    id,
    snapshotId: input.captureVersionId,
    transportJobId,
    requestedBy: null,
    requestOrigin: "automatic",
    status,
    stage: "preparing",
    doneCount: 0,
    totalCount: 0,
    synthesisDoneCount: 0,
    synthesisTotalCount: 0,
    cacheHitCount: 0,
    failedCount: 0,
    providerModel: input.providerModel,
    promptVersion: input.promptVersion,
    cancelRequested: false,
    retryFailedOnly: false,
    sourceSha256: input.sourceSha256,
    updatedAt: "2026-07-24T00:00:00.000Z",
  };
}

function identity(input: AutomaticAppKnowledgeTarget): string {
  return [
    input.app,
    input.platform,
    input.captureVersionId,
    input.sourceSha256,
    input.providerModel,
    input.promptVersion,
  ].join(":");
}

function automaticDependencies(options: {
  enabled?: boolean;
  publishFailure?: boolean;
  allowlist?: ReadonlySet<string>;
} = {}) {
  const durable = new Map<string, AppKnowledgeJobView>();
  const queued: AppKnowledgeJobView[] = [];
  const transports = new Map<number, { status: "queued" | "running" | "done" | "error" | "cancelled" }>();
  const createdDurableJobs: AppKnowledgeJobView[] = [];
  const publishedJobs: Job[] = [];
  let nextJobId = 30;
  let nextTransportId = 100;
  let publishFailure = options.publishFailure ?? false;

  const dependencies: AutomaticAppKnowledgeDependencies = {
    environment: {
      APP_KNOWLEDGE_AUTO_GENERATE: options.enabled === false ? "0" : "1",
    },
    allowlist: options.allowlist,
    store: {
      findAutomaticJob: async (input) => durable.get(identity(input)),
      createAutomaticJob: async (input, transportJobId) => {
        const created = job(++nextJobId, transportJobId, input);
        durable.set(identity(input), created);
        queued.push(created);
        createdDurableJobs.push(created);
        return created;
      },
      listQueuedAutomaticJobs: async (limit) =>
        queued.filter(({ status }) => status === "queued").slice(0, limit),
    },
    createTransportJob: async () => {
      const transportJobId = ++nextTransportId;
      transports.set(transportJobId, { status: "queued" });
      return transportJobId;
    },
    getTransportJob: async (transportJobId) => transports.get(transportJobId),
    setTransportJobStatus: async (transportJobId, status) => {
      transports.set(transportJobId, { status });
    },
    publishJob: async (value) => {
      if (publishFailure) throw new Error("broker unavailable");
      publishedJobs.push(value);
    },
  };

  return {
    dependencies,
    createdDurableJobs,
    publishedJobs,
    transports,
    durable,
    setPublishFailure(value: boolean) {
      publishFailure = value;
    },
  };
}

test("creates and publishes one automatic job per unchanged identity", async () => {
  const h = automaticDependencies();
  const first = await ensureAutomaticAppKnowledgeJob(target(), h.dependencies);
  const second = await ensureAutomaticAppKnowledgeJob(target(), h.dependencies);

  assert.equal(first.status, "ready");
  assert.equal(second.status, "ready");
  if (first.status !== "ready" || second.status !== "ready") return;
  assert.equal(first.job.id, second.job.id);
  assert.equal(h.createdDurableJobs.length, 1);
  assert.equal(h.publishedJobs.length, 1);
  assert.equal(first.job.requestedBy, null);
  assert.equal(first.job.requestOrigin, "automatic");
});

test("leaves durable work recoverable when queue publication fails", async () => {
  const h = automaticDependencies({ publishFailure: true });
  await assert.rejects(
    () => ensureAutomaticAppKnowledgeJob(target(), h.dependencies),
    /queue publication failed/i,
  );
  assert.equal(h.createdDurableJobs.length, 1);
  assert.equal(h.createdDurableJobs[0].status, "queued");

  h.setPublishFailure(false);
  const reconciled = await reconcileQueuedAppKnowledgeJobs(h.dependencies);
  assert.deepEqual(reconciled, { examined: 1, published: 1, skipped: 0, failed: 0 });
  assert.equal(h.publishedJobs.length, 1);
});

test("source hash, provider model, and prompt version define new automatic identities", async () => {
  const h = automaticDependencies();
  await ensureAutomaticAppKnowledgeJob(target(), h.dependencies);
  await ensureAutomaticAppKnowledgeJob(target({ sourceSha256: "b".repeat(64) }), h.dependencies);
  await ensureAutomaticAppKnowledgeJob(target({ providerModel: "gemini-3-pro" }), h.dependencies);
  await ensureAutomaticAppKnowledgeJob(target({ promptVersion: 2 }), h.dependencies);

  assert.equal(h.createdDurableJobs.length, 4);
  assert.equal(h.publishedJobs.length, 4);
});

test("cancelled automatic work can deliberately regenerate the same identity", async () => {
  const h = automaticDependencies();
  const first = await ensureAutomaticAppKnowledgeJob(target(), h.dependencies);
  assert.equal(first.status, "ready");
  if (first.status !== "ready") return;
  h.durable.delete(identity(target()));
  first.job.status = "cancelled";

  const regenerated = await ensureAutomaticAppKnowledgeJob(target(), h.dependencies);
  assert.equal(regenerated.status, "ready");
  if (regenerated.status !== "ready") return;
  assert.notEqual(regenerated.job.id, first.job.id);
  assert.equal(h.createdDurableJobs.length, 2);
});

test("a unique-identity race reuses the winner without duplicate publication", async () => {
  const h = automaticDependencies();
  const winner = job(44, 144, target());
  h.transports.set(winner.transportJobId, { status: "queued" });
  let firstRead = true;
  h.dependencies.store.findAutomaticJob = async () => {
    if (firstRead) {
      firstRead = false;
      return undefined;
    }
    return winner;
  };
  h.dependencies.store.createAutomaticJob = async () => winner;

  const result = await ensureAutomaticAppKnowledgeJob(target(), h.dependencies);
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.equal(result.created, false);
  assert.equal(result.published, false);
  assert.equal(h.publishedJobs.length, 0);
  assert.equal(h.transports.get(101)?.status, "cancelled");
});

test("automatic generation is disabled or allowlisted before any mutation", async () => {
  const disabled = automaticDependencies({ enabled: false });
  assert.deepEqual(
    await ensureAutomaticAppKnowledgeJob(target(), disabled.dependencies),
    { status: "disabled" },
  );
  assert.equal(disabled.createdDurableJobs.length, 0);

  const excluded = automaticDependencies({ allowlist: new Set(["figma"]) });
  assert.deepEqual(
    await ensureAutomaticAppKnowledgeJob(target(), excluded.dependencies),
    { status: "excluded" },
  );
  assert.equal(excluded.createdDurableJobs.length, 0);
});

test("parses the optional automatic app and app-platform allowlist", () => {
  assert.equal(
    automaticAppKnowledgeAllowlistFromEnvironment({}),
    undefined,
  );
  assert.deepEqual(
    automaticAppKnowledgeAllowlistFromEnvironment({
      APP_KNOWLEDGE_AUTO_ALLOWLIST: "linear, figma/web, linear",
    }),
    new Set(["linear", "figma/web"]),
  );
});

test("reconciliation skips active transports and bounds queued work", async () => {
  const h = automaticDependencies();
  const first = await ensureAutomaticAppKnowledgeJob(target(), h.dependencies);
  const second = await ensureAutomaticAppKnowledgeJob(
    target({ sourceSha256: "b".repeat(64) }),
    h.dependencies,
  );
  assert.equal(first.status, "ready");
  assert.equal(second.status, "ready");
  if (first.status !== "ready" || second.status !== "ready") return;

  h.transports.set(first.job.transportJobId, { status: "running" });
  h.transports.set(second.job.transportJobId, { status: "error" });
  h.publishedJobs.length = 0;

  const reconciled = await reconcileQueuedAppKnowledgeJobs(h.dependencies, 1);
  assert.deepEqual(reconciled, { examined: 1, published: 0, skipped: 1, failed: 0 });
  assert.equal(h.publishedJobs.length, 0);
});

test("the database store persists source identity in the initial automatic insert", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const query: DatabaseQuery = async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes("SELECT av.id AS capture_version_id")) {
      return databaseResult([{
        capture_version_id: 7,
        app_id: 3,
        app: "linear",
        version_number: 2,
        platform_id: 5,
        platform: "web",
      }]);
    }
    if (sql.includes("INSERT INTO app_knowledge_snapshots")) {
      return databaseResult([{ id: 7 }]);
    }
    if (sql.includes("INSERT INTO app_knowledge_jobs")) {
      return databaseResult([databaseJobRow()]);
    }
    return databaseResult();
  };

  const created = await createAppKnowledgeStore(query).createAutomaticJob(
    target(),
    101,
  );

  assert.equal(created.requestedBy, null);
  assert.equal(created.requestOrigin, "automatic");
  const insertion = calls.find(({ sql }) => sql.includes("INSERT INTO app_knowledge_jobs"));
  assert.match(insertion?.sql ?? "", /source_sha256/);
  assert.deepEqual(insertion?.values, [
    7,
    101,
    "gemini-2.5-pro",
    1,
    SHA_A,
  ]);
});

test("the database store rereads the winner of an automatic identity race", async () => {
  let winnerReads = 0;
  const query: DatabaseQuery = async (sql) => {
    if (sql.includes("SELECT av.id AS capture_version_id")) {
      return databaseResult([{
        capture_version_id: 7,
        app_id: 3,
        app: "linear",
        version_number: 2,
        platform_id: 5,
        platform: "web",
      }]);
    }
    if (sql.includes("INSERT INTO app_knowledge_snapshots")) {
      return databaseResult([{ id: 7 }]);
    }
    if (sql.includes("INSERT INTO app_knowledge_jobs")) {
      throw Object.assign(new Error("unique"), {
        code: "23505",
        constraint: "app_knowledge_automatic_generation_identity",
      });
    }
    if (sql.includes("j.request_origin = 'automatic'")) {
      winnerReads++;
      return databaseResult([databaseJobRow({
        id: 44,
        transport_job_id: 144,
      })]);
    }
    return databaseResult();
  };

  const winner = await createAppKnowledgeStore(query).createAutomaticJob(
    target(),
    101,
  );

  assert.equal(winner.id, 44);
  assert.equal(winner.transportJobId, 144);
  assert.equal(winnerReads, 1);
});

test("the database reconciler query is bounded and ordered by creation time", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const query: DatabaseQuery = async (sql, values) => {
    calls.push({ sql, values });
    return databaseResult([databaseJobRow()]);
  };

  const jobs = await createAppKnowledgeStore(query).listQueuedAutomaticJobs(25);

  assert.equal(jobs.length, 1);
  assert.match(calls[0].sql, /request_origin = 'automatic'/);
  assert.match(calls[0].sql, /status = 'queued'/);
  assert.match(calls[0].sql, /ORDER BY j\.created_at, j\.id/);
  assert.deepEqual(calls[0].values, [25]);
});

test("catalog completion is durable before automatic handoff starts", async () => {
  const events: string[] = [];
  const catalogJob: CatalogAutomaticHandoffJob & {
    repair?: { screens: boolean; uiElements: boolean; flows: boolean };
  } = {
    slug: "linear",
    platform: "web" as const,
    status: "pending",
    repair: { screens: false, uiElements: false, flows: false },
  };

  const result = await completeCatalogCrawlAndHandoff({
    job: catalogJob,
    saveState: () => {
      assert.equal(catalogJob.status, "done");
      assert.equal("repair" in catalogJob, false);
      events.push("saved");
    },
    log: (message) => events.push(`log:${message}`),
    handoff: async () => {
      events.push("automatic");
    },
    now: () => "2026-07-24T00:00:00.000Z",
  });

  assert.deepEqual(events, [
    "saved",
    "log:Done: linear (web)",
    "automatic",
  ]);
  assert.equal(result.warning, undefined);
  assert.equal(catalogJob.finishedAt, "2026-07-24T00:00:00.000Z");
});

test("catalog automatic handoff failure remains a bounded warning", async () => {
  const logs: string[] = [];
  const catalogJob: CatalogAutomaticHandoffJob = {
    slug: "linear",
    platform: "web" as const,
    status: "pending",
  };

  const result = await completeCatalogCrawlAndHandoff({
    job: catalogJob,
    saveState: () => {},
    log: (message) => logs.push(message),
    handoff: async () => {
      throw new Error("broker token=TOPSECRET");
    },
  });

  assert.equal(catalogJob.status, "done");
  assert.equal(result.warning, "Automatic analysis enqueue failed");
  assert.deepEqual(logs, [
    "Done: linear (web)",
    "Automatic analysis enqueue failed",
  ]);
});
