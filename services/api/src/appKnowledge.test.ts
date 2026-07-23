import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createServer, type Server } from "node:http";
import { after, before, test } from "node:test";
import express from "express";
import type { AppKnowledgeSnapshot } from "../../../src/appKnowledge.ts";
import type {
  AppKnowledgeJobView,
  AppKnowledgeSnapshotView,
  AppKnowledgeStore,
} from "../../../src/appKnowledgeStore.ts";
import { ActiveAppKnowledgeJobError } from "../../../src/appKnowledgeStore.ts";
import {
  mountAppKnowledgeRoutes,
  type AppKnowledgeRouteDependencies,
} from "./appKnowledge.ts";

const sourceSha256 = "a".repeat(64);
const manifest = [{
  evidenceId: "SCREEN-1",
  imageId: 9,
  kind: "screen" as const,
  eligibility: "eligible" as const,
  reason: "screen_capture" as const,
  normalizedVisualSha256: "b".repeat(64),
  object: { sha256: "c".repeat(64), byteSize: 10, contentType: "image/png" as const },
}];

function snapshot(failed = 0): AppKnowledgeSnapshot {
  return {
    identity: {
      app: "linear",
      platform: "web",
      captureVersionId: 7,
      sourceSha256,
      providerModel: "vision-model",
      promptVersion: 1,
      generatedAt: "2026-07-23T00:00:00.000Z",
    },
    coverage: {
      total: 1, eligible: 1, analyzed: failed ? 0 : 1, cached: 0,
      quarantined: 0, skipped: 0, failed, duplicateVisuals: 0,
      byKind: {
        screen: { total: 1, eligible: 1, analyzed: failed ? 0 : 1, cached: 0, quarantined: 0, failed },
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
      claims: [{
        id: "home-purpose",
        kind: "observed",
        text: "The home screen orients the user.",
        evidenceIds: ["SCREEN-1"],
        confidence: 0.9,
      }],
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
        id: "home-capability",
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

function revision(
  reviewStatus: "draft" | "in_review" | "approved" = "draft",
  failed = 0,
) {
  return {
    id: 51,
    snapshotId: 41,
    revisionNumber: 1,
    authorType: "generated" as const,
    reviewStatus,
    content: snapshot(failed),
    manifest,
    sourceSha256,
    providerModel: "vision-model",
    promptVersion: 1,
    createdBy: 1,
    createdAt: "2026-07-23T00:00:00.000Z",
  };
}

function snapshotView(
  reviewStatus: "draft" | "in_review" | "approved" = "draft",
  failed = 0,
): AppKnowledgeSnapshotView {
  const current = revision(reviewStatus, failed);
  return {
    id: 41,
    target: {
      appId: 3,
      app: "linear",
      platformId: 5,
      platform: "web",
      captureVersionId: 7,
      versionNumber: 2,
    },
    currentRevisionId: current.id,
    ...(reviewStatus === "approved" ? { approvedRevisionId: current.id } : {}),
    currentRevision: current,
    revisions: [current],
    reviewEvents: [],
  };
}

const job: AppKnowledgeJobView = {
  id: 31,
  snapshotId: 41,
  transportJobId: 71,
  requestedBy: 1,
  status: "queued",
  stage: "preparing",
  doneCount: 0,
  totalCount: 0,
  cacheHitCount: 0,
  failedCount: 0,
  providerModel: "vision-model",
  promptVersion: 1,
  cancelRequested: false,
  retryFailedOnly: false,
  updatedAt: "2026-07-23T00:00:00.000Z",
};

let adminView: AppKnowledgeSnapshotView | undefined = snapshotView();
let approvedView: AppKnowledgeSnapshotView | undefined;
let currentSha = sourceSha256;
let allowApp = true;
let providerModel = "vision-model";
let publishFailure = false;
let resolveVersion = true;
let activeJobExists = false;
let transportId = 70;
const published: unknown[] = [];
const statuses: unknown[] = [];
const actions: string[] = [];

class NotificationClient extends EventEmitter {
  queries: string[] = [];
  released = false;
  async query(sql: string) { this.queries.push(sql); return { rows: [] }; }
  release() { this.released = true; }
}
const notifications = new NotificationClient();

const store = {
  async createJob() {
    actions.push("create");
    if (activeJobExists) throw new ActiveAppKnowledgeJobError();
    return job;
  },
  async getAdminSnapshotForApp() { return adminView; },
  async getAdminSnapshot(snapshotId: number) {
    return snapshotId === 41 ? adminView : undefined;
  },
  async getApprovedSnapshotForApp() { return approvedView; },
  async getLatestJobForSnapshot(snapshotId: number) {
    return snapshotId === 41 ? job : undefined;
  },
  async getJob(jobId: number) {
    return jobId === 31 ? { ...job, status: "running" as const } : undefined;
  },
  async requestCancel(jobId: number) {
    actions.push("cancel");
    return jobId === 31 ? { ...job, cancelRequested: true } : undefined;
  },
  async resumeJob(jobId: number, transportJobId: number) {
    actions.push("resume");
    return jobId === 31 ? { ...job, transportJobId } : undefined;
  },
  async retryFailedEvidence(jobId: number, transportJobId: number) {
    actions.push("retry");
    return jobId === 31 ? { ...job, transportJobId, retryFailedOnly: true } : undefined;
  },
  async saveRevision(_snapshotId: number, _revisionId: number, content: AppKnowledgeSnapshot) {
    actions.push("edit");
    return { ...revision(), id: 52, revisionNumber: 2, authorType: "user" as const, content };
  },
  async setReviewStatus(_snapshotId: number, _revisionId: number, status: "draft" | "in_review" | "approved") {
    actions.push(status);
    return { ...revision(status), reviewStatus: status };
  },
  async recordReviewEvent(input: { action: string }) {
    actions.push(input.action);
    return {
      id: 81, snapshotId: 41, actorId: 1, action: input.action,
      details: {}, createdAt: "2026-07-23T00:00:00.000Z",
    };
  },
  async failJob() { actions.push("failed"); },
} as unknown as AppKnowledgeStore;

const dependencies = {
  store,
  canAccessApp: async () => allowApp,
  resolveAppVersion: async (_app: string, _platform: string, version?: number) =>
    resolveVersion ? ({
      id: 7,
      app_id: 3,
      platform_id: 5,
      app: "linear",
      platform: "web",
      version_number: version ?? 2,
      label: "v2",
      source_url: null,
      status: "published",
      notes: "",
      captured_at: "2026-07-23T00:00:00.000Z",
      submitted_at: null,
      published_at: "2026-07-23T00:00:00.000Z",
      screen_count: 1,
      analyzed_count: 1,
      component_count: 0,
      token_count: 0,
      flow_count: 0,
    }) : undefined,
  createJob: async () => ++transportId,
  setJobStatus: async (...input: unknown[]) => { statuses.push(input); },
  publishJob: async (value: unknown) => {
    if (publishFailure) throw new Error("amqp://secret.example queue refused token=secret");
    published.push(value);
  },
  get providerModel() { return providerModel; },
  promptVersion: 1,
  currentSourceSha256: async () => currentSha,
  acquireNotificationClient: async () => notifications,
} as unknown as AppKnowledgeRouteDependencies;

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  const role = req.header("x-role") === "admin" ? "admin" : "user";
  res.locals.user = { id: role === "admin" ? 1 : 2, role, email: `${role}@example.com` };
  next();
});
const requireAdmin: express.RequestHandler = (_req, res, next) => {
  if (res.locals.user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
};
mountAppKnowledgeRoutes(app, requireAdmin, dependencies);

let server: Server;
let base = "";
before(async () => {
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server failed");
  base = `http://127.0.0.1:${address.port}`;
});
after(async () => new Promise<void>((resolve, reject) =>
  server.close((error) => error ? reject(error) : resolve())));

const adminHeaders = { "content-type": "application/json", "x-role": "admin" };

test("admin starts exactly one scoped app/platform/version job", async () => {
  const response = await fetch(`${base}/app-knowledge/jobs`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ app: "linear", platform: "web", version: 2 }),
  });
  assert.equal(response.status, 201);
  assert.deepEqual(published.at(-1), { type: "generate-app-knowledge", runId: "31", jobId: transportId });
  assert.equal((await response.json() as { id: number }).id, 31);
  assert.equal((await fetch(`${base}/app-knowledge/jobs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ app: "linear", platform: "web", version: 2 }),
  })).status, 403);
  assert.equal((await fetch(`${base}/app-knowledge/jobs/bulk`, {
    method: "POST",
    headers: adminHeaders,
    body: "{}",
  })).status, 404);
});

test("start rejects inaccessible targets, unresolved versions, and unconfigured providers", async () => {
  allowApp = false;
  assert.equal((await fetch(`${base}/app-knowledge/jobs`, {
    method: "POST", headers: adminHeaders,
    body: JSON.stringify({ app: "linear", platform: "web", version: 2 }),
  })).status, 404);
  allowApp = true;
  resolveVersion = false;
  assert.equal((await fetch(`${base}/app-knowledge/jobs`, {
    method: "POST", headers: adminHeaders,
    body: JSON.stringify({ app: "linear", platform: "web", version: 2 }),
  })).status, 404);
  resolveVersion = true;
  providerModel = "";
  const unavailable = await fetch(`${base}/app-knowledge/jobs`, {
    method: "POST", headers: adminHeaders,
    body: JSON.stringify({ app: "linear", platform: "web", version: 2 }),
  });
  providerModel = "vision-model";
  assert.equal(unavailable.status, 503);
  assert.equal((await unavailable.json() as { code: string }).code, "provider_unavailable");
});

test("start rejects a duplicate active target with a stable conflict code", async () => {
  activeJobExists = true;
  const response = await fetch(`${base}/app-knowledge/jobs`, {
    method: "POST", headers: adminHeaders,
    body: JSON.stringify({ app: "linear", platform: "web", version: 2 }),
  });
  activeJobExists = false;
  assert.equal(response.status, 409);
  assert.equal((await response.json() as { code: string }).code, "active_job_exists");
});

test("ordinary entitled reads expose only the approved revision and deterministic role projection", async () => {
  approvedView = snapshotView("approved");
  const response = await fetch(`${base}/apps/linear/analysis?platform=web&version=2&role=developer`);
  assert.equal(response.status, 200);
  const body = await response.json() as Record<string, unknown>;
  assert.deepEqual(Object.keys(body).sort(), ["projection", "revision"]);
  assert.equal((body.projection as { role: string }).role, "developer");
  const serialized = JSON.stringify(body);
  assert.doesNotMatch(serialized, /vision-model|reviewEvents|errorMessage|quarantined/);
  approvedView = undefined;
  assert.equal((await fetch(`${base}/apps/linear/analysis?platform=web&version=2`)).status, 404);
});

test("admin reads include job, coverage, diagnostics, revisions, and review events", async () => {
  adminView = snapshotView("draft");
  const response = await fetch(`${base}/apps/linear/analysis?platform=web&version=2`, {
    headers: { "x-role": "admin" },
  });
  assert.equal(response.status, 200);
  const body = await response.json() as Record<string, unknown>;
  assert.ok(body.snapshot);
  assert.ok(body.job);
  assert.ok(body.coverage);
  assert.ok(body.qualityDiagnostics);
});

test("all lifecycle and review mutations are admin-only", async () => {
  const routes: Array<[string, string, unknown]> = [
    ["POST", "/app-knowledge/jobs/31/cancel", {}],
    ["POST", "/app-knowledge/jobs/31/resume", {}],
    ["POST", "/app-knowledge/jobs/31/retry-failed-evidence", {}],
    ["POST", "/app-knowledge/snapshots/41/regenerations", {}],
    ["PATCH", "/app-knowledge/snapshots/41/revisions", { revisionId: 51, content: snapshot() }],
    ["POST", "/app-knowledge/snapshots/41/review-status", { revisionId: 51, status: "in_review" }],
  ];
  for (const [method, path, body] of routes) {
    assert.equal((await fetch(`${base}${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })).status, 403, path);
  }
  for (const [method, path, body] of routes) {
    assert.notEqual((await fetch(`${base}${path}`, {
      method,
      headers: adminHeaders,
      body: JSON.stringify(body),
    })).status, 403, path);
  }
  for (const action of ["cancel", "resume", "retry", "edit", "in_review"]) {
    assert.ok(actions.includes(action), action);
  }
});

