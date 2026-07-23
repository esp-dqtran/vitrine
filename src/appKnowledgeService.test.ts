import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import sharp from "sharp";
import type { AppKnowledgeSnapshot } from "./appKnowledge.ts";
import type { AppKnowledgeProvider } from "./appKnowledgeProvider.ts";
import {
  createAppKnowledgeService,
  type AppKnowledgeEvidenceAnalysis,
} from "./appKnowledgeService.ts";
import type {
  AppKnowledgeJobEvidenceRecord,
  AppKnowledgeStore,
  AppKnowledgeWorkerJob,
} from "./appKnowledgeStore.ts";
import type { AppKnowledgeEvidenceSource } from "./db.ts";
import type { ObjectMetadata, ObjectStore } from "./objectStore.ts";

async function png(red: number): Promise<Buffer> {
  return sharp({
    create: {
      width: 8,
      height: 8,
      channels: 4,
      background: { r: red, g: 20, b: 30, alpha: 1 },
    },
  }).png().toBuffer();
}

function metadata(id: number, body: Buffer): ObjectMetadata {
  const sha256 = createHash("sha256").update(body).digest("hex");
  return {
    key: `images/${id}/${sha256}.png`,
    sha256,
    byteSize: body.byteLength,
    contentType: "image/png",
    accessClass: "protected",
  };
}

function analysis(evidenceId: string): AppKnowledgeEvidenceAnalysis {
  return {
    evidenceId,
    pageType: "Home",
    productArea: "Core",
    purpose: "Orient users",
    viewport: "desktop",
    visibleText: ["Home"],
    theme: "light",
    visualHierarchy: [],
    layoutPatterns: [],
    contentPatterns: [],
    imagery: [],
    icons: [],
    interactionPatterns: [],
    visibleStates: ["Default"],
    availableActions: [],
    systemFeedback: [],
    accessibilityObservations: [],
    likelyIntent: "Start",
    friction: [],
    uncertainStates: [],
    confidence: 0.9,
  };
}

function synthesized(evidenceId: string): AppKnowledgeSnapshot {
  return {
    identity: {
      app: "Alpha",
      platform: "web",
      captureVersionId: 3,
      sourceSha256: "0".repeat(64),
      providerModel: "ignored",
      promptVersion: 99,
      generatedAt: "2026-07-23T00:00:00.000Z",
    },
    coverage: {
      total: 0, eligible: 0, analyzed: 0, cached: 0, quarantined: 0,
      skipped: 0, failed: 0, duplicateVisuals: 0,
      byKind: {
        screen: { total: 0, eligible: 0, analyzed: 0, cached: 0, quarantined: 0, failed: 0 },
        flow_step: { total: 0, eligible: 0, analyzed: 0, cached: 0, quarantined: 0, failed: 0 },
        ui_element: { total: 0, eligible: 0, analyzed: 0, cached: 0, quarantined: 0, failed: 0 },
      },
      flowReferences: { total: 0, resolved: 0, uniqueImages: 0 },
    },
    screens: [{
      id: "screen-home",
      evidenceId,
      pageType: "Home",
      productArea: "Core",
      purpose: "Orient users",
      viewport: "desktop",
      visibleText: ["Home"],
      theme: "light",
      visualHierarchy: [],
      layoutPatterns: [],
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
        text: "Users can view home.",
        evidenceIds: [evidenceId],
        confidence: 0.9,
      }],
      featureRelationships: [], userJourneys: [], actorResponsibilities: [],
      requirements: [], acceptanceCriteria: [], edgeCases: [], dependencies: [], risks: [],
      successMetrics: [], guardrails: [], analyticsEvents: [], openQuestions: [],
    },
  };
}

