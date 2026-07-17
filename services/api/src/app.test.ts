import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { Server } from "node:http";
import { createApiApp, createCrawlRepairRequester } from "./app.ts";
import type { ObjectMetadata, ObjectStore } from "../../../src/objectStore.ts";

const admin = { id: 1, email: "admin@example.com", role: "admin" as const };
const user = { id: 2, email: "user@example.com", role: "user" as const };
const publishedVersion = { id: 1, app: "linear", platform: "web", version_number: 1, label: "v1", source_url: null, status: "published" as const, notes: "", captured_at: "2026-07-10T00:00:00.000Z", submitted_at: null, published_at: "2026-07-10T01:00:00.000Z", screen_count: 1, analyzed_count: 1, component_count: 1, token_count: 1, flow_count: 0 };
const adminCookie = { cookie: "astryx_session=admin" };
const previewSha256 = createHash("sha256").update("image").digest("hex");
const previewMetadata: ObjectMetadata = {
  key: `images/7/${previewSha256}.webp`, sha256: previewSha256, byteSize: 5,
  contentType: "image/webp", accessClass: "public-preview",
};
const failureBody = Buffer.from("real-png-evidence");
const failureSha256 = createHash("sha256").update(failureBody).digest("hex");
const failureMetadata: ObjectMetadata = {
  key: `crawl-failures/21/62726f7773652d70726f6475637473/6f70656e2d736f667477617265/${failureSha256}.png`,
  sha256: failureSha256,
  byteSize: failureBody.byteLength,
  contentType: "image/png",
  accessClass: "internal",
};
const localObjectStore: ObjectStore = {
  put: async () => { throw new Error("unused"); },
  head: async () => previewMetadata,
  get: async () => ({ metadata: previewMetadata, body: Buffer.from("image") }),
  signedGetUrl: async () => undefined,
  async *list() { yield previewMetadata; },
  delete: async () => false,
};
const catalogImages = [
  {
    id: 7,
    app: "linear",
    platform: "web",
    image_url: "mobbin-bulk:0123456789abcdef",
    description: "Toolbar",
  },
];

function crawlPlan(revision = 1, reviewed = false) {
  return {
    app: "atlassian",
    revision,
    startUrl: "https://www.atlassian.com/",
    domain: "Team collaboration and developer tools.",
    sources: ["https://www.atlassian.com/software/jira"],
    reviewed,
    flows: [{
      id: "browse-products",
      title: "Browse products",
      description: "Open Jira from the catalog.",
      safe: true,
      requiredSecrets: [],
      steps: [{
        id: "open-software",
        action: "goto",
        url: "/software",
        safety: "read",
        expected: {
          state: "Software catalog",
          url: "https://www.atlassian.com/software",
          visible: { text: "Explore Atlassian products" },
        },
      }],
    }],
  };
}

function crawlPlanWithSecret() {
  const plan = crawlPlan();
  plan.flows.push({
    id: "signup",
    title: "Start signup",
    description: "Enter a disposable test email without submitting.",
    safe: false,
    requiredSecrets: ["ATLASSIAN_TEST_EMAIL"],
    steps: [{
      id: "enter-email",
      action: "fill",
      role: "textbox",
      name: "Email",
      value: "$ATLASSIAN_TEST_EMAIL",
      safety: "read",
      expected: { state: "Email entered", visible: { role: "textbox", name: "Email" } },
    }],
  } as never);
  return plan;
}

function crawlRun(overrides: Record<string, unknown> = {}) {
  return {
    id: "21",
    app_id: 4,
    app: "atlassian",
    version_id: 8,
    plan_id: "11",
    run_kind: "planned",
    parent_run_id: null,
    platform: "web",
    allow_all: false,
    pause_requested_at: null,
    job_id: null,
    status: "queued",
    current_flow_id: null,
    current_step_id: null,
    completed_count: 0,
    failed_count: 0,
    skipped_count: 0,
    cancel_requested_at: null,
    retry_of_run_id: null,
    retry_mode: "all",
    environment: {
      headless: true,
      browserName: "chromium",
      requestedFlowIds: [],
      unsafeApproved: false,
      disposableAccountAcknowledged: false,
      allowSideEffects: false,
    },
    worker_id: null,
    heartbeat_at: null,
    created_at: "2026-07-12T00:00:00.000Z",
    started_at: null,
    finished_at: null,
    updated_at: "2026-07-12T00:00:00.000Z",
    ...overrides,
  };
}

test("uses the repository's free host API port", async () => {
  const appModule = await import("./app.ts");
  assert.equal((appModule as { DEFAULT_API_PORT?: number }).DEFAULT_API_PORT, 3010);
});

async function serve(app: ReturnType<typeof createApiApp>): Promise<{ base: string; server: Server }> {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  return { base: `http://127.0.0.1:${address.port}`, server };
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

test("keeps every crawl administration route admin-only before dependencies run", async (t) => {
  let dependencyCalls = 0;
  const touched = async () => {
    dependencyCalls++;
    return undefined as never;
  };
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => user,
    createJob: touched,
    publishJob: touched,
    listCrawlPlans: touched,
    getCrawlPlan: touched,
    saveCrawlPlan: touched,
    approveCrawlPlan: touched,
    createCrawlRun: touched,
    listCrawlRuns: touched,
    getCrawlRun: touched,
    listCrawlRunSteps: touched,
    listCrawlRunEvidence: touched,
    listCrawlRunRepairs: touched,
    cancelCrawlRun: touched,
    retryCrawlRun: touched,
    markQueuedCrawlRunInterrupted: touched,
    requestCrawlRepair: touched,
    applyCrawlRepair: touched,
    rejectCrawlRepair: touched,
  } as never));
  t.after(() => close(server));
  const headers = { cookie: "astryx_session=user", "content-type": "application/json" };
  const cases = [
    ["POST", "/crawl/apps/atlassian/research", { homepageUrl: "https://www.atlassian.com" }],
    ["GET", "/crawl/apps/atlassian/plans"],
    ["GET", "/crawl/plans/11"],
    ["PUT", "/crawl/plans/11", crawlPlan(2)],
    ["POST", "/crawl/plans/11/approve"],
    ["POST", "/crawl/apps/atlassian/runs", { planId: "11", mode: "full" }],
    ["GET", "/crawl/apps/atlassian/runs"],
    ["GET", "/crawl/runs/21"],
    ["POST", "/crawl/runs/21/cancel"],
    ["POST", "/crawl/runs/21/retry", { mode: "failed" }],
    ["GET", "/crawl/runs/21/failures/browse-products/open-software/screenshot"],
    ["POST", "/crawl/runs/21/repairs", { flowId: "browse-products", stepId: "open-software" }],
    ["POST", "/crawl/repairs/31/apply"],
    ["POST", "/crawl/repairs/31/reject"],
  ] as const;
  for (const [method, path, body] of cases) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    assert.equal(response.status, 403, `${method} ${path}`);
  }
  assert.equal(dependencyCalls, 0);
});

test("creates and inspects an admin-only autonomous crawl without exposing session ciphertext", async (t) => {
  const createdInputs: unknown[] = [];
  const published: unknown[] = [];
  const detail = {
    run: crawlRun({
      id: "42", app: "linear", plan_id: null, run_kind: "autonomous", allow_all: true,
      environment: { homepageUrl: "https://app.test/", provider: "chatgpt", requiredSecrets: ["APP_TEST_EMAIL"] },
    }),
    missions: [], states: [], transitions: [],
  };
  const makeApp = (currentUser: typeof admin | typeof user) => createApiApp({
    resolveSession: async () => currentUser,
    ensureActiveAppVersion: async () => ({ id: 8 }),
    createAutonomousRun: async (input: unknown) => { createdInputs.push(input); return detail.run as never; },
    getAutonomousRun: async () => detail as never,
    publishJob: async (job: unknown) => { published.push(job); },
  } as never);
  const deniedServer = await serve(makeApp(user));
  const adminServer = await serve(makeApp(admin));
  t.after(() => Promise.all([close(deniedServer.server), close(adminServer.server)]).then(() => undefined));
  const body = {
    homepageUrl: "https://app.test",
    platform: "web",
    provider: "chatgpt",
    requiredSecrets: ["APP_TEST_EMAIL"],
    allowAll: true,
    allowAllAcknowledged: true,
    ceilings: { runtimeMinutes: 120, actions: 500, modelRequests: 50, storageBytes: 100_000_000 },
    agentConcurrency: 3,
  };
  const denied = await fetch(`${deniedServer.base}/crawl/apps/linear/autonomous-runs`, {
    method: "POST", headers: { cookie: "astryx_session=user", "content-type": "application/json" }, body: JSON.stringify(body),
  });
  assert.equal(denied.status, 403);
  const created = await fetch(`${adminServer.base}/crawl/apps/linear/autonomous-runs`, {
    method: "POST", headers: { ...adminCookie, "content-type": "application/json" }, body: JSON.stringify(body),
  });
  assert.equal(created.status, 202);
  const view = await created.json();
  assert.equal(view.allow_all, true);
  assert.equal(JSON.stringify(view).includes("encrypted_storage_state"), false);
  assert.equal(createdInputs.length, 1);
  assert.deepEqual(published, [{ type: "autonomous-crawl-app", name: "linear", runId: "42" }]);

  const inspected = await fetch(`${adminServer.base}/crawl/autonomous-runs/42`, { headers: adminCookie });
  assert.equal(inspected.status, 200);
  assert.equal(JSON.stringify(await inspected.json()).includes("encrypted_storage_state"), false);
});