test("approval rejects stale sources and unacknowledged partial coverage", async () => {
  adminView = snapshotView("in_review");
  currentSha = "d".repeat(64);
  const stale = await fetch(`${base}/app-knowledge/snapshots/41/review-status`, {
    method: "POST", headers: adminHeaders,
    body: JSON.stringify({ revisionId: 51, status: "approved" }),
  });
  assert.equal(stale.status, 409);
  assert.equal((await stale.json() as { code: string }).code, "source_changed");

  currentSha = sourceSha256;
  adminView = snapshotView("in_review", 1);
  const partial = await fetch(`${base}/app-knowledge/snapshots/41/review-status`, {
    method: "POST", headers: adminHeaders,
    body: JSON.stringify({ revisionId: 51, status: "approved" }),
  });
  assert.equal(partial.status, 409);
  assert.equal((await partial.json() as { code: string }).code, "coverage_review_required");
  adminView!.reviewEvents.push({
    id: 99, snapshotId: 41, revisionId: 51, actorId: 1,
    action: "partial_coverage_acknowledged", details: {},
    createdAt: "2026-07-23T00:00:00.000Z",
  });
  const approved = await fetch(`${base}/app-knowledge/snapshots/41/review-status`, {
    method: "POST", headers: adminHeaders,
    body: JSON.stringify({ revisionId: 51, status: "approved" }),
  });
  assert.equal(approved.status, 200);
});

