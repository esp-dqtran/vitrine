import { type Page, type Download } from "playwright";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import { getAppFlows, insertImage, saveAppFlows, setAppMeta, type ImageKind } from "./db.ts";
import type { DesignFlow } from "./designSystem.ts";
import { clearCancel, isCancelRequested, writeProgress, type StageOutcome } from "./progress.ts";
import { waitUntilVisible, getExpectedAlt, launchMobbinContext, platformFromUrl } from "./crawler.ts";

const LOGIN_WAIT_MS = 30 * 60_000; // time to log in manually in the opened window
const SCROLL_STEP = 500;
const SCROLL_DELAY_MS = 400;
const MAX_SCROLL_ITERATIONS = 500; // ponytail: hard cap so a page with truly infinite scroll can't hang forever
const STABLE_AT_BOTTOM_STREAK = 6;
const DOWNLOAD_WAIT_MS = 5 * 60_000;

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
// disabled until cards are selected, so we go straight through the menu here.
async function clickDownloadAllMenu(page: Page): Promise<boolean> {
  const more = page.locator('button[aria-label="More actions"]').first();
  if ((await more.count()) === 0) return false;
  await more.click();
  const item = page.getByRole("menuitem", { name: /download all screens/i });
  await item.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  if ((await item.count()) === 0) return false;
  await item.first().click();
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
    let lastCount = -1;
    const deadline = Date.now() + DOWNLOAD_WAIT_MS;
    while (Date.now() < deadline) {
      await page.waitForTimeout(2000);
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
async function ingestImages(
  sourceDir: string,
  appName: string,
  platform: string,
  sourceUrl: string,
  viewport?: { width: number; height: number } | null,
  kind: ImageKind = "screen",
): Promise<{ imported: number; imageIds: number[] }> {
  const dir = `data/images/${appName}`;
  mkdirSync(dir, { recursive: true });
  let imported = 0;
  const imageIds: number[] = [];
  const entries = (existsSync(sourceDir) ? (readdirSync(sourceDir, { recursive: true }) as string[]) : [])
    .filter((rel) => /\.(png|jpe?g|webp)$/i.test(rel))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  for (const rel of entries) {
    const full = `${sourceDir}/${rel}`;
    const body = readFileSync(full);
    const hash = createHash("sha1").update(body).digest("hex").slice(0, 16);
    const ext = rel.split(".").pop();
    const localPath = `${dir}/${hash}.${ext}`;
    if (!existsSync(localPath)) {
      renameSync(full, localPath);
      imported++;
    }
    // ponytail: bulk-imported screens come off disk, so there is no fetchable image_url
    // for the captioner to pull — these rows stay uncaptioned until they're re-crawled.
    imageIds.push(
      await insertImage(appName, platform, `mobbin-bulk:${hash}`, { sourceUrl, viewportWidth: viewport?.width, viewportHeight: viewport?.height, kind })
    );
  }
  return { imported, imageIds };
}

// gridWaitMs defaults to the long login window (first crawl waits for a manual sign-in).
// A caller that has already established login (e.g. after the screens tab) passes a short
// timeout so a tab the app simply doesn't have fails fast instead of hanging 30 minutes.
export async function crawlBulkDownload(appUrl: string, appName: string, tab: BulkTab = "screens", gridWaitMs: number = LOGIN_WAIT_MS): Promise<StageOutcome> {
  clearCancel();
  const platform = platformFromUrl(appUrl);
  const kind: ImageKind = tab === "ui-elements" ? "ui_element" : "screen";
  const label = tab === "ui-elements" ? "UI elements" : "screens";
  const context = await launchMobbinContext();
  const page = context.pages()[0] ?? (await context.newPage());
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
  let savedPaths: string[];

  if (tab === "screens") {
    // Screens: app-level "Download all screens" from the ⋮ More actions menu — no selection.
    if (isCancelRequested()) return cancelledOutcome();
    console.log(`[${appName}] Downloading all screens via the More actions menu...`);
    writeProgress({ stage: "crawl", app: appName, done: 0, total: 0, status: "running", message: "Downloading" });
    savedPaths = await triggerAndSaveDownloads(page, downloadDir, clickDownloadAllMenu);
  } else {
    // UI Elements: a single selection pass, sanity-checked against the count Mobbin displays,
    // then the bottom-toolbar Download button (no app-level "download all" on this tab).
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

    if (isCancelRequested()) return cancelledOutcome();
    console.log(`[${appName}] Triggering download for ${selected} selected ${label}...`);
    writeProgress({ stage: "crawl", app: appName, done: 0, total: selected, status: "running", message: "Downloading" });
    savedPaths = await triggerAndSaveDownloads(page, downloadDir);
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
    imported += (await ingestImages(sourceDir, appName, platform, appUrl, page.viewportSize(), kind)).imported;
  }

  rmSync(downloadDir, { recursive: true, force: true });
  if (imported > 0 && (pageMeta.iconUrl || pageMeta.category)) await setAppMeta(appName, pageMeta).catch(() => {});
  console.log(`[${appName}] Done. Imported ${imported} ${label} image(s) via bulk download.`);
  writeProgress({ stage: "crawl", app: appName, done: imported, total: imported, status: "done" });

  await context.close();
  return { status: "done" };
}

// Enumerate the flow cards on the app's Flows tab. Same virtualized-grid scroll dance as
// screens, but link collection only — Mobbin has no cross-flow multi-select (zero
// aria-pressed toggles on this tab), so each flow is downloaded from its own page below.
async function collectFlowLinks(page: Page): Promise<Array<{ id: string; title: string; url: string }>> {
  const seen = new Map<string, { id: string; title: string; url: string }>();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);

  let stableAtBottom = 0;
  for (let i = 0; i < MAX_SCROLL_ITERATIONS && stableAtBottom < 3; i++) {
    const batch = await page.$$eval('a[href*="/flows/"]', (anchors) =>
      anchors.map((a) => ({
        href: a.getAttribute("href") ?? "",
        title: (a.querySelector("img")?.getAttribute("alt") || a.textContent || "").trim(),
      }))
    );
    for (const { href, title } of batch) {
      const id = href.split("/").filter(Boolean).pop() ?? "";
      if (!id || id === "flows" || seen.has(id)) continue;
      seen.set(id, { id, title: title || `Flow ${seen.size + 1}`, url: new URL(href, page.url()).toString() });
    }

    const atBottom = await page.evaluate(
      () => window.scrollY + window.innerHeight >= document.body.scrollHeight - 2
    );
    stableAtBottom = atBottom ? stableAtBottom + 1 : 0;

    await page.evaluate(() => window.scrollBy(0, Math.round(window.innerHeight * 0.7)));
    await page.waitForTimeout(400);
  }
  return [...seen.values()];
}

// Visits each flow page and uses its own "Download all screens" export, then records the
// flow in app_flows with steps pointing at the ingested images (in export order).
export async function crawlFlowsDownload(appUrl: string, appName: string, gridWaitMs: number = LOGIN_WAIT_MS): Promise<StageOutcome> {
  clearCancel();
  const platform = platformFromUrl(appUrl);
  const context = await launchMobbinContext();
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(tabUrl(appUrl, "flows"), { waitUntil: "domcontentloaded" });
  try {
    await waitUntilVisible(page, 'a[href*="/flows/"]', gridWaitMs, "the flows grid");
  } catch (error) {
    await context.close();
    return { status: "error", message: (error as Error).message };
  }

  const flowLinks = await collectFlowLinks(page);
  console.log(`[${appName}] Found ${flowLinks.length} flow(s). Downloading each flow's screens...`);
  writeProgress({ stage: "crawl", app: appName, done: 0, total: flowLinks.length, status: "running", message: "Downloading flows" });

  const downloadRoot = `data/downloads/${appName}-flows`;
  const crawled: DesignFlow[] = [];
  let done = 0;
  for (const flow of flowLinks) {
    if (isCancelRequested()) break;
    try {
      await page.goto(flow.url, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);
      const dir = `${downloadRoot}/${flow.id}`;
      const savedPaths = await triggerAndSaveDownloads(page, dir);
      if (savedPaths.length === 0) {
        console.warn(`[${appName}] No download started for flow "${flow.title}" (${flow.url}) — skipping.`);
        continue;
      }
      const extractDir = `${dir}/_extracted`;
      const imageIds: number[] = [];
      for (const path of savedPaths) {
        const sourceDir = extractIfArchive(path, extractDir) ? extractDir : dir;
        imageIds.push(...(await ingestImages(sourceDir, appName, platform, flow.url, page.viewportSize())).imageIds);
      }
      if (imageIds.length === 0) continue;
      crawled.push({
        id: `mobbin-flow-${flow.id}`,
        title: flow.title,
        description: `Imported from Mobbin: ${flow.url}`,
        tags: [],
        steps: imageIds.map((imageId, index) => ({ label: `Step ${index + 1}`, evidence: [imageId] })),
      });
      console.log(`[${appName}] Flow "${flow.title}": ${imageIds.length} step(s).`);
    } catch (error) {
      console.warn(`[${appName}] Error on flow ${flow.id}: ${error}. Skipping.`);
    } finally {
      done++;
      writeProgress({ stage: "crawl", app: appName, done, total: flowLinks.length, status: "running", message: "Downloading flows" });
    }
  }
  rmSync(downloadRoot, { recursive: true, force: true });

  if (crawled.length > 0) {
    await saveAppFlows(appName, mergeFlows(await getAppFlows(appName), crawled));
  }

  await context.close();
  if (isCancelRequested()) {
    console.log(`[${appName}] Cancelled. ${crawled.length} flow(s) imported before cancel.`);
    writeProgress({ stage: "crawl", app: appName, done, total: flowLinks.length, status: "cancelled", message: "Cancelled by user" });
    return { status: "cancelled", message: "Cancelled by user" };
  }
  console.log(`[${appName}] Done. Imported ${crawled.length}/${flowLinks.length} flow(s).`);
  writeProgress({ stage: "crawl", app: appName, done: flowLinks.length, total: flowLinks.length, status: "done" });
  return { status: "done" };
}