test("rejects unsafe autonomous inputs before creating a parent run", async (t) => {
  let creates = 0;
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => admin,
    ensureActiveAppVersion: async () => ({ id: 8 }),
    createAutonomousRun: async () => { creates++; return crawlRun() as never; },
  } as never));
  t.after(() => close(server));
  const valid = {
    homepageUrl: "https://app.test", platform: "web", provider: "chatgpt", requiredSecrets: [],
    allowAll: true, allowAllAcknowledged: true,
    ceilings: { runtimeMinutes: 60, actions: 100, modelRequests: 20, storageBytes: 1_000_000 }, agentConcurrency: 3,
  };
  for (const body of [
    { ...valid, homepageUrl: "http://127.0.0.1" },
    { ...valid, allowAllAcknowledged: false },
    { ...valid, password: "secret" },
    { ...valid, ceilings: { ...valid.ceilings, actions: 0 } },
    { ...valid, agentConcurrency: 9 },
    { ...valid, requiredSecrets: ["secret-value@example.com"] },
  ]) {
    const response = await fetch(`${base}/crawl/apps/linear/autonomous-runs`, {
      method: "POST", headers: { ...adminCookie, "content-type": "application/json" }, body: JSON.stringify(body),
    });
    assert.equal(response.status, 400);
  }
  assert.equal(creates, 0);
});

test("encrypts shared crawl sessions and returns metadata only", async (t) => {
  let encrypted = "";
  const session = { id: "5", app_id: 4, encrypted_storage_state: "", state_version: 2, updated_by: admin.id, updated_at: new Date("2026-07-16T00:00:00Z") };
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => admin,
    crawlSessionEncryptionKey: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
    saveCrawlAccountSession: async (_app: string, value: string) => { encrypted = value; return { ...session, encrypted_storage_state: value } as never; },
    getCrawlAccountSession: async () => ({ ...session, encrypted_storage_state: encrypted }) as never,
  } as never));
  t.after(() => close(server));
  const storageState = { cookies: [{ name: "session", value: "secret", domain: "app.test", path: "/", expires: -1, httpOnly: true, secure: true, sameSite: "Lax" }], origins: [] };
  const saved = await fetch(`${base}/crawl/apps/linear/session`, {
    method: "PUT", headers: { ...adminCookie, "content-type": "application/json" }, body: JSON.stringify({ storageState }),
  });
  assert.equal(saved.status, 200);
  assert.doesNotMatch(encrypted, /secret/);
  assert.equal(JSON.stringify(await saved.json()).includes("encrypted_storage_state"), false);
  const viewed = await fetch(`${base}/crawl/apps/linear/session`, { headers: adminCookie });
  assert.equal(viewed.status, 200);
  assert.equal(JSON.stringify(await viewed.json()).includes("encrypted_storage_state"), false);
});

test("validates crawl slugs, public URLs, plans, modes, ids, and repair requests", async (t) => {
  let dependencyCalls = 0;
  const touched = async () => {
    dependencyCalls++;
    return undefined as never;
  };
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => admin,
    createJob: touched,
    listCrawlPlans: touched,
    getCrawlPlan: touched,
    saveCrawlPlan: touched,
    createCrawlRun: touched,
    listCrawlRuns: touched,
    getCrawlRun: touched,
    cancelCrawlRun: touched,
    retryCrawlRun: touched,
    requestCrawlRepair: touched,
    applyCrawlRepair: touched,
    rejectCrawlRepair: touched,
  } as never));
  t.after(() => close(server));
  const headers = { ...adminCookie, "content-type": "application/json" };
  const cases = [
    ["POST", "/crawl/apps/not%20safe/research", { homepageUrl: "https://example.com" }],
    ["POST", "/crawl/apps/atlassian/research", { homepageUrl: "http://127.0.0.1/private" }],
    ["POST", "/crawl/apps/atlassian/research", { homepageUrl: "https://user:password@example.com" }],
    ["POST", "/crawl/apps/atlassian/research", { homepageUrl: "https://example.com", provider: "gemini" }],
    ["GET", "/crawl/apps/not%20safe/plans"],
    ["GET", "/crawl/plans/0"],
    ["PUT", "/crawl/plans/11", {}],
    ["POST", "/crawl/plans/not-an-id/approve"],
    ["POST", "/crawl/apps/atlassian/runs", { planId: "11", mode: "failed" }],
    ["POST", "/crawl/apps/atlassian/runs", { planId: 11, mode: "full" }],
    ["POST", "/crawl/apps/atlassian/runs", { planId: "11", mode: "full", unsafeApproved: "yes" }],
    ["GET", "/crawl/runs/9223372036854775808"],
    ["POST", "/crawl/runs/21/retry", { mode: "remaining" }],
    ["GET", "/crawl/runs/21/failures/not%20safe/open-software/screenshot"],
    ["POST", "/crawl/runs/21/repairs", { flowId: "browse-products", stepId: "open-software", provider: "unknown" }],
    ["POST", "/crawl/runs/21/repairs", { flowId: "browse-products", stepId: "open-software", provider: "gemini" }],
    ["POST", "/crawl/repairs/not-an-id/apply"],
    ["POST", "/crawl/repairs/0/reject"],
  ] as const;
  for (const [method, path, body] of cases) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    assert.equal(response.status, 400, `${method} ${path}`);
  }
  assert.equal(dependencyCalls, 0);
});

test("enqueues research and supports immutable plan revision and approval", async (t) => {
  const plans = [{ id: "11", app: "atlassian", revision: 1, status: "draft", plan: crawlPlan() }];
  const published: unknown[] = [];
  const saved: unknown[] = [];
  const approvedBy: number[] = [];
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => admin,
    createJob: async (type: string, payload: Record<string, unknown>) => {
      assert.equal(type, "research-app");
      assert.deepEqual(payload, { name: "atlassian", homepageUrl: "https://www.atlassian.com/", provider: "claude" });
      return 41;
    },
    publishJob: async (job: unknown) => { published.push(job); },
    listCrawlPlans: async () => plans as never,
    getCrawlPlan: async () => plans[0] as never,
    saveCrawlPlan: async (plan: unknown, userId: number, metadata: Record<string, unknown>) => {
      saved.push({ plan, userId, metadata });
      return { id: "12", app: "atlassian", revision: 2, status: "draft", plan } as never;
    },
    approveCrawlPlan: async (_id: string, userId: number) => {
      approvedBy.push(userId);
      return { ...plans[0], status: "approved", plan: crawlPlan(1, true) } as never;
    },
  } as never));
  t.after(() => close(server));
  const headers = { ...adminCookie, "content-type": "application/json" };

  const research = await fetch(`${base}/crawl/apps/atlassian/research`, {
    method: "POST", headers, body: JSON.stringify({ homepageUrl: "https://www.atlassian.com", provider: "claude" }),
  });
  assert.equal(research.status, 202);
  assert.deepEqual(await research.json(), { jobId: 41, app: "atlassian", homepageUrl: "https://www.atlassian.com/" });
  assert.deepEqual(published, [{ type: "research-app", name: "atlassian", homepageUrl: "https://www.atlassian.com/", provider: "claude", jobId: 41 }]);

  assert.deepEqual(await (await fetch(`${base}/crawl/apps/atlassian/plans`, { headers })).json(), plans.map((plan) => ({ ...plan, requiredSecrets: [] })));
  assert.equal((await fetch(`${base}/crawl/plans/11`, { headers })).status, 200);
  const revised = await fetch(`${base}/crawl/plans/11`, {
    method: "PUT", headers, body: JSON.stringify(crawlPlan(2)),
  });
  assert.equal(revised.status, 201);
  assert.deepEqual(saved, [{ plan: crawlPlan(2), userId: admin.id, metadata: { sourcePlanId: "11" } }]);

  const approval = await fetch(`${base}/crawl/plans/11/approve`, { method: "POST", headers });
  assert.equal(approval.status, 200);
  assert.deepEqual(approvedBy, [admin.id]);
  assert.equal((await approval.json()).plan.reviewed, true);
});

