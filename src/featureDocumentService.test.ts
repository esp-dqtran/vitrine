import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import type {
  FeatureDocumentContent,
  FeatureDocumentJobStage,
  FeatureEvidenceManifestItem,
  FeatureStepAnalysis,
} from "./featureDocument.ts";
import type { FeatureDocumentProvider } from "./featureDocumentProvider.ts";
import { createFeatureDocumentService } from "./featureDocumentService.ts";
import type {
  CompleteFeatureGenerationInput,
  FeatureDocumentStore,
  FeatureDocumentWorkerJob,
  FeatureStepAnalysisRecord,
  RecordedStepAnalysis,
  RecordedStepFailure,
} from "./featureDocumentStore.ts";
import type { ObjectMetadata, ObjectStore } from "./objectStore.ts";

const source = {
  app: "Checkout",
  platform: "web" as const,
  flowId: "checkout",
  title: "Checkout",
  description: "Complete checkout",
  tags: [],
};

const manifest: FeatureEvidenceManifestItem[] = [
  { stepIndex: 0, imageIndex: 0, imageId: 42, evidenceId: "FLOW-STEP-01-IMAGE-42", stepLabel: "Cart", description: "Cart" },
  { stepIndex: 0, imageIndex: 1, imageId: 43, evidenceId: "FLOW-STEP-01-IMAGE-43", stepLabel: "Cart", description: "Cart detail" },
  { stepIndex: 1, imageIndex: 0, imageId: 44, evidenceId: "FLOW-STEP-02-IMAGE-44", stepLabel: "Payment", description: "Payment" },
];

const claim = (id: string, text: string) => ({ id, kind: "proposed" as const, text, evidenceIds: [] });

function documentFixture(): FeatureDocumentContent {
  return {
    unscopedEvidence: [],
    sourceAssessment: {
      captureType: "partial-journey",
      completeness: "partial",
      rationale: "No explicit interactions are recorded.",
      evidenceIds: [manifest[0].evidenceId],
    },
    executiveSummary: {
      purpose: claim("purpose", "Improve checkout"),
      userValue: claim("value", "Complete purchases"),
      recommendation: claim("recommendation", "Preserve progress"),
    },
    observedFlow: {
      userGoal: { id: "user-goal", kind: "observed", text: "Checkout", evidenceIds: [manifest[0].evidenceId] },
      entryPoint: { id: "entry", kind: "observed", text: "Cart", evidenceIds: [manifest[0].evidenceId] },
      completionPoint: { id: "completion", kind: "unknown", text: "Confirmation", evidenceIds: [] },
      journey: [], actors: [], visibleStates: [],
    },
    flowAnalysis: { effectivePatterns: [], friction: [], missingStates: [], inconsistencies: [], risksAndAssumptions: [] },
    proposedFeature: { problem: claim("problem", "Progress can be lost"), targetUsers: [], goals: [], nonGoals: [], behavior: [], journey: [] },
    requirements: [{
      id: "REQ-001",
      kind: "inferred",
      text: "Present the captured checkout journey",
      evidenceIds: manifest.map(({ evidenceId }) => evidenceId),
      userStory: "As a buyer, I want to review the cart and payment states so that I can continue checkout.",
      priority: "unranked",
      preconditions: [],
      acceptanceCriteria: [{
        id: "AC-001",
        kind: "observed",
        given: "the cart capture is loaded",
        when: "the cart is viewed",
        then: "the cart state is visible",
        evidenceIds: [manifest[0].evidenceId],
      }, {
        id: "AC-002",
        kind: "observed",
        given: "the cart detail capture is loaded",
        when: "the cart is viewed",
        then: "the cart detail is visible",
        evidenceIds: [manifest[1].evidenceId],
      }, {
        id: "AC-003",
        kind: "inferred",
        given: "the payment capture is available",
        when: "the payment state is reviewed",
        then: "payment information is present",
        evidenceIds: [manifest[2].evidenceId],
      }],
    }],
    edgeCases: [], successMetrics: [], guardrailMetrics: [], analyticsEvents: [], dependencies: [], openQuestions: [],
  };
}

function analysis(evidenceId: string): FeatureStepAnalysis {
  return {
    evidenceId,
    visibleUi: ["Screen"],
    visibleText: ["Continue"],
    likelyIntent: "Continue checkout",
    availableActions: ["Continue"],
    systemFeedback: [], friction: [], missingOrUncertainStates: [], accessibility: [], confidence: 0.9,
  };
}