test("queue failures return a stable safe code and mark both jobs failed", async () => {
  publishFailure = true;
  const response = await fetch(`${base}/app-knowledge/jobs`, {
    method: "POST", headers: adminHeaders,
    body: JSON.stringify({ app: "linear", platform: "web", version: 2 }),
  });
  publishFailure = false;
  assert.equal(response.status, 503);
  const body = await response.text();
  assert.match(body, /queue_unavailable/);
  assert.doesNotMatch(body, /amqp|secret|token/);
  assert.ok(actions.includes("failed"));
  assert.ok(statuses.length > 0);
});

test("SSE is admin-only, starts after LISTEN, emits notifications, and releases on close", async () => {
  assert.equal((await fetch(`${base}/app-knowledge/jobs/31/events`)).status, 403);
  const controller = new AbortController();
  const response = await fetch(`${base}/app-knowledge/jobs/31/events`, {
    headers: { "x-role": "admin" },
    signal: controller.signal,
  });
  assert.match(response.headers.get("content-type") ?? "", /text\/event-stream/);
  const reader = response.body!.getReader();
  const first = new TextDecoder().decode((await reader.read()).value);
  assert.match(first, /event: app-knowledge-progress/);
  assert.match(first, /"id":31/);
  assert.equal(notifications.queries[0], "LISTEN app_knowledge_jobs");
  notifications.emit("notification", { channel: "app_knowledge_jobs", payload: "31" });
  const second = new TextDecoder().decode((await reader.read()).value);
  assert.match(second, /app-knowledge-progress/);
  controller.abort();
  const deadline = Date.now() + 2_000;
  while (!notifications.released && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(notifications.released, true);
});
