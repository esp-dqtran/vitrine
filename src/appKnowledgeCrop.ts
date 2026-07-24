import { createHash } from "node:crypto";
import sharp from "sharp";
import type { AppKnowledgeDesignSystemResult } from "./appKnowledge.ts";
import type { AppKnowledgeEvidenceManifestItem } from "./appKnowledgeEvidence.ts";
import { componentOccurrenceKey } from "./appKnowledgeProjector.ts";
import type { AppKnowledgeNormalizedRegion } from "./appKnowledgeService.ts";
import type { AppKnowledgeWorkerJob } from "./appKnowledgeStore.ts";
import type { ObjectMetadata, ObjectStore } from "./objectStore.ts";

export interface PixelRegion {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface DerivedComponentCrop {
  body: Buffer;
  sha256: string;
  byteSize: number;
  contentType: "image/png";
  sourceRegionPixels: PixelRegion;
}

export interface AppKnowledgeComponentCropIdentity {
  sourceImageId: number;
  region: AppKnowledgeNormalizedRegion;
  providerModel: string;
  promptVersion: number;
}

export interface PersistComponentCropInput extends AppKnowledgeComponentCropIdentity {
  jobId: number;
  platformId: number;
  componentFamily: string;
  componentVariant: string;
  sourceSha256: string;
  object: ObjectMetadata;
}

export interface AppKnowledgeCropStore {
  findComponentCrop(input: AppKnowledgeComponentCropIdentity): Promise<number | undefined>;
  persistComponentCrop(input: PersistComponentCropInput): Promise<number>;
  attachCropsToRevision(jobId: number, revisionId: number): Promise<void>;
}

export interface DeriveComponentCropsInput {
  job: AppKnowledgeWorkerJob;
  manifest: readonly AppKnowledgeEvidenceManifestItem[];
  result: AppKnowledgeDesignSystemResult;
  objectStore: ObjectStore;
  imageObjectById(imageId: number): Promise<ObjectMetadata | undefined>;
  store: AppKnowledgeCropStore;
  signal?: AbortSignal;
}

function validDimension(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

export function validateComponentCropRegion(input: {
  region: AppKnowledgeNormalizedRegion;
  sourceWidth: number;
  sourceHeight: number;
}): PixelRegion {
  const { region, sourceWidth, sourceHeight } = input;
  if (!validDimension(sourceWidth) || !validDimension(sourceHeight)) {
    throw new Error("Component crop source dimensions are invalid");
  }
  const coordinates = [region.x, region.y, region.width, region.height];
  if (
    coordinates.some((value) => !Number.isFinite(value))
    || region.x < 0
    || region.y < 0
    || region.width <= 0
    || region.height <= 0
    || region.x > 1
    || region.y > 1
    || region.width > 1
    || region.height > 1
    || region.x + region.width > 1
    || region.y + region.height > 1
  ) {
    throw new Error("Component crop region exceeds source bounds");
  }
  if (region.width >= 0.9 && region.height >= 0.9) {
    throw new Error("Component crop region is effectively full-screen");
  }

  const rawLeft = Math.floor(region.x * sourceWidth);
  const rawTop = Math.floor(region.y * sourceHeight);
  const rawRight = Math.ceil((region.x + region.width) * sourceWidth);
  const rawBottom = Math.ceil((region.y + region.height) * sourceHeight);
  if (rawRight - rawLeft < 16 || rawBottom - rawTop < 16) {
    throw new Error("Component crop region must be at least 16 by 16 pixels");
  }

  const horizontalMargin = region.width * sourceWidth * 0.02;
  const verticalMargin = region.height * sourceHeight * 0.02;
  const left = Math.max(0, Math.floor(region.x * sourceWidth - horizontalMargin));
  const top = Math.max(0, Math.floor(region.y * sourceHeight - verticalMargin));
  const right = Math.min(
    sourceWidth,
    Math.ceil((region.x + region.width) * sourceWidth + horizontalMargin),
  );
  const bottom = Math.min(
    sourceHeight,
    Math.ceil((region.y + region.height) * sourceHeight + verticalMargin),
  );
  return { left, top, width: right - left, height: bottom - top };
}

export async function deriveComponentCrop(input: {
  source: Uint8Array;
  region: AppKnowledgeNormalizedRegion;
}): Promise<DerivedComponentCrop> {
  let oriented: Buffer;
  let width: number | undefined;
  let height: number | undefined;
  try {
    oriented = await sharp(input.source).autoOrient().png().toBuffer();
    ({ width, height } = await sharp(oriented).metadata());
  } catch {
    throw new Error("Component crop source must be a valid raster image");
  }
  if (!width || !height) {
    throw new Error("Component crop source must be a valid raster image");
  }
  const sourceRegionPixels = validateComponentCropRegion({
    region: input.region,
    sourceWidth: width,
    sourceHeight: height,
  });
  const body = await sharp(oriented)
    .extract(sourceRegionPixels)
    .png()
    .toBuffer();
  return {
    body,
    sha256: createHash("sha256").update(body).digest("hex"),
    byteSize: body.byteLength,
    contentType: "image/png",
    sourceRegionPixels,
  };
}

function sameMetadata(left: ObjectMetadata, right: ObjectMetadata): boolean {
  return left.key === right.key
    && left.sha256 === right.sha256
    && left.byteSize === right.byteSize
    && left.contentType === right.contentType
    && left.accessClass === right.accessClass;
}

function matchesManifest(
  item: AppKnowledgeEvidenceManifestItem,
  metadata: ObjectMetadata,
): boolean {
  return item.object.sha256 === metadata.sha256
    && item.object.byteSize === metadata.byteSize
    && item.object.contentType === metadata.contentType;
}

function aborted(signal: AbortSignal | undefined): never | void {
  if (signal?.aborted) throw signal.reason ?? new Error("Component crop derivation cancelled");
}

function digest(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}

async function verifiedSource(
  item: AppKnowledgeEvidenceManifestItem,
  input: DeriveComponentCropsInput,
): Promise<{ metadata: ObjectMetadata; body: Buffer }> {
  const metadata = await input.imageObjectById(item.imageId);
  if (!metadata || !matchesManifest(item, metadata)) {
    throw new Error("Component crop source metadata mismatch");
  }
  const stored = await input.objectStore.get(metadata.key);
  if (
    !sameMetadata(metadata, stored.metadata)
    || stored.body.byteLength !== metadata.byteSize
    || digest(stored.body) !== metadata.sha256
  ) {
    throw new Error("Component crop source metadata mismatch");
  }
  return { metadata, body: stored.body };
}

export async function deriveComponentCrops(
  input: DeriveComponentCropsInput,
): Promise<Map<string, number>> {
  const manifest = new Map(input.manifest.map((item) => [item.evidenceId, item]));
  const result = new Map<string, number>();
  for (const component of input.result.componentCandidates) {
    for (const variant of component.variantCandidates) {
      for (const occurrence of variant.occurrences) {
        aborted(input.signal);
        const key = componentOccurrenceKey({
          componentId: component.id,
          variantId: variant.id,
          evidenceId: occurrence.evidenceId,
          region: occurrence.region,
        });
        if (result.has(key)) continue;
        try {
          const item = manifest.get(occurrence.evidenceId);
          if (!item || item.kind !== "screen") {
            throw new Error("Component crop occurrence is outside the frozen screen allowlist");
          }
          const identity: AppKnowledgeComponentCropIdentity = {
            sourceImageId: item.imageId,
            region: occurrence.region,
            providerModel: input.job.providerModel,
            promptVersion: input.job.promptVersion,
          };
          const existing = await input.store.findComponentCrop(identity);
          if (existing !== undefined) {
            result.set(key, existing);
            continue;
          }
          const source = await verifiedSource(item, input);
          const crop = await deriveComponentCrop({
            source: source.body,
            region: occurrence.region,
          });
          const object: ObjectMetadata = {
            key: `app-knowledge/component-crops/${crop.sha256}.png`,
            sha256: crop.sha256,
            byteSize: crop.byteSize,
            contentType: crop.contentType,
            accessClass: "protected",
          };
          const put = await input.objectStore.put({ ...object, body: crop.body });
          if (!sameMetadata(object, put.metadata)) {
            throw new Error("Component crop object write failed verification");
          }
          const persisted = await input.objectStore.head(object.key);
          if (!persisted || !sameMetadata(object, persisted)) {
            throw new Error("Component crop object write failed verification");
          }
          const imageId = await input.store.persistComponentCrop({
            ...identity,
            jobId: input.job.id,
            platformId: input.job.target.platformId,
            componentFamily: component.name,
            componentVariant: variant.name,
            sourceSha256: source.metadata.sha256,
            object,
          });
          result.set(key, imageId);
        } catch (error) {
          aborted(input.signal);
          void error;
        }
      }
    }
  }
  return result;
}
