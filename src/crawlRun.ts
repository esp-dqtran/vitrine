import { createHash, randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { chromium, type Page } from "playwright";
import { urlMatchesExpectation, type CrawlFlow, type CrawlPlan, type CrawlStep } from "./crawlPlan.ts";
import { ensureActiveAppVersion, getAppFlows as getStoredAppFlows } from "./db.ts";
import {
  attachFailureObject as attachStoredFailureObject,
  claimRunById as claimStoredRunById,
  createRetry as createStoredRetry,
  createRun as createStoredRun,
  findWorkerEvidence as findStoredWorkerEvidence,
  getPlan as getStoredPlan,
  getRun as getStoredRun,
  heartbeatRun as heartbeatStoredRun,
  isRunCancellationRequested as isStoredRunCancellationRequested,
  listRunSteps as listStoredRunSteps,
  loadWorkerRunExecution as loadStoredWorkerRunExecution,
  loadWorkerRunFinalization as loadStoredWorkerRunFinalization,
  markStaleRunIdsInterrupted as markStoredStaleRunIdsInterrupted,
  persistEvidenceBundle as persistStoredEvidenceBundle,
  reserveCaptureImage as reserveStoredCaptureImage,
  requestRunCancellation as requestStoredRunCancellation,
  saveWorkerAppFlows as saveStoredWorkerAppFlows,
  updateRun as updateStoredRun,
  upsertRunStep as upsertStoredRunStep,
  type CreateRunInput as StoredCreateRunInput,
  type CrawlEvidenceRecord,
  type CrawlPlanRecord,
  type CrawlRunEnvironmentInput,
  type CrawlRunRecord,
  type CrawlRunStepRecord,
  type EvidenceKey,
  type FindWorkerEvidenceInput,
  type PersistEvidenceBundleInput,
  type PersistEvidenceBundleResult,
  type ReserveCaptureImageInput,
  type ReserveCaptureImageResult,
  type SaveWorkerAppFlowsInput,
  type UpdateRunInput,
  type UpsertRunStepInput,
  type WorkerRunExecutionSnapshot,
  type WorkerRunFinalizationSnapshot,
} from "./crawlStore.ts";
import type { DesignFlow } from "./designSystem.ts";
import { isAppSlug } from "./imageSource.ts";
import { failureObjectKey, imageObjectKey, LocalObjectStore, type ObjectMetadata, type ObjectStore } from "./objectStore.ts";
import { createObjectStore, objectStoreConfigFromEnvironment } from "./objectStoreConfig.ts";
import {
  executeFlowsInOwnedContext,
  isTransientBrowserError,
  type FlowResume,
  type FlowRunResult,
  type FlowStepRecord,
  type RunnerHooks,
  type StepActual,
} from "./smartCrawler.ts";

export interface CompletedCaptureIdentity {
  status: "completed";
  runId: string;
  workerId: string;
  app: string;
  versionId: number;
  planId: string;
  flowId: string;
  stepId: string;
  stateLabel: string;
  sourceUrl: string;
}

export interface ScreenshotPage {
  url(): string;
  viewportSize(): { width: number; height: number } | null;
  screenshot(options: { fullPage: true }): Promise<Uint8Array>;
  evaluate?: Page["evaluate"];
}

export interface CaptureDependencies {
  dataDir: string;
  findWorkerEvidence(input: FindWorkerEvidenceInput): Promise<CrawlEvidenceRecord | undefined>;
  reserveCaptureImage(input: ReserveCaptureImageInput): Promise<ReserveCaptureImageResult>;
  persistEvidenceBundle(input: PersistEvidenceBundleInput): Promise<PersistEvidenceBundleResult>;
  objectStore: ObjectStore;
  secretValues: readonly string[];
  shortRef?(fullHash: string): string;
}

export interface FailureArtifactIdentity {
  runId: string;
  workerId: string;
  flowId: string;
  stepId: string;
}

export interface FailureArtifactDependencies {
  objectStore: ObjectStore;
  attachFailureObject(input: FailureArtifactIdentity & { object: ObjectMetadata }): Promise<void>;
}

export interface ValidatedCapture {
  evidence: CrawlEvidenceRecord;
  imageId: number;
  ref: string;
  observedHash: string;
  newFile: boolean;
  reused: boolean;
}

function fullHash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function mediaReference(hash: string, shortRef: (fullHash: string) => string): { ref: string; hash16: string } {
  const hash16 = shortRef(hash);
  if (!/^[0-9a-f]{16}$/.test(hash16)) throw new Error("Capture short reference must be 16 lowercase hexadecimal characters");
  return { ref: `capture:${hash16}`, hash16 };
}

function replaceLiteral(value: string, literal: string): string {
  if (!literal) return value;
  return value.replace(new RegExp(literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "giu"), "redacted");
}

const SENSITIVE_DURABLE_URL_KEY = /password|passwd|pwd|secret|token|api.?key|private.?key|authorization|cookie|session.?id/i;

export function normalizeCaptureUrl(value: string, secretValues: readonly string[] = []): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Capture URL must be absolute");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Capture URL must use HTTP or HTTPS");
  }
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  for (const secret of secretValues) {
    if (typeof secret !== "string") throw new Error("Capture secret values must be strings");
    for (const variant of new Set([secret, encodeURIComponent(secret)])) {
      url.pathname = replaceLiteral(url.pathname, variant);
    }
  }
  return url.toString();
}

