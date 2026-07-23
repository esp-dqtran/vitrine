import { createHash } from "node:crypto";
import sharp from "sharp";
import type { AppKnowledgeEvidenceKind } from "./appKnowledge.ts";
import type { AppKnowledgeEvidenceSource, CrawledImage } from "./db.ts";
import type { ObjectMetadata, ObjectStore } from "./objectStore.ts";

export type AppKnowledgeEvidenceReason =
  | "screen_capture"
  | "flow_step_capture"
  | "visual_duplicate"
  | "ui_element_full_page_capture"
  | "ui_element_isolation_unverified"
  | "ui_element_human_override"
  | "ui_element_human_quarantine";

export type AppKnowledgeEvidenceFailureCode =
  | "source_invalid"
  | "image_scope_mismatch"
  | "flow_evidence_missing"
  | "image_object_missing"
  | "image_type_unsupported"
  | "image_size_excessive"
  | "image_metadata_mismatch"
  | "image_corrupt";

export class AppKnowledgeEvidenceError extends Error {
  readonly code: AppKnowledgeEvidenceFailureCode;

  constructor(code: AppKnowledgeEvidenceFailureCode) {
    super(code);
    this.code = code;
  }
}

export interface AppKnowledgeEvidenceOverride {
  imageId: number;
  decision: "eligible" | "quarantined";
  reason: string;
}

export interface AppKnowledgeEvidenceManifestItem {
  evidenceId: string;
  imageId: number;
  kind: AppKnowledgeEvidenceKind;
  eligibility: "eligible" | "quarantined" | "duplicate";
  reason: AppKnowledgeEvidenceReason;
  normalizedVisualSha256?: string;
  duplicateOfEvidenceId?: string;
  capturedAt?: string;
  viewport?: { width?: number; height?: number };
  flow?: {
    id: string;
    title: string;
    category?: string;
    stepIndex: number;
    stepLabel: string;
    interaction?: string;
  };
  object: {
    sha256: string;
    byteSize: number;
    contentType: "image/png" | "image/jpeg" | "image/webp";
  };
}

export interface AppKnowledgeEvidenceManifest {
  sourceSha256: string;
  items: AppKnowledgeEvidenceManifestItem[];
  flowReferences: {
    total: number;
    resolved: number;
    uniqueImages: number;
  };
}

type EvidenceImage = CrawledImage & { object?: ObjectMetadata };
type RasterType = AppKnowledgeEvidenceManifestItem["object"]["contentType"];

const RASTER_TYPES = new Set<RasterType>(["image/png", "image/jpeg", "image/webp"]);
const SHA256 = /^[0-9a-f]{64}$/;

