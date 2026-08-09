import { createHash } from "node:crypto";
import { chromium } from "playwright";
import sharp from "sharp";
import {
  googlePlayListing,
  googlePlayPhoneScreenshots,
  type GooglePlayScreenshot,
} from "../src/googlePlayImport.ts";
import { closePool, pool } from "../src/db.ts";
import { generateThumbnail } from "../src/imageThumbnail.ts";
import { attachThumbnailObject, replaceImageObject } from "../src/objectStoreDb.ts";
import { createObjectStore, objectStoreConfigFromEnvironment } from "../src/objectStoreConfig.ts";
import {
  imageObjectKey,
  thumbnailObjectKey,
  type ObjectMetadata,
  type StoredContentType,
} from "../src/objectStore.ts";

function option(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function positiveInteger(value: string | null, name: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function imageType(body: Buffer): { extension: "png" | "jpg" | "webp"; contentType: StoredContentType } {
  if (body.length >= 8 && body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { extension: "png", contentType: "image/png" };
  }
  if (body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) {
    return { extension: "jpg", contentType: "image/jpeg" };
  }
  if (body.length >= 12 && body.subarray(0, 4).toString("ascii") === "RIFF"
    && body.subarray(8, 12).toString("ascii") === "WEBP") {
    return { extension: "webp", contentType: "image/webp" };
  }
  throw new Error("Google Play returned unsupported image bytes");
}

const app = option("--app")?.trim();
const listingValue = option("--listing")?.trim();
const versionId = positiveInteger(option("--version-id"), "--version-id");
const maxScreens = option("--max-screens") === null
  ? Number.MAX_SAFE_INTEGER
  : positiveInteger(option("--max-screens"), "--max-screens");
const expectedScreens = option("--expected-screens");
const expectedCount = expectedScreens === null
  ? null
  : positiveInteger(expectedScreens, "--expected-screens");
const apply = process.argv.includes("--apply");

if (!app) throw new Error("--app is required");
if (!listingValue) throw new Error("--listing is required");
const listing = googlePlayListing(listingValue);
const sourcePrefix = `google-play:${listing.packageId}:`;
const sourceId = (index: number) => `${sourcePrefix}${index}`;

async function browseScreenshotShelf(url: string): Promise<GooglePlayScreenshot[]> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ locale: "en-US", viewport: { width: 1_440, height: 1_200 } });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    const screenshots = page.locator('img[alt="Screenshot image"]');
    await screenshots.first().waitFor({ state: "attached", timeout: 20_000 });
    const count = await screenshots.count();
    for (let index = 0; index < count; index += 1) {
      await screenshots.nth(index).scrollIntoViewIfNeeded();
    }
    await page.waitForTimeout(500);
    const rendered = await screenshots.evaluateAll((images) => images.map((image) => {
      const element = image as HTMLImageElement;
      return {
        url: element.currentSrc || element.src,
        width: element.naturalWidth,
        height: element.naturalHeight,
      };
    }));
    return googlePlayPhoneScreenshots(rendered);
  } finally {
    await browser.close();
  }
}

async function fetchBytes(url: string): Promise<{ body: Buffer; type: ReturnType<typeof imageType> }> {
  const response = await fetch(url, { headers: { Accept: "image/webp,image/jpeg,image/png,image/*;q=0.8" } });
  if (!response.ok) throw new Error(`Google Play image download failed (${response.status})`);
  const body = Buffer.from(await response.arrayBuffer());
  if (body.byteLength === 0 || body.byteLength > 64 * 1024 * 1024) {
    throw new Error("Google Play image size is invalid");
  }
  return { body, type: imageType(body) };
}