export function sanitizeDurableActualUrl(value: string, secretValues: readonly string[] = []): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Durable URL must be absolute");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Durable URL must use HTTP or HTTPS");
  }
  url.username = "";
  url.password = "";
  url.hash = "";
  for (const secret of secretValues) {
    if (typeof secret !== "string") throw new Error("Capture secret values must be strings");
    for (const variant of new Set([secret, encodeURIComponent(secret)])) {
      url.pathname = replaceLiteral(url.pathname, variant);
    }
  }
  const parameters = [...url.searchParams.entries()];
  url.search = "";
  for (const [key, value] of parameters) {
    if (SENSITIVE_DURABLE_URL_KEY.test(key)) {
      continue;
    }
    let sanitizedKey = key;
    let sanitizedValue = value;
    for (const secret of secretValues) {
      for (const variant of new Set([secret, encodeURIComponent(secret)])) {
        sanitizedKey = replaceLiteral(sanitizedKey, variant);
        sanitizedValue = replaceLiteral(sanitizedValue, variant);
      }
    }
    url.searchParams.append(sanitizedKey, sanitizedValue);
  }
  return url.toString();
}

export async function withMaskedSecretFields<T>(
  page: Pick<Page, "evaluate">,
  secretValues: readonly string[],
  work: () => Promise<T>,
): Promise<T> {
  const secrets = secretValues.filter(Boolean);
  if (secrets.length === 0) return work();
  const token = randomUUID();
  await page.evaluate(({ secrets: values, token: maskToken }) => {
    const attribute = "data-astryx-secret-mask";
    const style = document.createElement("style");
    style.id = `astryx-secret-mask-${maskToken}`;
    style.textContent = `[${attribute}="${maskToken}"] { filter: blur(12px) !important; color: transparent !important; text-shadow: none !important; caret-color: transparent !important; -webkit-text-security: disc !important; }`;
    document.head.append(style);
    for (const element of document.querySelectorAll<HTMLElement>("input, textarea, [contenteditable='true'], body *")) {
      const controlValue = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? element.value : "";
      const text = element.textContent ?? "";
      const containsSmallestSecretText = values.some((secret) =>
        text.includes(secret) && ![...element.children].some((child) => (child.textContent ?? "").includes(secret)),
      );
      if (values.some((secret) => controlValue.includes(secret)) || containsSmallestSecretText) {
        element.setAttribute(attribute, maskToken);
      }
    }
  }, { secrets, token });
  try {
    return await work();
  } finally {
    await page.evaluate((maskToken) => {
      document.querySelectorAll(`[data-astryx-secret-mask="${maskToken}"]`)
        .forEach((element) => element.removeAttribute("data-astryx-secret-mask"));
      document.getElementById(`astryx-secret-mask-${maskToken}`)?.remove();
    }, token);
  }
}

function validateCompletedIdentity(identity: CompletedCaptureIdentity): void {
  if ((identity as { status?: unknown }).status !== "completed") throw new Error("Capture requires a completed step result");
  if (!isAppSlug(identity.app)) throw new Error("Capture app must be a safe slug");
  if (!Number.isInteger(identity.versionId) || identity.versionId <= 0) throw new Error("Capture version must be a positive integer");
  for (const [label, value] of [
    ["run id", identity.runId],
    ["worker id", identity.workerId],
    ["plan id", identity.planId],
    ["flow id", identity.flowId],
    ["step id", identity.stepId],
    ["state label", identity.stateLabel],
  ] as const) {
    if (!value.trim()) throw new Error(`Capture ${label} must be non-empty`);
  }
}

interface LivePageState {
  rawUrl: string;
  finalUrl: string;
  viewport: { width: number; height: number };
}

function livePageState(page: ScreenshotPage, secretValues: readonly string[]): LivePageState {
  const rawUrl = page.url();
  const finalUrl = normalizeCaptureUrl(rawUrl, secretValues);
  const viewport = page.viewportSize();
  if (
    !viewport ||
    !Number.isInteger(viewport.width) ||
    viewport.width <= 0 ||
    !Number.isInteger(viewport.height) ||
    viewport.height <= 0
  ) {
    throw new Error("Capture requires a positive integer live viewport");
  }
  return { rawUrl, finalUrl, viewport: { ...viewport } };
}

function defaultObjectStore(dataDir: string): ObjectStore {
  if (process.env.OBJECT_STORE_BACKEND || process.env.NODE_ENV === "production") {
    return createObjectStore(objectStoreConfigFromEnvironment(process.env));
  }
  return new LocalObjectStore(resolve(dataDir, "objects"));
}

function sameMetadata(left: ObjectMetadata, right: ObjectMetadata): boolean {
  return left.key === right.key && left.sha256 === right.sha256 && left.byteSize === right.byteSize
    && left.contentType === right.contentType && left.accessClass === right.accessClass;
}

export async function persistFailureArtifact(
  page: Pick<ScreenshotPage, "screenshot">,
  identity: FailureArtifactIdentity,
  dependencies: FailureArtifactDependencies,
): Promise<ObjectMetadata> {
  const png = await page.screenshot({ fullPage: true });
  const sha256 = fullHash(png);
  const object: ObjectMetadata = {
    key: failureObjectKey(identity.runId, identity.flowId, identity.stepId, sha256),
    sha256,
    byteSize: png.byteLength,
    contentType: "image/png",
    accessClass: "internal",
  };
  const uploaded = await dependencies.objectStore.put({ ...object, body: png });
  if (!sameMetadata(uploaded.metadata, object)) throw new Error("Uploaded failure metadata does not match the PNG");
  await dependencies.attachFailureObject({ ...identity, object });
  return object;
}

export function defaultFailureArtifactDependencies(objectStore: ObjectStore): FailureArtifactDependencies {
  return { objectStore, attachFailureObject: attachStoredFailureObject };
}