function metadata(imageId: number): ObjectMetadata & { body: Buffer } {
  const body = Buffer.from(`image-${imageId}`);
  return {
    key: `images/${imageId}.png`,
    sha256: createHash("sha256").update(body).digest("hex"),
    byteSize: body.byteLength,
    contentType: "image/png",
    accessClass: "protected",
    body,
  };
}

class FakeStore {
  job: FeatureDocumentWorkerJob = {
    id: 27,
    documentId: 11,
    transportJobId: 9,
    status: "queued",
    stage: "preparing",
    doneCount: 0,
    totalCount: manifest.length,
    updatedAt: "2026-07-22T00:00:00.000Z",
    source,
    evidenceManifest: manifest,
    evidenceManifestSha256: "a".repeat(64),
    focusInstruction: "Find recovery gaps",
    promptVersion: 1,
    providerModel: "research-model",
    cancelRequested: false,
  };
  progress: Array<[FeatureDocumentJobStage, number]> = [];
  stepAnalyses: FeatureStepAnalysisRecord[] = [];
  failures: RecordedStepFailure[] = [];
  completed: CompleteFeatureGenerationInput[] = [];
  failed?: { code: string; message: string };
  stale = false;
  cancelAfterFirstImage = false;

  async claimJob(): Promise<FeatureDocumentWorkerJob> {
    this.job.status = this.job.cancelRequested ? "cancelled" : "running";
    return this.job;
  }
  async workerJob(): Promise<FeatureDocumentWorkerJob> {
    if (this.cancelAfterFirstImage && this.stepAnalyses.length > 0) this.job.cancelRequested = true;
    return this.job;
  }
  async updateProgress(_jobId: number, stage: FeatureDocumentJobStage, doneCount: number): Promise<void> {
    this.progress.push([stage, doneCount]);
  }
  async completedStepAnalyses(): Promise<FeatureStepAnalysisRecord[]> {
    return this.stepAnalyses;
  }
  async recordStepAnalysis(jobId: number, input: RecordedStepAnalysis): Promise<void> {
    this.stepAnalyses.push({ jobId, ...input });
  }
  async recordStepFailure(_jobId: number, input: RecordedStepFailure): Promise<void> {
    this.failures.push(input);
  }
  async completeGeneration(_jobId: number, input: CompleteFeatureGenerationInput): Promise<never> {
    this.completed.push(input);
    return undefined as never;
  }
  async failJob(_jobId: number, code: string, message: string): Promise<void> {
    this.job.status = "error";
    this.failed = { code, message };
  }
  async markStale(): Promise<void> {
    this.job.status = "stale";
    this.stale = true;
  }
}

function setup(options: { store?: FakeStore; synthesis?: unknown; currentSha256?: string; analyzeImage?: FeatureDocumentProvider["analyzeImage"]; maxImageBytes?: number } = {}) {
  const store = options.store ?? new FakeStore();
  const imageCalls: Array<{ prompt: { evidenceId: string; validationError?: string } }> = [];
  const synthesisCalls: Array<{ validationError?: string }> = [];
  const provider: FeatureDocumentProvider = {
    model: "research-model",
    async analyzeImage(prompt) {
      imageCalls.push({ prompt });
      return options.analyzeImage ? options.analyzeImage(prompt, { bytes: Buffer.alloc(0), contentType: "image/png" }, AbortSignal.timeout(1_000)) : analysis(prompt.evidenceId);
    },
    async synthesize(prompt) {
      synthesisCalls.push({ validationError: prompt.validationError });
      return options.synthesis ?? documentFixture();
    },
  };
  const objects = new Map(manifest.map(({ imageId }) => [imageId, metadata(imageId)]));
  const objectStore = {
    async head(key: string) {
      const object = [...objects.values()].find((candidate) => candidate.key === key);
      return object && {
        key: object.key,
        sha256: object.sha256,
        byteSize: object.byteSize,
        contentType: object.contentType,
        accessClass: object.accessClass,
      };
    },
    async get(key: string) {
      const object = [...objects.values()].find((candidate) => candidate.key === key)!;
      return { metadata: object, body: object.body };
    },
  } as unknown as ObjectStore;
  const service = createFeatureDocumentService({
    store: store as unknown as FeatureDocumentStore,
    provider,
    objectStore,
    imageObjectById: async (imageId) => objects.get(imageId),
    currentSourceManifest: async () => ({ sha256: options.currentSha256 ?? store.job.evidenceManifestSha256 }),
    timeoutMs: 1_000,
    retryDelayMs: 0,
    ...(options.maxImageBytes ? { maxImageBytes: options.maxImageBytes } : {}),
  });
  return { store, service, imageCalls, synthesisCalls, objects };
}