test("reports required secret configuration without returning secret values", async (t) => {
  const secretValue = "curator-secret-must-never-leak@example.com";
  process.env.ATLASSIAN_TEST_EMAIL = secretValue;
  t.after(() => { delete process.env.ATLASSIAN_TEST_EMAIL; });
  const plan = { id: "11", app: "atlassian", revision: 1, status: "draft", plan: crawlPlanWithSecret() };
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => admin,
    getCrawlPlan: async () => plan as never,
  } as never));
  t.after(() => close(server));
  const response = await fetch(`${base}/crawl/plans/11`, { headers: adminCookie });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.requiredSecrets, [{ name: "ATLASSIAN_TEST_EMAIL", configured: true }]);
  assert.equal(JSON.stringify(body).includes(secretValue), false);
});

test("persists crawl runs before transport, returns durable details, and controls retries", async (t) => {
  const createdInputs: unknown[] = [];
  const published: unknown[] = [];
  const cancelled: string[] = [];
  const retried: unknown[] = [];
  const queued = crawlRun();
  const failedStep = {
    run_id: "21",
    flow_id: "browse-products",
    step_id: "open-software",
    status: "failed",
    failure_screenshot: "data/crawl-failures/atlassian/21/failure.png",
    failure_object_key: failureMetadata.key,
    error_class: "SemanticStepError",
    error_message: "Expected software catalog",
  };
  const evidence = {
    id: "61",
    version_id: 8,
    plan_id: "11",
    image_id: 70,
    flow_id: "browse-products",
    step_id: "open-software",
    source_url: "https://www.atlassian.com/",
    final_url: "https://www.atlassian.com/software",
    state_label: "Software catalog",
    screenshot_hash: "a".repeat(64),
    viewport_width: 1440,
    viewport_height: 900,
    captured_at: "2026-07-12T00:00:00.000Z",
  };
  const repair = {
    id: "31",
    run_id: "21",
    flow_id: "browse-products",
    step_id: "open-software",
    status: "proposed",
    failure: { error: "Expected software catalog", screenshot: "/private/crawl/failure.png" },
    proposed_step: crawlPlan().flows[0].steps[0],
  };
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => admin,
    createCrawlRun: async (input: unknown) => { createdInputs.push(input); return queued as never; },
    publishJob: async (job: unknown) => { published.push(job); },
    listCrawlRuns: async () => [queued] as never,
    getCrawlRun: async () => queued as never,
    listCrawlRunSteps: async () => [failedStep] as never,
    listCrawlRunEvidence: async () => [evidence] as never,
    listCrawlRunRepairs: async () => [repair] as never,
    cancelCrawlRun: async (runId: string) => { cancelled.push(runId); return crawlRun({ status: "cancelled" }) as never; },
    retryCrawlRun: async (runId: string, mode: "full" | "failed") => {
      retried.push({ runId, mode });
      return crawlRun({ id: "22", retry_of_run_id: runId, retry_mode: mode === "full" ? "all" : mode }) as never;
    },
  } as never));
  t.after(() => close(server));
  const headers = { ...adminCookie, "content-type": "application/json" };

  const started = await fetch(`${base}/crawl/apps/atlassian/runs`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      planId: "11",
      mode: "full",
      unsafeApproved: false,
      disposableAccountAcknowledged: false,
      allowSideEffects: false,
      environment: { headless: true, browserName: "chromium", viewport: { width: 1440, height: 900 } },
    }),
  });
  assert.equal(started.status, 202);
  assert.deepEqual(createdInputs, [{
    app: "atlassian",
    planId: "11",
    unsafeApproved: false,
    disposableAccountAcknowledged: false,
    allowSideEffects: false,
    environment: { headless: true, browserName: "chromium", viewport: { width: 1440, height: 900 } },
    userId: admin.id,
  }]);
  assert.deepEqual(published, [{ type: "smart-crawl-app", name: "atlassian", runId: "21" }]);

  assert.equal((await fetch(`${base}/crawl/apps/atlassian/runs`, { headers })).status, 200);
  const detail = await (await fetch(`${base}/crawl/runs/21`, { headers })).json();
  assert.equal(detail.run.id, "21");
  assert.equal(detail.steps[0].failure_screenshot, undefined);
  assert.equal(detail.steps[0].failure_object_key, undefined);
  assert.equal(detail.steps[0].failureScreenshotUrl, "/api/crawl/runs/21/failures/browse-products/open-software/screenshot");
  assert.equal(detail.evidence[0].imageUrl, "/api/media/atlassian/aaaaaaaaaaaaaaaa");
  assert.equal(detail.repairs[0].failure.screenshot, undefined);
  assert.equal(JSON.stringify(detail).includes("/private/crawl/failure.png"), false);

  assert.equal((await fetch(`${base}/crawl/runs/21/cancel`, { method: "POST", headers })).status, 200);
  assert.deepEqual(cancelled, ["21"]);
  const retry = await fetch(`${base}/crawl/runs/21/retry`, {
    method: "POST", headers, body: JSON.stringify({ mode: "failed" }),
  });
  assert.equal(retry.status, 202);
  assert.deepEqual(retried, [{ runId: "21", mode: "failed" }]);
  assert.deepEqual(published.at(-1), { type: "smart-crawl-app", name: "atlassian", runId: "22" });
});

test("marks a persisted run interrupted and returns only safe IDs when publishing fails", async (t) => {
  const interrupted: string[] = [];
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => admin,
    createCrawlRun: async () => crawlRun() as never,
    publishJob: async () => { throw new Error("broker-password-must-not-leak"); },
    markQueuedCrawlRunInterrupted: async (runId: string) => {
      interrupted.push(runId);
      return crawlRun({ status: "interrupted" }) as never;
    },
  } as never));
  t.after(() => close(server));
  const response = await fetch(`${base}/crawl/apps/atlassian/runs`, {
    method: "POST",
    headers: { ...adminCookie, "content-type": "application/json" },
    body: JSON.stringify({ planId: "11", mode: "full" }),
  });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.deepEqual(body, {
    error: "crawl transport unavailable",
    runId: "21",
    versionId: 8,
    planId: "11",
  });
  assert.deepEqual(interrupted, ["21"]);
  assert.equal(JSON.stringify(body).includes("broker-password"), false);
});

test("serves only the database-bound internal failure object for its exact flow and step", async (t) => {
  let lookup: unknown;
  const signedRequests: Array<{ key: string; expires: number }> = [];
  const objectStore: ObjectStore = {
    put: async () => { throw new Error("unused"); },
    head: async () => failureMetadata,
    get: async () => ({ metadata: failureMetadata, body: failureBody }),
    signedGetUrl: async (key, expires) => {
      signedRequests.push({ key, expires });
      return "http://minio:9000/astryx/internal-failure.png?signature=test";
    },
    async *list() { yield failureMetadata; },
    delete: async () => false,
  };
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => admin,
    objectStore,
    crawlFailureObject: async (input: unknown) => {
      lookup = input;
      return failureMetadata;
    },
  } as never));
  t.after(() => close(server));
  const response = await fetch(`${base}/crawl/runs/21/failures/browse-products/open-software/screenshot`, {
    headers: adminCookie,
    redirect: "manual",
  });
  assert.equal(response.status, 200);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), failureBody);
  assert.deepEqual(signedRequests, []);
  assert.deepEqual(lookup, { runId: "21", flowId: "browse-products", stepId: "open-software" });
});