export async function captureValidatedState(
  page: ScreenshotPage,
  identity: CompletedCaptureIdentity,
  overrides: Partial<CaptureDependencies> = {},
): Promise<ValidatedCapture> {
  validateCompletedIdentity(identity);
  const secretValues = overrides.secretValues ?? [];
  const sourceUrl = normalizeCaptureUrl(identity.sourceUrl, secretValues);
  const takeScreenshot = async () => {
    const before = livePageState(page, secretValues);
    const png = await page.screenshot({ fullPage: true });
    const after = livePageState(page, secretValues);
    return { before, png, after };
  };
  if (secretValues.some(Boolean) && !page.evaluate) {
    throw new Error("Secret-bearing capture requires screenshot masking support");
  }
  const { before, png, after } = secretValues.some(Boolean)
    ? await withMaskedSecretFields(page as Pick<Page, "evaluate">, secretValues, takeScreenshot)
    : await takeScreenshot();
  if (
    before.rawUrl !== after.rawUrl ||
    before.viewport.width !== after.viewport.width ||
    before.viewport.height !== after.viewport.height
  ) {
    throw new Error("Capture page state changed during screenshot");
  }
  const observedHash = fullHash(png);
  const shortRef = overrides.shortRef ?? ((hash: string) => hash.slice(0, 16));
  const findWorkerEvidence = overrides.findWorkerEvidence ?? findStoredWorkerEvidence;
  const reserveCaptureImage = overrides.reserveCaptureImage ?? reserveStoredCaptureImage;
  const persistEvidenceBundle = overrides.persistEvidenceBundle ?? persistStoredEvidenceBundle;
  const dataDir = overrides.dataDir ?? "data";
  const objectStore = overrides.objectStore ?? defaultObjectStore(dataDir);
  const key: EvidenceKey = {
    versionId: identity.versionId,
    planId: identity.planId,
    flowId: identity.flowId,
    stepId: identity.stepId,
    finalUrl: before.finalUrl,
    viewportWidth: before.viewport.width,
    viewportHeight: before.viewport.height,
  };

  const existing = await findWorkerEvidence({
    ...key,
    runId: identity.runId,
    workerId: identity.workerId,
    app: identity.app,
  });
  if (existing) {
    return {
      evidence: existing,
      imageId: existing.image_id,
      ref: mediaReference(existing.screenshot_hash, shortRef).ref,
      observedHash,
      newFile: false,
      reused: true,
    };
  }

  const { ref } = mediaReference(observedHash, shortRef);
  const reserved = await reserveCaptureImage({
    ...key,
    runId: identity.runId,
    workerId: identity.workerId,
    app: identity.app,
    imageUrl: ref,
  });
  const object: ObjectMetadata = {
    key: imageObjectKey(reserved.imageId, observedHash, "png"),
    sha256: observedHash,
    byteSize: png.byteLength,
    contentType: "image/png",
    accessClass: "protected",
  };
  const uploaded = await objectStore.put({ ...object, body: png });
  if (!sameMetadata(uploaded.metadata, object)) throw new Error("Uploaded capture metadata does not match the PNG");

  const persisted = await persistEvidenceBundle({
    ...key,
    runId: identity.runId,
    workerId: identity.workerId,
    app: identity.app,
    imageId: reserved.imageId,
    imageCreated: reserved.imageCreated,
    object,
    sourceUrl,
    stateLabel: identity.stateLabel,
    screenshotHash: observedHash,
  });

  return {
    evidence: persisted.evidence,
    imageId: persisted.imageId,
    ref: mediaReference(persisted.evidence.screenshot_hash, shortRef).ref,
    observedHash,
    newFile: uploaded.created,
    reused: persisted.reused,
  };
}

function evidenceOrder(a: CrawlEvidenceRecord, b: CrawlEvidenceRecord): number {
  return (
    a.final_url.localeCompare(b.final_url) ||
    a.viewport_width - b.viewport_width ||
    a.viewport_height - b.viewport_height ||
    a.image_id - b.image_id
  );
}

export function assembleCanonicalFlows(
  plan: CrawlPlan,
  identity: { versionId: number; planId: string; completedFlowIds: Iterable<string> },
  evidence: readonly CrawlEvidenceRecord[],
  existing: readonly DesignFlow[],
): DesignFlow[] {
  const completed = new Set(identity.completedFlowIds);
  const pinnedEvidence = evidence.filter(
    (record) => record.version_id === identity.versionId && record.plan_id === identity.planId,
  );
  const built: DesignFlow[] = [];

  for (const flow of plan.flows) {
    if (!completed.has(flow.id)) continue;
    const flowEvidence = pinnedEvidence.filter((record) => record.flow_id === flow.id);
    if (flow.steps.some((step) => !step.optional && !flowEvidence.some((record) => record.step_id === step.id))) {
      continue;
    }
    const steps: DesignFlow["steps"] = [];
    const seenImageIds = new Set<number>();
    for (const step of flow.steps) {
      const imageIds = [
        ...new Set(
          flowEvidence
            .filter((record) => record.step_id === step.id)
            .sort(evidenceOrder)
            .map((record) => record.image_id),
        ),
      ].filter((imageId) => {
        if (seenImageIds.has(imageId)) return false;
        seenImageIds.add(imageId);
        return true;
      });
      if (imageIds.length > 0) steps.push({ label: step.expected.state, evidence: imageIds });
    }
    if (steps.length > 0) {
      built.push({ id: flow.id, title: flow.title, description: flow.description, tags: ["smart-crawler"], steps });
    }
  }

  const replaced = new Set(built.map((flow) => flow.id));
  return [...existing.filter((flow) => !replaced.has(flow.id)), ...built];
}

export interface FinalizeCanonicalRunInput {
  runId: string;
  workerId: string;
}

export interface CanonicalFinalizationDependencies {
  loadWorkerRunFinalization(runId: string, workerId: string): Promise<WorkerRunFinalizationSnapshot>;
  getAppFlows(app: string): Promise<DesignFlow[]>;
  saveWorkerAppFlows(input: SaveWorkerAppFlowsInput): Promise<void>;
}

