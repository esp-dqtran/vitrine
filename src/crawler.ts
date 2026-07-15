import { chromium, type BrowserContext, type Page } from "playwright";
import { existsSync } from "node:fs";
import { imageExists, insertImage } from "./db.ts";
import { clearCancel, isCancelRequested, writeProgress } from "./progress.ts";
import { runPool } from "./pool.ts";
import { platformFromUrl } from "./platformFromUrl.ts";

const MAX_SCROLL_ITERATIONS = 500; // ponytail: hard cap so a page with truly infinite scroll can't hang forever
const LOGIN_WAIT_MS = 30 * 60_000; // time to log in manually in the opened window
// ponytail: fixed pool size, not measured against Mobbin's actual rate limits — lower it
// if screens start erroring out or a CAPTCHA shows up, raise it if it stays clean.
const CONCURRENCY = 4;

export interface AppTarget {
  name: string;
  url: string;
}

// Defaults to a real (headed) window so a human can log in the first time — the persistent
// profile then carries that login into every later run on the SAME OS. Chrome encrypts the
// cookie store with an OS-level key (macOS Keychain / Linux libsecret) — copying or bind-
// mounting data/browser-profile-mobbin from a macOS host into a Linux container gives you the
// cookie *file* but not a working decryption key, so the container silently sees a logged-out
// session even though every file is present and readable. Fixed by exporting the session via
// Playwright's own storageState (portable — it works through the CDP session, not the OS
// cookie store) and re-importing it into whatever fresh profile the container creates.
export async function launchMobbinContext(): Promise<BrowserContext> {
  const profileDir = process.env.MOBBIN_PROFILE_DIR ?? "data/browser-profile-mobbin";
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: process.env.HEADLESS === "true",
  });
  const storageStatePath = process.env.MOBBIN_STORAGE_STATE_PATH;
  if (storageStatePath && existsSync(storageStatePath)) {
    await context.setStorageState(storageStatePath);
  }
  return context;
}

// Run once on the machine that already has a logged-in headed profile (e.g. locally on
// macOS) to produce the portable session file a Linux container can actually use.
export async function exportMobbinStorageState(outPath: string): Promise<void> {
  const context = await chromium.launchPersistentContext("data/browser-profile-mobbin", { headless: false });
  await context.storageState({ path: outPath });
  await context.close();
  console.log(`Wrote storage state to ${outPath}`);
}