test("keeps repair suggestion, apply, and reject as separate admin actions", async (t) => {
  const requests: unknown[] = [];
  const applies: unknown[] = [];
  const rejects: unknown[] = [];
  const proposed = {
    id: "31",
    run_id: "21",
    status: "proposed",
    failure: { error: "Expected software catalog", screenshot: "/private/crawl/failure.png" },
    proposed_step: crawlPlan().flows[0].steps[0],
  };
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => admin,
    requestCrawlRepair: async (input: unknown) => { requests.push(input); return proposed as never; },
    applyCrawlRepair: async (id: string, userId: number) => {
      applies.push({ id, userId });
      return { ...proposed, status: "applied", applied_plan_id: "12" } as never;
    },
    rejectCrawlRepair: async (id: string, userId: number) => {
      rejects.push({ id, userId });
      return { ...proposed, status: "rejected" } as never;
    },
  } as never));
  t.after(() => close(server));
  const headers = { ...adminCookie, "content-type": "application/json" };
  const requested = await fetch(`${base}/crawl/runs/21/repairs`, {
    method: "POST",
    headers,
    body: JSON.stringify({ flowId: "browse-products", stepId: "open-software", provider: "chatgpt" }),
  });
  assert.equal(requested.status, 201);
  const requestedBody = await requested.json();
  assert.equal(requestedBody.failure.error, "Expected software catalog");
  assert.equal(requestedBody.failure.screenshot, undefined);
  assert.equal(JSON.stringify(requestedBody).includes("/private/crawl/failure.png"), false);
  assert.deepEqual(requests, [{ runId: "21", flowId: "browse-products", stepId: "open-software", provider: "chatgpt" }]);
  assert.deepEqual(applies, []);
  assert.deepEqual(rejects, []);

  const applied = await fetch(`${base}/crawl/repairs/31/apply`, { method: "POST", headers });
  const rejected = await fetch(`${base}/crawl/repairs/31/reject`, { method: "POST", headers });
  assert.equal(applied.status, 200);
  assert.equal(rejected.status, 200);
  assert.equal((await applied.json()).failure.screenshot, undefined);
  assert.equal((await rejected.json()).failure.screenshot, undefined);
  assert.deepEqual(applies, [{ id: "31", userId: admin.id }]);
  assert.deepEqual(rejects, [{ id: "31", userId: admin.id }]);
});

test("repair suggestions attach only the verified internal failure object", async () => {
  const askedWith: unknown[] = [];
  let metadata: ObjectMetadata | undefined = failureMetadata;
  let corrupt = false;
  const requester = createCrawlRepairRequester({
    getRun: async () => crawlRun({ status: "failed" }) as never,
    getPlan: async () => ({ id: "11", plan: crawlPlan(1, true) }) as never,
    listRunSteps: async () => [{
      flow_id: "browse-products",
      step_id: "open-software",
      status: "failed",
      final_url: "https://www.atlassian.com/",
      failure_screenshot: null,
      failure_object_key: failureMetadata.key,
      error_class: "SemanticStepError",
      error_message: "Expected software catalog",
    }] as never,
    crawlFailureObject: async () => metadata,
    objectStore: {
      put: async () => { throw new Error("unused"); },
      head: async () => metadata,
      get: async () => ({ metadata: failureMetadata, body: corrupt ? Buffer.from("corrupt") : failureBody }),
      signedGetUrl: async () => undefined,
      async *list() { yield failureMetadata; },
      delete: async () => false,
    },
    startChatSession: async () => ({
      ask: async (_prompt: string, attachment?: unknown) => {
        askedWith.push(attachment);
        return JSON.stringify(crawlPlan().flows[0].steps[0]);
      },
      close: async () => {},
    }),
    proposeRepair: async () => ({ id: "31", status: "proposed" }) as never,
  });
  const input = { runId: "21", flowId: "browse-products", stepId: "open-software", provider: "chatgpt" as const };

  await requester(input);
  metadata = undefined;
  await requester(input);
  metadata = failureMetadata;
  corrupt = true;
  await assert.rejects(() => requester(input), /Object bytes do not match metadata/);

  assert.deepEqual(askedWith, [{ name: "crawl-failure.png", mimeType: "image/png", buffer: failureBody }, undefined]);
});

test("rejects an invalid Mobbin import before creating a job", async (t) => {
  let created = false;
  const { base, server } = await serve(
    createApiApp({
      resolveSession: async () => admin,
      createJob: async () => {
        created = true;
        return 1;
      },
    })
  );
  t.after(() => close(server));
  const response = await fetch(`${base}/jobs`, {
    method: "POST",
    headers: { ...adminCookie, "content-type": "application/json" },
    body: JSON.stringify({ type: "import-app", name: "../linear", url: "http://example.com" }),
  });
  assert.equal(response.status, 400);
  assert.equal(created, false);
});

test("marks a created job error when RabbitMQ publication fails", async (t) => {
  const statuses: string[] = [];
  const { base, server } = await serve(
    createApiApp({
      resolveSession: async () => admin,
      createJob: async () => 42,
      publishJob: async () => {
        throw new Error("broker down");
      },
      setJobStatus: async (_id, status) => {
        statuses.push(status);
      },
    })
  );
  t.after(() => close(server));
  const response = await fetch(`${base}/jobs`, {
    method: "POST",
    headers: { ...adminCookie, "content-type": "application/json" },
    body: JSON.stringify({
      type: "import-app",
      name: "linear",
      url: "https://mobbin.com/apps/linear-web-00000000-0000-0000-0000-000000000000/version/screens",
    }),
  });
  assert.equal(response.status, 503);
  assert.deepEqual(statuses, ["error"]);
});

test("serves a hydrated structured design system", async (t) => {
  const { base, server } = await serve(
    createApiApp({
      resolveSession: async () => admin,
      getDesignSystem: async () => ({
        app: "linear",
        generatedAt: "2026-07-10T00:00:00.000Z",
        tokens: [
          {
            id: "color-primary",
            kind: "color",
            name: "Primary",
            value: "#5E6AD2",
            role: "primary action",
            evidence: [7],
          },
        ],
        components: [],
        flows: [],
      }),
      appImages: async () => [
        {
          id: 7,
          app: "linear",
          platform: "web",
          image_url: "mobbin-bulk:0123456789abcdef",
          description: "Toolbar",
        },
      ],
      getAppFlows: async () => [{
        id: "login",
        title: "Login",
        description: "Authenticate",
        tags: ["Authentication"],
        steps: [{ label: "Email", evidence: [7] }],
      }],
    })
  );
  t.after(() => close(server));

  const response = await fetch(`${base}/design-systems/linear?platform=web`, { headers: adminCookie });
  assert.equal(response.status, 200);
  const snapshot = await response.json();
  assert.equal(snapshot.tokens[0].evidence[0].imageUrl, "/api/media/linear/0123456789abcdef");
  assert.equal(snapshot.flows[0].steps[0].label, "Email");
  assert.equal(snapshot.flows[0].steps[0].evidence[0].imageUrl, "/api/media/linear/0123456789abcdef");
  assert.match(response.headers.get("content-type") ?? "", /application\/json/);
});