async function ensureTargetVersion(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const target = await client.query<{ app: string; platform: string; status: string }>(
      `SELECT a.name AS app, av.platform, av.status
       FROM app_versions av JOIN apps a ON a.id = av.app_id
       WHERE av.id = $1 FOR UPDATE`,
      [versionId],
    );
    const version = target.rows[0];
    if (!version || version.app !== app || version.platform !== "android") {
      throw new Error(`Version ${versionId} is not the Android version for ${app}`);
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

async function upsertImage(index: number, sourceUrl: string, width: number, height: number): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const image = await client.query<{ id: number }>(
      `INSERT INTO images (platform_id, image_url, kind)
       SELECT p.id, $3, 'screen' FROM platforms p
       JOIN apps a ON a.id = p.app_id
       WHERE a.name = $1 AND p.name = $2
       ON CONFLICT (platform_id, image_url) DO UPDATE SET
         kind = EXCLUDED.kind, created_at = EXCLUDED.created_at
       RETURNING id`,
      [app, "android", sourceId(index)],
    );
    const imageId = image.rows[0]?.id;
    if (!imageId) throw new Error("Unable to establish Google Play screenshot image");
    await client.query(
      `INSERT INTO version_images (version_id, image_id, source_url, viewport_width, viewport_height, state_context)
       VALUES ($1, $2, $3, $4, $5, 'google-play-listing')
       ON CONFLICT (version_id, image_id) DO UPDATE SET
         source_url = EXCLUDED.source_url,
         viewport_width = EXCLUDED.viewport_width,
         viewport_height = EXCLUDED.viewport_height,
         state_context = EXCLUDED.state_context,
         captured_at = EXCLUDED.captured_at`,
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

async function removeStaleScreenshots(screenshots: GooglePlayScreenshot[]): Promise<void> {
  const expected = screenshots.map(({ index }) => sourceId(index));
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `DELETE FROM version_images vi USING images i
       WHERE vi.version_id = $1 AND vi.image_id = i.id
         AND i.image_url LIKE $2 AND i.image_url <> ALL($3::text[])`,
      [versionId, `${sourcePrefix}%`, expected],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function replaceAppCardPreview(imageIds: number[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM app_preview_images WHERE version_id = $1", [versionId]);
    await client.query(
      `INSERT INTO app_preview_images (version_id, image_id, rank)
       SELECT $1, selected.image_id, selected.rank::smallint
       FROM UNNEST($2::integer[]) WITH ORDINALITY AS selected(image_id, rank)`,
      [versionId, imageIds.slice(0, 3)],
    );
    await client.query("COMMIT");
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
      `UPDATE app_versions SET source_url = $2,
         screen_count = (SELECT COUNT(*)::int FROM version_images vi
           JOIN images i ON i.id = vi.image_id
           WHERE vi.version_id = app_versions.id AND i.kind = 'screen')
       WHERE id = $1`,
      [versionId, listing.url],
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

const screenshots = (await browseScreenshotShelf(listing.url)).slice(0, maxScreens);
if (expectedCount !== null && screenshots.length !== expectedCount) {
  throw new Error(`Expected ${expectedCount} Google Play screenshots; found ${screenshots.length}`);
}
if (screenshots.length === 0) throw new Error("Google Play listing did not contain any screenshots");
console.log(JSON.stringify({
  status: "discovered", app, packageId: listing.packageId, versionId,
  listingUrl: listing.url, screenshots: screenshots.map(({ index }) => ({ index })),
}));

if (!apply) {
  console.log(JSON.stringify({ status: "dry-run", message: "Re-run with --apply to import media into the existing Android version." }));
  await closePool();
  process.exit(0);
}

await ensureTargetVersion();
const store = createObjectStore(objectStoreConfigFromEnvironment(process.env));
const importedImageIds: number[] = [];
let uploaded = 0;
try {
  for (const screenshot of screenshots) {
    const { body, type } = await fetchBytes(screenshot.url);
    const dimensions = await sharp(body).metadata();
    if (!dimensions.width || !dimensions.height) {
      throw new Error(`Google Play screenshot ${screenshot.index} dimensions could not be read`);
    }
    const imageId = await upsertImage(screenshot.index, screenshot.url, dimensions.width, dimensions.height);
    importedImageIds.push(imageId);
    const sha256 = createHash("sha256").update(body).digest("hex");
    const metadata: ObjectMetadata = {
      key: imageObjectKey(imageId, sha256, type.extension),
      sha256,
      byteSize: body.byteLength,
      contentType: type.contentType,
      accessClass: "protected",
    };
    const stored = await store.put({ ...metadata, body });
    const client = await pool.connect();
    try {
      await replaceImageObject(client, { imageId, metadata: stored.metadata });
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
      await attachThumbnailObject(client, { imageId, metadata: storedThumbnail.metadata });
    } finally {
      client.release();
    }
    uploaded += stored.created ? 1 : 0;
    console.log(`Imported ${screenshot.index}/${screenshots.length}: image ${imageId}`);
  }
  await removeStaleScreenshots(screenshots);
  await replaceAppCardPreview(importedImageIds);
  await refreshTargetVersion();
  const verification = await pool.query<{
    version_id: number; status: string; source_url: string; screens: number;
    objects: number; thumbnails: number; previews: number; manual_previews: number;
  }>(
    `SELECT av.id AS version_id, av.status, av.source_url,
       COUNT(vi.image_id) FILTER (WHERE i.image_url LIKE $2)::int AS screens,
       COUNT(i.object_key) FILTER (WHERE i.image_url LIKE $2)::int AS objects,
       COUNT(i.thumbnail_object_key) FILTER (WHERE i.image_url LIKE $2)::int AS thumbnails,
       COUNT(assignment.image_id) FILTER (WHERE i.image_url LIKE $2 AND pattern.slug = 'preview')::int AS previews,
       COUNT(manual.image_id) FILTER (WHERE i.image_url LIKE $2)::int AS manual_previews
     FROM app_versions av
     JOIN version_images vi ON vi.version_id = av.id
     JOIN images i ON i.id = vi.image_id AND i.kind = 'screen'
     LEFT JOIN screen_pattern_assignments assignment ON assignment.image_id = i.id
     LEFT JOIN screen_patterns pattern ON pattern.id = assignment.screen_pattern_id
     LEFT JOIN app_preview_images manual ON manual.version_id = av.id AND manual.image_id = i.id
     WHERE av.id = $1 GROUP BY av.id, av.status, av.source_url`,
    [versionId, `${sourcePrefix}%`],
  );
  const result = verification.rows[0];
  if (!result || result.source_url !== listing.url || result.screens !== screenshots.length
    || result.objects !== screenshots.length || result.thumbnails !== screenshots.length
    || result.previews !== screenshots.length
    || result.manual_previews !== Math.min(3, screenshots.length)) {
    throw new Error("Google Play import verification failed");
  }
  console.log(JSON.stringify({
    status: "ok", app, packageId: listing.packageId, versionId,
    versionStatus: result.status, screenshots: result.screens,
    uploadedObjects: uploaded, previewAssignments: result.previews,
    appCardPreviews: result.manual_previews,
  }));
} finally {
  await closePool();
}
