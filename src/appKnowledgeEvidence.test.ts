import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import sharp from "sharp";
import type { AppKnowledgeEvidenceSource, CrawledImage } from "./db.ts";
import type { DesignFlow } from "./designSystem.ts";
import type { ObjectMetadata, ObjectStore } from "./objectStore.ts";
import {
  AppKnowledgeEvidenceError,
  appKnowledgeCacheKey,
  buildAppKnowledgeEvidenceManifest,
  normalizedVisualSha256,
} from "./appKnowledgeEvidence.ts";

async function image(
  red: number,
  format: "png" | "jpeg" | "webp" = "png",
): Promise<Buffer> {
  const pipeline = sharp({
    create: {
      width: 8,
      height: 8,
      channels: 4,
      background: { r: red, g: 20, b: 30, alpha: 1 },
    },
  });
  return format === "jpeg"
    ? pipeline.jpeg({ quality: 100, chromaSubsampling: "4:4:4" }).toBuffer()
    : format === "webp"
      ? pipeline.webp({ lossless: true }).toBuffer()
      : pipeline.png().toBuffer();
}

function metadata(imageId: number, body: Buffer, contentType: ObjectMetadata["contentType"] = "image/png"): ObjectMetadata {
  return {
    key: `images/${imageId}/${createHash("sha256").update(body).digest("hex")}.png`,
    sha256: createHash("sha256").update(body).digest("hex"),
    byteSize: body.byteLength,
    contentType,
    accessClass: "protected",
  };
}

function crawled(
  id: number,
  kind: CrawledImage["kind"],
  object: ObjectMetadata,
  overrides: Partial<CrawledImage> = {},
): CrawledImage & { object: ObjectMetadata } {
  return {
    id,
    app: "Alpha",
    platform: "web",
    image_url: `capture:${id}`,
    kind,
    description: null,
    captured_at: "2026-07-23T00:00:00.000Z",
    viewport_width: 8,
    viewport_height: 8,
    object,
    ...overrides,
  };
}

function store(objects: Map<string, { metadata: ObjectMetadata; body: Buffer }>): ObjectStore {
  return {
    async get(key) {
      const value = objects.get(key);
      if (!value) throw Object.assign(new Error("missing"), { code: "ENOENT" });
      return value;
    },
    async head(key) {
      return objects.get(key)?.metadata;
    },
    async put() {
      throw new Error("not used");
    },
    async signedGetUrl() {
      return undefined;
    },
    async *list() {},
    async delete() {
      return false;
    },
  };
}

async function fixture() {
  const bodies = new Map<number, Buffer>([
    [10, await image(10)],
    [20, await image(20)],
    [21, await image(21)],
    [30, await image(30)],
  ]);
  const images = [...bodies].map(([id, body]) => crawled(
    id,
    id === 30 ? "ui_element" : id === 10 ? "screen" : "flow_step",
    metadata(id, body),
  ));
  const flows: DesignFlow[] = [
    {
      id: "https://mobbin.com/flows/z-last",
      title: "Z last",
      description: "",
      tags: [],
      steps: [{ label: "Z step", evidence: [21] }],
    },
    {
      id: "https://mobbin.com/flows/a-first",
      title: "A first",
      description: "",
      tags: [],
      steps: [
        { label: "First", interaction: "Tap", evidence: [20, 20] },
        { label: "Second", evidence: [21] },
      ],
    },
  ];
  const source: AppKnowledgeEvidenceSource = {
    appId: 1,
    app: "Alpha",
    platformId: 2,
    platform: "web",
    versionId: 3,
    versionNumber: 4,
    images,
    flows,
  };
  const objects = new Map(images.map(({ object }) => [
    object.key,
    { metadata: object, body: bodies.get(Number(object.key.split("/")[1]))! },
  ]));
  return { source, bodies, objects };
}

