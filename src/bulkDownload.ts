import { type Page, type Download, type Locator } from "playwright";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { getAppFlows, insertImage, saveAppFlows, setAppMeta, type ImageKind } from "./db.ts";
import type { DesignFlow } from "./designSystem.ts";
import { clearCancel, isCancelRequested, writeProgress, type StageOutcome } from "./progress.ts";
import { waitUntilVisible, getExpectedAlt, launchMobbinContext } from "./crawler.ts";
import { platformFromUrl, type Platform } from "./platformFromUrl.ts";
import { imageObjectKey, thumbnailObjectKey, type ObjectMetadata, type ObjectStore, type StoredContentType } from "./objectStore.ts";
import { stripMobbinWatermark } from "./mobbinWatermark.ts";
import { generateThumbnail } from "./imageThumbnail.ts";

const LOGIN_WAIT_MS = 30 * 60_000; // time to log in manually in the opened window
const SCROLL_STEP = 500;
const SCROLL_DELAY_MS = 400;
const MAX_SCROLL_ITERATIONS = 500; // ponytail: hard cap so a page with truly infinite scroll can't hang forever
const STABLE_AT_BOTTOM_STREAK = 6;
const DOWNLOAD_WAIT_MS = 5 * 60_000;
const DOWNLOAD_QUIET_MS = 500; // settle time after the first download to catch multi-file exports

export type BulkTab = "screens" | "ui-elements";

// Mobbin app URLs end in the tab segment (".../apps/<slug>/<versionId>/screens") — swap it
// so callers can keep passing the screens URL they already have for every crawl type.
export function tabUrl(appUrl: string, tab: BulkTab | "flows"): string {
  const url = new URL(appUrl);
  const parts = url.pathname.split("/").filter(Boolean);
  if (["screens", "ui-elements", "flows"].includes(parts[parts.length - 1])) parts[parts.length - 1] = tab;
  else parts.push(tab);
  url.pathname = `/${parts.join("/")}`;
  return url.toString();
}

// Newest flow definition wins on id collision; everything else is kept.
export function mergeFlows(existing: DesignFlow[], incoming: DesignFlow[]): DesignFlow[] {
  const byId = new Map(existing.map((flow) => [flow.id, flow]));
  for (const flow of incoming) byId.set(flow.id, flow);
  return [...byId.values()];
}

// Runs entirely as discrete Playwright evaluate() calls, one per scroll step — NOT one big
// injected JS loop. That distinction matters: driving this same interaction through the
// Chrome extension's CDP-instrumented tab caused click-triggered re-renders to degrade
// severely (sub-second early on, 40+ seconds per click by ~100 selections). Plain
// Playwright automation (this file) doesn't carry that instrumentation overhead.
//
// Works for both the Screens and UI Elements tabs — same grid markup, same hidden
// aria-pressed checkbox per card, and element cards still link to /screens/. Cards are
// matched by alt-text *prefix* (the app's display name) because screens are titled
// "<App> screen" while element crops vary — the prefix still excludes the "More like
// <other app>" recommendation carousel.
async function selectAllOwnCards(page: Page, appAltPrefix: string): Promise<{ clicked: number; skipped: number }> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);

  let totalClicked = 0;
  let totalSkipped = 0;
  let stableAtBottom = 0;
  for (let i = 0; i < MAX_SCROLL_ITERATIONS && stableAtBottom < STABLE_AT_BOTTOM_STREAK; i++) {
    const { clicked, skipped } = await page.evaluate((prefix) => {
      // Only grids that actually hold screen links — excludes the unrelated "similar apps"
      // icon carousel, which uses the same "content-start" class but no /screens/ hrefs.
      const grids = Array.from(document.querySelectorAll("div.grid")).filter(
        (g) => g.className.includes("content-start") && g.querySelectorAll('a[href*="/screens/"]').length > 0
      );
      let clicked = 0;
      let skipped = 0;
      for (const g of grids) {
        for (const a of Array.from(g.querySelectorAll('a[href*="/screens/"]'))) {
          const cardAlt = (a.querySelector("img")?.getAttribute("alt") || "").toLowerCase();
          const checkbox = a.parentElement?.querySelector('button[aria-pressed="false"]') as HTMLButtonElement | null;
          if (!checkbox) continue;
          if (!cardAlt.startsWith(prefix)) {
            skipped++;
            continue;
          }
          checkbox.click();
          clicked++;
        }
      }
      return { clicked, skipped };
    }, appAltPrefix);
    totalClicked += clicked;
    totalSkipped += skipped;

    const atBottom = await page.evaluate(
      () => window.scrollY + window.innerHeight >= document.body.scrollHeight - 300
    );
    stableAtBottom = atBottom ? stableAtBottom + 1 : 0;

    await page.evaluate((step) => window.scrollBy(0, step), SCROLL_STEP);
    await page.waitForTimeout(SCROLL_DELAY_MS);
  }
  return { clicked: totalClicked, skipped: totalSkipped };
}