test("downloads a complete editable Figma library and secondary exports", async (t) => {
  const snapshot = {
    app: "linear",
    generatedAt: "2026-07-10T00:00:00.000Z",
    tokens: [{ id: "accent", kind: "color" as const, name: "Accent", value: "#5E6AD2", role: "Primary", evidence: [7] }],
    components: [{ id: "button", name: "Button", category: "Actions", description: "Action", variants: [{ id: "primary", name: "Primary", description: "Filled", evidence: [7] }] }],
    flows: [],
  };
  const durable: Array<{ exportId: number; metadata: ObjectMetadata }> = [];
  const uploaded: Array<ObjectMetadata & { body: Uint8Array }> = [];
  const evidenceBody = Buffer.from("object-backed-evidence");
  const evidenceMetadata: ObjectMetadata = {
    key: `images/7/${createHash("sha256").update(evidenceBody).digest("hex")}.webp`,
    sha256: createHash("sha256").update(evidenceBody).digest("hex"),
    byteSize: evidenceBody.byteLength,
    contentType: "image/webp",
    accessClass: "protected",
  };
  let nextExportId = 40;
  const exportStore: ObjectStore = {
    put: async (input) => {
      uploaded.push(input);
      return { created: true, metadata: input };
    },
    head: async () => undefined,
    get: async () => ({ metadata: evidenceMetadata, body: evidenceBody }),
    signedGetUrl: async () => undefined,
    async *list() { /* unused */ },
    delete: async () => false,
  };
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => user,
    canAccessApp: async () => true,
    reserveExportOperation: async () => ({ status: "reserved" as const, used: 1, limit: 20 as const, resetAt: "2026-08-01T00:00:00.000Z" }),
    recordAccessEvent: async () => undefined,
    createExport: async () => ++nextExportId,
    completeExport: async (exportId, metadata) => { durable.push({ exportId, metadata }); },
    failExport: async () => undefined,
    objectStore: exportStore,
    imageObjectById: async () => evidenceMetadata,
    getDesignSystem: async () => snapshot,
    getVersionDesignSystem: async () => ({ version: publishedVersion, snapshot, flows: [] }),
    getAppFlows: async () => [],
    appImages: async () => catalogImages,
    versionImages: async () => catalogImages,
  }));
  t.after(() => close(server));
  const headers = { cookie: "astryx_session=user", "content-type": "application/json" };
  const figma = await fetch(`${base}/design-systems/linear/exports`, {
    method: "POST", headers, body: JSON.stringify({ format: "figma", platform: "web", selection: { kind: "design-system" } }),
  });
  assert.equal(figma.status, 200);
  assert.equal(Buffer.from(await figma.arrayBuffer()).subarray(0, 2).toString(), "PK");
  assert.match(figma.headers.get("content-disposition") ?? "", /linear-figma-library\.zip/);
  assert.equal(figma.headers.get("content-type"), "application/zip");

  const json = await fetch(`${base}/design-systems/linear/exports`, {
    method: "POST", headers, body: JSON.stringify({ format: "json", platform: "web", selection: { kind: "component-family", id: "button" } }),
  });
  assert.equal(json.status, 200);
  assert.equal((await json.json()).components.length, 1);
  assert.equal(uploaded.length, 2);
  assert.match(Buffer.from(uploaded[0].body).toString("utf8"), new RegExp(evidenceBody.toString("base64")));
  assert.deepEqual(durable.map(({ exportId }) => exportId), [41, 42]);
  for (let index = 0; index < uploaded.length; index++) {
    const metadata = uploaded[index];
    assert.equal(metadata.key, `exports/${41 + index}/${metadata.sha256}.${index === 0 ? "zip" : "json"}`);
    assert.equal(metadata.sha256, createHash("sha256").update(metadata.body).digest("hex"));
    assert.equal(metadata.byteSize, metadata.body.byteLength);
    assert.equal(metadata.accessClass, "protected");
    const { body: _body, ...persistedMetadata } = metadata;
    assert.deepEqual(durable[index], { exportId: 41 + index, metadata: persistedMetadata });
  }
  assert.equal((await fetch(`${base}/design-systems/linear/exports`, {
    method: "POST", headers, body: JSON.stringify({ format: "pdf", platform: "web", selection: { kind: "design-system" } }),
  })).status, 400);
});

test("does not fall back to legacy media when an associated object fails verification", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "astryx-export-object-"));
  mkdirSync(join(root, "images", "linear"), { recursive: true });
  writeFileSync(join(root, "images", "linear", "0123456789abcdef.webp"), "legacy-fallback");
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const expected: ObjectMetadata = {
    key: `images/7/${"a".repeat(64)}.webp`, sha256: "a".repeat(64), byteSize: 7,
    contentType: "image/webp", accessClass: "protected",
  };
  let created = false;
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => user,
    canAccessApp: async () => true,
    objectStore: { ...localObjectStore, get: async () => ({ metadata: expected, body: Buffer.from("wrong") }) },
    imageObjectById: async () => expected,
    getVersionDesignSystem: async () => ({
      version: publishedVersion,
      snapshot: { app: "linear", generatedAt: "2026-07-10T00:00:00.000Z", tokens: [], components: [], flows: [] },
      flows: [],
    }),
    versionImages: async () => catalogImages,
    reserveExportOperation: async () => ({ status: "reserved" as const, used: 1, limit: 20 as const, resetAt: "2026-08-01T00:00:00.000Z" }),
    recordAccessEvent: async () => undefined,
    createExport: async () => { created = true; return 1; },
    dataDir: root,
  }));
  t.after(() => close(server));
  const response = await fetch(`${base}/design-systems/linear/exports`, {
    method: "POST", headers: { cookie: "astryx_session=user", "content-type": "application/json" },
    body: JSON.stringify({ format: "figma", platform: "web", selection: { kind: "design-system" } }),
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Export storage unavailable" });
  assert.equal(created, false);
});

test("downloads an authorized completed export locally or by short signed redirect", async (t) => {
  const body = Buffer.from('{"tokens":[]}');
  const metadata: ObjectMetadata = {
    key: `exports/91/${createHash("sha256").update(body).digest("hex")}.json`,
    sha256: createHash("sha256").update(body).digest("hex"), byteSize: body.byteLength,
    contentType: "application/json", accessClass: "protected",
  };
  let signed = false;
  const store: ObjectStore = {
    ...localObjectStore,
    get: async () => ({ metadata, body }),
    signedGetUrl: async () => signed ? "https://objects.example/signed" : undefined,
  };
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => user,
    objectStore: store,
    authorizedExportObject: async ({ exportId }) => {
      if (exportId === 93) throw new Error("exports/91/secret-key");
      return exportId === 91 ? { metadata, filename: "linear tokens\r\nunsafe.json" } : undefined;
    },
  }));
  t.after(() => close(server));
  const local = await fetch(`${base}/exports/91`, { headers: { cookie: "astryx_session=user" } });
  assert.equal(local.status, 200);
  assert.deepEqual(Buffer.from(await local.arrayBuffer()), body);
  assert.equal(local.headers.get("content-type"), "application/json");
  assert.equal(local.headers.get("content-disposition"), 'attachment; filename="linear_tokens__unsafe.json"');

  signed = true;
  const redirect = await fetch(`${base}/exports/91`, { headers: { cookie: "astryx_session=user" }, redirect: "manual" });
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.get("location"), "https://objects.example/signed");
  assert.equal(redirect.headers.get("content-type"), "application/json");
  assert.equal(redirect.headers.get("content-disposition"), 'attachment; filename="linear_tokens__unsafe.json"');
  const missing = await fetch(`${base}/exports/92`, { headers: { cookie: "astryx_session=user" } });
  assert.equal(missing.status, 404);
  assert.doesNotMatch(await missing.text(), /exports\/91|object_key|signed/i);
  const failed = await fetch(`${base}/exports/93`, { headers: { cookie: "astryx_session=user" } });
  assert.equal(failed.status, 503);
  assert.deepEqual(await failed.json(), { error: "Export storage unavailable" });
});

test("does not complete an export when object upload fails", async (t) => {
  const snapshot = { app: "linear", generatedAt: "2026-07-10T00:00:00.000Z", tokens: [], components: [], flows: [] };
  const completed: number[] = [];
  const failed: number[] = [];
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => user,
    canAccessApp: async () => true,
    reserveExportOperation: async () => ({ status: "reserved" as const, used: 1, limit: 20 as const, resetAt: "2026-08-01T00:00:00.000Z" }),
    recordAccessEvent: async () => undefined,
    createExport: async () => 73,
    completeExport: async (exportId) => { completed.push(exportId); },
    failExport: async (exportId) => { failed.push(exportId); },
    objectStore: { ...localObjectStore, put: async () => { throw new Error("checksum mismatch"); } },
    getVersionDesignSystem: async () => ({ version: publishedVersion, snapshot, flows: [] }),
    versionImages: async () => [],
  }));
  t.after(() => close(server));
  const response = await fetch(`${base}/design-systems/linear/exports`, {
    method: "POST",
    headers: { cookie: "astryx_session=user", "content-type": "application/json" },
    body: JSON.stringify({ format: "json", platform: "web", selection: { kind: "design-system" } }),
  });
  assert.equal(response.status, 503);
  assert.deepEqual(completed, []);
  assert.deepEqual(failed, [73]);
});

