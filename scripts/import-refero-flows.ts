import { createHash } from "node:crypto";
import sharp from "sharp";
import { attachImageObject, attachThumbnailObject } from "../src/objectStoreDb.ts";
import { createObjectStore, objectStoreConfigFromEnvironment } from "../src/objectStoreConfig.ts";
import { imageObjectKey, thumbnailObjectKey, type ObjectMetadata, type StoredContentType } from "../src/objectStore.ts";
import { generateThumbnail } from "../src/imageThumbnail.ts";
import { closePool, getAppFlows, insertImage, pool, query, saveAppFlows, withTransaction } from "../src/db.ts";
import { crawlReferoFlows } from "../src/referoImport.ts";
import type { DesignFlow } from "../src/designSystem.ts";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function positiveInteger(value: string | undefined, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${label} must be a positive integer`);
  return parsed;
}

function appSlug(value: string | undefined): string {
  const app = value?.trim() ?? "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(app)) throw new Error("--app must be a lowercase app slug");
  return app;
}

function imageType(body: Buffer, header: string | null): { extension: "png" | "jpg" | "webp"; contentType: StoredContentType } {
  if (body.length >= 8 && body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { extension: "png", contentType: "image/png" };
  }
  if (body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) {
    return { extension: "jpg", contentType: "image/jpeg" };
  }
  if (body.length >= 12 && body.subarray(0, 4).toString("ascii") === "RIFF" && body.subarray(8, 12).toString("ascii") === "WEBP") {
    return { extension: "webp", contentType: "image/webp" };
  }
  throw new Error(`Refero returned unsupported image bytes (${header ?? "no content type"})`);
}

async function attach(imageId: number, metadata: ObjectMetadata, thumbnail = false): Promise<void> {
  const client = await pool.connect();
  try {
    if (thumbnail) await attachThumbnailObject(client, { imageId, metadata });
    else await attachImageObject(client, { imageId, metadata });
  } finally {
    client.release();
  }
}

async function download(url: string): Promise<Buffer> {
  const response = await fetch(url, { headers: { Accept: "image/*" } });
  if (!response.ok) throw new Error(`Refero flow image download failed (${response.status})`);
  const body = Buffer.from(await response.arrayBuffer());
  if (body.byteLength === 0 || body.byteLength > 64 * 1024 * 1024) throw new Error("Refero flow image size is invalid");
  imageType(body, response.headers.get("content-type"));
  return body;
}

async function composeVertical(chunks: Buffer[]): Promise<{ body: Buffer; width: number; height: number }> {
  const dimensions = await Promise.all(chunks.map(async (body) => {
    const metadata = await sharp(body).metadata();
    if (!metadata.width || !metadata.height) throw new Error("Refero flow image dimensions are invalid");
    return { width: metadata.width, height: metadata.height };
  }));
  const width = dimensions[0].width;
  if (dimensions.some((item) => item.width !== width)) throw new Error("Refero flow chunks have inconsistent widths");
  const height = dimensions.reduce((sum, item) => sum + item.height, 0);
  if (chunks.length === 1) return { body: chunks[0], width, height };
  let top = 0;
  const composite = chunks.map((input, index) => {
    const item = { input, left: 0, top };
    top += dimensions[index].height;
    return item;
  });
  const body = await sharp({ create: { width, height, channels: 3, background: "#ffffff" } })
    .composite(composite)
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
    .toBuffer();
  return { body, width, height };
}

const siteId = positiveInteger(argument("--site-id"), "--site-id");
const app = appSlug(argument("--app"));
const authorization = process.env.REFERO_AUTHORIZATION?.trim();
if (!authorization) throw new Error("REFERO_AUTHORIZATION is required");

const active = await query<{ id: number; version_number: number; provider: string; status: string }>(
  `SELECT av.id, av.version_number, av.provider, av.status
   FROM app_versions av JOIN apps a ON a.id = av.app_id
   WHERE a.name = $1 AND av.platform = 'web' AND av.status IN ('draft', 'in_review')
   ORDER BY av.version_number DESC LIMIT 1`,
  [app],
);
const version = active.rows[0];
if (!version) throw new Error("Refero flow import requires an existing active app version");
if (version.provider !== "f") throw new Error(`Active app version uses provider ${version.provider}, not f`);

const crawl = await crawlReferoFlows(siteId, fetch, 100, authorization);
if (!crawl.complete) {
  throw new Error(`Refero flow coverage is incomplete (${crawl.flows.length}/${crawl.reportedCount})`);
}
const store = createObjectStore(objectStoreConfigFromEnvironment(process.env));
const existingBeforeImport = await getAppFlows(app, "web");
const incomingFlowIds = new Set(crawl.flows.map(({ id }) => `f-flow-${id}`));
const previousEvidenceIds = existingBeforeImport
  .filter(({ id }) => incomingFlowIds.has(id))
  .flatMap(({ steps }) => steps.flatMap(({ evidence }) => evidence));
const imported: DesignFlow[] = [];
let rawChunks = 0;
let uploadedObjects = 0;
let previewSteps = 0;

try {
  for (const flow of crawl.flows) {
    const steps: DesignFlow["steps"] = [];
    for (const [stepIndex, screenshot] of flow.screenshots.entries()) {
      rawChunks += screenshot.imageUrls.length;
      const selectedUrls = screenshot.previewUrl ? [screenshot.previewUrl] : screenshot.imageUrls;
      if (screenshot.previewUrl) previewSteps += 1;
      const chunks = await Promise.all(selectedUrls.map(download));
      const composed = await composeVertical(chunks);
      const type = imageType(composed.body, null);
      const sha256 = createHash("sha256").update(composed.body).digest("hex");
      const imageReference = `capture:flow_step:${sha256.slice(0, 16)}:${stepIndex + 1}`;
      const imageId = await insertImage(app, "web", imageReference, {
        provider: "f",
        sourceUrl: `https://refero.design/flows/${flow.id}`,
        viewportWidth: composed.width,
        viewportHeight: composed.height,
        kind: "flow_step",
      });
      const metadata: ObjectMetadata = {
        key: imageObjectKey(imageId, sha256, type.extension),
        sha256,
        byteSize: composed.body.byteLength,
        contentType: type.contentType,
        accessClass: "protected",
      };
      const stored = await store.put({ ...metadata, body: composed.body });
      await attach(imageId, stored.metadata);
      uploadedObjects += stored.created ? 1 : 0;
      const thumbnail = await generateThumbnail(composed.body);
      const thumbnailSha256 = createHash("sha256").update(thumbnail).digest("hex");
      const thumbnailMetadata: ObjectMetadata = {
        key: thumbnailObjectKey(imageId, thumbnailSha256),
        sha256: thumbnailSha256,
        byteSize: thumbnail.byteLength,
        contentType: "image/jpeg",
        accessClass: "protected",
      };
      const storedThumbnail = await store.put({ ...thumbnailMetadata, body: thumbnail });
      await attach(imageId, storedThumbnail.metadata, true);
      steps.push({ label: `Step ${stepIndex + 1}`, evidence: [imageId] });
      console.log(`Imported flow ${flow.id}, step ${stepIndex + 1}/${flow.screenshots.length}: ${chunks.length} chunk(s)`);
    }
    imported.push({
      id: `f-flow-${flow.id}`,
      title: flow.name,
      description: flow.description,
      tags: [],
      steps,
    });
  }

  const existing = await getAppFlows(app, "web");
  const incomingIds = new Set(imported.map(({ id }) => id));
  await saveAppFlows(app, "web", [...existing.filter(({ id }) => !incomingIds.has(id)), ...imported]);

  const storedFlows = await getAppFlows(app, "web");
  const saved = imported.map(({ id }) => storedFlows.find((flow) => flow.id === id));
  if (saved.some((flow) => !flow)) throw new Error("Refero flow persistence verification failed");
  const evidenceIds = saved.flatMap((flow) => flow!.steps.flatMap(({ evidence }) => evidence));
  const verified = await query<{ images: number; objects: number; thumbnails: number }>(
    `SELECT COUNT(*)::int AS images, COUNT(i.object_key)::int AS objects,
       COUNT(i.thumbnail_object_key)::int AS thumbnails
     FROM version_images vi JOIN images i ON i.id = vi.image_id
     WHERE vi.version_id = $1 AND i.kind = 'flow_step' AND i.id = ANY($2::integer[])`,
    [version.id, evidenceIds],
  );
  const coverage = verified.rows[0];
  if (!coverage || coverage.images !== evidenceIds.length || coverage.objects !== evidenceIds.length || coverage.thumbnails !== evidenceIds.length) {
    throw new Error("Refero flow evidence verification failed");
  }
  const retainedEvidenceIds = new Set(storedFlows.flatMap(({ steps }) => steps.flatMap(({ evidence }) => evidence)));
  const obsoleteEvidenceIds = [...new Set(previousEvidenceIds.filter((id) => !retainedEvidenceIds.has(id)))];
  const obsoleteObjects = obsoleteEvidenceIds.length === 0 ? [] : await withTransaction(async (client) => {
    await client.query(
      "DELETE FROM version_images WHERE version_id = $1 AND image_id = ANY($2::integer[])",
      [version.id, obsoleteEvidenceIds],
    );
    const removed = await client.query<{ object_key: string | null; thumbnail_object_key: string | null }>(
      `DELETE FROM images i
       WHERE i.id = ANY($1::integer[])
         AND NOT EXISTS (SELECT 1 FROM version_images vi WHERE vi.image_id = i.id)
       RETURNING i.object_key, i.thumbnail_object_key`,
      [obsoleteEvidenceIds],
    );
    return removed.rows.flatMap(({ object_key, thumbnail_object_key }) => [object_key, thumbnail_object_key]
      .filter((key): key is string => Boolean(key)));
  });
  for (const key of obsoleteObjects) await store.delete(key);
  if (obsoleteObjects.length > 0) {
    await query(
      `DELETE FROM stored_objects so
       WHERE so.object_key = ANY($1::text[])
         AND NOT EXISTS (SELECT 1 FROM images i WHERE i.object_key = so.object_key OR i.thumbnail_object_key = so.object_key)`,
      [obsoleteObjects],
    );
  }
  console.log(JSON.stringify({
    status: "ok",
    app,
    siteId,
    provider: version.provider,
    versionId: version.id,
    versionNumber: version.version_number,
    reportedFlows: crawl.reportedCount,
    storedFlows: imported.length,
    storedSteps: evidenceIds.length,
    rawChunks,
    previewSteps,
    fullReferoCoverage: crawl.complete,
    attachedObjects: coverage.objects,
    attachedThumbnails: coverage.thumbnails,
    uploadedObjects,
    removedObsoleteObjects: obsoleteObjects.length,
  }));
} finally {
  await closePool();
}