export async function finalizeCanonicalRun(
  input: FinalizeCanonicalRunInput,
  overrides: Partial<CanonicalFinalizationDependencies> = {},
): Promise<DesignFlow[]> {
  if (!input.runId.trim() || !input.workerId.trim()) throw new Error("Run and worker ids must be non-empty");
  const loadWorkerRunFinalization = overrides.loadWorkerRunFinalization ?? loadStoredWorkerRunFinalization;
  const getAppFlows = overrides.getAppFlows ?? getStoredAppFlows;
  const saveWorkerAppFlows = overrides.saveWorkerAppFlows ?? saveStoredWorkerAppFlows;
  const snapshot = await loadWorkerRunFinalization(input.runId, input.workerId);
  if (snapshot.runId !== input.runId || snapshot.plan.app !== snapshot.app) {
    throw new Error("Finalization snapshot does not match the pinned run");
  }

  // Task 6 must persist observedHash + evidenceId before marking a step completed.
  // Finalization deliberately ignores status-only rows so a crash cannot publish stale evidence.
  const canonicalEvidenceById = new Map(snapshot.evidence.map((record) => [record.id, record]));
  const completedSteps = new Set(
    snapshot.steps
      .filter((step) => {
        const evidence = step.evidenceId ? canonicalEvidenceById.get(step.evidenceId) : undefined;
        return step.status === "completed"
          && evidence?.version_id === snapshot.versionId
          && evidence.plan_id === snapshot.planId
          && evidence.flow_id === step.flowId
          && evidence.step_id === step.stepId;
      })
      .map((step) => `${step.flowId}\u0000${step.stepId}`),
  );
  const completedFlowIds = snapshot.plan.flows
    .filter((flow) => flow.steps.every((step) => step.optional || completedSteps.has(`${flow.id}\u0000${step.id}`)))
    .map((flow) => flow.id);
  const existing = await getAppFlows(snapshot.app);
  const flows = assembleCanonicalFlows(
    snapshot.plan,
    { versionId: snapshot.versionId, planId: snapshot.planId, completedFlowIds },
    snapshot.evidence,
    existing,
  );
  if (JSON.stringify(flows) !== JSON.stringify(existing)) {
    await saveWorkerAppFlows({
      runId: input.runId,
      workerId: input.workerId,
      app: snapshot.app,
      flows,
    });
  }
  return flows;
}

export interface CreateCrawlRunInput {
  app: string;
  planId: string;
  requestedFlowIds?: string[];
  unsafeApproved?: boolean;
  disposableAccountAcknowledged?: boolean;
  allowSideEffects?: boolean;
  environment?: Omit<
    CrawlRunEnvironmentInput,
    "requestedFlowIds" | "unsafeApproved" | "disposableAccountAcknowledged" | "allowSideEffects"
  >;
  userId?: number;
}

interface RunnablePlanRecord {
  id: string;
  app: string;
  status: CrawlPlanRecord["status"];
  plan: CrawlPlan;
}

export interface CrawlRunServiceStore {
  getPlan(id: string): Promise<RunnablePlanRecord | undefined>;
  ensureActiveVersion(app: string, userId?: number, sourceUrl?: string): Promise<{ id: number }>;
  createRun(input: StoredCreateRunInput): Promise<CrawlRunRecord>;
  getRun(id: string): Promise<CrawlRunRecord | undefined>;
  claimRunById(id: string, workerId: string): Promise<CrawlRunRecord>;
  loadWorkerRunExecution(id: string, workerId: string): Promise<WorkerRunExecutionSnapshot>;
  listRunSteps(id: string): Promise<CrawlRunStepRecord[]>;
  upsertRunStep(input: UpsertRunStepInput): Promise<CrawlRunStepRecord>;
  heartbeatRun(id: string, workerId: string): Promise<CrawlRunRecord>;
  updateRun(id: string, workerId: string, patch: UpdateRunInput): Promise<CrawlRunRecord>;
  requestRunCancellation(id: string): Promise<CrawlRunRecord>;
  isRunCancellationRequested(id: string): Promise<boolean>;
  createRetry(id: string, options: { mode: "all" | "failed" }): Promise<CrawlRunRecord>;
  markStaleRunIdsInterrupted(staleBefore: Date): Promise<string[]>;
}

export interface CrawlBrowserRunInput {
  run: CrawlRunRecord;
  plan: CrawlPlan;
  flows: CrawlFlow[];
  resumes: ReadonlyMap<string, FlowResume>;
  hooks: RunnerHooks;
  env: Record<string, string | undefined>;
}

export type CrawlBrowserExecutor = (input: CrawlBrowserRunInput) => Promise<FlowRunResult[]>;

export interface CrawlRunServiceDependencies {
  workerId: string;
  dataDir?: string;
  runtimeEnv?: Record<string, string | undefined>;
  objectStore?: ObjectStore;
  attachFailureObject?: FailureArtifactDependencies["attachFailureObject"];
  store?: Partial<CrawlRunServiceStore>;
  executeBrowser?: CrawlBrowserExecutor;
  captureState?: (
    page: Page,
    identity: CompletedCaptureIdentity,
    secretValues: readonly string[],
  ) => Promise<ValidatedCapture>;
  captureFailure?: (
    page: Page,
    run: CrawlRunRecord,
    flow: CrawlFlow,
    step: CrawlStep,
    secretValues: readonly string[],
  ) => Promise<string | undefined>;
  finalizeRun?: (input: FinalizeCanonicalRunInput) => Promise<DesignFlow[]>;
}

