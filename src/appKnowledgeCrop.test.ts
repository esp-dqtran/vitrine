import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import sharp from "sharp";
import {
  deriveComponentCrop,
  deriveComponentCrops,
  validateComponentCropRegion,
  type AppKnowledgeCropStore,
} from "./appKnowledgeCrop.ts";
import type { AppKnowledgeDesignSystemResult } from "./appKnowledge.ts";
import type { AppKnowledgeEvidenceManifestItem } from "./appKnowledgeEvidence.ts";
import type { AppKnowledgeWorkerJob } from "./appKnowledgeStore.ts";
import type { ObjectMetadata, ObjectStore } from "./objectStore.ts";
import { componentOccurrenceKey } from "./appKnowledgeProjector.ts";

async function pngFixture(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 38, g: 99, b: 235, alpha: 1 },
    },
  }).png().toBuffer();
}

test("adds two-percent margin and clamps a valid normalized crop", async () => {
  const crop = await deriveComponentCrop({
    source: await pngFixture(1_000, 500),
    region: { x: 0.9, y: 0.8, width: 0.1, height: 0.2 },
  });

  assert.deepEqual(crop.sourceRegionPixels, {
    left: 898,
    top: 398,
    width: 102,
    height: 102,
  });
  assert.equal(crop.contentType, "image/png");
  assert.equal(crop.byteSize, crop.body.byteLength);
  assert.match(crop.sha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(await sharp(crop.body).metadata().then(({ width, height }) => ({ width, height })), {
    width: 102,
    height: 102,
  });
});

test("rejects tiny and near-full-screen component crops", async () => {
  const source = await pngFixture(1_000, 500);
  await assert.rejects(
    () => deriveComponentCrop({
      source,
      region: { x: 0, y: 0, width: 0.01, height: 0.02 },
    }),
    /at least 16 by 16/,
  );
  await assert.rejects(
    () => deriveComponentCrop({
      source,
      region: { x: 0, y: 0, width: 0.9, height: 0.9 },
    }),
    /full-screen/,
  );
});

test("rejects invalid normalized geometry before reading pixels", () => {
  assert.throws(
    () => validateComponentCropRegion({
      region: { x: 0.95, y: 0, width: 0.1, height: 0.2 },
      sourceWidth: 1_000,
      sourceHeight: 500,
    }),
    /source bounds/,
  );
});

test("rejects bytes that are not a raster image", async () => {
  await assert.rejects(
    () => deriveComponentCrop({
      source: Buffer.from("not an image"),
      region: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
    }),
    /valid raster image/,
  );
});

function sha256(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}

function cropJob(): AppKnowledgeWorkerJob {
  return {
    id: 9,
    snapshotId: 3,
    transportJobId: 4,
    requestedBy: null,
    requestOrigin: "automatic",
    status: "running",
    stage: "synthesizing",
    doneCount: 1,
    totalCount: 1,
    synthesisDoneCount: 0,
    synthesisTotalCount: 1,
    cacheHitCount: 0,
    failedCount: 0,
    providerModel: "gemini-2.5-pro",
    promptVersion: 2,
    cancelRequested: false,
    retryFailedOnly: false,
    sourceSha256: "a".repeat(64),
    updatedAt: "2026-07-24T00:00:00.000Z",
    target: {
      appId: 1,
      app: "Alpha",
      platformId: 2,
      platform: "web",
      captureVersionId: 3,
      versionNumber: 1,
    },
  };
}

function cropResult(evidenceId = "SCREEN-1"): AppKnowledgeDesignSystemResult {
  return {
    tokenCandidates: [],
    componentCandidates: [{
      id: "component-button",
      name: "Button",
      category: "Actions",
      purpose: "Trigger an action",
      anatomy: ["Container", "Label"],
      observedProperties: ["Filled"],
      variants: ["Primary"],
      variantCandidates: [{
        id: "variant-primary",
        name: "Primary",
        description: "Primary action",
        observedProperties: ["Filled"],
        visibleStates: ["Default"],
        evidenceIds: [evidenceId],
        occurrences: [{
          evidenceId,
          region: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
          confidence: 0.88,
        }],
        confidence: 0.88,
        source: "llm_inferred",
        reviewStatus: "needs_review",
      }],
      states: ["Default"],
      responsiveEvidence: [],
      evidenceIds: [evidenceId],
      visualRegions: [],
      designLanguageCandidateIds: [],
      claims: [],
      confidence: 0.88,
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
      layout: [],
      iconography: [],
      imagery: [],
      responsive: [],
      content: [],
      interaction: [],
    },
    unresolvedConflicts: [],
  };
}

function cropManifest(metadata: ObjectMetadata): AppKnowledgeEvidenceManifestItem[] {
  return [{
    evidenceId: "SCREEN-1",
    imageId: 11,
    kind: "screen",
    eligibility: "eligible",
    reason: "screen_capture",
    object: {
      sha256: metadata.sha256,
      byteSize: metadata.byteSize,
      contentType: "image/png",
    },
  }];
}

function cropStore(input: {
  existing?: number;
  persisted?: number;
  writes?: Array<Record<string, unknown>>;
} = {}): AppKnowledgeCropStore {
  return {
    async findComponentCrop() {
      return input.existing;
    },
    async persistComponentCrop(value) {
      input.writes?.push(structuredClone(value) as unknown as Record<string, unknown>);
      return input.persisted ?? 88;
    },
    async attachCropsToRevision() {},
  };
}

function objectStore(input: {
  sourceMetadata: ObjectMetadata;
  source: Buffer;
  head?: (key: string) => ObjectMetadata | undefined;
  puts?: ObjectMetadata[];
}): ObjectStore {
  return {
    async get(key) {
      if (key !== input.sourceMetadata.key) throw new Error("missing");
      return { metadata: input.sourceMetadata, body: input.source };
    },
    async head(key) {
      return input.head?.(key);
    },
    async put(value) {
      const { body: _body, ...metadata } = value;
      input.puts?.push(metadata);
      return { created: true, metadata };
    },
    async signedGetUrl() { return undefined; },
    async *list() {},
    async delete() { return false; },
  };
}

test("reuses a persisted crop without reading or writing object storage", async () => {
  const source = await pngFixture(100, 100);
  const metadata: ObjectMetadata = {
    key: "screens/source.png",
    sha256: sha256(source),
    byteSize: source.byteLength,
    contentType: "image/png",
    accessClass: "protected",
  };
  const result = cropResult();
  const crops = await deriveComponentCrops({
    job: cropJob(),
    manifest: cropManifest(metadata),
    result,
    objectStore: objectStore({ sourceMetadata: metadata, source }),
    imageObjectById: async () => {
      throw new Error("source should not be read");
    },
    store: cropStore({ existing: 77 }),
  });
  const occurrence = result.componentCandidates[0].variantCandidates[0].occurrences[0];
  assert.equal(crops.get(componentOccurrenceKey({
    componentId: "component-button",
    variantId: "variant-primary",
    evidenceId: occurrence.evidenceId,
    region: occurrence.region,
  })), 77);
});

test("isolates an occurrence outside the frozen screen allowlist", async () => {
  const source = await pngFixture(100, 100);
  const metadata: ObjectMetadata = {
    key: "screens/source.png",
    sha256: sha256(source),
    byteSize: source.byteLength,
    contentType: "image/png",
    accessClass: "protected",
  };
  let read = false;
  const crops = await deriveComponentCrops({
    job: cropJob(),
    manifest: cropManifest(metadata),
    result: cropResult("SCREEN-999"),
    objectStore: objectStore({ sourceMetadata: metadata, source }),
    imageObjectById: async () => {
      read = true;
      return metadata;
    },
    store: cropStore(),
  });
  assert.equal(crops.size, 0);
  assert.equal(read, false);
});

test("isolates source metadata mismatch before deriving a crop", async () => {
  const source = await pngFixture(100, 100);
  const metadata: ObjectMetadata = {
    key: "screens/source.png",
    sha256: sha256(source),
    byteSize: source.byteLength,
    contentType: "image/png",
    accessClass: "protected",
  };
  const crops = await deriveComponentCrops({
    job: cropJob(),
    manifest: cropManifest(metadata),
    result: cropResult(),
    objectStore: objectStore({ sourceMetadata: metadata, source }),
    imageObjectById: async () => ({ ...metadata, byteSize: metadata.byteSize + 1 }),
    store: cropStore(),
  });
  assert.equal(crops.size, 0);
});

test("does not persist a crop when post-write object verification fails", async () => {
  const source = await pngFixture(100, 100);
  const metadata: ObjectMetadata = {
    key: "screens/source.png",
    sha256: sha256(source),
    byteSize: source.byteLength,
    contentType: "image/png",
    accessClass: "protected",
  };
  const writes: Array<Record<string, unknown>> = [];
  const puts: ObjectMetadata[] = [];
  const crops = await deriveComponentCrops({
    job: cropJob(),
    manifest: cropManifest(metadata),
    result: cropResult(),
    objectStore: objectStore({
      sourceMetadata: metadata,
      source,
      puts,
      head: (key) => ({
        key,
        sha256: "f".repeat(64),
        byteSize: 1,
        contentType: "image/png",
        accessClass: "protected",
      }),
    }),
    imageObjectById: async () => metadata,
    store: cropStore({ writes }),
  });
  assert.equal(puts.length, 1);
  assert.equal(writes.length, 0);
  assert.equal(crops.size, 0);
});

test("stores and verifies a content-addressed crop before persistence", async () => {
  const source = await pngFixture(100, 100);
  const metadata: ObjectMetadata = {
    key: "screens/source.png",
    sha256: sha256(source),
    byteSize: source.byteLength,
    contentType: "image/png",
    accessClass: "protected",
  };
  const writes: Array<Record<string, unknown>> = [];
  const puts: ObjectMetadata[] = [];
  const crops = await deriveComponentCrops({
    job: cropJob(),
    manifest: cropManifest(metadata),
    result: cropResult(),
    objectStore: objectStore({
      sourceMetadata: metadata,
      source,
      puts,
      head: (key) => puts.find((value) => value.key === key),
    }),
    imageObjectById: async () => metadata,
    store: cropStore({ persisted: 88, writes }),
  });

  assert.equal(crops.size, 1);
  assert.equal(puts.length, 1);
  assert.match(puts[0].key, /^app-knowledge\/component-crops\/[0-9a-f]{64}\.png$/);
  assert.equal(puts[0].accessClass, "protected");
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].object, puts[0]);
});