// The bottom toolbar shows a running "N selected" label — the app's own count of what is
// actually selected, which survives virtualization (unlike the DOM).
async function toolbarSelectedCount(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const match = document.body.innerText.match(/(\d[\d,]*)\s+selected/i);
    return match ? Number(match[1].replace(/,/g, "")) : null;
  });
}

// The Screens tab and individual flow pages expose "Download all screens" directly; the
// UI Elements tab only has the bottom-toolbar Download button that appears once cards are
// selected. Some pages tuck the action behind a "..." overflow menu — try that last.
async function clickDownloadControl(page: Page): Promise<boolean> {
  for (const selector of ['[aria-label="Download all screens"]', 'button[aria-label="Download"]']) {
    const control = page.locator(selector);
    if ((await control.count()) > 0) {
      await control.first().click();
      return true;
    }
  }
  for (const button of await page.locator('button[aria-haspopup="menu"]').all()) {
    await button.click().catch(() => {});
    await page.waitForTimeout(300);
    const item = page.getByRole("menuitem", { name: /download all screens/i });
    if ((await item.count()) > 0) {
      await item.first().click();
      return true;
    }
    await page.keyboard.press("Escape");
  }
  return false;
}

// Screens tab: Mobbin's app-level "Download all screens" lives in the "..." (More actions)
// menu and grabs every screen with no per-card selection — the direct toolbar button is
// disabled until cards are selected, so we go straight through the menu here. The menu item
// itself is a submenu trigger (not a direct action) — hovering it opens a version submenu
// whose first option is the latest version, which is what actually starts the download.
// Individual flow rows on the Flows tab expose the identical "More actions" menu — the
// `more` param lets callers scope it to a specific row instead of the page-level toolbar.
async function clickDownloadAllMenu(page: Page, more: Locator = page.locator('button[aria-label="More actions"]').first()): Promise<boolean> {
  // Backgrounded/unfocused tabs can throttle the hover-triggered submenu's render,
  // so the version flyout below may not mount in time — force focus first.
  await page.bringToFront();
  if ((await more.count()) === 0) return false;
  await more.click();
  const item = page.getByRole("menuitem", { name: /download all screens/i });
  await item.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  if ((await item.count()) === 0) return false;
  const menusBeforeHover = await page.getByRole("menu").count();
  await item.first().hover();
  // Wait for a genuinely NEW menu to mount before reading "the last one" — otherwise
  // a race can resolve to the still-open outer menu and click its first item
  // ("Visit ...") instead of the version submenu that hasn't rendered yet.
  await page.waitForFunction(
    (expected) => document.querySelectorAll('[role="menu"]').length > expected,
    menusBeforeHover,
    { timeout: 8000 },
  ).catch(() => {});
  const submenu = page.getByRole("menu").last();
  const latestVersion = submenu.getByRole("menuitem").first();
  // The submenu container can mount before its own content (Mobbin fetches the
  // version list async) — .count() is an instant snapshot with no retry, so it can
  // read 0 a moment before the item actually renders. waitFor() actually retries.
  // Observed under sustained load: the version list can sit on a "Loading..." placeholder
  // for several seconds before resolving — 9s gives it real room before we give up and
  // fall back to multi-select.
  await latestVersion.waitFor({ state: "visible", timeout: 9000 }).catch(() => {});
  if ((await latestVersion.count()) === 0) return false;
  await latestVersion.click();
  return true;
}

// The count Mobbin prints in the tab toolbar ("Showing N screens" / "… UI elements"),
// used to sanity-check a single-pass selection against the app's real total.
async function shownTotalCount(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const match = document.body.innerText.match(/Showing\s+([\d,]+)/i);
    return match ? Number(match[1].replace(/,/g, "")) : null;
  });
}

