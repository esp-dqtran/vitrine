import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import sharp from "sharp";
import type {
  AppKnowledgeDesignSystemResult,
  AppKnowledgeSnapshot,
} from "./appKnowledge.ts";
import type {
  AppKnowledgeDesignSystemChunkPrompt,
  AppKnowledgeDesignSystemMergePrompt,
  AppKnowledgeFlowSynthesisPrompt,
  AppKnowledgeProvider,
} from "./appKnowledgeProvider.ts";
import type { AppKnowledgeEvidenceManifestItem } from "./appKnowledgeEvidence.ts";
import { EvidenceAnalysisError } from "./evidenceAnalysisRuntime.ts";
import {
  createAppKnowledgeService,
  parseAppKnowledgeEvidenceAnalysis,
  type AppKnowledgeEvidenceAnalysis,
} from "./appKnowledgeService.ts";
import type {
  AppKnowledgeJobEvidenceRecord,
  AppKnowledgeStore,
  AppKnowledgeWorkerJob,
} from "./appKnowledgeStore.ts";
import type { AppKnowledgeEvidenceSource } from "./db.ts";
import type { ObjectMetadata, ObjectStore } from "./objectStore.ts";

async function png(red: number, width = 8, height = 8): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
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
    tokenCandidates: [],
    componentOccurrences: [],
  };
}

test("parses LLM token candidates and normalized component occurrences", () => {
  const raw = {
    ...analysis("SCREEN-1"),
    tokenCandidates: [
      "color",
      "typography",
      "spacing",
      "radius",
      "border",
      "effect",
    ].map((kind) => ({
      kind,
      name: `${kind} candidate`,
      value: kind === "color" ? "#F26B38" : "16px",
      role: "Observed visual role",
      confidence: 0.82,
    })),
    componentOccurrences: [{
      family: "Button",
      variant: "Primary",
      category: "Inputs",
      purpose: "Triggers the primary action",
      anatomy: ["container", "label"],
      visibleStates: ["default"],
      observedProperties: ["orange fill", "white label"],
      region: { x: 0.72, y: 0.61, width: 0.18, height: 0.06 },
      confidence: 0.88,
    }],
  };

  const parsed = parseAppKnowledgeEvidenceAnalysis(raw, "SCREEN-1");

  assert.deepEqual(
    parsed.tokenCandidates.map(({ kind }) => kind),
    ["color", "typography", "spacing", "radius", "border", "effect"],
  );
  assert.deepEqual(parsed.componentOccurrences[0].region, {
    x: 0.72,
    y: 0.61,
    width: 0.18,
    height: 0.06,
  });
});

test("rejects unsupported tokens and out-of-bounds normalized regions", () => {
  const token = {
    ...analysis("SCREEN-1"),
    tokenCandidates: [{
      kind: "opacity",
      name: "Disabled",
      value: "0.5",
      role: "Disabled content",
      confidence: 0.8,
    }],
    componentOccurrences: [],
  };
  assert.throws(
    () => parseAppKnowledgeEvidenceAnalysis(token, "SCREEN-1"),
    /token kind is invalid/,
  );

  const region = {
    ...analysis("SCREEN-1"),
    tokenCandidates: [],
    componentOccurrences: [{
      family: "Button",
      variant: "Primary",
      category: "Inputs",
      purpose: "Submit",
      anatomy: [],
      visibleStates: ["default"],
      observedProperties: [],
      region: { x: 0.9, y: 0.9, width: 0.2, height: 0.2 },
      confidence: 0.8,
    }],
  };
  assert.throws(
    () => parseAppKnowledgeEvidenceAnalysis(region, "SCREEN-1"),
    /normalized region exceeds source bounds/,
  );
});

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