test("analyzes every ordered image then creates one validated revision", async () => {
  const { store, service, imageCalls } = setup();
  await service.generate(String(store.job.id));

  assert.deepEqual(imageCalls.map((call) => call.prompt.evidenceId), manifest.map(({ evidenceId }) => evidenceId));
  assert.equal(store.completed[0].content.requirements.length, 1);
  assert.deepEqual(store.progress, [
    ["preparing", 0], ["analyzing", 0], ["analyzing", 1], ["analyzing", 2], ["analyzing", 3],
    ["synthesizing", 3], ["validating", 3], ["saving", 3],
  ]);
});

test("uses verified crawl observations without sending screenshots to the analysis provider", async () => {
  const store = new FakeStore();
  store.job.evidenceManifest = manifest.map((item) => ({
    ...item,
    observation: analysis(item.evidenceId),
  }));
  const { service, imageCalls, synthesisCalls } = setup({ store });

  assert.equal(await service.generate(String(store.job.id)), "done");
  assert.equal(imageCalls.length, 0);
  assert.equal(synthesisCalls.length, 1);
  assert.deepEqual(
    store.stepAnalyses.map(({ evidenceId }) => evidenceId),
    manifest.map(({ evidenceId }) => evidenceId),
  );
});

test("analyzes only the screenshot steps that lack crawl observations", async () => {
  const store = new FakeStore();
  store.job.evidenceManifest = manifest.map((item, index) => ({
    ...item,
    ...(index === 0 ? { observation: analysis(item.evidenceId) } : {}),
  }));
  const { service, imageCalls } = setup({ store });

  assert.equal(await service.generate(String(store.job.id)), "done");
  assert.deepEqual(
    imageCalls.map(({ prompt }) => prompt.evidenceId),
    manifest.slice(1).map(({ evidenceId }) => evidenceId),
  );
});

test("analyzes every ordered image in one whole-Flow provider call", async () => {
  const state = setup();
  const calls: Array<{ evidenceIds: string[]; imageIds: number[] }> = [];
  const provider: FeatureDocumentProvider = {
    model: "research-model",
    async analyzeFlow(prompt, images) {
      calls.push({
        evidenceIds: prompt.allowedEvidenceIds,
        imageIds: images.map(({ evidence }) => evidence.imageId),
      });
      return {
        analyses: images.map(({ evidence }) => analysis(evidence.evidenceId)),
        document: documentFixture(),
      };
    },
    async analyzeImage() {
      throw new Error("whole-Flow provider must not analyze images separately");
    },
    async synthesize() {
      throw new Error("whole-Flow provider must not synthesize separately");
    },
  };
  const service = createFeatureDocumentService({
    store: state.store as unknown as FeatureDocumentStore,
    provider,
    objectStore: {
      get: async (key: string) => {
        const object = [...state.objects.values()].find((candidate) => candidate.key === key)!;
        return { metadata: object, body: object.body };
      },
    } as unknown as ObjectStore,
    imageObjectById: async (imageId) => state.objects.get(imageId),
    currentSourceManifest: async () => ({ sha256: state.store.job.evidenceManifestSha256 }),
    timeoutMs: 1_000,
    retryDelayMs: 0,
  });

  assert.equal(await service.generate(String(state.store.job.id)), "done");
  assert.deepEqual(calls, [{
    evidenceIds: manifest.map(({ evidenceId }) => evidenceId),
    imageIds: manifest.map(({ imageId }) => imageId),
  }]);
  assert.deepEqual(
    state.store.stepAnalyses.map(({ evidenceId }) => evidenceId),
    manifest.map(({ evidenceId }) => evidenceId),
  );
  assert.equal(state.store.completed.length, 1);
  assert.deepEqual(state.store.progress, [
    ["preparing", 0], ["analyzing", 0], ["analyzing", 1], ["analyzing", 2], ["analyzing", 3],
    ["synthesizing", 3], ["validating", 3], ["saving", 3],
  ]);
});