// Mobbin's export might come back as one zip, or as several individual file downloads —
// we don't assume which, we just collect every `download` event until they stop arriving.
async function triggerAndSaveDownloads(page: Page, dir: string, trigger: (p: Page) => Promise<boolean> = clickDownloadControl): Promise<string[]> {
  mkdirSync(dir, { recursive: true });
  const downloads: Download[] = [];
  const onDownload = (d: Download) => downloads.push(d);
  page.on("download", onDownload);
  try {
    if (!(await trigger(page))) return [];
    // Poll the listener-backed array rather than page.waitForEvent — the download can fire
    // in the gap between trigger() resolving and a fresh waitForEvent() call being armed,
    // which would miss it and wrongly report "no download started". The `downloads` array
    // is race-free since the listener above was attached before trigger() ran.
    let lastCount = -1;
    const deadline = Date.now() + DOWNLOAD_WAIT_MS;
    while (Date.now() < deadline) {
      await page.waitForTimeout(DOWNLOAD_QUIET_MS);
      if (downloads.length > 0 && downloads.length === lastCount) break;
      lastCount = downloads.length;
    }
    const saved: string[] = [];
    for (const download of downloads) {
      const path = `${dir}/${download.suggestedFilename()}`;
      await download.saveAs(path);
      saved.push(path);
    }
    return saved;
  } finally {
    page.off("download", onDownload);
  }
}

// ponytail: shells out to the system `unzip` (present on macOS/Linux by default) rather
// than adding a zip-parsing dependency for what's a one-line job.
function extractIfArchive(filePath: string, destDir: string): boolean {
  if (!filePath.toLowerCase().endsWith(".zip")) return false;
  mkdirSync(destDir, { recursive: true });
  execSync(`unzip -o ${JSON.stringify(filePath)} -d ${JSON.stringify(destDir)}`);
  return true;
}

// We don't know Mobbin's internal filenames for exported screens, so re-key everything by
// content hash (same scheme the earlier network-capture crawler used) — guarantees no
// collisions and makes re-running idempotent regardless of what the zip calls things.
// Entries are ingested in filename order (Mobbin numbers exported flow screens), so the
// returned image ids preserve step order for flow reconstruction.
export interface BulkObjectDependencies {
  objectStore: ObjectStore;
  insertImage: typeof insertImage;
  attachImage(imageId: number, metadata: ObjectMetadata): Promise<void>;
  attachThumbnail(imageId: number, metadata: ObjectMetadata): Promise<void>;
}

const IMAGE_TYPE: Record<string, { extension: "png" | "jpg" | "webp"; contentType: StoredContentType }> = {
  png: { extension: "png", contentType: "image/png" },
  jpg: { extension: "jpg", contentType: "image/jpeg" },
  jpeg: { extension: "jpg", contentType: "image/jpeg" },
  webp: { extension: "webp", contentType: "image/webp" },
};

function sameObjectMetadata(left: ObjectMetadata, right: ObjectMetadata): boolean {
  return left.key === right.key && left.sha256 === right.sha256 && left.byteSize === right.byteSize
    && left.contentType === right.contentType && left.accessClass === right.accessClass;
}