function designSystem(evidenceId: string, suffix = "merged"): AppKnowledgeDesignSystemResult {
  const claim = {
    id: `language-layout-${suffix}`,
    kind: "observed" as const,
    text: "Primary content uses a consistent page frame.",
    evidenceIds: [evidenceId],
    confidence: 0.9,
  };
  return {
    tokenCandidates: [],
    componentCandidates: [{
      id: `component-page-frame-${suffix}`,
      name: "Page frame",
      category: "layout",
      purpose: "Frame primary application content",
      anatomy: ["Navigation", "Content"],
      observedProperties: ["Consistent content frame"],
      variants: [],
      variantCandidates: [],
      states: [],
      responsiveEvidence: [],
      evidenceIds: [evidenceId],
      visualRegions: ["Page"],
      designLanguageCandidateIds: [claim.id],
      claims: [],
      confidence: 0.9,
      status: "candidate",
    }],
    rules: [],
    designLanguage: {
      color: [],
      typography: [],
      spacing: [],
      radius: [],
      border: [],
      effects: [],
      layout: [claim],
      iconography: [],
      imagery: [],
      responsive: [],
      content: [],
      interaction: [],
    },
    unresolvedConflicts: [],
  };
}

async function harness(options: {
  drift?: boolean;
  failEvidenceId?: string;
  failEvidenceKind?: "screen" | "flow_step" | "ui_element";
  cachedEvidenceId?: string;
  blockEvidenceId?: string;
  rateLimitEvidenceId?: string;
  designSystemChunkBytes?: number;
  failDesignChunkFromCall?: number;
  failDesignChunkAttempts?: number;
  componentOccurrence?: boolean;
} = {}) {
  const bodies = new Map<number, Buffer>([
    [1, await png(10, 100, 100)],
    [2, await png(20)],
    [3, await png(21)],
    [4, await png(30)],
    [5, await png(10, 100, 100)],
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
        { label: "Second", interaction: "Tap Continue", evidence: [3] },
      ],
    }],
  };
  const records = new Map<string, AppKnowledgeJobEvidenceRecord>();
  const cache = new Map<string, { analysis: Record<string, unknown> }>();
  let completed: AppKnowledgeSnapshot | undefined;
  let stale = false;
  let failed: { code: string; message: string } | undefined;
  const cropWrites: Array<Record<string, unknown>> = [];
  let attachedCropRevision: { jobId: number; revisionId: number } | undefined;
  const progress: Array<{ stage: AppKnowledgeWorkerJob["stage"]; done: number }> = [];
  const designSystemChunks = new Map<string, {
    key: string;
    ordinal: number;
    status: "pending" | "complete" | "failed";
    fragment?: Record<string, unknown>;
    attemptCount: number;
    errorCode?: string;
  }>();
  const job: AppKnowledgeWorkerJob = {
    id: 1,
    snapshotId: 1,
    transportJobId: 1,
    requestedBy: 1,
    requestOrigin: "manual",
    status: "queued",
    stage: "preparing",
    doneCount: 0,
    totalCount: 0,
    synthesisDoneCount: 0,
    synthesisTotalCount: 0,
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
      progress.push({ stage, done });
    },
    async setSynthesisPlan(_jobId: number, totalCount: number, doneCount: number) {
      job.synthesisTotalCount = totalCount;
      job.synthesisDoneCount = doneCount;
      synthesisPlans.push({ totalCount, doneCount });
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
    async prepareDesignSystemChunks(_jobId: number, chunks: Array<{ key: string; ordinal: number }>) {
      for (const chunk of chunks) {
        if (!designSystemChunks.has(chunk.key)) {
          designSystemChunks.set(chunk.key, {
            ...chunk,
            status: "pending",
            attemptCount: 0,
          });
        }
      }
      return [...designSystemChunks.values()]
        .sort((left, right) => left.ordinal - right.ordinal)
        .map((chunk) => structuredClone(chunk));
    },
    async designSystemChunkRecords() {
      return [...designSystemChunks.values()]
        .sort((left, right) => left.ordinal - right.ordinal)
        .map((chunk) => structuredClone(chunk));
    },
    async recordDesignSystemChunkResult(_jobId: number, input: { key: string; fragment: Record<string, unknown>; attemptCount: number }) {
      const chunk = designSystemChunks.get(input.key)!;
      designSystemChunks.set(input.key, {
        ...chunk,
        status: "complete",
        fragment: structuredClone(input.fragment),
        attemptCount: input.attemptCount,
      });
    },
    async recordDesignSystemChunkFailure(_jobId: number, input: { key: string; errorCode: string; attemptCount: number }) {
      const chunk = designSystemChunks.get(input.key)!;
      designSystemChunks.set(input.key, {
        ...chunk,
        status: "failed",
        attemptCount: input.attemptCount,
        errorCode: input.errorCode,
      });
    },
    async findComponentCrop() {
      return undefined;
    },
    async persistComponentCrop(input: Record<string, unknown>) {
      cropWrites.push(structuredClone(input));
      return 99;
    },
    async attachCropsToRevision(jobId: number, revisionId: number) {
      attachedCropRevision = { jobId, revisionId };
    },
    async completeGeneration(_jobId: number, snapshot: AppKnowledgeSnapshot) {
      completed = snapshot;
      job.status = "done";
      return { id: 12, reviewStatus: "draft" };
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
      if (entry) return { metadata: entry[1], body: bodies.get(entry[0])! };
      const crop = cropObjects.get(key);
      if (crop) return crop;
      throw new Error("missing");
    },
    async head(key) {
      return [...objects.values()].find((object) => object.key === key)
        ?? cropObjects.get(key)?.metadata;
    },
    async put(input) {
      const { body, ...metadata } = input;
      cropObjects.set(metadata.key, { metadata, body: Buffer.from(body) });
      return { created: true, metadata };
    },
    async signedGetUrl() { return undefined; },
    async *list() {},
    async delete() { return false; },
  };
  const calls: Array<{ evidenceId: string; previous: string | null }> = [];
  const designChunkCalls: AppKnowledgeDesignSystemChunkPrompt[] = [];
  const designMergeCalls: AppKnowledgeDesignSystemMergePrompt[] = [];
  const flowSynthesisCalls: AppKnowledgeFlowSynthesisPrompt[] = [];
  const synthesisPlans: Array<{ totalCount: number; doneCount: number }> = [];
  const cropObjects = new Map<string, { metadata: ObjectMetadata; body: Buffer }>();
  const providerGate = Promise.withResolvers<void>();
  let active = 0;
  let maximum = 0;
  const provider: AppKnowledgeProvider = {
    model: "test-model",
    async analyzeEvidence(prompt, _image, signal) {
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
      if (prompt.evidenceId === options.blockEvidenceId) {
        providerGate.resolve();
        await new Promise<never>((_resolve, reject) =>
          signal.addEventListener(
            "abort",
            () => reject(signal.reason),
            { once: true },
          ));
      }
      if (prompt.evidenceId === options.rateLimitEvidenceId) {
        throw new EvidenceAnalysisError("provider_rate_limited");
      }
      if (
        prompt.evidenceId === options.failEvidenceId
        || prompt.kind === options.failEvidenceKind
      ) throw new Error("provider exploded secret /tmp/key");
      return analysis(prompt.evidenceId);
    },
    async synthesize(prompt) {
      return synthesized(prompt.allowedEvidenceIds[0]);
    },
    async synthesizeFlows(prompt) {
      flowSynthesisCalls.push(structuredClone(prompt));
      return {
        flows: (prompt.flows as Array<{
          id: string;
          steps: Array<{ id: string }>;
        }>).map((flow) => ({
          flowId: flow.id,
          purpose: `Complete ${flow.id}`,
          tags: ["Flow"],
          feedback: ["Completion feedback"],
          openQuestions: [],
          confidence: 0.86,
          source: "llm_inferred",
          reviewStatus: "needs_review",
          steps: flow.steps.map((step) => ({
            stepId: step.id,
            interaction: "Inferred interaction",
            visibleStates: ["Default"],
            systemFeedback: [],
          })),
        })),
      };
    },
    async synthesizeDesignSystemChunk(prompt) {
      designChunkCalls.push(structuredClone(prompt));
      const callNumber = designChunkCalls.length;
      if (
        options.failDesignChunkFromCall !== undefined
        && callNumber >= options.failDesignChunkFromCall
        && callNumber < options.failDesignChunkFromCall
          + (options.failDesignChunkAttempts ?? 3)
      ) throw new Error("temporary design-system failure");
      return designSystem(
        prompt.allowedEvidenceIds[0],
        `chunk-${designChunkCalls.length}`,
      );
    },
    async mergeDesignSystem(prompt) {
      designMergeCalls.push(structuredClone(prompt));
      const result = designSystem(prompt.allowedEvidenceIds[0]);
      if (options.componentOccurrence) {
        result.componentCandidates[0].variantCandidates = [{
          id: "variant-page-frame-default",
          name: "Default",
          description: "Default page frame",
          observedProperties: ["Consistent content frame"],
          visibleStates: ["Default"],
          evidenceIds: [prompt.allowedEvidenceIds[0]],
          occurrences: [{
            evidenceId: prompt.allowedEvidenceIds[0],
            region: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
            confidence: 0.88,
          }],
          confidence: 0.88,
          source: "llm_inferred",
          reviewStatus: "needs_review",
        }];
      }
      return result;
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
    timeoutMs: 20,
    cancelCheckIntervalMs: 1,
    designSystemChunkBytes: options.designSystemChunkBytes,
  });
  return {
    service,
    job,
    records,
    cache,
    calls,
    designChunkCalls,
    designMergeCalls,
    flowSynthesisCalls,
    synthesisPlans,
    cropWrites,
    designSystemChunks,
    progress,
    get maximum() { return maximum; },
    get completed() { return completed; },
    get stale() { return stale; },
    get failed() { return failed; },
    get attachedCropRevision() { return attachedCropRevision; },
    providerStarted: providerGate.promise,
    cancel: () => { job.cancelRequested = true; },
  };
}