export interface CrawlRunService {
  create(input: CreateCrawlRunInput): Promise<CrawlRunRecord>;
  execute(runId: string): Promise<CrawlRunRecord>;
  cancel(runId: string): Promise<CrawlRunRecord>;
  retry(runId: string, mode: "failed" | "full"): Promise<CrawlRunRecord>;
  recoverStaleRuns(staleBefore: Date): Promise<string[]>;
}

function defaultServiceStore(): CrawlRunServiceStore {
  return {
    getPlan: getStoredPlan,
    ensureActiveVersion: ensureActiveAppVersion,
    createRun: createStoredRun,
    getRun: getStoredRun,
    claimRunById: claimStoredRunById,
    loadWorkerRunExecution: loadStoredWorkerRunExecution,
    listRunSteps: listStoredRunSteps,
    upsertRunStep: upsertStoredRunStep,
    heartbeatRun: heartbeatStoredRun,
    updateRun: updateStoredRun,
    requestRunCancellation: requestStoredRunCancellation,
    isRunCancellationRequested: isStoredRunCancellationRequested,
    createRetry: createStoredRetry,
    markStaleRunIdsInterrupted: markStoredStaleRunIdsInterrupted,
  };
}

const TERMINAL_CRAWL_RUNS = new Set(["succeeded", "failed", "cancelled"]);

function durableStepKey(flowId: string, stepId: string): string {
  return `${flowId}\u0000${stepId}`;
}

function jsonEqual(left: unknown, right: unknown): boolean {
  return isDeepStrictEqual(left, right);
}

function actualSatisfiesExpected(actual: StepActual, step: CrawlStep): boolean {
  return urlMatchesExpectation(actual.finalUrl, step.expected)
    && (step.expected.page === undefined || actual.page === step.expected.page)
    && (step.expected.visible === undefined || actual.visible === true)
    && (step.expected.hidden === undefined || actual.hidden === true);
}

function isDurablyCompletedStep(
  row: CrawlRunStepRecord | undefined,
  canonical: CrawlEvidenceRecord | undefined,
  flow: CrawlFlow,
  step: CrawlStep,
  snapshot: WorkerRunExecutionSnapshot,
): boolean {
  const actual = row?.actual as StepActual | null | undefined;
  return row?.status === "completed"
    && jsonEqual(row.expected, step.expected)
    && Boolean(actual)
    && actualSatisfiesExpected(actual!, step)
    && Boolean(row.observed_screenshot_hash)
    && Boolean(row.final_url)
    && canonical?.version_id === snapshot.run.version_id
    && canonical.plan_id === snapshot.run.plan_id
    && canonical.flow_id === flow.id
    && canonical.step_id === step.id
    && canonical.final_url === normalizeCaptureUrl(row!.final_url!)
    && actual!.finalUrl === row!.final_url;
}

function validCompletedPrefix(
  flow: CrawlFlow,
  snapshot: WorkerRunExecutionSnapshot,
): { stepIndex: number; url?: string } {
  const rows = new Map(snapshot.steps.map((row) => [durableStepKey(row.flow_id, row.step_id), row]));
  const evidence = new Map(snapshot.evidence.map((record) => [record.id, record]));
  let stepIndex = 0;
  let url: string | undefined;
  for (const step of flow.steps) {
    const row = rows.get(durableStepKey(flow.id, step.id));
    const canonical = row?.evidence_id ? evidence.get(row.evidence_id) : undefined;
    if (!isDurablyCompletedStep(row, canonical, flow, step, snapshot)) break;
    stepIndex++;
    url = row!.final_url!;
  }
  return { stepIndex, ...(url ? { url } : {}) };
}

function isDurablyCompletedFlow(flow: CrawlFlow, snapshot: WorkerRunExecutionSnapshot): boolean {
  const rows = new Map(snapshot.steps.map((row) => [durableStepKey(row.flow_id, row.step_id), row]));
  const evidence = new Map(snapshot.evidence.map((record) => [record.id, record]));
  return flow.steps.every((step) => {
    const row = rows.get(durableStepKey(flow.id, step.id));
    if (step.optional && row?.status === "skipped") return true;
    return isDurablyCompletedStep(row, row?.evidence_id ? evidence.get(row.evidence_id) : undefined, flow, step, snapshot);
  });
}

function runCounts(rows: Iterable<CrawlRunStepRecord>): Pick<UpdateRunInput, "completedCount" | "failedCount" | "skippedCount"> {
  const values = [...rows];
  return {
    completedCount: values.filter((row) => row.status === "completed").length,
    failedCount: values.filter((row) => row.status === "failed").length,
    skippedCount: values.filter((row) => row.status === "skipped").length,
  };
}

export function resolveCrawlProfileDir(
  dataDir: string,
  app: string,
  env: Record<string, string | undefined> = process.env,
): string {
  const root = env.CRAWL_PROFILE_ROOT?.trim();
  return root ? join(root, app) : join(dataDir, `browser-profile-${app}`);
}

function defaultBrowserExecutor(dataDir: string, runtimeEnv: Record<string, string | undefined>): CrawlBrowserExecutor {
  return async ({ run, plan, flows, resumes, hooks, env }) => {
    if (run.environment.browserName && run.environment.browserName !== "chromium") {
      throw new Error("Durable crawling currently supports Chromium only");
    }
    return executeFlowsInOwnedContext(plan, flows, {
      createContext: () => chromium.launchPersistentContext(resolveCrawlProfileDir(dataDir, run.app, runtimeEnv), {
        headless: run.environment.headless ?? true,
        ...(run.environment.viewport ? { viewport: run.environment.viewport } : {}),
        ...(run.environment.locale ? { locale: run.environment.locale } : {}),
        ...(run.environment.timezone ? { timezoneId: run.environment.timezone } : {}),
      }),
      hooks,
      env,
      resumes,
    });
  };
}

