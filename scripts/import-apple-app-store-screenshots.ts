import { createHash } from "node:crypto";
import sharp from "sharp";
import { appleAppStoreScreenshots } from "../src/appleAppStoreImport.ts";
import { closePool, pool } from "../src/db.ts";
import { generateThumbnail } from "../src/imageThumbnail.ts";
import { attachImageObject, attachThumbnailObject } from "../src/objectStoreDb.ts";
import { createObjectStore, objectStoreConfigFromEnvironment } from "../src/objectStoreConfig.ts";
import { imageObjectKey, thumbnailObjectKey, type ObjectMetadata } from "../src/objectStore.ts";

function option(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function positiveInteger(value: string | null, name: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

const app = option("--app");
const listing = option("--listing");
const versionId = positiveInteger(option("--version-id"), "--version-id");
const maxScreens = positiveInteger(option("--max-screens") ?? "5", "--max-screens");
const expectedScreens = option("--expected-screens");
const apply = process.argv.includes("--apply");

if (!app?.trim()) throw new Error("--app is required");
if (!listing?.trim()) throw new Error("--listing is required");

const parsedListing = new URL(listing);
if (parsedListing.protocol !== "https:" || parsedListing.hostname !== "apps.apple.com") {
  throw new Error("--listing must be an official https://apps.apple.com URL");
}
const appStoreId = parsedListing.pathname.match(/\/id(\d+)$/)?.[1];
if (!appStoreId) throw new Error("--listing must end with an Apple App Store id");
const listingUrl = `${parsedListing.origin}${parsedListing.pathname}`;
const expectedCount = expectedScreens === null
  ? null
  : positiveInteger(expectedScreens, "--expected-screens");

async function fetchBytes(url: string): Promise<Buffer> {
  const response = await fetch(url, { headers: { Accept: "image/webp,image/*;q=0.8" } });
  if (!response.ok) throw new Error(`Apple image download failed (${response.status})`);
  const body = Buffer.from(await response.arrayBuffer());
  if (body.byteLength === 0 || body.byteLength > 64 * 1024 * 1024) throw new Error("Apple image size is invalid");
  if (response.headers.get("content-type")?.split(";", 1)[0] !== "image/webp") {
    throw new Error(`Apple returned unexpected image content type (${response.headers.get("content-type") ?? "missing"})`);
  }
  return body;
}

async function ensureTargetVersion(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const target = await client.query<{
      app: string;
      platform: string;
      status: string;
    }>(
      `SELECT a.name AS app, av.platform, av.status
       FROM app_versions av
       JOIN apps a ON a.id = av.app_id
       WHERE av.id = $1
       FOR UPDATE`,
      [versionId],
    );
    const version = target.rows[0];
    if (!version || version.app !== app || version.platform !== "ios") {
      throw new Error(`Version ${versionId} is not the iOS version for ${app}`);
    }
    if (!["draft", "in_review", "published"].includes(version.status)) {
      throw new Error(`Version ${versionId} cannot accept screenshots while ${version.status}`);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function upsertImage(
  index: number,
  sourceUrl: string,
  width: number,
  height: number,
): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const image = await client.query<{ id: number }>(
      `INSERT INTO images (platform_id, image_url, kind)
       SELECT p.id, $3, 'screen'
       FROM platforms p
       JOIN apps a ON a.id = p.app_id
       WHERE a.name = $1 AND p.name = $2
       ON CONFLICT (platform_id, image_url) DO UPDATE SET kind = EXCLUDED.kind
       RETURNING id`,
      [app, "ios", `apple-store:${appStoreId}:${index}`],
    );
    const imageId = image.rows[0]?.id;
    if (!imageId) throw new Error("Unable to establish Apple screenshot image");
    await client.query(
      `INSERT INTO version_images (version_id, image_id, source_url, viewport_width, viewport_height, state_context)
       VALUES ($1, $2, $3, $4, $5, 'app-store-listing')
       ON CONFLICT (version_id, image_id) DO UPDATE SET
         source_url = EXCLUDED.source_url,
         viewport_width = EXCLUDED.viewport_width,
         viewport_height = EXCLUDED.viewport_height,
         state_context = EXCLUDED.state_context`,
      [versionId, imageId, sourceUrl, width, height],
    );
    await client.query(
      `INSERT INTO screen_pattern_assignments (image_id, screen_pattern_id, source, confidence)
       SELECT $1, id, 'imported', 1 FROM screen_patterns WHERE slug = 'preview'
       ON CONFLICT (image_id, screen_pattern_id) DO UPDATE SET
         source = CASE WHEN screen_pattern_assignments.source = 'manual'
           THEN screen_pattern_assignments.source ELSE EXCLUDED.source END,
         confidence = CASE WHEN screen_pattern_assignments.source = 'manual'
           THEN screen_pattern_assignments.confidence ELSE EXCLUDED.confidence END,
         updated_at = now()`,
      [imageId],
    );
    await client.query("COMMIT");
    return imageId;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function refreshTargetVersion(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE app_versions
       SET screen_count = (
         SELECT COUNT(*)::int
         FROM version_images vi
         JOIN images i ON i.id = vi.image_id
         WHERE vi.version_id = app_versions.id AND i.kind = 'screen'
       )
       WHERE id = $1`,
      [versionId],
    );
    await client.query("SELECT refresh_screen_pattern_previews($1)", [versionId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

const page = await fetch(listingUrl, { headers: { Accept: "text/html" } });
if (!page.ok) throw new Error(`Apple listing request failed (${page.status})`);
const screenshots = appleAppStoreScreenshots(await page.text(), expectedCount).slice(0, maxScreens);
if (screenshots.length === 0) throw new Error("Apple listing did not contain any static screenshots");
console.log(JSON.stringify({
  status: "discovered",
  app,
  appStoreId,
  versionId,
  listingUrl,
  screenshots: screenshots.map(({ index, width, height }) => ({ index, width, height })),
}));

if (!apply) {
  console.log(JSON.stringify({ status: "dry-run", message: "Re-run with --apply to import media into the specified existing version." }));
  await closePool();
  process.exit(0);
}

await ensureTargetVersion();
const store = createObjectStore(objectStoreConfigFromEnvironment(process.env));
let uploaded = 0;
try {
  for (const screenshot of screenshots) {
    const body = await fetchBytes(screenshot.url);
    const dimensions = await sharp(body).metadata();
    if (!dimensions.width || !dimensions.height) {
      throw new Error(`Apple screenshot ${screenshot.index} dimensions could not be read`);
    }
    const imageId = await upsertImage(
      screenshot.index,
      screenshot.url,
      dimensions.width,
      dimensions.height,
    );
    const sha256 = createHash("sha256").update(body).digest("hex");
    const object: ObjectMetadata = {
      key: imageObjectKey(imageId, sha256, "webp"), sha256, byteSize: body.byteLength,
      contentType: "image/webp", accessClass: "protected",
    };
    const stored = await store.put({ ...object, body });
    const client = await pool.connect();
    try {
      await attachImageObject(client, { imageId, metadata: stored.metadata });
      const thumbnail = await generateThumbnail(body);
      const thumbnailSha256 = createHash("sha256").update(thumbnail).digest("hex");
      const thumbnailMetadata: ObjectMetadata = {
        key: thumbnailObjectKey(imageId, thumbnailSha256), sha256: thumbnailSha256, byteSize: thumbnail.byteLength,
        contentType: "image/jpeg", accessClass: "protected",
      };
      const storedThumbnail = await store.put({ ...thumbnailMetadata, body: thumbnail });
      await attachThumbnailObject(client, { imageId, metadata: storedThumbnail.metadata });
    } finally {
      client.release();
    }
    uploaded += stored.created ? 1 : 0;
    console.log(`Imported ${screenshot.index}/${screenshots.length}: image ${imageId}`);
  }
  await refreshTargetVersion();
  const verification = await pool.query<{
    version_id: number;
    status: string;
    screens: number;
    objects: number;
    thumbnails: number;
    previews: number;
  }>(
    `SELECT av.id AS version_id, av.status,
       COUNT(vi.image_id) FILTER (WHERE i.image_url LIKE $2)::int AS screens,
       COUNT(i.object_key) FILTER (WHERE i.image_url LIKE $2)::int AS objects,
       COUNT(i.thumbnail_object_key) FILTER (WHERE i.image_url LIKE $2)::int AS thumbnails,
       COUNT(assignment.image_id) FILTER (WHERE i.image_url LIKE $2 AND pattern.slug = 'preview')::int AS previews
     FROM app_versions av
     JOIN version_images vi ON vi.version_id = av.id
     JOIN images i ON i.id = vi.image_id AND i.kind = 'screen'
     LEFT JOIN screen_pattern_assignments assignment ON assignment.image_id = i.id
     LEFT JOIN screen_patterns pattern ON pattern.id = assignment.screen_pattern_id
     WHERE av.id = $1
     GROUP BY av.id, av.status`,
    [versionId, `apple-store:${appStoreId}:%`],
  );
  const result = verification.rows[0];
  if (!result || result.screens !== screenshots.length
    || result.objects !== screenshots.length || result.thumbnails !== screenshots.length
    || result.previews !== screenshots.length) {
    throw new Error("Apple import verification failed");
  }
  console.log(JSON.stringify({
    status: "ok",
    app,
    versionId,
    versionStatus: result.status,
    screenshots: result.screens,
    uploadedObjects: uploaded,
    previewAssignments: result.previews,
  }));
} finally {
  await closePool();
}