test("normalizes decoded PNG, JPEG, and WebP pixels without merging near duplicates", async () => {
  const png = await image(10, "png");
  const jpeg = await image(10, "jpeg");
  const webp = await image(10, "webp");
  assert.equal(await normalizedVisualSha256(png), await normalizedVisualSha256(jpeg));
  assert.equal(await normalizedVisualSha256(png), await normalizedVisualSha256(webp));
  assert.notEqual(await normalizedVisualSha256(png), await normalizedVisualSha256(await image(11)));
});

test("keeps canonical occurrence order and deduplicates provider work without dropping Flow references", async () => {
  const { source, objects } = await fixture();
  const result = await buildAppKnowledgeEvidenceManifest({
    source,
    objectStore: store(objects),
  });

  assert.deepEqual(
    result.items.map(({ imageId, kind }) => `${kind}:${imageId}`),
    [
      "screen:10",
      "flow_step:20",
      "flow_step:20",
      "flow_step:21",
      "flow_step:21",
      "ui_element:30",
    ],
  );
  assert.equal(result.items[1].eligibility, "eligible");
  assert.equal(result.items[2].eligibility, "duplicate");
  assert.equal(result.items[2].duplicateOfEvidenceId, result.items[1].evidenceId);
  assert.equal(result.items[3].eligibility, "eligible");
  assert.equal(result.items[4].eligibility, "duplicate");
  assert.equal(result.items[4].duplicateOfEvidenceId, result.items[3].evidenceId);
  assert.match(result.items[1].evidenceId, /^FLOW-[0-9a-f]+-STEP-0000-IMAGE-20$/);
  assert.doesNotMatch(result.items[1].evidenceId, /mobbin|https/i);
  assert.equal(result.flowReferences.total, 4);
  assert.equal(result.flowReferences.resolved, 4);
  assert.equal(result.flowReferences.uniqueImages, 2);
});

test("quarantines UI Elements unless a human override proves isolation", async () => {
  const { source, objects } = await fixture();
  const fullPage = await buildAppKnowledgeEvidenceManifest({ source, objectStore: store(objects) });
  const element = fullPage.items.at(-1)!;
  assert.equal(element.eligibility, "quarantined");
  assert.equal(element.reason, "ui_element_full_page_capture");

  const eligible = await buildAppKnowledgeEvidenceManifest({
    source,
    objectStore: store(objects),
    overrides: [{ imageId: 30, decision: "eligible", reason: "Admin verified isolated control" }],
  });
  assert.equal(eligible.items.at(-1)!.eligibility, "eligible");
  assert.equal(eligible.items.at(-1)!.reason, "ui_element_human_override");

  const quarantined = await buildAppKnowledgeEvidenceManifest({
    source,
    objectStore: store(objects),
    overrides: [{ imageId: 30, decision: "quarantined", reason: "Contains a full application frame" }],
  });
  assert.equal(quarantined.items.at(-1)!.eligibility, "quarantined");
  assert.equal(quarantined.items.at(-1)!.reason, "ui_element_human_quarantine");
});

test("fails missing and cross-scope Flow evidence with stable reason codes", async () => {
  const { source, objects } = await fixture();
  source.flows[0].steps[0].evidence = [999];
  await assert.rejects(
    buildAppKnowledgeEvidenceManifest({ source, objectStore: store(objects) }),
    (error: unknown) => error instanceof AppKnowledgeEvidenceError && error.code === "flow_evidence_missing",
  );

  const scoped = await fixture();
  scoped.source.images[0].app = "Other";
  await assert.rejects(
    buildAppKnowledgeEvidenceManifest({ source: scoped.source, objectStore: store(scoped.objects) }),
    (error: unknown) => error instanceof AppKnowledgeEvidenceError && error.code === "image_scope_mismatch",
  );
});