function digest(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function flowIdentity(id: string): string {
  return digest(id).slice(0, 24);
}

function imageScope(source: AppKnowledgeEvidenceSource, image: EvidenceImage): void {
  if (
    image.app !== source.app
    || image.platform !== source.platform
    || !Number.isSafeInteger(image.id)
    || image.id <= 0
  ) {
    throw new AppKnowledgeEvidenceError("image_scope_mismatch");
  }
}

function sameMetadata(left: ObjectMetadata, right: ObjectMetadata): boolean {
  return left.key === right.key
    && left.sha256 === right.sha256
    && left.byteSize === right.byteSize
    && left.contentType === right.contentType
    && left.accessClass === right.accessClass;
}

async function verifiedRaster(input: {
  image: EvidenceImage;
  objectStore: ObjectStore;
  maxImageBytes: number;
}): Promise<{
  body: Buffer;
  object: AppKnowledgeEvidenceManifestItem["object"];
  visualSha256: string;
  dimensions: { width?: number; height?: number };
}> {
  const expected = input.image.object;
  if (!expected) throw new AppKnowledgeEvidenceError("image_object_missing");
  if (!RASTER_TYPES.has(expected.contentType as RasterType)) {
    throw new AppKnowledgeEvidenceError("image_type_unsupported");
  }
  if (
    !SHA256.test(expected.sha256)
    || !Number.isSafeInteger(expected.byteSize)
    || expected.byteSize < 1
  ) {
    throw new AppKnowledgeEvidenceError("image_metadata_mismatch");
  }
  if (expected.byteSize > input.maxImageBytes) {
    throw new AppKnowledgeEvidenceError("image_size_excessive");
  }
  let stored: Awaited<ReturnType<ObjectStore["get"]>>;
  try {
    stored = await input.objectStore.get(expected.key);
  } catch {
    throw new AppKnowledgeEvidenceError("image_object_missing");
  }
  if (
    stored.body.byteLength > input.maxImageBytes
    || stored.metadata.byteSize > input.maxImageBytes
  ) {
    throw new AppKnowledgeEvidenceError("image_size_excessive");
  }
  if (
    !sameMetadata(expected, stored.metadata)
    || stored.body.byteLength !== expected.byteSize
    || digest(stored.body) !== expected.sha256
  ) {
    throw new AppKnowledgeEvidenceError("image_metadata_mismatch");
  }
  try {
    const normalized = sharp(stored.body).autoOrient().toColorspace("srgb").ensureAlpha();
    const { data, info } = await normalized.raw().toBuffer({ resolveWithObject: true });
    const header = Buffer.from(JSON.stringify([info.width, info.height, info.channels]), "utf8");
    return {
      body: stored.body,
      object: {
        sha256: expected.sha256,
        byteSize: expected.byteSize,
        contentType: expected.contentType as RasterType,
      },
      visualSha256: digest(Buffer.concat([header, data])),
      dimensions: { width: info.width, height: info.height },
    };
  } catch {
    throw new AppKnowledgeEvidenceError("image_corrupt");
  }
}

export async function normalizedVisualSha256(bytes: Uint8Array): Promise<string> {
  try {
    const { data, info } = await sharp(bytes).autoOrient().toColorspace("srgb").ensureAlpha()
      .raw().toBuffer({ resolveWithObject: true });
    return digest(Buffer.concat([
      Buffer.from(JSON.stringify([info.width, info.height, info.channels]), "utf8"),
      data,
    ]));
  } catch {
    throw new AppKnowledgeEvidenceError("image_corrupt");
  }
}

function viewport(image: EvidenceImage): AppKnowledgeEvidenceManifestItem["viewport"] | undefined {
  const width = image.viewport_width ?? undefined;
  const height = image.viewport_height ?? undefined;
  return width || height ? { ...(width ? { width } : {}), ...(height ? { height } : {}) } : undefined;
}

function isFullPageUiElement(
  image: EvidenceImage,
  dimensions: { width?: number; height?: number },
): boolean {
  const viewportWidth = image.viewport_width ?? undefined;
  const viewportHeight = image.viewport_height ?? undefined;
  if (!viewportWidth || !viewportHeight || !dimensions.width || !dimensions.height) return false;
  const widthRatio = dimensions.width / viewportWidth;
  const heightRatio = dimensions.height / viewportHeight;
  return widthRatio >= 0.9 && widthRatio <= 1.1 && heightRatio >= 0.9 && heightRatio <= 1.1;
}

function canonicalItem(item: AppKnowledgeEvidenceManifestItem) {
  return {
    evidenceId: item.evidenceId,
    imageId: item.imageId,
    kind: item.kind,
    eligibility: item.eligibility,
    reason: item.reason,
    normalizedVisualSha256: item.normalizedVisualSha256 ?? null,
    duplicateOfEvidenceId: item.duplicateOfEvidenceId ?? null,
    capturedAt: item.capturedAt ?? null,
    viewport: item.viewport
      ? { width: item.viewport.width ?? null, height: item.viewport.height ?? null }
      : null,
    flow: item.flow
      ? {
          id: item.flow.id,
          title: item.flow.title,
          category: item.flow.category ?? null,
          stepIndex: item.flow.stepIndex,
          stepLabel: item.flow.stepLabel,
          interaction: item.flow.interaction ?? null,
        }
      : null,
    object: item.object,
  };
}

function validSource(source: AppKnowledgeEvidenceSource): void {
  if (
    !Number.isSafeInteger(source.appId)
    || source.appId <= 0
    || !source.app
    || !Number.isSafeInteger(source.platformId)
    || source.platformId <= 0
    || !["ios", "android", "web"].includes(source.platform)
    || !Number.isSafeInteger(source.versionId)
    || source.versionId <= 0
    || !Number.isSafeInteger(source.versionNumber)
    || source.versionNumber <= 0
    || !Array.isArray(source.images)
    || !Array.isArray(source.flows)
  ) throw new AppKnowledgeEvidenceError("source_invalid");
}

export async function buildAppKnowledgeEvidenceManifest(input: {
  source: AppKnowledgeEvidenceSource;
  objectStore: ObjectStore;
  overrides?: AppKnowledgeEvidenceOverride[];
  maxImageBytes?: number;
}): Promise<AppKnowledgeEvidenceManifest> {
  validSource(input.source);
  const maxImageBytes = input.maxImageBytes ?? 20 * 1024 * 1024;
  if (!Number.isSafeInteger(maxImageBytes) || maxImageBytes < 1) {
    throw new AppKnowledgeEvidenceError("source_invalid");
  }
  const images = input.source.images as EvidenceImage[];
  const byId = new Map<number, EvidenceImage>();
  for (const image of images) {
    imageScope(input.source, image);
    if (byId.has(image.id)) throw new AppKnowledgeEvidenceError("source_invalid");
    byId.set(image.id, image);
  }
  const overrides = new Map<number, AppKnowledgeEvidenceOverride>();
  for (const override of input.overrides ?? []) {
    if (
      !Number.isSafeInteger(override.imageId)
      || override.imageId <= 0
      || !override.reason.trim()
      || overrides.has(override.imageId)
    ) throw new AppKnowledgeEvidenceError("source_invalid");
    overrides.set(override.imageId, override);
  }

  const occurrences: Array<{
    evidenceId: string;
    image: EvidenceImage;
    kind: AppKnowledgeEvidenceKind;
    flow?: AppKnowledgeEvidenceManifestItem["flow"];
  }> = [];
  for (const image of images.filter(({ kind }) => kind === "screen").sort((a, b) => a.id - b.id)) {
    occurrences.push({ evidenceId: `SCREEN-${image.id}`, image, kind: "screen" });
  }

  let totalFlowReferences = 0;
  const flowImageIds = new Set<number>();
  const orderedFlows = [...input.source.flows].sort((left, right) => left.id.localeCompare(right.id));
  for (const flow of orderedFlows) {
    const encodedFlowId = flowIdentity(flow.id);
    for (let stepIndex = 0; stepIndex < flow.steps.length; stepIndex += 1) {
      const step = flow.steps[stepIndex];
      for (const imageId of step.evidence) {
        totalFlowReferences += 1;
        const image = byId.get(imageId);
        if (!image || image.kind !== "flow_step") {
          throw new AppKnowledgeEvidenceError("flow_evidence_missing");
        }
        flowImageIds.add(imageId);
        occurrences.push({
          evidenceId: `FLOW-${encodedFlowId}-STEP-${String(stepIndex).padStart(4, "0")}-IMAGE-${image.id}`,
          image,
          kind: "flow_step",
          flow: {
            id: flow.id,
            title: flow.title,
            ...(flow.category ? { category: flow.category } : {}),
            stepIndex,
            stepLabel: step.label,
            ...(step.interaction ? { interaction: step.interaction } : {}),
          },
        });
      }
    }
  }

  for (const image of images.filter(({ kind }) => kind === "ui_element").sort((a, b) => a.id - b.id)) {
    occurrences.push({ evidenceId: `UI-ELEMENT-${image.id}`, image, kind: "ui_element" });
  }

  const verified = new Map<number, Awaited<ReturnType<typeof verifiedRaster>>>();
  const firstEligibleByVisual = new Map<string, string>();
  const items: AppKnowledgeEvidenceManifestItem[] = [];
  for (const occurrence of occurrences) {
    let raster = verified.get(occurrence.image.id);
    if (!raster) {
      raster = await verifiedRaster({
        image: occurrence.image,
        objectStore: input.objectStore,
        maxImageBytes,
      });
      verified.set(occurrence.image.id, raster);
    }
    const override = overrides.get(occurrence.image.id);
    let eligibility: AppKnowledgeEvidenceManifestItem["eligibility"] = "eligible";
    let reason: AppKnowledgeEvidenceReason = occurrence.kind === "screen"
      ? "screen_capture"
      : occurrence.kind === "flow_step"
        ? "flow_step_capture"
        : "ui_element_isolation_unverified";
    if (occurrence.kind === "ui_element") {
      if (override?.decision === "eligible") {
        reason = "ui_element_human_override";
      } else {
        eligibility = "quarantined";
        reason = override
          ? "ui_element_human_quarantine"
          : isFullPageUiElement(occurrence.image, raster.dimensions)
            ? "ui_element_full_page_capture"
            : "ui_element_isolation_unverified";
      }
    }
    let duplicateOfEvidenceId: string | undefined;
    if (eligibility === "eligible") {
      duplicateOfEvidenceId = firstEligibleByVisual.get(raster.visualSha256);
      if (duplicateOfEvidenceId) {
        eligibility = "duplicate";
        reason = "visual_duplicate";
      } else {
        firstEligibleByVisual.set(raster.visualSha256, occurrence.evidenceId);
      }
    }
    items.push({
      evidenceId: occurrence.evidenceId,
      imageId: occurrence.image.id,
      kind: occurrence.kind,
      eligibility,
      reason,
      normalizedVisualSha256: raster.visualSha256,
      ...(duplicateOfEvidenceId ? { duplicateOfEvidenceId } : {}),
      ...(occurrence.image.captured_at ? { capturedAt: occurrence.image.captured_at } : {}),
      ...(viewport(occurrence.image) ? { viewport: viewport(occurrence.image) } : {}),
      ...(occurrence.flow ? { flow: occurrence.flow } : {}),
      object: raster.object,
    });
  }

  const canonicalSource = {
    identity: {
      appId: input.source.appId,
      app: input.source.app,
      platformId: input.source.platformId,
      platform: input.source.platform,
      versionId: input.source.versionId,
      versionNumber: input.source.versionNumber,
    },
    flowOrder: input.source.flows.map((flow) => ({
      id: flow.id,
      steps: flow.steps.map((step) => ({
        label: step.label,
        interaction: step.interaction ?? null,
        evidence: [...step.evidence],
      })),
    })),
    items: items.map(canonicalItem),
  };
  return {
    sourceSha256: digest(JSON.stringify(canonicalSource)),
    items,
    flowReferences: {
      total: totalFlowReferences,
      resolved: totalFlowReferences,
      uniqueImages: flowImageIds.size,
    },
  };
}

export function appKnowledgeCacheKey(input: {
  normalizedVisualSha256: string;
  platform: string;
  promptVersion: number;
  providerModel: string;
}): string {
  return digest(JSON.stringify([
    input.normalizedVisualSha256,
    input.platform,
    input.promptVersion,
    input.providerModel,
  ]));
}