function hasExpectedImageSignature(body: Uint8Array, contentType: StoredContentType): boolean {
  if (contentType === "image/png") {
    return body.length >= 8 && Buffer.from(body.subarray(0, 8)).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (contentType === "image/jpeg") return body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff;
  return body.length >= 12
    && Buffer.from(body.subarray(0, 4)).toString("ascii") === "RIFF"
    && Buffer.from(body.subarray(8, 12)).toString("ascii") === "WEBP";
}

export async function ingestDownloadedImages(
  sourceDir: string,
  appName: string,
  platform: string,
  sourceUrl: string,
  viewport?: { width: number; height: number } | null,
  kind: ImageKind = "screen",
  dependencies?: BulkObjectDependencies,
): Promise<{ imported: number; imageIds: number[] }> {
  if (!dependencies) throw new Error("Object storage is required for bulk ingestion");
  let imported = 0;
  const imageIds: number[] = [];
  const entries = (existsSync(sourceDir) ? (readdirSync(sourceDir, { recursive: true }) as string[]) : [])
    .filter((rel) => /\.(png|jpe?g|webp)$/i.test(rel))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  for (const rel of entries) {
    const full = `${sourceDir}/${rel}`;
    // Mobbin's bottom watermark bar shows up on UI Element exports too (not just Screens/
    // flow steps — some "elements" are full-page captures, not cropped tiles). Strip
    // unconditionally; stripMobbinWatermark only crops when it actually detects the bar.
    const body = await stripMobbinWatermark(readFileSync(full));
    const sha256 = createHash("sha256").update(body).digest("hex");
    const legacyHash = sha256.slice(0, 16);
    const type = IMAGE_TYPE[rel.split(".").pop()?.toLowerCase() ?? ""];
    if (!type) throw new Error("Unsupported downloaded image type");
    if (!hasExpectedImageSignature(body, type.contentType)) {
      throw new Error(`Downloaded image content does not match ${type.contentType}: ${rel}`);
    }
    const imageId = await dependencies.insertImage(
      appName,
      platform,
      `mobbin-bulk:${legacyHash}`,
      { sourceUrl, viewportWidth: viewport?.width, viewportHeight: viewport?.height, kind },
    );
    const metadata: ObjectMetadata = {
      key: imageObjectKey(imageId, sha256, type.extension),
      sha256,
      byteSize: body.byteLength,
      contentType: type.contentType,
      accessClass: "protected",
    };
    const stored = await dependencies.objectStore.put({ ...metadata, body });
    if (!sameObjectMetadata(stored.metadata, metadata)) throw new Error("Uploaded bulk image metadata does not match the downloaded bytes");
    await dependencies.attachImage(imageId, metadata);
    // Best-effort: grid views fall back to the full-resolution image via COALESCE when no
    // thumbnail is attached, so a resize hiccup here must not fail the whole ingest.
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
      await dependencies.objectStore.put({ ...thumbnailMetadata, body: thumbnail });
      await dependencies.attachThumbnail(imageId, thumbnailMetadata);
    } catch (error) {
      console.warn(`[${appName}] Thumbnail generation failed for image ${imageId}: ${error}`);
    }
    if (stored.created) imported += 1;
    imageIds.push(imageId);
  }
  return { imported, imageIds };
}