test("serves evidence-backed search and 2-app comparison", async (t) => {
  const systems = [
    {
      app: "linear",
      generatedAt: "2026-07-10T00:00:00.000Z",
      tokens: [{ id: "accent", kind: "color" as const, name: "Accent", value: "#5E6AD2", role: "Primary", evidence: [7] }],
      components: [{ id: "button", name: "Button", category: "Actions", description: "Action", variants: [{ id: "primary", name: "Primary", description: "Filled", evidence: [7] }] }],
      flows: [],
    },
    {
      app: "airbnb",
      generatedAt: "2026-07-10T00:00:00.000Z",
      tokens: [{ id: "accent", kind: "color" as const, name: "Accent", value: "#FF385C", role: "Primary", evidence: [8] }],
      components: [],
      flows: [],
    },
  ];
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => user,
    canAccessApp: async () => true,
    allImages: async () => [{
      ...catalogImages[0],
      analysis: {
        description: "Toolbar with primary action",
        purpose: "Manage issues",
        pageType: "Workspace",
        productArea: "Issues",
        theme: "dark" as const,
        visibleStates: ["default"],
        componentNames: ["Button"],
      },
    }],
    listDesignSystems: async () => systems,
    listAppFlowSets: async () => [],
  }));
  t.after(() => close(server));

  const search = await fetch(`${base}/search?q=primary&kind=component`, { headers: { cookie: "astryx_session=user" } });
  assert.equal(search.status, 200);
  assert.equal((await search.json()).items[0].id, "component:linear:button");

  const compare = await fetch(`${base}/compare?apps=linear,airbnb`, { headers: { cookie: "astryx_session=user" } });
  assert.equal(compare.status, 200);
  assert.deepEqual((await compare.json()).foundations[0].values, ["#5E6AD2", "#FF385C"]);
  assert.equal((await fetch(`${base}/compare?apps=linear`, { headers: { cookie: "astryx_session=user" } })).status, 400);
});

test("creates user-owned collections and edits item notes", async (t) => {
  const now = "2026-07-11T00:00:00.000Z";
  const collection = { id: 4, name: "Onboarding", description: "", created_at: now, updated_at: now, items: [] };
  let notes = "";
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => user,
    canAccessApp: async () => true,
    createCollection: async (_userId, name, description) => ({ ...collection, name, description: description ?? "" }),
    listCollections: async () => [{ ...collection, items: [] }],
    addCollectionItem: async (_userId, _collectionId, item) => ({
      id: 9,
      kind: item.kind,
      app: item.app,
      reference_id: item.referenceId,
      title: item.title,
      notes: item.notes,
      created_at: now,
      updated_at: now,
    }),
    updateCollectionItemNotes: async (_userId, _collectionId, _itemId, value) => {
      notes = value;
      return { id: 9, kind: "screen", app: "linear", reference_id: "7", title: "Workspace", notes, created_at: now, updated_at: now };
    },
    removeCollectionItem: async () => true,
    deleteCollection: async () => true,
  }));
  t.after(() => close(server));
  const headers = { cookie: "astryx_session=user", "content-type": "application/json" };

  const created = await fetch(`${base}/collections`, { method: "POST", headers, body: JSON.stringify({ name: "Onboarding" }) });
  assert.equal(created.status, 201);
  assert.equal((await created.json()).name, "Onboarding");
  assert.equal((await fetch(`${base}/collections`, { headers })).status, 200);

  const added = await fetch(`${base}/collections/4/items`, {
    method: "POST", headers,
    body: JSON.stringify({ kind: "screen", app: "linear", referenceId: "7", title: "Workspace", notes: "Reference" }),
  });
  assert.equal(added.status, 201);
  const patched = await fetch(`${base}/collections/4/items/9`, { method: "PATCH", headers, body: JSON.stringify({ notes: "Reuse hierarchy" }) });
  assert.equal(patched.status, 200);
  assert.equal(notes, "Reuse hierarchy");
  assert.equal((await fetch(`${base}/collections/4/items/9`, { method: "DELETE", headers })).status, 204);
  assert.equal((await fetch(`${base}/collections/4`, { method: "DELETE", headers })).status, 204);
});

test("runs the admin draft-review-publish workflow and hides drafts from designers", async (t) => {
  const version = { id: 12, app: "linear", platform: "web", version_number: 2, label: "v2", source_url: null, status: "draft" as const, notes: "", captured_at: "2026-07-11T00:00:00.000Z", submitted_at: null, published_at: null, screen_count: 7, analyzed_count: 7, component_count: 2, token_count: 4, flow_count: 1 };
  let publishedOnly: boolean | undefined;
  const { base, server } = await serve(createApiApp({
    resolveSession: async (token) => token === "admin" ? admin : user,
    createAppVersion: async () => version,
    createJob: async () => 44,
    publishJob: async () => undefined,
    listAppVersions: async (_app, _platform, only) => { publishedOnly = only; return only ? [] : [version]; },
    getVersionPublicationBlockers: async () => [],
    submitAppVersionForReview: async () => ({ ...version, status: "in_review" as const }),
    publishAppVersion: async () => ({ ...version, status: "published" as const, published_at: "2026-07-11T01:00:00.000Z" }),
  }));
  t.after(() => close(server));
  const jsonHeaders = { ...adminCookie, "content-type": "application/json" };
  const created = await fetch(`${base}/apps/linear/versions`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ platform: "web", sourceUrl: "https://mobbin.com/apps/linear/version/screens" }) });
  assert.equal(created.status, 201);
  assert.equal((await created.json()).status, "draft");
  assert.equal((await fetch(`${base}/versions/12/blockers`, { headers: adminCookie })).status, 200);
  assert.equal((await fetch(`${base}/versions/12/submit`, { method: "POST", headers: adminCookie })).status, 200);
  assert.equal((await (await fetch(`${base}/versions/12/publish`, { method: "POST", headers: adminCookie })).json()).status, "published");

  const designerVersions = await fetch(`${base}/apps/linear/versions?platform=web`, { headers: { cookie: "astryx_session=user" } });
  assert.equal(designerVersions.status, 200);
  assert.equal(publishedOnly, true);
});

test("returns 404 when an app has no structured design system", async (t) => {
  const { base, server } = await serve(
    createApiApp({
      resolveSession: async () => admin,
      getDesignSystem: async () => undefined,
      getAppFlows: async () => [],
      appImages: async () => [],
    })
  );
  t.after(() => close(server));
  assert.equal(
    (await fetch(`${base}/design-systems/linear?platform=web`, { headers: adminCookie })).status,
    404
  );
});

test("serves crawled flows even when an app has not been through AI synthesis", async (t) => {
  const { base, server } = await serve(
    createApiApp({
      resolveSession: async () => admin,
      getDesignSystem: async () => undefined,
      appImages: async () => [
        { id: 7, app: "lang-chain", platform: "web", image_url: "mobbin-bulk:0123456789abcdef", description: null },
      ],
      getAppFlows: async () => [{
        id: "onboarding",
        title: "Onboarding",
        description: "Crawled from Mobbin",
        tags: [],
        steps: [{ label: "Step 1", evidence: [7] }],
      }],
    })
  );
  t.after(() => close(server));

  const response = await fetch(`${base}/design-systems/lang-chain?platform=web`, { headers: adminCookie });
  assert.equal(response.status, 200);
  const snapshot = await response.json();
  assert.deepEqual(snapshot.components, []);
  assert.equal(snapshot.flows[0].title, "Onboarding");
  assert.equal(snapshot.flows[0].steps[0].evidence[0].imageUrl, "/api/media/lang-chain/0123456789abcdef");
});

test("serves local bulk media", async (t) => {
  const dataDir = mkdtempSync(join(tmpdir(), "astryx-api-"));
  mkdirSync(join(dataDir, "images", "linear"), { recursive: true });
  writeFileSync(join(dataDir, "images", "linear", "0123456789abcdef.webp"), "image");
  const { base, server } = await serve(
    createApiApp({ dataDir, resolveSession: async () => admin })
  );
  t.after(async () => {
    await close(server);
    rmSync(dataDir, { recursive: true, force: true });
  });

  assert.equal(
    (await fetch(`${base}/media/linear/0123456789abcdef`, { headers: adminCookie })).status,
    200
  );
  assert.equal(
    (await fetch(`${base}/media/linear/not-a-hash`, { headers: adminCookie })).status,
    400
  );
});