function seedCompletedScreens(
  state: Awaited<ReturnType<typeof harness>>,
  count: number,
  duplicateFlowStepCount = 0,
): void {
  const screenManifest: AppKnowledgeEvidenceManifestItem[] = Array.from(
    { length: count },
    (_, index) => {
    const evidenceId = `SCREEN-${index + 1}`;
    state.records.set(evidenceId, {
      evidenceId,
      status: "complete",
      analysis: analysis(evidenceId),
      attemptCount: 1,
    });
    return {
      evidenceId,
      imageId: index + 1,
      kind: "screen" as const,
      eligibility: "eligible" as const,
      reason: "screen_capture",
      normalizedVisualSha256: `${(index + 1).toString(16).padStart(64, "0")}`,
      capturedAt: "2026-07-23T00:00:00.000Z",
      object: {
        sha256: "a".repeat(64),
        byteSize: 1,
        contentType: "image/png",
      },
    };
    },
  );
  const duplicateFlows: AppKnowledgeEvidenceManifestItem[] = Array.from(
    { length: duplicateFlowStepCount },
    (_, index) => ({
    evidenceId: `FLOW-DUPLICATE-${index + 1}`,
    imageId: 10_000 + index,
    kind: "flow_step" as const,
    eligibility: "duplicate" as const,
    reason: "visual_duplicate",
    duplicateOfEvidenceId: "SCREEN-1",
    capturedAt: "2026-07-23T00:00:00.000Z",
    object: {
      sha256: "a".repeat(64),
      byteSize: 1,
      contentType: "image/png",
    },
    }),
  );
  state.job.manifest = [...screenManifest, ...duplicateFlows];
  state.job.sourceSha256 = "0".repeat(64);
  state.job.totalCount = count;
}