// gridWaitMs defaults to the long login window (first crawl waits for a manual sign-in).
// A caller that has already established login (e.g. after the screens tab) passes a short
// timeout so a tab the app simply doesn't have fails fast instead of hanging 30 minutes.
export async function crawlBulkDownload(appUrl: string, appName: string, tab: BulkTab = "screens", gridWaitMs: number = LOGIN_WAIT_MS, storage?: BulkObjectDependencies, platformOverride?: Platform): Promise<StageOutcome> {
  clearCancel();
  const platform = platformOverride ?? platformFromUrl(appUrl);
  const kind: ImageKind = tab === "ui-elements" ? "ui_element" : "screen";
  const label = tab === "ui-elements" ? "UI elements" : "screens";
  const context = await launchMobbinContext();
  // A stale/restored tab left over from an earlier session can sit in the profile's
  // session-restore state — start from a genuinely fresh, focused page so the
  // hover-triggered download submenu below reliably renders (backgrounded/stale
  // tabs were observed to silently drop it).
  for (const stale of context.pages()) await stale.close().catch(() => {});
  const page = await context.newPage();
  await page.bringToFront();
  await page.goto(tabUrl(appUrl, tab), { waitUntil: "domcontentloaded" });
  try {
    await waitUntilVisible(page, 'a[href*="/screens/"]', gridWaitMs, `the ${label} grid`);
  } catch (error) {
    await context.close();
    return { status: "error", message: (error as Error).message };
  }

  // Best-effort app metadata from the Mobbin app page, persisted after the app row exists.
  //   icon:     the header <img> whose alt is the app name itself (screens are "<App> screen").
  //   category: Mobbin links the app's category (e.g. "Finance") to a category browse page.
  const pageMeta = await page.evaluate(() => {
    const app = (document.querySelector("h1")?.textContent ?? "").split(/[—-]/)[0].trim().toLowerCase();
    let iconUrl: string | null = null;
    if (app) {
      const icon = Array.from(document.querySelectorAll("img")).find((img) => {
        const alt = (img.getAttribute("alt") ?? "").trim().toLowerCase();
        return alt === app || (alt.startsWith(app) && !alt.includes("screen"));
      });
      iconUrl = icon ? icon.currentSrc || icon.src || null : null;
    }
    const catLink = Array.from(document.querySelectorAll("a")).find((a) => /categor/i.test(a.getAttribute("href") ?? ""));
    const category = catLink ? (catLink.textContent ?? "").trim() || null : null;
    return { iconUrl, category };
  }).catch(() => ({ iconUrl: null as string | null, category: null as string | null }));

  const cancelledOutcome = async (): Promise<StageOutcome> => {
    console.log(`[${appName}] Cancelled before download.`);
    writeProgress({ stage: "crawl", app: appName, done: 0, total: 0, status: "cancelled", message: "Cancelled by user" });
    await context.close();
    return { status: "cancelled", message: "Cancelled by user" };
  };

  const downloadDir = `data/downloads/${appName}`;

  // Multi-select + bottom-toolbar Download — the only path UI Elements ever had (no app-level
  // "download all" there), and a fallback for Screens when the More-actions version submenu
  // gets stuck (observed: Mobbin's version-list fetch can hang indefinitely under sustained
  // bulk-export load, independent of page/session health — the grid itself still loads fine).
  const selectAndDownloadAll = async (): Promise<string[]> => {
    const appAltPrefix = (await getExpectedAlt(page)).replace(/ screen$/, "");
    console.log(`[${appName}] Selecting every ${label} card (filtering to alt prefix "${appAltPrefix}")...`);
    writeProgress({ stage: "crawl", app: appName, done: 0, total: 0, status: "running", message: `Selecting ${label}` });

    const { clicked, skipped } = await selectAllOwnCards(page, appAltPrefix);
    const shown = await shownTotalCount(page);
    const selected = (await toolbarSelectedCount(page)) ?? clicked;
    console.log(`[${appName}] One pass: selected ${selected} of ${shown ?? "?"} ${label} (${skipped} filtered as other-app).`);
    if (shown != null && selected < shown) {
      console.warn(`[${appName}] One pass selected ${selected}/${shown} ${label} — some cards may have been missed.`);
    }

    if (isCancelRequested()) return [];
    console.log(`[${appName}] Triggering download for ${selected} selected ${label}...`);
    writeProgress({ stage: "crawl", app: appName, done: 0, total: selected, status: "running", message: "Downloading" });
    return triggerAndSaveDownloads(page, downloadDir);
  };

  let savedPaths: string[];

  if (tab === "screens") {
    // Screens: try the app-level "Download all screens" menu first — fast, no selection needed.
    if (isCancelRequested()) return cancelledOutcome();
    console.log(`[${appName}] Downloading all screens via the More actions menu...`);
    writeProgress({ stage: "crawl", app: appName, done: 0, total: 0, status: "running", message: "Downloading" });
    savedPaths = await triggerAndSaveDownloads(page, downloadDir, clickDownloadAllMenu);

    if (savedPaths.length === 0) {
      if (isCancelRequested()) return cancelledOutcome();
      console.warn(`[${appName}] Download-all menu produced nothing — falling back to multi-select.`);
      savedPaths = await selectAndDownloadAll();
    }
  } else {
    savedPaths = await selectAndDownloadAll();
  }

  if (savedPaths.length === 0) {
    console.warn(`[${appName}] No download started — check the download control selectors are still correct.`);
    writeProgress({ stage: "crawl", app: appName, done: 0, total: 0, status: "error", message: "No download started" });
    await context.close();
    return { status: "error", message: "No download started" };
  }

  const extractDir = `${downloadDir}/_extracted`;
  let imported = 0;
  for (const path of savedPaths) {
    const sourceDir = extractIfArchive(path, extractDir) ? extractDir : downloadDir;
    imported += (await ingestDownloadedImages(sourceDir, appName, platform, appUrl, page.viewportSize(), kind, storage)).imported;
  }

  rmSync(downloadDir, { recursive: true, force: true });
  if (imported > 0 && (pageMeta.iconUrl || pageMeta.category)) await setAppMeta(appName, pageMeta).catch(() => {});
  console.log(`[${appName}] Done. Imported ${imported} ${label} image(s) via bulk download.`);
  writeProgress({ stage: "crawl", app: appName, done: imported, total: imported, status: "done" });

  await context.close();
  return { status: "done" };
}

// Each flow renders inline on the Flows tab itself (no separate per-flow page needed) as a
// "group/cell" container with a screenshot filmstrip and its own hover-revealed Save/Copy/
// More actions row — identical menu to the Screens tab. One flow's filmstrip can carry
// several <a href="/flows/<id>"> anchors (one per thumbnail), all pointing at the same id.
function flowCellLocator(page: Page, flowId: string): Locator {
  return page.locator('[class*="group/cell"]').filter({ has: page.locator(`a[href*="/flows/${flowId}"]`) }).first();
}