async function harness(options: {
  drift?: boolean;
  failEvidenceId?: string;
  cachedEvidenceId?: string;
} = {}) {
  const bodies = new Map<number, Buffer>([
    [1, await png(10)],
    [2, await png(20)],
    [3, await png(21)],
    [4, await png(30)],
    [5, await png(10)],
  ]);
  const objects = new Map<number, ObjectMetadata>(
    [...bodies].map(([id, body]) => [id, metadata(id, body)]),
  );
  const source: AppKnowledgeEvidenceSource = {
    appId: 1,
    app: "Alpha",
    platformId: 2,
    platform: "web",
    versionId: 3,
    versionNumber: 1,
    images: [
      { id: 1, app: "Alpha", platform: "web", image_url: "capture:1", kind: "screen", description: null, object: objects.get(1)! },
      { id: 2, app: "Alpha", platform: "web", image_url: "capture:2", kind: "flow_step", description: null, object: objects.get(2)! },
      { id: 3, app: "Alpha", platform: "web", image_url: "capture:3", kind: "flow_step", description: null, object: objects.get(3)! },
      { id: 4, app: "Alpha", platform: "web", image_url: "capture:4", kind: "ui_element", description: null, viewport_width: 8, viewport_height: 8, object: objects.get(4)! },
      { id: 5, app: "Alpha", platform: "web", image_url: "capture:5", kind: "screen", description: null, object: objects.get(5)! },
    ],
    flows: [{
      id: "flow-a",
      title: "Flow A",
      description: "",
      tags: [],
      steps: [
        { label: "First", evidence: [2] },
        { label: "Second", evidence: [3] },
      ],
    }],
  };
  const records = new Map<string, AppKnowledgeJobEvidenceRecord>();
  const cache = new Map<string, { analysis: Record<string, unknown> }>();
  let completed: AppKnowledgeSnapshot | undefined;
  let stale = false;
  let failed: { code: string; message: string } | undefined;
  const job: AppKnowledgeWorkerJob = {
    id: 1,
    snapshotId: 1,
    transportJobId: 1,
    requestedBy: 1,
    status: "queued",
    stage: "preparing",
    doneCount: 0,
    totalCount: 0,
    cacheHitCount: 0,
    failedCount: 0,
    providerModel: "test-model",
    promptVersion: 1,
    cancelRequested: false,
    retryFailedOnly: false,
    updatedAt: "2026-07-23T00:00:00.000Z",
    target: {
      appId: 1,
      app: "Alpha",
      platformId: 2,
      platform: "web",
      captureVersionId: 3,
      versionNumber: 1,
    },
  };
  const store = {
    async claimJob() {
      job.status = job.cancelRequested ? "cancelled" : "running";
      return structuredClone(job);
    },
    async freezeManifest(_jobId: number, manifest: AppKnowledgeWorkerJob["manifest"], sourceSha256: string) {
      job.manifest = structuredClone(manifest!);
      job.sourceSha256 = sourceSha256;
      job.totalCount = manifest!.filter(({ eligibility }) => eligibility === "eligible").length;
      return structuredClone(job);
    },
    async workerJob() {
      return structuredClone(job);
    },
    async updateProgress(_jobId: number, stage: AppKnowledgeWorkerJob["stage"], done: number) {
      job.stage = stage;
      job.doneCount = done;
    },
    async evidenceRecords() {
      return [...records.values()].map((record) => structuredClone(record));
    },
    async cachedAnalysis(key: string) {
      const value = cache.get(key);
      return value ? {
        cacheKey: key,
        normalizedVisualSha256: "a".repeat(64),
        platform: "web",
        promptVersion: 1,
        providerModel: "test-model",
        analysis: value.analysis,
      } : undefined;
    },
    async saveCachedAnalysis(input: { cacheKey: string; analysis: Record<string, unknown> }) {
      cache.set(input.cacheKey, { analysis: input.analysis });
      return input;
    },
    async recordEvidenceResult(_jobId: number, input: { evidenceId: string; status: "complete" | "cached"; analysis: Record<string, unknown>; attemptCount: number; cacheKey?: string }) {
      records.set(input.evidenceId, { evidenceId: input.evidenceId, status: input.status, analysis: input.analysis, attemptCount: input.attemptCount, ...(input.cacheKey ? { cacheKey: input.cacheKey } : {}) });
    },
    async recordEvidenceFailure(_jobId: number, input: { evidenceId: string; errorCode: string; attemptCount: number }) {
      records.set(input.evidenceId, { evidenceId: input.evidenceId, status: "failed", attemptCount: input.attemptCount, errorCode: input.errorCode });
    },
    async completeGeneration(_jobId: number, snapshot: AppKnowledgeSnapshot) {
      completed = snapshot;
      job.status = "done";
      return { reviewStatus: "draft" };
    },
    async markStale() {
      stale = true;
      job.status = "stale";
    },
    async failJob(_jobId: number, code: string, message: string) {
      failed = { code, message };
      job.status = "error";
    },
  } as unknown as AppKnowledgeStore;
  const objectStore: ObjectStore = {
    async get(key) {
      const entry = [...objects.entries()].find(([, object]) => object.key === key);
      if (!entry) throw new Error("missing");
      return { metadata: entry[1], body: bodies.get(entry[0])! };
    },
    async head() { return undefined; },
    async put() { throw new Error("not used"); },
    async signedGetUrl() { return undefined; },
    async *list() {},
    async delete() { return false; },
  };
  const calls: Array<{ evidenceId: string; previous: string | null }> = [];
  let active = 0;
  let maximum = 0;
  const provider: AppKnowledgeProvider = {
    model: "test-model",
    async analyzeEvidence(prompt) {
      active += 1;
      maximum = Math.max(maximum, active);
      await Promise.resolve();
      active -= 1;
      calls.push({
        evidenceId: prompt.evidenceId,
        previous: typeof prompt.previousStepContext?.evidenceId === "string"
          ? prompt.previousStepContext.evidenceId
          : null,
      });
      if (prompt.evidenceId === options.failEvidenceId) throw new Error("provider exploded secret /tmp/key");
      return analysis(prompt.evidenceId);
    },
    async synthesize(prompt) {
      return synthesized(prompt.allowedEvidenceIds[0]);
    },
  };
  const service = createAppKnowledgeService({
    store,
    provider,
    objectStore,
    evidenceSource: async () => source,
    evidenceOverrides: async () => [],
    imageObjectById: async (id) => objects.get(id),
    currentSourceSha256: async () => options.drift ? "f".repeat(64) : job.sourceSha256,
    retryDelayMs: 0,
    screenConcurrency: 2,
    flowConcurrency: 2,
  });
  return {
    service,
    job,
    records,
    cache,
    calls,
    get maximum() { return maximum; },
    get completed() { return completed; },
    get stale() { return stale; },
    get failed() { return failed; },
  };
}