test("rejects unsupported, excessive, corrupt, and mismatched objects before provider eligibility", async () => {
  for (const { mutate, code } of [
    {
      mutate: (object: ObjectMetadata) => ({ ...object, contentType: "application/json" as const }),
      code: "image_type_unsupported",
    },
    {
      mutate: (object: ObjectMetadata) => ({ ...object, byteSize: 50_000_000 }),
      code: "image_size_excessive",
    },
  ] as const) {
    const current = await fixture();
    const first = current.source.images[0] as CrawledImage & { object: ObjectMetadata };
    first.object = mutate(first.object);
    await assert.rejects(
      buildAppKnowledgeEvidenceManifest({
        source: current.source,
        objectStore: store(current.objects),
        maxImageBytes: 1024,
      }),
      (error: unknown) => error instanceof AppKnowledgeEvidenceError
        && error.code === code,
    );
  }

  const mismatch = await fixture();
  const first = (mismatch.source.images[0] as CrawledImage & { object: ObjectMetadata }).object;
  mismatch.objects.set(first.key, { metadata: { ...first, sha256: "f".repeat(64) }, body: Buffer.from("bad") });
  await assert.rejects(
    buildAppKnowledgeEvidenceManifest({ source: mismatch.source, objectStore: store(mismatch.objects) }),
    (error: unknown) => error instanceof AppKnowledgeEvidenceError && error.code === "image_metadata_mismatch",
  );

  const corrupt = await fixture();
  const corruptImage = corrupt.source.images[0] as CrawledImage & { object: ObjectMetadata };
  const corruptBody = Buffer.from("not an image");
  corruptImage.object = metadata(corruptImage.id, corruptBody);
  corrupt.objects.set(corruptImage.object.key, { metadata: corruptImage.object, body: corruptBody });
  await assert.rejects(
    buildAppKnowledgeEvidenceManifest({ source: corrupt.source, objectStore: store(corrupt.objects) }),
    (error: unknown) => error instanceof AppKnowledgeEvidenceError && error.code === "image_corrupt",
  );
});

test("source SHA covers ownership, ordering, object, capture, and quarantine decisions", async () => {
  const base = await fixture();
  const initial = await buildAppKnowledgeEvidenceManifest({ source: base.source, objectStore: store(base.objects) });
  const variants: AppKnowledgeEvidenceSource[] = [
    { ...base.source, appId: 9 },
    { ...base.source, flows: [...base.source.flows].reverse() },
    {
      ...base.source,
      images: base.source.images.map((item, index) => index
        ? item
        : { ...item, captured_at: "2026-07-24T00:00:00.000Z" }),
    },
  ];
  for (const source of variants) {
    const result = await buildAppKnowledgeEvidenceManifest({ source, objectStore: store(base.objects) });
    assert.notEqual(result.sourceSha256, initial.sourceSha256);
  }
  const overridden = await buildAppKnowledgeEvidenceManifest({
    source: base.source,
    objectStore: store(base.objects),
    overrides: [{ imageId: 30, decision: "eligible", reason: "Verified" }],
  });
  assert.notEqual(overridden.sourceSha256, initial.sourceSha256);

  const changedObject = await fixture();
  const replacement = await image(99);
  const changed = changedObject.source.images[0] as CrawledImage & { object: ObjectMetadata };
  changed.object = metadata(changed.id, replacement);
  changedObject.objects.set(changed.object.key, { metadata: changed.object, body: replacement });
  const objectResult = await buildAppKnowledgeEvidenceManifest({
    source: changedObject.source,
    objectStore: store(changedObject.objects),
  });
  assert.notEqual(objectResult.sourceSha256, initial.sourceSha256);
});

test("cache keys include visual, platform, prompt, and provider identities", () => {
  const base = {
    normalizedVisualSha256: "a".repeat(64),
    platform: "web",
    promptVersion: 1,
    providerModel: "model-a",
  };
  const key = appKnowledgeCacheKey(base);
  assert.match(key, /^[0-9a-f]{64}$/);
  assert.notEqual(key, appKnowledgeCacheKey({ ...base, platform: "ios" }));
  assert.notEqual(key, appKnowledgeCacheKey({ ...base, promptVersion: 2 }));
  assert.notEqual(key, appKnowledgeCacheKey({ ...base, providerModel: "model-b" }));
});
