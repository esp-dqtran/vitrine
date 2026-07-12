import { createHash, randomUUID } from "node:crypto";
import { link, mkdir, open, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { CrawlPlan } from "./crawlPlan.ts";
import {
  createEvidence as createStoredEvidence,
  findEvidence as findStoredEvidence,
  type CreateEvidenceInput,
  type CrawlEvidenceRecord,
  type EvidenceKey,
} from "./crawlStore.ts";
import { insertImage as insertStoredImage } from "./db.ts";
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
  finalUrl: string;
  viewport: { width: number; height: number };
}

export interface ScreenshotPage {
  screenshot(options: { fullPage: true }): Promise<Uint8Array>;
}

export interface CaptureDependencies {
  dataDir: string;
  findEvidence(key: EvidenceKey): Promise<CrawlEvidenceRecord | undefined>;
  createEvidence(input: CreateEvidenceInput): Promise<CrawlEvidenceRecord>;
  insertImage: typeof insertStoredImage;
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

export function normalizeCaptureUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Capture URL must be absolute");
  }
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  return url.toString();
}

function validateCompletedIdentity(identity: CompletedCaptureIdentity): void {
  if ((identity as { status?: unknown }).status !== "completed") throw new Error("Capture requires a completed step result");
  if (!isAppSlug(identity.app)) throw new Error("Capture app must be a safe slug");
  if (!Number.isInteger(identity.versionId) || identity.versionId <= 0) throw new Error("Capture version must be a positive integer");
  if (!Number.isInteger(identity.viewport.width) || identity.viewport.width <= 0) throw new Error("Capture viewport width must be a positive integer");
  if (!Number.isInteger(identity.viewport.height) || identity.viewport.height <= 0) throw new Error("Capture viewport height must be a positive integer");
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
  const sourceUrl = normalizeCaptureUrl(identity.sourceUrl);
  const finalUrl = normalizeCaptureUrl(identity.finalUrl);
  const png = await page.screenshot({ fullPage: true });
  const observedHash = fullHash(png);
  const shortRef = overrides.shortRef ?? ((hash: string) => hash.slice(0, 16));
  const findEvidence = overrides.findEvidence ?? findStoredEvidence;
  const createEvidence = overrides.createEvidence ?? createStoredEvidence;
  const insertImage = overrides.insertImage ?? insertStoredImage;
  const dataDir = overrides.dataDir ?? "data";
  const key: EvidenceKey = {
    versionId: identity.versionId,
    planId: identity.planId,
    flowId: identity.flowId,
    stepId: identity.stepId,
    finalUrl,
    viewportWidth: identity.viewport.width,
    viewportHeight: identity.viewport.height,
  };

  const existing = await findEvidence(key);
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

  const imageId = await insertImage(identity.app, "web", ref, {
    sourceUrl,
    viewportWidth: identity.viewport.width,
    viewportHeight: identity.viewport.height,
    stateContext: identity.stateLabel,
  });
  const evidence = await createEvidence({
    ...key,
    runId: identity.runId,
    workerId: identity.workerId,
    imageId,
    sourceUrl,
    stateLabel: identity.stateLabel,
    screenshotHash: observedHash,
  });
  const reused = evidence.screenshot_hash !== observedHash || evidence.image_id !== imageId;

  return {
    evidence,
    imageId: evidence.image_id,
    ref: mediaReference(evidence.screenshot_hash, shortRef).ref,
    observedHash,
    newFile,
    reused,
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
  completedFlowIds: Iterable<string>,
  evidence: readonly CrawlEvidenceRecord[],
  existing: readonly DesignFlow[],
): DesignFlow[] {
  const completed = new Set(completedFlowIds);
  const built: DesignFlow[] = [];

  for (const flow of plan.flows) {
    if (!completed.has(flow.id)) continue;
    const steps: DesignFlow["steps"] = [];
    const seenImageIds = new Set<number>();
    for (const step of flow.steps) {
      const imageIds = [
        ...new Set(
          evidence
            .filter((record) => record.flow_id === flow.id && record.step_id === step.id)
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