interface PreparedFlows {
  runnable: CrawlFlow[];
  skipped: Array<{ flow: CrawlFlow; step: CrawlStep; index: number; reason: string }>;
  gateFailure?: { flow: CrawlFlow; message: string };
  executionEnv: Record<string, string | undefined>;
}

function prepareFlows(
  plan: CrawlPlan,
  run: CrawlRunRecord,
  selected: CrawlFlow[],
  runtimeEnv: Record<string, string | undefined>,
): PreparedFlows {
  const runnable: CrawlFlow[] = [];
  const skipped: PreparedFlows["skipped"] = [];
  const executionEnv: Record<string, string | undefined> = { TEST_ACCOUNT: runtimeEnv.TEST_ACCOUNT };

  for (const flow of selected) {
    if (!flow.safe && !run.environment.unsafeApproved) {
      flow.steps.forEach((step, index) => skipped.push({ flow, step, index, reason: "unsafe_not_approved" }));
      continue;
    }
    const missingSecrets = flow.requiredSecrets.filter((name) => !runtimeEnv[name]);
    if (missingSecrets.length > 0) {
      return {
        runnable,
        skipped,
        executionEnv,
        gateFailure: { flow, message: `Required secrets are missing: ${missingSecrets.join(", ")}` },
      };
    }
    for (const name of flow.requiredSecrets) executionEnv[name] = runtimeEnv[name];
    if (flow.safe) {
      runnable.push(flow);
      continue;
    }
    const missingGates = [
      ...(runtimeEnv.TEST_ACCOUNT === "1" ? [] : ["TEST_ACCOUNT"]),
      ...(run.environment.disposableAccountAcknowledged ? [] : ["disposable account acknowledgement"]),
    ];
    if (missingGates.length > 0) {
      return {
        runnable,
        skipped,
        executionEnv,
        gateFailure: { flow, message: `Unsafe flow gate is missing: ${missingGates.join(", ")}` },
      };
    }
    if (run.environment.allowSideEffects) {
      runnable.push(flow);
      continue;
    }
    const boundary = flow.steps.findIndex((step) => step.safety === "side-effect");
    if (boundary < 0) {
      runnable.push(flow);
      continue;
    }
    if (boundary > 0) runnable.push({ ...flow, steps: flow.steps.slice(0, boundary) });
    flow.steps.slice(boundary).forEach((step, offset) => {
      skipped.push({ flow, step, index: boundary + offset, reason: "side_effect_disabled" });
    });
  }
  return { runnable, skipped, executionEnv };
}

function sanitizedStepActual(actual: StepActual, secretValues: readonly string[]): StepActual {
  return {
    ...actual,
    sourceUrl: sanitizeDurableActualUrl(actual.sourceUrl, secretValues),
    finalUrl: sanitizeDurableActualUrl(actual.finalUrl, secretValues),
  };
}

export class CrawlRunInterruptedError extends Error {
  constructor(cause?: unknown) {
    super("Transient crawler infrastructure failure", cause === undefined ? undefined : { cause });
    this.name = "CrawlRunInterruptedError";
  }
}