test("synthesizes 610 completed screens in bounded chunks without expanding flow duplicates", async () => {
  const state = await harness({ designSystemChunkBytes: 24_000 });
  seedCompletedScreens(state, 610, 754);

  assert.equal(await state.service.generate("1"), "done", JSON.stringify(state.failed));
  assert.equal(state.calls.length, 0, "completed screen analyses must be reused");
  assert.equal(
    state.designChunkCalls.flatMap(({ allowedEvidenceIds }) => allowedEvidenceIds).length,
    610,
  );
  assert.ok(state.designChunkCalls.length > 1);
  assert.equal(state.designMergeCalls.length, 1);
  assert.equal(state.completed?.screens.length, 610);
  assert.equal(state.completed?.flows.length, 0);
  assert.ok(state.completed?.designLanguage.layout.length);
});

test("reuses completed design-system chunks and retries only the failed chunk after resume", async () => {
  const state = await harness({
    designSystemChunkBytes: 1_000,
    failDesignChunkFromCall: 2,
    failDesignChunkAttempts: 3,
  });
  seedCompletedScreens(state, 8);

  assert.equal(await state.service.generate("1"), "error");
  const firstChunkEvidence = state.designChunkCalls[0].allowedEvidenceIds;
  assert.equal(
    [...state.designSystemChunks.values()].filter(({ status }) => status === "complete").length,
    1,
  );
  assert.equal(
    [...state.designSystemChunks.values()].filter(({ status }) => status === "failed").length,
    1,
  );

  assert.equal(await state.service.generate("1"), "done", JSON.stringify(state.failed));
  assert.equal(
    state.designChunkCalls.filter(({ allowedEvidenceIds }) =>
      JSON.stringify(allowedEvidenceIds) === JSON.stringify(firstChunkEvidence)).length,
    1,
    "the completed first chunk must not be sent to the provider again",
  );
  assert.ok([...state.designSystemChunks.values()].every(({ status }) => status === "complete"));
});

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
  assert.equal(state.flowSynthesisCalls.length, 1);
  assert.deepEqual(state.synthesisPlans, [{ totalCount: 2, doneCount: 0 }]);
  assert.equal(state.completed?.flows.length, 1);
  assert.equal(state.completed?.flows[0].steps[1].interaction, "Tap Continue");
  assert.equal(state.completed?.flows[0].insights?.source, "llm_inferred");
});