// Scans the flow rows currently mounted in the DOM (virtualized — only a handful are ever
// mounted at once), deduped by id since a flow's filmstrip carries multiple matching anchors.
// Mobbin renders each row's heading as "<title> from <category>" (category omitted for
// top-level flows) — the title is its own bold span, and its parent holds the full text.
async function discoverFlowRows(page: Page): Promise<Array<{ id: string; title: string; category: string }>> {
  return page.evaluate(() => {
    const seen = new Map<string, { title: string; category: string }>();
    for (const a of Array.from(document.querySelectorAll('a[href*="/flows/"]'))) {
      const href = a.getAttribute("href") ?? "";
      if (href.endsWith("/flows")) continue;
      const id = href.split("/").filter(Boolean).pop() ?? "";
      if (!id || seen.has(id)) continue;
      const cell = a.closest('[class*="group/cell"]');
      const titleEl = cell?.querySelector(".text-body-bold.text-text-primary");
      const title = titleEl?.textContent?.trim() ?? "";
      const fullText = titleEl?.parentElement?.textContent?.trim() ?? title;
      const category = fullText.startsWith(title) ? fullText.slice(title.length).replace(/^\s*from\s*/i, "").trim() : "";
      seen.set(id, { title, category });
    }
    return [...seen.entries()].map(([id, { title, category }]) => ({ id, title: title || `Flow ${id}`, category }));
  });
}

// Reveals and clicks a specific flow row's own "More actions" menu (Save/Copy/More actions
// only render on hover), reusing the same hover-submenu dance as the Screens tab.
async function downloadFlowRow(page: Page, cell: Locator): Promise<boolean> {
  await cell.hover();
  const more = cell.getByRole("button", { name: "More actions" });
  if ((await more.count()) === 0) return false;
  return clickDownloadAllMenu(page, more);
}

// Flows dominate total crawl time (each row needs its own hover + menu + version-fetch
// round trip), so instead of one page working the grid top-to-bottom, FLOW_LANES pages
// share it — each scrolls the same grid independently and claims a disjoint, stable subset
// of rows by hashing the row id, so lanes never race for the same flow.
// ponytail: fixed pool size, not a knob. Mobbin's version-menu endpoint has throttled under
// sustained bulk-menu load before (see clickDownloadAllMenu) — start modest; raise if this
// holds up under real load, lower if "Loading..."/no-download failures climb.
const FLOW_LANES = 2;

function shardOf(id: string, lanes: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  return Math.abs(h) % lanes;
}