test("prepares, quarantines UI Elements, deduplicates visuals, and keeps Flow steps sequential", async () => {
  const state = await harness();
  assert.equal(await state.service.generate("1"), "done", JSON.stringify(state.failed));
  assert.equal(state.completed?.identity.sourceSha256, state.job.sourceSha256);
  assert.equal(state.completed?.coverage.quarantined, 1);
  assert.equal(state.completed?.coverage.duplicateVisuals, 1);
  assert.equal(state.calls.some(({ evidenceId }) => evidenceId === "UI-ELEMENT-4"), false);
  assert.equal(state.calls.some(({ evidenceId }) => evidenceId === "SCREEN-5"), false);
  const flow = state.calls.filter(({ evidenceId }) => evidenceId.startsWith("FLOW-"));
  assert.equal(flow[0].previous, null);
  assert.equal(flow[1].previous, flow[0].evidenceId);
  assert.equal(state.completed?.screens[0].evidenceId, "SCREEN-1");
});

test("persists an evidence failure, synthesizes a partial draft, and redacts failure detail", async () => {
  const state = await harness({ failEvidenceId: "SCREEN-1" });
  assert.equal(await state.service.generate("1"), "done");
  assert.equal(state.records.get("SCREEN-1")?.status, "failed");
  assert.equal(state.completed?.coverage.failed, 1);
  assert.equal(state.failed, undefined);
});

test("marks source drift stale before save", async () => {
  const state = await harness({ drift: true });
  assert.equal(await state.service.generate("1"), "stale", JSON.stringify(state.failed));
  assert.equal(state.stale, true);
  assert.equal(state.completed, undefined);
});
