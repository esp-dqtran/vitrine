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
    if (
      this.cancelAfterFirstImage
      && this.progress.some(([stage, done]) => stage === "analyzing" && done > 0)
    ) this.job.cancelRequested = true;
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

type FlowCall = { evidenceIds: string[]; imageIds: number[]; validationError?: string };

function setup(options: {
  store?: FakeStore;
  document?: unknown;
  currentSha256?: string;
  analyzeFlow?: (call: FlowCall, attempt: number) => unknown;
  maxImageBytes?: number;
} = {}) {
  const store = options.store ?? new FakeStore();
  const flowCalls: FlowCall[] = [];
  const provider: FeatureDocumentProvider = {
    model: "research-model",
    async analyzeFlow(prompt, images) {
      const call: FlowCall = {
        evidenceIds: prompt.allowedEvidenceIds,
        imageIds: images.map(({ evidence }) => evidence.imageId),
        ...(prompt.validationError ? { validationError: prompt.validationError } : {}),
      };
      flowCalls.push(call);
      if (options.analyzeFlow) return options.analyzeFlow(call, flowCalls.length);
      return {
        analyses: images.map(({ evidence }) => analysis(evidence.evidenceId)),
        document: options.document ?? documentFixture(),
      };
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
  return { store, service, flowCalls, objects };
}

test("analyzes every ordered image in one whole-Flow call then creates one validated revision", async () => {
  const { store, service, flowCalls } = setup();

  assert.equal(await service.generate(String(store.job.id)), "done");
  assert.deepEqual(flowCalls, [{
    evidenceIds: manifest.map(({ evidenceId }) => evidenceId),
    imageIds: manifest.map(({ imageId }) => imageId),
  }]);
  assert.deepEqual(
    store.stepAnalyses.map(({ evidenceId }) => evidenceId),
    manifest.map(({ evidenceId }) => evidenceId),
  );
  assert.equal(store.completed[0].content.requirements.length, 1);
  assert.deepEqual(store.progress, [
    ["preparing", 0], ["analyzing", 0], ["analyzing", 1], ["analyzing", 2], ["analyzing", 3],
    ["synthesizing", 3], ["validating", 3], ["saving", 3],
  ]);
});

test("never saves a partial document after cancellation", async () => {
  const store = new FakeStore();
  store.cancelAfterFirstImage = true;
  const { service, flowCalls } = setup({ store });
  await service.generate(String(store.job.id));

  assert.equal(flowCalls.length, 0);
  assert.equal(store.completed.length, 0);
  assert.equal(store.job.status, "cancelled");
});

test("marks a drifted source stale before spending a provider call", async () => {
  const { store, service, flowCalls } = setup({ currentSha256: "b".repeat(64) });

  assert.equal(await service.generate(String(store.job.id)), "stale");
  assert.equal(flowCalls.length, 0);
  assert.equal(store.stale, true);
  assert.equal(store.completed.length, 0);
});

test("repairs one invalid document with the exact validation error", async () => {
  const { store, service, flowCalls } = setup({
    analyzeFlow: (_call, attempt) => attempt === 1
      ? { invalid: true }
      : {
        analyses: manifest.map(({ evidenceId }) => analysis(evidenceId)),
        document: documentFixture(),
      },
  });

  assert.equal(await service.generate(String(store.job.id)), "done");
  assert.equal(flowCalls.length, 2);
  assert.match(flowCalls[1].validationError ?? "", /whole Flow analysis/);
  assert.equal(store.completed.length, 1);
});

test("reports every broken policy rule in one validation error", async () => {
  const broken = documentFixture();
  broken.requirements[0].id = "REQUIREMENT-1";
  broken.requirements[0].priority = "must";
  broken.openQuestions = [{ id: "OQ-1", kind: "observed", text: "Unresolved", evidenceIds: [manifest[0].evidenceId] }];
  const { store, service, flowCalls } = setup({
    analyzeFlow: (_call, attempt) => ({
      analyses: manifest.map(({ evidenceId }) => analysis(evidenceId)),
      document: attempt === 1 ? broken : documentFixture(),
    }),
  });

  assert.equal(await service.generate(String(store.job.id)), "done");
  const reported = flowCalls[1].validationError ?? "";
  assert.match(reported, /REQ-001 format/);
  assert.match(reported, /priority must be unranked/);
  assert.match(reported, /openQuestions must be classified as unknown/);
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

test("retries one transient provider failure", async () => {
  let calls = 0;
  const state = setup({
    analyzeFlow: () => {
      calls += 1;
      if (calls === 1) throw new Error("provider unavailable");
      return {
        analyses: manifest.map(({ evidenceId }) => analysis(evidenceId)),
        document: documentFixture(),
      };
    },
  });

  assert.equal(await state.service.generate("27"), "done");
  assert.equal(calls, 2);
  assert.equal(state.store.completed.length, 1);
});

test("rejects excessive image metadata before loading object bytes", async () => {
  const state = setup({ maxImageBytes: 4 });
  let getCalls = 0;
  const service = createFeatureDocumentService({
    store: state.store as unknown as FeatureDocumentStore,
    provider: {
      model: "research-model",
      analyzeFlow: async () => ({
        analyses: manifest.map(({ evidenceId }) => analysis(evidenceId)),
        document: documentFixture(),
      }),
    },
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
