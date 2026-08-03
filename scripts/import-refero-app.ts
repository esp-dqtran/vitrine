import { createHash } from "node:crypto";
import sharp from "sharp";
import { attachImageObject, attachThumbnailObject } from "../src/objectStoreDb.ts";
import { createObjectStore, objectStoreConfigFromEnvironment } from "../src/objectStoreConfig.ts";
import { imageObjectKey, thumbnailObjectKey, type ObjectMetadata, type StoredContentType } from "../src/objectStore.ts";
import { generateThumbnail } from "../src/imageThumbnail.ts";
import { closePool, insertImage, pool, query, setAppMeta } from "../src/db.ts";
import {
  crawlReferoSite,
  fetchReferoSiteDetail,
  referoAppSlug,
  referoWebsiteUrl,
} from "../src/referoImport.ts";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function positiveInteger(value: string | undefined, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${label} must be a positive integer`);
  return parsed;
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

const siteId = positiveInteger(argument("--site-id"), "--site-id");
const authorization = process.env.REFERO_AUTHORIZATION?.trim();
const siteDetail = await fetchReferoSiteDetail(siteId, fetch, authorization);
const crawl = await crawlReferoSite(siteId, fetch, 100, authorization);
if (siteDetail.domain !== crawl.site.domain || siteDetail.name !== crawl.site.name) {
  throw new Error("Refero site detail does not match search results");
}
const app = argument("--app")?.trim() || referoAppSlug(crawl.site);
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(app)) throw new Error("--app must be a lowercase app slug");

const providerColumn = await query<{ present: boolean }>(
  `SELECT EXISTS (
     SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'app_versions' AND column_name = 'provider'
   ) AS present`,
);
if (!providerColumn.rows[0]?.present) {
  await closePool();
  throw new Error("Migration 0068_app_version_provider is not applied");
}

const store = createObjectStore(objectStoreConfigFromEnvironment(process.env));
const occurrences = new Map<string, number>();
let uploaded = 0;
try {
  for (const [index, capture] of crawl.captures.entries()) {
    const response = await fetch(capture.imageUrl, { headers: { Accept: "image/*" } });
    if (!response.ok) throw new Error(`Refero image download failed (${response.status})`);
    const body = Buffer.from(await response.arrayBuffer());
    if (body.byteLength === 0 || body.byteLength > 64 * 1024 * 1024) throw new Error("Refero image size is invalid");
    const type = imageType(body, response.headers.get("content-type"));
    const dimensions = await sharp(body).metadata();
    const sha256 = createHash("sha256").update(body).digest("hex");
    const shortHash = sha256.slice(0, 16);
    const occurrence = (occurrences.get(shortHash) ?? 0) + 1;
    occurrences.set(shortHash, occurrence);
    const imageReference = `capture:${shortHash}${occurrence > 1 ? `:${occurrence}` : ""}`;
    const imageId = await insertImage(app, "web", imageReference, {
      provider: "f",
      sourceUrl: capture.pageUrl ?? capture.imageUrl,
      viewportWidth: dimensions.width ?? capture.width,
      viewportHeight: dimensions.height ?? capture.height,
      kind: "screen",
    });
    const metadata: ObjectMetadata = {
      key: imageObjectKey(imageId, sha256, type.extension),
      sha256,
      byteSize: body.byteLength,
      contentType: type.contentType,
      accessClass: "protected",
    };
    const stored = await store.put({ ...metadata, body });
    await attach(imageId, stored.metadata);
    try {
      const thumbnail = await generateThumbnail(body);
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
    } catch (error) {
      console.warn(`Thumbnail ${index + 1}/${crawl.captures.length} failed: ${String(error)}`);
    }
    uploaded += stored.created ? 1 : 0;
    console.log(`Imported ${index + 1}/${crawl.captures.length}: record ${capture.recordId}`);
  }
  await setAppMeta(app, {
    displayName: siteDetail.name,
    description: siteDetail.description,
    websiteUrl: referoWebsiteUrl(siteDetail),
    iconUrl: siteDetail.faviconUrl,
    accentColor: siteDetail.backgroundColor,
    categories: siteDetail.categories,
  });
  const verification = await query<{
    version_id: number;
    version_number: number;
    provider: string;
    status: string;
    screens: number;
    attached_objects: number;
    attached_thumbnails: number;
  }>(
    `SELECT av.id AS version_id, av.version_number, av.provider, av.status,
       COUNT(*)::int AS screens,
       COUNT(i.object_key)::int AS attached_objects,
       COUNT(i.thumbnail_object_key)::int AS attached_thumbnails
     FROM app_versions av
     JOIN apps a ON a.id = av.app_id
     JOIN version_images vi ON vi.version_id = av.id
     JOIN images i ON i.id = vi.image_id AND i.kind = 'screen'
     WHERE a.name = $1 AND av.platform = 'web' AND av.status IN ('draft', 'in_review')
     GROUP BY av.id, av.version_number, av.provider, av.status
     ORDER BY av.version_number DESC LIMIT 1`,
    [app],
  );
  const version = verification.rows[0];
  if (!version || version.provider !== "f" || version.screens < crawl.captures.length || version.attached_objects !== version.screens) {
    throw new Error("Refero import verification failed");
  }
  console.log(JSON.stringify({
    status: "ok",
    app,
    siteId,
    site: crawl.site.name,
    categories: siteDetail.categories,
    metadataScreens: siteDetail.screenshotsCount,
    provider: version.provider,
    versionId: version.version_id,
    versionNumber: version.version_number,
    versionStatus: version.status,
    reportedScreens: crawl.reportedCount,
    accessibleScreens: crawl.captures.length,
    storedScreens: version.screens,
    fullReferoCoverage: crawl.complete,
    pagesFetched: crawl.pagesFetched,
    uploadedObjects: uploaded,
    attachedObjects: version.attached_objects,
    attachedThumbnails: version.attached_thumbnails,
  }));
} finally {
  await closePool();
}