test("binds signed design-system media to the entitled user and expiry", async (t) => {
  const dataDir = mkdtempSync(join(tmpdir(), "astryx-signed-media-"));
  mkdirSync(join(dataDir, "images", "linear"), { recursive: true });
  writeFileSync(join(dataDir, "images", "linear", "0123456789abcdef.webp"), "image");
  let nowSeconds = 1_000;
  const other = { id: 3, email: "other@example.com", role: "user" as const };
  const signedSnapshot = {
    app: "linear",
    generatedAt: "2026-07-10T00:00:00.000Z",
    tokens: [
      { id: "color", kind: "color" as const, name: "Color", value: "#000", role: "text", evidence: [7] },
      { id: "invalid", kind: "color" as const, name: "Invalid", value: "#fff", role: "background", evidence: [8] },
    ],
    components: [],
    flows: [],
  };
  const { base, server } = await serve(createApiApp({
    dataDir,
    mediaSigningSecret: "0123456789abcdef0123456789abcdef",
    nowSeconds: () => nowSeconds,
    resolveSession: async (token) => token === "owner" ? user : other,
    canAccessApp: async () => true,
    getDesignSystem: async () => signedSnapshot,
    getVersionDesignSystem: async () => ({ version: publishedVersion, snapshot: signedSnapshot, flows: [] }),
    appImages: async () => catalogImages,
    versionImages: async () => [...catalogImages, { ...catalogImages[0], id: 8, image_url: "javascript:alert(1)" }],
    getAppFlows: async () => [],
  }));
  t.after(async () => {
    await close(server);
    rmSync(dataDir, { recursive: true, force: true });
  });

  const snapshot = await (await fetch(`${base}/design-systems/linear?platform=web`, {
    headers: { cookie: "astryx_session=owner" },
  })).json();
  const mediaUrl = snapshot.tokens[0].evidence[0].imageUrl as string;
  assert.equal(snapshot.tokens[1].evidence[0].imageUrl, "");
  assert.match(mediaUrl, /\?expires=1300&token=/);
  assert.equal((await fetch(`${base}${mediaUrl.replace("/api", "")}`, {
    headers: { cookie: "astryx_session=owner" },
  })).status, 200);
  assert.equal((await fetch(`${base}${mediaUrl.replace("/api", "")}`, {
    headers: { cookie: "astryx_session=other" },
  })).status, 403);
  nowSeconds = 1_301;
  assert.equal((await fetch(`${base}${mediaUrl.replace("/api", "")}`, {
    headers: { cookie: "astryx_session=owner" },
  })).status, 410);
});

test("keeps health public and rejects private data without a session", async (t) => {
  const { base, server } = await serve(
    createApiApp({ resolveSession: async () => undefined })
  );
  t.after(() => close(server));

  assert.equal((await fetch(`${base}/health`)).status, 200);
  assert.equal((await fetch(`${base}/apps`)).status, 401);
  assert.equal((await fetch(`${base}/jobs`)).status, 401);
});

test("keeps liveness up but fails readiness when object storage is unavailable", async (t) => {
  const { base, server } = await serve(createApiApp({
    storageReady: async () => { throw new Error("Object storage is unavailable"); },
  }));
  t.after(() => close(server));

  assert.equal((await fetch(`${base}/health`)).status, 200);
  const response = await fetch(`${base}/ready`);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: "error", error: "object_storage_unavailable" });
});

test("rejects import job acceptance when object storage is unavailable", async (t) => {
  let created = false;
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => admin,
    storageReady: async () => { throw new Error("Object storage is unavailable"); },
    createJob: async () => {
      created = true;
      return 1;
    },
  }));
  t.after(() => close(server));

  const response = await fetch(`${base}/jobs`, {
    method: "POST",
    headers: { ...adminCookie, "content-type": "application/json" },
    body: JSON.stringify({
      type: "import-app",
      name: "linear",
      url: "https://mobbin.com/apps/linear/version/screens",
    }),
  });
  assert.equal(response.status, 503);
  assert.equal(created, false);
  assert.deepEqual(await response.json(), { error: "Object storage unavailable", code: "object_storage_unavailable" });
});

test("serves public catalog previews without exposing the admin gallery", async (t) => {
  const { base, server } = await serve(createApiApp({
    allImages: async () => catalogImages,
    publishedPreviewImages: async () => [{ ...catalogImages[0], preview_rank: 1 }],
  }));
  t.after(() => close(server));
  const response = await fetch(`${base}/catalog`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.apps[0].previewScreens.length, 1);
  assert.doesNotMatch(JSON.stringify(body), /mobbin-bulk|image_url/);
});

test("serves only the first three public preview images", async (t) => {
  const ranks: number[] = [];
  const { base, server } = await serve(createApiApp({
    objectStore: localObjectStore,
    publishedPreviewObject: async ({ rank }) => {
      ranks.push(rank);
      return rank === 1 ? previewMetadata : undefined;
    },
  }));
  t.after(() => close(server));
  const preview = await fetch(`${base}/preview-media/linear/1`);
  assert.equal(preview.status, 200);
  assert.equal(preview.headers.get("content-type"), "image/webp");
  assert.equal(preview.headers.get("x-content-type-options"), "nosniff");
  assert.equal(await preview.text(), "image");
  assert.equal((await fetch(`${base}/preview-media/linear/2`)).status, 404);
  assert.equal((await fetch(`${base}/preview-media/linear/4`)).status, 400);
  assert.deepEqual(ranks, [1, 2]);
});

test("redirects authorized object-backed media to a short-lived signed URL", async (t) => {
  const signedStore: ObjectStore = {
    ...localObjectStore,
    signedGetUrl: async (_key, expires) => {
      assert.equal(expires, 300);
      return "https://objects.example/signed";
    },
  };
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => admin,
    objectStore: signedStore,
    adminImageObject: async () => ({ ...previewMetadata, accessClass: "protected" }),
  }));
  t.after(() => close(server));
  const response = await fetch(`${base}/media/linear/0123456789abcdef`, {
    headers: adminCookie,
    redirect: "manual",
  });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "https://objects.example/signed");
  assert.equal(response.headers.get("cache-control"), "private, max-age=280");
});

test("passes the thumb variant through to the object lookup, defaulting to full otherwise", async (t) => {
  const seenVariants: Array<string | undefined> = [];
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => admin,
    objectStore: localObjectStore,
    adminImageObject: async (input) => {
      seenVariants.push(input.variant);
      return { ...previewMetadata, accessClass: "protected" };
    },
  }));
  t.after(() => close(server));
  await fetch(`${base}/media/linear/0123456789abcdef?variant=thumb`, { headers: adminCookie, redirect: "manual" });
  await fetch(`${base}/media/linear/0123456789abcdef`, { headers: adminCookie, redirect: "manual" });
  assert.deepEqual(seenVariants, ["thumb", "full"]);
});

test("gates customer app detail and unlocks a Free app", async (t) => {
  let unlocked = false;
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => user,
    allImages: async () => catalogImages,
    listAppVersions: async (app) => [{ ...publishedVersion, app }],
    versionImages: async () => catalogImages,
    canAccessApp: async () => unlocked,
    unlockFreeApp: async () => {
      unlocked = true;
      return { status: "unlocked", remaining: 2 };
    },
    recordAccessEvent: async () => {},
  }));
  t.after(() => close(server));
  const locked = await fetch(`${base}/apps/linear`, { headers: { cookie: "astryx_session=user" } });
  assert.equal(locked.status, 403);
  assert.deepEqual(await locked.json(), { error: "Upgrade required", code: "upgrade_required" });
  const unlock = await fetch(`${base}/apps/linear/unlock`, {
    method: "POST",
    headers: { cookie: "astryx_session=user" },
  });
  assert.equal(unlock.status, 201);
  assert.equal((await fetch(`${base}/apps/linear`, { headers: { cookie: "astryx_session=user" } })).status, 200);
});

test("keeps the old gallery and pipeline state admin-only", async (t) => {
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => user,
    allImages: async () => catalogImages,
    listJobs: async () => [],
  }));
  t.after(() => close(server));
  for (const path of ["/apps", "/images?app=linear", "/jobs", "/progress"]) {
    assert.equal((await fetch(`${base}${path}`, { headers: { cookie: "astryx_session=user" } })).status, 403);
  }
});

test("logs in with a secure cookie, resolves me, and logs out", async (t) => {
  let deletedToken: string | undefined;
  const { base, server } = await serve(
    createApiApp({
      authenticateUser: async (email, password) =>
        email === admin.email && password === "admin password" ? admin : undefined,
      createSession: async () => ({ token: "raw-session-token", expiresAt: new Date() }),
      resolveSession: async (token) => (token === "raw-session-token" ? admin : undefined),
      deleteSession: async (token) => {
        deletedToken = token;
      },
    })
  );
  t.after(() => close(server));

  const login = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: admin.email, password: "admin password" }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie") ?? "";
  assert.match(cookie, /astryx_session=raw-session-token/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Strict/i);

  const me = await fetch(`${base}/auth/me`, {
    headers: { cookie: "astryx_session=raw-session-token" },
  });
  assert.deepEqual(await me.json(), admin);

  const logout = await fetch(`${base}/auth/logout`, {
    method: "POST",
    headers: { cookie: "astryx_session=raw-session-token" },
  });
  assert.equal(logout.status, 204);
  assert.equal(deletedToken, "raw-session-token");
});

