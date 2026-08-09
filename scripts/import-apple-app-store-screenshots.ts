import { createHash } from "node:crypto";
import { chromium } from "playwright";
import sharp from "sharp";
import {
  appleAppStoreLookupScreenshots,
  appleAppStoreScreenshots,
  completeAppleAppStoreScreenshots,
} from "../src/appleAppStoreImport.ts";
import { closePool, pool } from "../src/db.ts";
import { generateThumbnail } from "../src/imageThumbnail.ts";
import { attachThumbnailObject, replaceImageObject } from "../src/objectStoreDb.ts";
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
const maxScreens = option("--max-screens") === null
  ? Number.MAX_SAFE_INTEGER
  : positiveInteger(option("--max-screens"), "--max-screens");
const expectedScreens = option("--expected-screens");
const device = option("--device") ?? "iphone";
const screenshotSource = option("--screenshot-source") ?? "live";
const apply = process.argv.includes("--apply");

if (!app?.trim()) throw new Error("--app is required");
if (!listing?.trim()) throw new Error("--listing is required");
if (device !== "iphone" && device !== "ipad") throw new Error("--device must be iphone or ipad");
if (screenshotSource !== "live" && screenshotSource !== "lookup") {
  throw new Error("--screenshot-source must be live or lookup");
}

const parsedListing = new URL(listing);
if (parsedListing.protocol !== "https:" || parsedListing.hostname !== "apps.apple.com") {
  throw new Error("--listing must be an official https://apps.apple.com URL");
}
const appStoreId = parsedListing.pathname.match(/\/id(\d+)$/)?.[1];
if (!appStoreId) throw new Error("--listing must end with an Apple App Store id");
const listingUrl = `${parsedListing.origin}${parsedListing.pathname}`;
const sourceListing = new URL(listingUrl);
const locale = parsedListing.searchParams.get("l");
if (locale) sourceListing.searchParams.set("l", locale);
const sourceListingUrl = sourceListing.toString();
const expectedCount = expectedScreens === null
  ? null
  : positiveInteger(expectedScreens, "--expected-screens");
const sourcePrefix = device === "iphone"
  ? `apple-store:${appStoreId}:`
  : `apple-store:${appStoreId}:ipad:`;
const sourceId = (index: number) => `${sourcePrefix}${index}`;

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

async function browseScreenshotShelf(
  url: string,
  targetDevice: "iphone" | "ipad",
): Promise<ReturnType<typeof appleAppStoreScreenshots>> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      locale: "en-GB",
      viewport: { width: 1_280, height: 844 },
    });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    const deviceLabel = targetDevice === "iphone" ? "iPhone" : "iPad";
    const shelf = page.locator(
      `section[aria-label^="${deviceLabel}"][aria-label*="Screenshots"]`,
    ).first();
    await shelf.waitFor({ state: "attached", timeout: 15_000 });

    const urls = new Set<string>();
    let reachedEnd = false;
    for (let pageNumber = 0; pageNumber < 20; pageNumber += 1) {
      const srcsets = await shelf.locator("source[srcset]").evaluateAll(
        (sources) => sources.map((source) => source.getAttribute("srcset") ?? ""),
      );
      for (const screenshot of appleAppStoreScreenshots(srcsets.join(" "), null)) {
        urls.add(screenshot.url);
      }

      const next = shelf.getByRole("button", { name: "Next Page" });
      if (await next.count() === 0 || !await next.isEnabled()) {
        reachedEnd = true;
        break;
      }
      try {
        await next.click({ timeout: 5_000 });
      } catch (error) {
        // Apple disables the control as the final shelf page settles. The
        // click may already have advanced the carousel before Playwright's
        // stability check completes, so treat that disabled state as EOF.
        if (!await next.isEnabled()) {
          reachedEnd = true;
          break;
        }
        throw error;
      }
      // Apple virtualizes this shelf after its slide animation. A stable desktop
      // viewport plus the animation delay prevents intermediate items from
      // being skipped while the carousel swaps its mounted source elements.
      await page.waitForTimeout(750);
    }
    if (!reachedEnd) throw new Error(`Apple ${targetDevice} screenshot shelf did not reach its final page`);

    return [...urls].map((screenshotUrl, index) => ({
      index: index + 1,
      url: screenshotUrl,
      width: 600,
      height: 1300,
    }));
  } finally {
    await browser.close();
  }
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
       ON CONFLICT (platform_id, image_url) DO UPDATE SET
         kind = EXCLUDED.kind,
         created_at = EXCLUDED.created_at
       RETURNING id`,
      [app, "ios", sourceId(index)],
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

async function refreshTargetVersion(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE app_versions
       SET source_url = $2,
         screen_count = (
         SELECT COUNT(*)::int
         FROM version_images vi
         JOIN images i ON i.id = vi.image_id
         WHERE vi.version_id = app_versions.id AND i.kind = 'screen'
       )
       WHERE id = $1`,
      [versionId, sourceListingUrl],
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