// Scrolls through the Flows tab across FLOW_LANES concurrent pages, downloading each
// newly-revealed flow inline from its own row (no per-flow page navigation), and records
// each in app_flows with steps pointing at the ingested images (in export order).
export async function crawlFlowsDownload(appUrl: string, appName: string, gridWaitMs: number = LOGIN_WAIT_MS, storage?: BulkObjectDependencies, platformOverride?: Platform): Promise<StageOutcome> {
  clearCancel();
  const platform = platformOverride ?? platformFromUrl(appUrl);
  const context = await launchMobbinContext();
  // A stale/restored tab left over from an earlier session can sit in the profile's
  // session-restore state — start from a genuinely fresh, focused page so the
  // hover-triggered menus below reliably render.
  for (const stale of context.pages()) await stale.close().catch(() => {});

  const probe = await context.newPage();
  await probe.bringToFront();
  await probe.goto(tabUrl(appUrl, "flows"), { waitUntil: "domcontentloaded" });
  try {
    await waitUntilVisible(probe, 'a[href*="/flows/"]', gridWaitMs, "the flows grid");
  } catch (error) {
    await context.close();
    return { status: "error", message: (error as Error).message };
  }

  const downloadRoot = `data/downloads/${appName}-flows`;
  const crawled: DesignFlow[] = [];
  const seen = new Set<string>(); // every row id any lane has discovered, for progress totals
  let done = 0;
  let cancelled = false;

  async function runLane(page: Page, laneIndex: number): Promise<void> {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    const laneSeen = new Set<string>();
    let stableAtBottom = 0;

    for (let i = 0; i < MAX_SCROLL_ITERATIONS && stableAtBottom < STABLE_AT_BOTTOM_STREAK; i++) {
      if (isCancelRequested()) { cancelled = true; break; }
      const rows = await discoverFlowRows(page);
      for (const row of rows) seen.add(row.id);
      const mine = rows.filter((row) => !laneSeen.has(row.id) && shardOf(row.id, FLOW_LANES) === laneIndex);

      const pending: Promise<void>[] = [];
      for (const row of mine) {
        if (isCancelRequested()) { cancelled = true; break; }
        laneSeen.add(row.id);
        const flowUrl = new URL(`/flows/${row.id}`, appUrl).toString();
        const viewport = page.viewportSize();
        let savedPaths: string[];
        try {
          const cell = flowCellLocator(page, row.id);
          await cell.scrollIntoViewIfNeeded().catch(() => {});
          savedPaths = await triggerAndSaveDownloads(page, `${downloadRoot}/${row.id}`, () => downloadFlowRow(page, cell));
        } catch (error) {
          console.warn(`[${appName}] Error on flow ${row.id}: ${error}. Skipping.`);
          done++;
          writeProgress({ stage: "crawl", app: appName, done, total: seen.size, status: "running", message: "Downloading flows" });
          continue;
        }
        if (savedPaths.length === 0) {
          console.warn(`[${appName}] No download started for flow "${row.title}" (${row.id}) — skipping.`);
          done++;
          writeProgress({ stage: "crawl", app: appName, done, total: seen.size, status: "running", message: "Downloading flows" });
          continue;
        }
        // Hash/upload/DB-insert don't touch the page, so let them run in the background
        // while this lane moves on to its next flow's hover/click instead of blocking on them.
        const dir = `${downloadRoot}/${row.id}`;
        const extractDir = `${dir}/_extracted`;
        pending.push(
          (async () => {
            const imageIds: number[] = [];
            for (const path of savedPaths) {
              const sourceDir = extractIfArchive(path, extractDir) ? extractDir : dir;
              imageIds.push(...(await ingestDownloadedImages(sourceDir, appName, platform, flowUrl, viewport, "flow_step", storage)).imageIds);
            }
            if (imageIds.length === 0) return;
            crawled.push({
              id: `mobbin-flow-${row.id}`,
              title: row.title,
              category: row.category || undefined,
              description: "",
              tags: [],
              steps: imageIds.map((imageId, index) => ({ label: `Step ${index + 1}`, evidence: [imageId] })),
            });
            console.log(`[${appName}] Flow "${row.title}": ${imageIds.length} step(s).`);
          })()
            .catch((error) => console.warn(`[${appName}] Error ingesting flow ${row.id}: ${error}. Skipping.`))
            .finally(() => {
              done++;
              writeProgress({ stage: "crawl", app: appName, done, total: seen.size, status: "running", message: "Downloading flows" });
            })
        );
      }
      await Promise.all(pending);

      const atBottom = await page.evaluate(
        () => window.scrollY + window.innerHeight >= document.body.scrollHeight - 2
      );
      stableAtBottom = atBottom ? stableAtBottom + 1 : 0;

      await page.evaluate(() => window.scrollBy(0, Math.round(window.innerHeight * 0.7)));
      await page.waitForTimeout(400);
    }
  }

  const extraPages = await Promise.all(Array.from({ length: FLOW_LANES - 1 }, () => context.newPage()));
  await Promise.all(extraPages.map(async (page) => {
    await page.goto(tabUrl(appUrl, "flows"), { waitUntil: "domcontentloaded" });
    await waitUntilVisible(page, 'a[href*="/flows/"]', 15_000, "the flows grid").catch(() => {});
  }));
  await Promise.all([probe, ...extraPages].map((page, laneIndex) => runLane(page, laneIndex)));

  rmSync(downloadRoot, { recursive: true, force: true });

  if (crawled.length > 0) {
    await saveAppFlows(appName, platform, mergeFlows(await getAppFlows(appName, platform), crawled));
  }

  await context.close();
  if (cancelled || isCancelRequested()) {
    console.log(`[${appName}] Cancelled. ${crawled.length} flow(s) imported before cancel.`);
    writeProgress({ stage: "crawl", app: appName, done, total: seen.size, status: "cancelled", message: "Cancelled by user" });
    return { status: "cancelled", message: "Cancelled by user" };
  }
  console.log(`[${appName}] Done. Imported ${crawled.length}/${seen.size} flow(s).`);
  writeProgress({ stage: "crawl", app: appName, done: seen.size, total: seen.size, status: "done" });
  return { status: "done" };
}