export function createCrawlRunService(options: CrawlRunServiceDependencies): CrawlRunService {
  if (!options.workerId.trim()) throw new Error("Crawler worker id must be non-empty");
  const store: CrawlRunServiceStore = { ...defaultServiceStore(), ...(options.store ?? {}) };
  const dataDir = options.dataDir ?? "data";
  const runtimeEnv = options.runtimeEnv ?? process.env;
  const objectStore = options.objectStore ?? defaultObjectStore(dataDir);
  const failureArtifacts: FailureArtifactDependencies = {
    objectStore,
    attachFailureObject: options.attachFailureObject ?? attachStoredFailureObject,
  };
  const executeBrowser = options.executeBrowser ?? defaultBrowserExecutor(dataDir, runtimeEnv);
  const captureState = options.captureState ?? ((page, identity, secretValues) =>
    captureValidatedState(page as unknown as ScreenshotPage, identity, { dataDir, objectStore, secretValues }));
  const captureFailure = options.captureFailure ?? ((page, run, flow, step, secretValues) =>
    withMaskedSecretFields(page, secretValues, async () => (
      await persistFailureArtifact(page, {
        runId: run.id,
        workerId: options.workerId,
        flowId: flow.id,
        stepId: step.id,
      }, failureArtifacts)
    ).key));
  const finalizeRun = options.finalizeRun ?? ((input) => finalizeCanonicalRun(input));

  return {
    async create(input) {
      if (!isAppSlug(input.app)) throw new Error("Crawl run app must be a safe slug");
      const plan = await store.getPlan(input.planId);
      if (!plan || plan.status !== "approved" || !plan.plan.reviewed || plan.app !== input.app) {
        throw new Error("Crawl runs require the app's approved reviewed plan");
      }
      const requestedFlowIds = [...new Set((input.requestedFlowIds ?? []).map((id) => id.trim()))];
      if (requestedFlowIds.some((id) => !id || !plan.plan.flows.some((flow) => flow.id === id))) {
        throw new Error("Requested flow is not present in the approved plan");
      }
      const version = await store.ensureActiveVersion(input.app, input.userId, plan.plan.startUrl);
      return store.createRun({
        app: input.app,
        versionId: version.id,
        planId: plan.id,
        environment: {
          ...(input.environment ?? {}),
          headless: input.environment?.headless ?? true,
          browserName: input.environment?.browserName ?? "chromium",
          requestedFlowIds,
          unsafeApproved: input.unsafeApproved ?? false,
          disposableAccountAcknowledged: input.disposableAccountAcknowledged ?? false,
          allowSideEffects: input.allowSideEffects ?? false,
        },
      });
    },
    async execute(runId) {
      const beforeClaim = await store.getRun(runId);
      if (!beforeClaim) throw new Error("Crawl run not found");
      if (TERMINAL_CRAWL_RUNS.has(beforeClaim.status)) return beforeClaim;
      let run: CrawlRunRecord;
      try {
        run = await store.claimRunById(runId, options.workerId);
      } catch (error) {
        const raced = await store.getRun(runId);
        if (raced && TERMINAL_CRAWL_RUNS.has(raced.status)) return raced;
        throw error;
      }
      if (run.status !== "running") return run;
      let terminalWritten = false;
      let snapshot: WorkerRunExecutionSnapshot | undefined;
      const finish = async (status: "succeeded" | "failed" | "cancelled" | "interrupted") => {
        if (terminalWritten) throw new Error("Crawl run terminal status was already written");
        const counts = snapshot ? runCounts(snapshot.steps) : {
          completedCount: run.completed_count,
          failedCount: run.failed_count,
          skippedCount: run.skipped_count,
        };
        const finished = await store.updateRun(run.id, options.workerId, {
          status,
          currentFlowId: null,
          currentStepId: null,
          ...counts,
        });
        terminalWritten = true;
        run = finished;
        return finished;
      };

      try {
        snapshot = await store.loadWorkerRunExecution(run.id, options.workerId);
        run = snapshot.run;
        const plan = snapshot.plan.plan;
        const configured = run.environment.requestedFlowIds.length > 0
          ? new Set(run.environment.requestedFlowIds)
          : new Set(plan.flows.map((flow) => flow.id));
        if (run.retry_mode === "failed" && run.retry_of_run_id) {
          const failed = new Set(
            (await store.listRunSteps(run.retry_of_run_id))
              .filter((step) => step.status === "failed")
              .map((step) => step.flow_id),
          );
          for (const id of [...configured]) if (!failed.has(id)) configured.delete(id);
        }
        const selected = plan.flows.filter((flow) => configured.has(flow.id));
        const prepared = prepareFlows(plan, run, selected, runtimeEnv);
        const rows = new Map(snapshot.steps.map((row) => [durableStepKey(row.flow_id, row.step_id), row]));
        const baseAttempts = new Map(snapshot.steps.map((row) => [durableStepKey(row.flow_id, row.step_id), row.attempts]));
        const captures = new Map<string, ValidatedCapture>();
        const flowOrder = new Map(plan.flows.map((flow, index) => [flow.id, index]));
        const writeStep = async (input: UpsertRunStepInput) => {
          const row = await store.upsertRunStep(input);
          rows.set(durableStepKey(row.flow_id, row.step_id), row);
          snapshot!.steps = [...rows.values()];
          return row;
        };
        const progress = async (flowId: string | null, stepId: string | null) => {
          run = await store.updateRun(run.id, options.workerId, {
            currentFlowId: flowId,
            currentStepId: stepId,
            ...runCounts(rows.values()),
          });
        };
        const persistSkipped = async (flow: CrawlFlow, step: CrawlStep, index: number, reason: string) => {
          await writeStep({
            runId: run.id,
            workerId: options.workerId,
            flowId: flow.id,
            stepId: step.id,
            flowOrder: flowOrder.get(flow.id) ?? 0,
            stepOrder: index,
            status: "skipped",
            attempts: baseAttempts.get(durableStepKey(flow.id, step.id)) ?? 0,
            expected: step.expected,
            actual: { reason },
            finishedAt: new Date(),
          });
        };

        if (await store.isRunCancellationRequested(run.id)) return finish("cancelled");
        for (const item of prepared.skipped) await persistSkipped(item.flow, item.step, item.index, item.reason);
        if (prepared.gateFailure) {
          const { flow, message } = prepared.gateFailure;
          const first = flow.steps[0];
          if (first) {
            await writeStep({
              runId: run.id,
              workerId: options.workerId,
              flowId: flow.id,
              stepId: first.id,
              flowOrder: flowOrder.get(flow.id) ?? 0,
              stepOrder: 0,
              status: "failed",
              attempts: 0,
              expected: first.expected,
              errorClass: "UnsafeRunGateError",
              errorMessage: message,
              finishedAt: new Date(),
            });
            for (let index = 1; index < flow.steps.length; index++) {
              await persistSkipped(flow, flow.steps[index], index, "flow_failed");
            }
          }
          return finish("failed");
        }

        const resumes = new Map<string, FlowResume>();
        const runnable = prepared.runnable.filter((flow) => {
          const resume = validCompletedPrefix(flow, snapshot!);
          if (resume.stepIndex === flow.steps.length) return false;
          if (resume.stepIndex > 0 && resume.url) resumes.set(flow.id, { stepIndex: resume.stepIndex, url: resume.url });
          return true;
        });
        const hooks: RunnerHooks = {
          cancelled: () => store.isRunCancellationRequested(run.id),
          stepStarted: async (flow, step, index, attempt) => {
            await store.heartbeatRun(run.id, options.workerId);
            await writeStep({
              runId: run.id,
              workerId: options.workerId,
              flowId: flow.id,
              stepId: step.id,
              flowOrder: flowOrder.get(flow.id) ?? 0,
              stepOrder: index,
              status: "running",
              attempts: (baseAttempts.get(durableStepKey(flow.id, step.id)) ?? 0) + attempt,
              expected: step.expected,
              startedAt: new Date(),
            });
            await progress(flow.id, step.id);
          },
          capture: async (page, flow, step, _state, actual) => {
            if (!step || !actual) throw new Error("Durable capture requires a completed planned step");
            const secretValues = flow.requiredSecrets.flatMap((name) => prepared.executionEnv[name] ? [prepared.executionEnv[name]!] : []);
            const captured = await captureState(page, {
              status: "completed",
              runId: run.id,
              workerId: options.workerId,
              app: run.app,
              versionId: run.version_id,
              planId: run.plan_id,
              flowId: flow.id,
              stepId: step.id,
              stateLabel: step.expected.state,
              sourceUrl: actual.sourceUrl,
            }, secretValues);
            captures.set(durableStepKey(flow.id, step.id), captured);
          },
          stepFinished: async (flow, step, index, result) => {
            const base = baseAttempts.get(durableStepKey(flow.id, step.id)) ?? 0;
            const secretValues = flow.requiredSecrets.flatMap((name) => prepared.executionEnv[name] ? [prepared.executionEnv[name]!] : []);
            if (result.status === "completed") {
              const captured = captures.get(durableStepKey(flow.id, step.id));
              if (!captured || !result.actual) throw new Error("Completed crawl step is missing durable capture");
              const actual = sanitizedStepActual(result.actual, secretValues);
              await writeStep({
                runId: run.id,
                workerId: options.workerId,
                flowId: flow.id,
                stepId: step.id,
                flowOrder: flowOrder.get(flow.id) ?? 0,
                stepOrder: index,
                status: "completed",
                attempts: base + result.attempts,
                sourceUrl: actual.sourceUrl,
                finalUrl: actual.finalUrl,
                expected: step.expected,
                actual,
                observedScreenshotHash: captured.observedHash,
                evidenceId: captured.evidence.id,
                errorClass: null,
                errorMessage: null,
                failureScreenshot: null,
                finishedAt: new Date(),
              });
              captures.delete(durableStepKey(flow.id, step.id));
            } else if (result.status === "failed") {
              const failure = result.failure!;
              const actual = failure.actual ? sanitizedStepActual(failure.actual, secretValues) : undefined;
              await writeStep({
                runId: run.id,
                workerId: options.workerId,
                flowId: flow.id,
                stepId: step.id,
                flowOrder: flowOrder.get(flow.id) ?? 0,
                stepOrder: index,
                status: "failed",
                attempts: base + result.attempts,
                sourceUrl: actual?.sourceUrl,
                finalUrl: actual?.finalUrl ?? sanitizeDurableActualUrl(failure.currentUrl, secretValues),
                expected: step.expected,
                actual,
                errorClass: failure.errorClass,
                errorMessage: failure.error,
                failureScreenshot: failure.screenshot || null,
                finishedAt: new Date(),
              });
            } else {
              const actual = result.actual ? sanitizedStepActual(result.actual, secretValues) : undefined;
              await writeStep({
                runId: run.id,
                workerId: options.workerId,
                flowId: flow.id,
                stepId: step.id,
                flowOrder: flowOrder.get(flow.id) ?? 0,
                stepOrder: index,
                status: "skipped",
                attempts: base + result.attempts,
                expected: step.expected,
                actual: actual ? { ...actual, reason: result.reason } : { reason: result.reason },
                finishedAt: new Date(),
              });
            }
            await progress(flow.id, step.id);
          },
          failure: (page, failure) => {
            const flow = plan.flows.find(({ id }) => id === failure.flow)!;
            const secretValues = flow.requiredSecrets.flatMap((name) => prepared.executionEnv[name] ? [prepared.executionEnv[name]!] : []);
            return captureFailure(page, run, flow, failure.step, secretValues);
          },
        };

        const results = runnable.length > 0
          ? await executeBrowser({ run, plan, flows: runnable, resumes, hooks, env: prepared.executionEnv })
          : [];
        const expectedResultIds = new Set(runnable.map((flow) => flow.id));
        const actualResultIds = new Set(results.map((result) => result.flowId));
        if (
          results.length !== expectedResultIds.size ||
          actualResultIds.size !== results.length ||
          [...expectedResultIds].some((id) => !actualResultIds.has(id))
        ) {
          throw new Error("Browser runner returned an incomplete or duplicate flow result set");
        }
        if (results.some((result) => result.status === "cancelled") || await store.isRunCancellationRequested(run.id)) {
          return finish("cancelled");
        }
        const transientFailure = results.some((result) => result.steps.some((record) =>
          record.status === "failed" && record.failure?.step.safety !== "side-effect"
          && isTransientBrowserError(new Error(record.failure?.error ?? "")),
        ));
        if (transientFailure) {
          const resolved = await finish("interrupted");
          if (resolved.status === "cancelled") return resolved;
          throw new CrawlRunInterruptedError();
        }
        if (results.some((result) => result.status === "failed")) return finish("failed");
        snapshot = await store.loadWorkerRunExecution(run.id, options.workerId);
        run = snapshot.run;
        if (prepared.runnable.some((flow) => !isDurablyCompletedFlow(flow, snapshot!))) {
          throw new Error("Browser runner completed without exact durable step evidence");
        }
        await finalizeRun({ runId: run.id, workerId: options.workerId });
        if (await store.isRunCancellationRequested(run.id)) return finish("cancelled");
        return finish("succeeded");
      } catch (error) {
        if (!terminalWritten) {
          try {
            if (await store.isRunCancellationRequested(run.id)) return await finish("cancelled");
            const resolved = await finish("interrupted");
            if (resolved.status === "cancelled") return resolved;
          } catch {
            // Preserve the execution error when the worker lease was lost as part of the failure.
          }
        }
        if (error instanceof CrawlRunInterruptedError) throw error;
        throw new CrawlRunInterruptedError(error);
      }
    },
    cancel(runId) {
      return store.requestRunCancellation(runId);
    },
    retry(runId, mode) {
      return store.createRetry(runId, { mode: mode === "full" ? "all" : "failed" });
    },
    recoverStaleRuns(staleBefore) {
      return store.markStaleRunIdsInterrupted(staleBefore);
    },
  };
}