async function removeStaleAppleScreenshots(screenshots: Array<{ index: number }>): Promise<void> {
  const expected = screenshots.map(({ index }) => sourceId(index));
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `DELETE FROM app_preview_images preview
       USING images i
       WHERE preview.version_id = $1
         AND preview.image_id = i.id
         AND i.image_url LIKE $2
         AND i.image_url <> ALL($3::text[])`,
      [versionId, `${sourcePrefix}%`, expected],
    );
    await client.query(
      `DELETE FROM version_images vi
       USING images i
       WHERE vi.version_id = $1
         AND vi.image_id = i.id
         AND i.image_url LIKE $2
         AND i.image_url <> ALL($3::text[])`,
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

const page = await fetch(listingUrl, { headers: { Accept: "text/html" } });
if (!page.ok) throw new Error(`Apple listing request failed (${page.status})`);
const pageScreenshots = device === "iphone"
  ? appleAppStoreScreenshots(await page.text(), null)
  : [];
const lookup = new URL("https://itunes.apple.com/lookup");
const country = parsedListing.pathname.split("/")[1] || "us";
lookup.search = new URLSearchParams({ id: appStoreId, country, entity: "software" }).toString();
const lookupResponse = await fetch(lookup, { headers: { Accept: "application/json" } });
const lookupScreenshots = lookupResponse.ok
  ? appleAppStoreLookupScreenshots(await lookupResponse.json(), device)
  : [];
const browsedScreenshots = screenshotSource === "live"
  ? await browseScreenshotShelf(listingUrl, device)
  : [];
// The rendered, paginated App Store shelf is the visual source of truth. Static
// HTML and Lookup are guarded fallbacks for listings that cannot be browsed.
const discovered = screenshotSource === "lookup"
  ? lookupScreenshots
  : browsedScreenshots.length
  ? browsedScreenshots
  : device === "iphone" && pageScreenshots.length
  ? completeAppleAppStoreScreenshots(pageScreenshots, lookupScreenshots)
  : lookupScreenshots;
const screenshots = discovered.slice(0, maxScreens);
if (expectedCount !== null && screenshots.length !== expectedCount) {
  throw new Error(`Expected ${expectedCount} Apple ${device} screenshots; found ${screenshots.length}`);
}
if (screenshots.length === 0) throw new Error("Apple listing did not contain any static screenshots");
console.log(JSON.stringify({
  status: "discovered",
  app,
  appStoreId,
  device,
  screenshotSource,
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
const importedImageIds: number[] = [];
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
    importedImageIds.push(imageId);
    const sha256 = createHash("sha256").update(body).digest("hex");
    const object: ObjectMetadata = {
      key: imageObjectKey(imageId, sha256, "webp"), sha256, byteSize: body.byteLength,
      contentType: "image/webp", accessClass: "protected",
    };
    const stored = await store.put({ ...object, body });
    const client = await pool.connect();
    try {
      await replaceImageObject(client, { imageId, metadata: stored.metadata });
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
  await removeStaleAppleScreenshots(screenshots);
  await replaceAppCardPreview(importedImageIds);
  await refreshTargetVersion();
  const verification = await pool.query<{
    version_id: number;
    status: string;
    screens: number;
    objects: number;
    thumbnails: number;
    previews: number;
    manual_previews: number;
  }>(
    `SELECT av.id AS version_id, av.status,
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
     LEFT JOIN app_preview_images manual
       ON manual.version_id = av.id AND manual.image_id = i.id
     WHERE av.id = $1
     GROUP BY av.id, av.status`,
    [versionId, `${sourcePrefix}%`],
  );
  const result = verification.rows[0];
  if (!result || result.screens !== screenshots.length
    || result.objects !== screenshots.length || result.thumbnails !== screenshots.length
    || result.previews !== screenshots.length
    || result.manual_previews !== Math.min(3, screenshots.length)) {
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
    appCardPreviews: result.manual_previews,
  }));
} finally {
  await closePool();
}