test("resumes from persisted analyses and retries only missing images", async () => {
  const store = new FakeStore();
  store.stepAnalyses = [{
    jobId: store.job.id,
    stepIndex: 0,
    imageIndex: 0,
    imageId: 42,
    evidenceId: manifest[0].evidenceId,
    result: analysis(manifest[0].evidenceId),
    attemptCount: 1,
  }];
  const { service, imageCalls } = setup({ store });
  await service.generate(String(store.job.id));
  assert.deepEqual(imageCalls.map((call) => call.prompt.evidenceId), manifest.slice(1).map(({ evidenceId }) => evidenceId));
});

test("never saves a partial document after cancellation", async () => {
  const store = new FakeStore();
  store.cancelAfterFirstImage = true;
  const { service, imageCalls } = setup({ store });
  await service.generate(String(store.job.id));

  assert.equal(imageCalls.length, 1);
  assert.equal(store.completed.length, 0);
  assert.equal(store.job.status, "cancelled");
});

test("marks the job stale instead of saving after source drift", async () => {
  const { store, service } = setup({ currentSha256: "b".repeat(64) });
  await service.generate(String(store.job.id));
  assert.equal(store.stale, true);
  assert.equal(store.completed.length, 0);
});

test("repairs one invalid synthesis with the exact validation error", async () => {
  let attempt = 0;
  const state = setup();
  const provider = state.service;
  void provider;
  const baseProvider: FeatureDocumentProvider = {
    model: "research-model",
    analyzeImage: async (prompt) => analysis(prompt.evidenceId),
    async synthesize(prompt) {
      state.synthesisCalls.push({ validationError: prompt.validationError });
      attempt += 1;
      return attempt === 1 ? { invalid: true } : documentFixture();
    },
  };
  const objects = state.objects;
  const service = createFeatureDocumentService({
    store: state.store as unknown as FeatureDocumentStore,
    provider: baseProvider,
    objectStore: {
      get: async (key: string) => {
        const object = [...objects.values()].find((candidate) => candidate.key === key)!;
        return { metadata: object, body: object.body };
      },
    } as unknown as ObjectStore,
    imageObjectById: async (imageId) => objects.get(imageId),
    currentSourceManifest: async () => ({ sha256: state.store.job.evidenceManifestSha256 }),
  });
  await service.generate("27");

  assert.equal(state.synthesisCalls.length, 2);
  assert.match(state.synthesisCalls[1].validationError ?? "", /sourceAssessment/);
  assert.equal(state.store.completed.length, 1);
});

test("rejects mismatched image bytes with a stable code and no partial revision", async () => {
  const state = setup();
  const original = state.objects.get(42)!;
  state.objects.set(42, { ...original, body: Buffer.from("tampered") });
  await state.service.generate("27");

  assert.equal(state.store.failed?.code, "image_metadata_mismatch");
  assert.equal(state.store.completed.length, 0);
  assert.equal(state.store.failed?.message.includes("tampered"), false);
});

test("retries one transient provider failure without repeating completed evidence", async () => {
  let calls = 0;
  const state = setup({
    analyzeImage: async (prompt) => {
      calls += 1;
      if (calls === 1) throw new Error("provider unavailable");
      return analysis(prompt.evidenceId);
    },
  });
  assert.equal(await state.service.generate("27"), "done");
  assert.equal(calls, manifest.length + 1);
  assert.equal(state.store.completed.length, 1);
});

test("rejects excessive image metadata before loading object bytes", async () => {
  const state = setup({ maxImageBytes: 4 });
  let getCalls = 0;
  const service = createFeatureDocumentService({
    store: state.store as unknown as FeatureDocumentStore,
    provider: { model: "research-model", analyzeImage: async (prompt) => analysis(prompt.evidenceId), synthesize: async () => documentFixture() },
    objectStore: { get: async () => { getCalls += 1; throw new Error("must not load"); } } as unknown as ObjectStore,
    imageObjectById: async (imageId) => state.objects.get(imageId),
    currentSourceManifest: async () => ({ sha256: state.store.job.evidenceManifestSha256 }),
    retryDelayMs: 0,
    maxImageBytes: 4,
  });
  assert.equal(await service.generate("27"), "error");
  assert.equal(state.store.failed?.code, "image_size_excessive");
  assert.equal(getCalls, 0);
});