test("derives verified component crops and attaches them after revision creation", async () => {
  const state = await harness({ componentOccurrence: true });

  assert.equal(await state.service.generate("1"), "done", JSON.stringify(state.failed));
  assert.equal(state.cropWrites.length, 1);
  assert.equal(state.cropWrites[0].sourceImageId, 1);
  assert.equal(state.cropWrites[0].componentFamily, "Page frame");
  assert.deepEqual(state.attachedCropRevision, { jobId: 1, revisionId: 12 });
});

test("persists an evidence failure, synthesizes a partial draft, and redacts failure detail", async () => {
  const state = await harness({ failEvidenceKind: "flow_step" });
  assert.equal(await state.service.generate("1"), "done");
  assert.equal(
    [...state.records.values()].filter(({ status }) => status === "failed").length,
    2,
  );
  assert.equal(state.completed?.coverage.failed, 2);
  assert.equal(state.failed, undefined);
});

test("does not double-count a failed evidence row when a resumed worker recovers it", async () => {
  const state = await harness();
  state.records.set("SCREEN-1", {
    evidenceId: "SCREEN-1",
    status: "failed",
    attemptCount: 3,
    errorCode: "output_invalid",
  });

  assert.equal(await state.service.generate("1"), "done");
  const analyzing = state.progress.filter(({ stage }) => stage === "analyzing");
  assert.deepEqual(analyzing.slice(0, 2).map(({ done }) => done), [0, 1]);
  assert.equal(state.records.get("SCREEN-1")?.status, "complete");
});

test("marks source drift stale before save", async () => {
  const state = await harness({ drift: true });
  assert.equal(await state.service.generate("1"), "stale", JSON.stringify(state.failed));
  assert.equal(state.stale, true);
  assert.equal(state.completed, undefined);
});

test("cancels an active provider call without recording evidence failure", async () => {
  const state = await harness({ blockEvidenceId: "SCREEN-1" });
  const generation = state.service.generate("1");
  await state.providerStarted;
  state.cancel();

  assert.equal(await generation, "cancelled");
  assert.equal(state.records.has("SCREEN-1"), false);
  assert.equal(state.failed, undefined);
});

test("stops the whole job on a browser rate limit without recording evidence failure", async () => {
  const state = await harness({ rateLimitEvidenceId: "SCREEN-1" });
  assert.equal(await state.service.generate("1"), "error");
  assert.equal(state.records.has("SCREEN-1"), false);
  assert.deepEqual(state.failed, {
    code: "provider_rate_limited",
    message: "ChatGPT temporarily limited browser requests",
  });
});
