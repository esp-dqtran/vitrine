import { type Page, type Download } from "playwright";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import { insertImage } from "./db.ts";
import { clearCancel, isCancelRequested, writeProgress, type StageOutcome } from "./progress.ts";
import { waitUntilVisible, getExpectedAlt, launchMobbinContext, platformFromUrl } from "./crawler.ts";

const LOGIN_WAIT_MS = 30 * 60_000; // time to log in manually in the opened window
const SCROLL_STEP = 500;
const SCROLL_DELAY_MS = 400;
const MAX_SCROLL_ITERATIONS = 500; // ponytail: hard cap so a page with truly infinite scroll can't hang forever
const STABLE_AT_BOTTOM_STREAK = 6;
// A single scroll pass misses stragglers the virtualized grid recycled out of the DOM
// before we got to click them — a second pass over the same ground catches the rest.
const SELECT_PASSES = 2;

// Runs entirely as discrete Playwright evaluate() calls, one per scroll step — NOT one big
// injected JS loop. That distinction matters: driving this same interaction through the
// Chrome extension's CDP-instrumented tab caused click-triggered re-renders to degrade
// severely (sub-second early on, 40+ seconds per click by ~100 selections). Plain
// Playwright automation (this file) doesn't carry that instrumentation overhead.
async function selectAllOwnScreens(page: Page, expectedAlt: string): Promise<{ clicked: number; skipped: number }> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);

  let totalClicked = 0;
  let totalSkipped = 0;
  let stableAtBottom = 0;
  for (let i = 0; i < MAX_SCROLL_ITERATIONS && stableAtBottom < STABLE_AT_BOTTOM_STREAK; i++) {
    const { clicked, skipped } = await page.evaluate((alt) => {
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
          if (cardAlt !== alt) {
            skipped++;
            continue;
          }
          checkbox.click();
          clicked++;
        }
      }
      return { clicked, skipped };
    }, expectedAlt);
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
async function ingestImages(sourceDir: string, appName: string, platform: string): Promise<number> {
  const dir = `data/images/${appName}`;
  mkdirSync(dir, { recursive: true });
  let count = 0;
  const entries = existsSync(sourceDir) ? (readdirSync(sourceDir, { recursive: true }) as string[]) : [];
  for (const rel of entries) {
    if (!/\.(png|jpe?g|webp)$/i.test(rel)) continue;
    const full = `${sourceDir}/${rel}`;
    const body = readFileSync(full);
    const hash = createHash("sha1").update(body).digest("hex").slice(0, 16);
    const ext = rel.split(".").pop();
    const localPath = `${dir}/${hash}.${ext}`;
    if (!existsSync(localPath)) {
      renameSync(full, localPath);
      // ponytail: bulk-imported screens come off disk, so there is no fetchable image_url
      // for the captioner to pull — these rows stay uncaptioned until they're re-crawled.
      await insertImage(appName, platform, `mobbin-bulk:${hash}`);
      count++;
    }
  }
  return count;
}

export async function crawlBulkDownload(appUrl: string, appName: string): Promise<StageOutcome> {
  clearCancel();
  const platform = platformFromUrl(appUrl);
  const context = await launchMobbinContext();
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await waitUntilVisible(page, 'a[href^="/screens/"]', LOGIN_WAIT_MS, "the screens grid");

  const expectedAlt = await getExpectedAlt(page);
  console.log(`[${appName}] Selecting every screen (${SELECT_PASSES} passes, filtering to "${expectedAlt}")...`);
  writeProgress({ stage: "crawl", app: appName, done: 0, total: 0, status: "running", message: "Selecting screens" });

  let clicked = 0;
  let skipped = 0;
  for (let pass = 0; pass < SELECT_PASSES; pass++) {
    if (isCancelRequested()) break;
    const result = await selectAllOwnScreens(page, expectedAlt);
    clicked += result.clicked;
    skipped += result.skipped;
    console.log(`[${appName}] Pass ${pass + 1}/${SELECT_PASSES}: +${result.clicked} selected (${result.skipped} filtered as other-app)`);
  }

  if (isCancelRequested()) {
    console.log(`[${appName}] Cancelled before download.`);
    writeProgress({ stage: "crawl", app: appName, done: 0, total: 0, status: "cancelled", message: "Cancelled by user" });
    await context.close();
    return { status: "cancelled", message: "Cancelled by user" };
  }

  console.log(`[${appName}] Triggering bulk download for ${clicked} selected screen(s)...`);
  writeProgress({ stage: "crawl", app: appName, done: 0, total: clicked, status: "running", message: "Downloading" });

  const downloadDir = `data/downloads/${appName}`;
  mkdirSync(downloadDir, { recursive: true });

  // Mobbin's export might come back as one zip, or as several individual file downloads —
  // we don't assume which, we just collect every `download` event until they stop arriving.
  const downloads: Download[] = [];
  page.on("download", (d) => downloads.push(d));
  await page.locator('[aria-label="Download all screens"]').click();

  let lastCount = -1;
  const deadline = Date.now() + 5 * 60_000;
  while (Date.now() < deadline) {
    await page.waitForTimeout(2000);
    if (downloads.length > 0 && downloads.length === lastCount) break;
    lastCount = downloads.length;
  }

  if (downloads.length === 0) {
    console.warn(`[${appName}] No download started — check the "Download all screens" selector is still correct.`);
    writeProgress({ stage: "crawl", app: appName, done: 0, total: clicked, status: "error", message: "No download started" });
    await context.close();
    return { status: "error", message: "No download started" };
  }

  const savedPaths: string[] = [];
  for (const download of downloads) {
    const path = `${downloadDir}/${download.suggestedFilename()}`;
    await download.saveAs(path);
    savedPaths.push(path);
  }

  const extractDir = `${downloadDir}/_extracted`;
  let imported = 0;
  for (const path of savedPaths) {
    if (extractIfArchive(path, extractDir)) {
      imported += await ingestImages(extractDir, appName, platform);
    } else {
      imported += await ingestImages(downloadDir, appName, platform);
    }
  }

  rmSync(downloadDir, { recursive: true, force: true });
  console.log(`[${appName}] Done. Imported ${imported} image(s) via bulk download.`);
  writeProgress({ stage: "crawl", app: appName, done: imported, total: imported, status: "done" });

  await context.close();
  return { status: "done" };
}
