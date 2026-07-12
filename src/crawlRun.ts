import { createHash, randomUUID } from "node:crypto";
import { link, mkdir, open, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { CrawlPlan } from "./crawlPlan.ts";
import { getAppFlows as getStoredAppFlows } from "./db.ts";
import {
  findWorkerEvidence as findStoredWorkerEvidence,
  loadWorkerRunFinalization as loadStoredWorkerRunFinalization,
  persistEvidenceBundle as persistStoredEvidenceBundle,
  saveWorkerAppFlows as saveStoredWorkerAppFlows,
  type CrawlEvidenceRecord,
  type EvidenceKey,
  type FindWorkerEvidenceInput,
  type PersistEvidenceBundleInput,
  type PersistEvidenceBundleResult,
  type SaveWorkerAppFlowsInput,
  type WorkerRunFinalizationSnapshot,
} from "./crawlStore.ts";
import type { DesignFlow } from "./designSystem.ts";
import { isAppSlug } from "./imageSource.ts";

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
}

export interface CaptureDependencies {
  dataDir: string;
  findWorkerEvidence(input: FindWorkerEvidenceInput): Promise<CrawlEvidenceRecord | undefined>;
  persistEvidenceBundle(input: PersistEvidenceBundleInput): Promise<PersistEvidenceBundleResult>;
  secretValues: readonly string[];
  shortRef?(fullHash: string): string;
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

class CaptureHashCollisionError extends Error {}

async function removeTemporaryFile(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

async function persistContentAddressedFile(
  dataDir: string,
  app: string,
  hash16: string,
  observedHash: string,
  png: Uint8Array,
): Promise<boolean> {
  const directory = join(dataDir, "images", app);
  await mkdir(directory, { recursive: true });
  const target = join(directory, `${hash16}.png`);
  const temporary = join(directory, `.${hash16}.${randomUUID()}.tmp`);

  try {
    const handle = await open(temporary, "wx", 0o600);
    try {
      await handle.writeFile(png);
      await handle.sync();
    } finally {
      await handle.close();
    }

    try {
      await link(temporary, target);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (fullHash(await readFile(target)) !== observedHash) {
        throw new CaptureHashCollisionError(`Capture media hash collision for capture:${hash16}`);
      }
      return false;
    }
  } finally {
    await removeTemporaryFile(temporary);
  }
}

export async function captureValidatedState(
  page: ScreenshotPage,
  identity: CompletedCaptureIdentity,
  overrides: Partial<CaptureDependencies> = {},
): Promise<ValidatedCapture> {
  validateCompletedIdentity(identity);
  const secretValues = overrides.secretValues ?? [];
  const sourceUrl = normalizeCaptureUrl(identity.sourceUrl, secretValues);
  const before = livePageState(page, secretValues);
  const png = await page.screenshot({ fullPage: true });
  const after = livePageState(page, secretValues);
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
  const persistEvidenceBundle = overrides.persistEvidenceBundle ?? persistStoredEvidenceBundle;
  const dataDir = overrides.dataDir ?? "data";
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

  const { ref, hash16 } = mediaReference(observedHash, shortRef);
  let newFile: boolean;
  try {
    newFile = await persistContentAddressedFile(dataDir, identity.app, hash16, observedHash, png);
  } catch (error) {
    if (error instanceof CaptureHashCollisionError) throw error;
    const code = (error as NodeJS.ErrnoException).code;
    throw new Error(`Capture file persistence failed${code ? ` (${code})` : ""}`);
  }

  const persisted = await persistEvidenceBundle({
    ...key,
    runId: identity.runId,
    workerId: identity.workerId,
    app: identity.app,
    imageUrl: ref,
    sourceUrl,
    stateLabel: identity.stateLabel,
    screenshotHash: observedHash,
  });

  return {
    evidence: persisted.evidence,
    imageId: persisted.imageId,
    ref: mediaReference(persisted.evidence.screenshot_hash, shortRef).ref,
    observedHash,
    newFile,
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
