import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { launchMobbinContext } from "../src/crawler.ts";
import {
  createJob,
  pool,
  query,
  setJobStatus,
} from "../src/db.ts";
import { canonicalSitesCatalogUrls } from "../src/sitesCatalog.ts";
import { closeSitesQueue, publishSitesJob } from "../src/sitesQueue.ts";
import { createSitesStore } from "../src/sitesStore.ts";

const CATALOG_URL = "https://mobbin.com/discover/sites/latest";
const MAX_SCROLL_ITERATIONS = 800;
const BOTTOM_STABILITY_ROUNDS = 5;
const sitesStore = createSitesStore();
const profileDir = await mkdtemp(join(tmpdir(), "astryx-mobbin-sites-"));

try {
  const context = await launchMobbinContext({
    profileDir,
    storageStatePath:
      process.env.MOBBIN_SITES_STORAGE_STATE_PATH ?? "data/mobbin-auth-state.json",
    headless: true,
  });
  try {
    const page = context.pages()[0] ?? await context.newPage();
    await page.goto(CATALOG_URL, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    if (
      new URL(page.url()).pathname !== "/discover/sites/latest" ||
      await page.locator('a[href="/login"]').count() > 0
    ) {
      throw new Error("Mobbin Sites authentication required");
    }

    const discovered = new Set<string>();
    let stableAtBottom = 0;
    for (
      let iteration = 0;
      iteration < MAX_SCROLL_ITERATIONS && stableAtBottom < BOTTOM_STABILITY_ROUNDS;
      iteration++
    ) {
      const hrefs = await page.$$eval(
        'a[href^="/sites/"][href$="/preview"]',
        (links) => links.map((link) => link.getAttribute("href") ?? ""),
      );
      for (const url of canonicalSitesCatalogUrls(hrefs)) discovered.add(url);

      const atBottom = await page.evaluate(
        () => window.scrollY + window.innerHeight >= document.body.scrollHeight - 2,
      );
      stableAtBottom = atBottom ? stableAtBottom + 1 : 0;
      await page.evaluate(
        () => window.scrollBy(0, Math.round(window.innerHeight * 0.8)),
      );
      await page.waitForTimeout(350);
    }

    const urls = [...discovered];
    if (urls.length === 0 || stableAtBottom < BOTTOM_STABILITY_ROUNDS) {
      throw new Error("Mobbin Sites catalog discovery did not reach a stable end");
    }

    const activeRows = await query<{ url: string | null }>(
      `SELECT payload->>'url' AS url
       FROM jobs
       WHERE type = 'import-site' AND status IN ('queued', 'running')`,
    );
    const active = new Set(
      activeRows.rows.map(({ url }) => url).filter((url): url is string => Boolean(url)),
    );
    let queued = 0;
    let alreadyReady = 0;
    let alreadyQueued = 0;

    for (const url of urls) {
      if (await sitesStore.readyVersionByCanonicalUrl(url)) {
        alreadyReady++;
        continue;
      }
      if (active.has(url)) {
        alreadyQueued++;
        continue;
      }
      const jobId = await createJob("import-site", { url });
      try {
        await publishSitesJob({ type: "import-site", url, jobId });
        active.add(url);
        queued++;
      } catch {
        await setJobStatus(jobId, "error", "Sites queue publish failed");
        throw new Error("Sites queue publish failed");
      }
    }

    console.log(JSON.stringify({
      discovered: urls.length,
      queued,
      alreadyReady,
      alreadyQueued,
    }));
  } finally {
    await context.close();
  }
} finally {
  await closeSitesQueue().catch(() => undefined);
  await pool.end().catch(() => undefined);
  await rm(profileDir, { recursive: true, force: true });
}