// Scripts here run detached (via a background shell), so there's no terminal to press
// Enter in — instead poll the page for a login-gated selector until it appears.
export async function waitUntilVisible(page: Page, selector: string, timeoutMs: number, label: string): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await page.locator(selector).count()) > 0) return;
    console.log(`Waiting for you to log in (looking for ${label})...`);
    await page.waitForTimeout(3000);
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for ${label}. Log in and re-run.`);
}

// The app's own display name, e.g. "Linear —The system for product development" -> "linear screen".
// Mobbin mixes "similar screens from other apps" into the same grid markup further down the
// page (real checkboxes, real /screens/ links) — this is the only reliable way to tell them
// apart from the current app's own screens, by comparing each thumbnail's alt text against it.
export async function getExpectedAlt(page: Page): Promise<string> {
  const appDisplayName = await page.evaluate(() => {
    const h1 = document.querySelector("h1")?.textContent ?? "";
    return h1.split(/[—-]/)[0]?.trim() ?? "";
  });
  return `${appDisplayName} screen`.toLowerCase();
}

// The grid virtualizes (unmounts off-screen cards), so a single "jump to bottom, query
// once" pass misses most screens. Scroll in small viewport-sized steps and collect the
// screen ids after every step, before each batch gets recycled out of the DOM. We only
// need the id here (not the image) — the real image comes from each screen's own page.
//
// Mobbin mixes "similar screens from other apps" (e.g. Quicken, Unsplash) into this same
// grid further down — same markup, real checkboxes, real /screens/ links. The only
// reliable tell is the thumbnail's alt text ("<App> screen"), so we collect that alongside
// the id and filter to the current app's own name before returning.
async function collectScreenIds(page: Page): Promise<Set<string>> {
  const seen = new Map<string, string>(); // id -> alt text
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);

  let stableAtBottom = 0;
  for (let i = 0; i < MAX_SCROLL_ITERATIONS && stableAtBottom < 3; i++) {
    const batch = await page.$$eval('a[href^="/screens/"]', (anchors) =>
      anchors.map((a) => ({
        id: a.getAttribute("href")?.split("/").filter(Boolean).pop() ?? "",
        alt: a.querySelector("img")?.alt ?? "",
      })).filter((s) => s.id)
    );
    for (const { id, alt } of batch) if (!seen.has(id)) seen.set(id, alt);

    const atBottom = await page.evaluate(
      () => window.scrollY + window.innerHeight >= document.body.scrollHeight - 2
    );
    stableAtBottom = atBottom ? stableAtBottom + 1 : 0;

    await page.evaluate(() => window.scrollBy(0, Math.round(window.innerHeight * 0.7)));
    await page.waitForTimeout(400);
  }

  const expectedAlt = await getExpectedAlt(page);

  const own = new Set<string>();
  let rejected = 0;
  for (const [id, alt] of seen) {
    if (alt.toLowerCase() === expectedAlt) {
      own.add(id);
    } else {
      rejected++;
    }
  }
  if (rejected > 0) {
    console.log(`Filtered out ${rejected} screen(s) belonging to other apps (recommended-screens contamination).`);
  }
  return own;
}


// Crawls one app's screens into `context` (which the caller owns — launches it, logs in
// once, and closes it when done). This is the part that's the same whether we're crawling
// a single app or working through a list of them back to back.
async function crawlAppScreens(context: BrowserContext, appUrl: string, appName: string): Promise<void> {
  const platform = platformFromUrl(appUrl);
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });

  console.log(`[${appName}] Scrolling to enumerate every screen...`);
  writeProgress({ stage: "crawl", app: appName, done: 0, total: 0, status: "running", message: "Enumerating screens" });
  const screenIds = [...(await collectScreenIds(page))];
  console.log(`[${appName}] Found ${screenIds.length} screens. Visiting each for a full-resolution capture (${CONCURRENCY} at a time)...`);
  writeProgress({ stage: "crawl", app: appName, done: 0, total: screenIds.length, status: "running" });

  // Extra tabs share the same authenticated context (cookies/session), so they don't
  // need their own login — only the crawl loop below runs concurrently across them.
  const extraPages = await Promise.all(Array.from({ length: CONCURRENCY - 1 }, () => context.newPage()));
  const pages = [page, ...extraPages];

  let done = 0;
  let skipped = 0;
  await runPool(screenIds, pages, async (workerPage, id) => {
    try {
      const pageUrl = `https://mobbin.com/screens/${id}`;
      await workerPage.goto(pageUrl, { waitUntil: "domcontentloaded" });
      await workerPage.waitForTimeout(2500);

      // Every other image on this page (nav icons, "related apps" carousel) shares the
      // same CDN host — the only reliable signal for "this is the actual screen" is the
      // DOM: it's the one wrapped in a "cursor-zoom-in" (click-to-enlarge) container.
      const mainImg = workerPage.locator('div[class*="cursor-zoom-in"] img').first();
      if ((await mainImg.count()) === 0) {
        console.warn(`No main image found for screen ${id}, skipping.`);
        return;
      }
      const observedImage = await mainImg.evaluate((img: HTMLImageElement) => ({ src: img.currentSrc || img.src, width: img.naturalWidth, height: img.naturalHeight }));
      const src = observedImage.src;

      // Dedupe on the CDN url, which is only known once the page has rendered — so a
      // re-crawl still pays the page load per screen, it just skips the insert.
      if (await imageExists(src)) {
        skipped++;
        return;
      }
      await insertImage(appName, platform, src, { sourceUrl: pageUrl, viewportWidth: observedImage.width, viewportHeight: observedImage.height });
      done++;
      if (done % 20 === 0) console.log(`[${appName}] ...${done}/${screenIds.length} done (${skipped} already had this screen)`);
    } catch (e) {
      console.warn(`[${appName}] Error on screen ${id}: ${e}. Skipping.`);
    } finally {
      writeProgress({ stage: "crawl", app: appName, done: done + skipped, total: screenIds.length, status: "running" });
    }
  }, isCancelRequested);

  // Extra tabs opened just for this app's pool — close them so the next app in a
  // multi-app run starts with a clean single-tab slate (crawlAppScreens reopens its own).
  await Promise.all(extraPages.map((p) => p.close()));

  if (isCancelRequested()) {
    console.log(`[${appName}] Cancelled. ${done} new screens recorded (${skipped} already present).`);
    writeProgress({ stage: "crawl", app: appName, done: done + skipped, total: screenIds.length, status: "cancelled", message: "Cancelled by user" });
  } else {
    console.log(`[${appName}] Done. ${done} new screens recorded (${skipped} already present).`);
    writeProgress({ stage: "crawl", app: appName, done: screenIds.length, total: screenIds.length, status: "done" });
  }
}

export async function crawl(appUrl: string, appName: string): Promise<void> {
  clearCancel();
  const context = await launchMobbinContext();
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await waitUntilVisible(page, 'a[href^="/screens/"]', LOGIN_WAIT_MS, "the screens grid");

  await crawlAppScreens(context, appUrl, appName);
  await context.close();
}

// Crawls a list of apps back to back in ONE browser session — logging in once (on the
// first app's page) rather than once per app, then working through the rest sequentially.
// Sequential, not pooled across apps: all apps share the same Mobbin login/profile, and
// Playwright only allows one process to hold a given persistent-context profile at a time.
export async function crawlMany(apps: AppTarget[]): Promise<void> {
  if (apps.length === 0) {
    console.log("No apps to crawl.");
    return;
  }
  clearCancel();
  const context = await launchMobbinContext();
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(apps[0].url, { waitUntil: "domcontentloaded" });
  await waitUntilVisible(page, 'a[href^="/screens/"]', LOGIN_WAIT_MS, "the screens grid");

  for (const [i, app] of apps.entries()) {
    if (isCancelRequested()) {
      console.log(`Cancelled before starting ${app.name} (${i + 1}/${apps.length}).`);
      break;
    }
    console.log(`\n=== App ${i + 1}/${apps.length}: ${app.name} ===`);
    await crawlAppScreens(context, app.url, app.name);
  }

  await context.close();
}