test("returns one generic login failure", async (t) => {
  const { base, server } = await serve(
    createApiApp({ authenticateUser: async () => undefined })
  );
  t.after(() => close(server));

  const response = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "missing@example.com", password: "wrong" }),
  });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Invalid email or password" });
});

test("explains when a normal-user session was evicted", async (t) => {
  const { base, server } = await serve(
    createApiApp({ resolveSessionState: async () => ({ status: "signed_in_elsewhere" }) })
  );
  t.after(() => close(server));
  const response = await fetch(`${base}/auth/me`, {
    headers: { cookie: "astryx_session=evicted" },
  });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: "Signed in on another device",
    code: "signed_in_elsewhere",
  });
});

test("rejects normal users and permits admins on pipeline creation", async (t) => {
  const userApp = await serve(createApiApp({ resolveSession: async () => user }));
  t.after(() => close(userApp.server));
  const denied = await fetch(`${userApp.base}/jobs`, {
    method: "POST",
    headers: { cookie: "astryx_session=user", "content-type": "application/json" },
    body: JSON.stringify({
      type: "import-app",
      name: "linear",
      url: "https://mobbin.com/apps/a/b/screens",
    }),
  });
  assert.equal(denied.status, 403);

  let created = false;
  const adminApp = await serve(
    createApiApp({
      resolveSession: async () => admin,
      createJob: async () => {
        created = true;
        return 9;
      },
      publishJob: async () => {},
    })
  );
  t.after(() => close(adminApp.server));
  const allowed = await fetch(`${adminApp.base}/jobs`, {
    method: "POST",
    headers: { cookie: "astryx_session=admin", "content-type": "application/json" },
    body: JSON.stringify({
      type: "import-app",
      name: "linear",
      url: "https://mobbin.com/apps/a/b/screens",
    }),
  });
  assert.equal(allowed.status, 201);
  assert.equal(created, true);
});

test("accepts raw Stripe webhooks before JSON parsing", async (t) => {
  let received = "";
  const { base, server } = await serve(createApiApp({
    billing: {
      createCheckout: async () => ({ status: "already_subscribed" }),
      createPortal: async () => undefined,
      handleWebhook: async (body) => {
        received = body.toString();
        return "processed";
      },
    },
  }));
  t.after(() => close(server));
  const response = await fetch(`${base}/billing/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": "sig" },
    body: '{"id":"evt_1"}',
  });
  assert.equal(response.status, 200);
  assert.equal(received, '{"id":"evt_1"}');
});

test("creates Checkout and returns safe subscription state", async (t) => {
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => user,
    billing: {
      createCheckout: async (_user, interval) => ({ status: "created", url: `https://stripe/${interval}` }),
      createPortal: async () => ({ url: "https://stripe/portal" }),
      handleWebhook: async () => "processed",
    },
    getAccountEntitlements: async () => ({
      plan: "pro",
      subscription: {
        user_id: user.id,
        stripe_customer_id: "cus_secret",
        stripe_subscription_id: "sub_secret",
        stripe_price_id: "price_secret",
        billing_interval: "month",
        status: "active",
        current_period_start: "2026-07-01T00:00:00Z",
        current_period_end: "2026-08-01T00:00:00Z",
        cancel_at_period_end: false,
        grace_expires_at: null,
      },
      freeUnlocks: ["linear"],
      freeUnlocksRemaining: 2,
      exportUsage: { used: 1, limit: 20, resetAt: "2026-08-01T00:00:00Z" },
    }),
  }));
  t.after(() => close(server));
  const checkout = await fetch(`${base}/billing/checkout`, {
    method: "POST",
    headers: { cookie: "astryx_session=user", "content-type": "application/json" },
    body: JSON.stringify({ interval: "month" }),
  });
  assert.equal(checkout.status, 201);
  assert.deepEqual(await checkout.json(), { url: "https://stripe/month" });
  const subscription = await (await fetch(`${base}/billing/subscription`, {
    headers: { cookie: "astryx_session=user" },
  })).json();
  assert.equal(subscription.plan, "pro");
  assert.equal(subscription.interval, "month");
  assert.equal(subscription.stripe_customer_id, undefined);
});

test("blocks catalog-wide traversal and records a redacted audit event", async (t) => {
  const events: Array<{ appSlug?: string; ipPrefix?: string; outcome: string }> = [];
  const images = [
    ...catalogImages,
    { ...catalogImages[0], id: 8, app: "notion", image_url: "mobbin-bulk:1111111111111111" },
  ];
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => user,
    canAccessApp: async () => true,
    allImages: async () => images,
    listAppVersions: async (app) => [{ ...publishedVersion, app }],
    versionImages: async (app) => images.filter((image) => image.app === app),
    appTraversalLimit: 1,
    recordAccessEvent: async (event) => { events.push(event); },
  }));
  t.after(() => close(server));
  const headers = { cookie: "astryx_session=user" };
  assert.equal((await fetch(`${base}/apps/linear`, { headers })).status, 200);
  assert.equal((await fetch(`${base}/apps/linear`, { headers })).status, 200);
  const blocked = await fetch(`${base}/apps/notion`, { headers });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get("retry-after"), "600");
  assert.equal(events.at(-1)?.appSlug, "notion");
  assert.equal(events.at(-1)?.outcome, "blocked");
  assert.match(events.at(-1)?.ipPrefix ?? "", /\/24$/);
});

test("reserves a validated selected export for entitled Pro", async (t) => {
  let receivedUserId: number | undefined;
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => user,
    canAccessApp: async () => true,
    appImages: async () => catalogImages,
    recordAccessEvent: async () => {},
    reserveExportOperation: async (userId) => {
      receivedUserId = userId;
      return { status: "reserved", used: 1, limit: 20, resetAt: "2026-08-01T00:00:00Z" };
    },
  }));
  t.after(() => close(server));
  const response = await fetch(`${base}/apps/linear/exports/reservations?platform=web`, {
    method: "POST",
    headers: { cookie: "astryx_session=user", "content-type": "application/json" },
    body: JSON.stringify({ kind: "screens", ids: [7] }),
  });
  assert.equal(response.status, 201);
  assert.equal(receivedUserId, user.id);
  assert.equal((await response.json()).status, "reserved");
});

test("rejects oversized or unavailable export reservations", async (t) => {
  let reserved = false;
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => user,
    canAccessApp: async () => false,
    reserveExportOperation: async () => {
      reserved = true;
      return { status: "not_pro", used: 0, limit: 20, resetAt: null };
    },
  }));
  t.after(() => close(server));
  const headers = { cookie: "astryx_session=user", "content-type": "application/json" };
  const invalid = await fetch(`${base}/apps/linear/exports/reservations?platform=web`, {
    method: "POST",
    headers,
    body: JSON.stringify({ kind: "screens", ids: Array.from({ length: 11 }, (_, i) => i + 1) }),
  });
  assert.equal(invalid.status, 400);
  const locked = await fetch(`${base}/apps/linear/exports/reservations?platform=web`, {
    method: "POST",
    headers,
    body: JSON.stringify({ kind: "component-family", id: "buttons" }),
  });
  assert.equal(locked.status, 403);
  assert.equal(reserved, false);
});

test("rejects component exports that do not belong to the app design system", async (t) => {
  let reserved = false;
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => user,
    canAccessApp: async () => true,
    getDesignSystem: async () => ({
      app: "linear",
      generatedAt: "2026-07-10T00:00:00Z",
      tokens: [],
      components: [],
      flows: [],
    }),
    recordAccessEvent: async () => {},
    reserveExportOperation: async () => {
      reserved = true;
      return { status: "reserved", used: 1, limit: 20, resetAt: "2026-08-01T00:00:00Z" };
    },
  }));
  t.after(() => close(server));
  const response = await fetch(`${base}/apps/linear/exports/reservations?platform=web`, {
    method: "POST",
    headers: { cookie: "astryx_session=user", "content-type": "application/json" },
    body: JSON.stringify({ kind: "component-family", id: "buttons" }),
  });
  assert.equal(response.status, 400);
  assert.equal(reserved, false);
});
