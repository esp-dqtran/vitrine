import { waitUntilVisible, launchMobbinContext, type AppTarget } from "./crawler.ts";

const LOGIN_WAIT_MS = 30 * 60_000;
const MAX_SCROLL_ITERATIONS = 2000; // ponytail: catalog is much taller than a single app's screens grid
// This page's pagination fetch is slower/less predictable than the screens grid's (observed via
// live DOM inspection: same virtualized `padding-top`/`height` grid, but its "load more" fetch to
// /api/search/fetch-search-page-apps can lag well behind the scroll position) — a longer per-step
// wait and a longer stable-bottom streak than collectScreenIds uses avoids declaring done too early.
const SCROLL_DELAY_MS = 900;
const STABLE_AT_BOTTOM_STREAK = 6;

// Mobbin splits its app catalog by platform — a single "web" search only surfaces a third
// of it (451 web vs. 874 ios vs. 356 android, confirmed live). Enumerate all three and dedupe
// by url, since the same product can have separate web/ios/android catalog entries.
const PLATFORMS = ["web", "ios", "android"] as const;
const catalogUrlFor = (platform: string) => `https://mobbin.com/search/apps/${platform}?content_type=apps`;

// Card hrefs are already the full "{slug}-{platform}-{uuid}/{versionId}/screens" path — exactly
// the AppTarget.url shape crawl/crawlBulkDownload expect. Derive the display name from the slug
// (strip the trailing "-{platform}-{uuid}") rather than the card's visible text, since the card's
// own <a> is an empty absolutely-positioned overlay — the name text lives in a sibling element.
function parseAppTarget(href: string): AppTarget {
  const slug = href.split("/").filter(Boolean)[1] ?? href;
  const match = slug.match(/^(.+)-(web|ios|android)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  const name = match ? match[1] : slug;
  return { name, url: `https://mobbin.com${href}` };
}

async function collectAppLinks(page: import("playwright").Page): Promise<AppTarget[]> {
  const seen = new Map<string, AppTarget>(); // href -> target
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(800);

  let stableAtBottom = 0;
  for (let i = 0; i < MAX_SCROLL_ITERATIONS && stableAtBottom < STABLE_AT_BOTTOM_STREAK; i++) {
    const hrefs = await page.$$eval('a[href^="/apps/"]', (anchors) =>
      anchors.map((a) => a.getAttribute("href") ?? "").filter(Boolean)
    );
    for (const href of hrefs) if (!seen.has(href)) seen.set(href, parseAppTarget(href));

    const atBottom = await page.evaluate(
      () => window.scrollY + window.innerHeight >= document.body.scrollHeight - 2
    );
    stableAtBottom = atBottom ? stableAtBottom + 1 : 0;

    await page.evaluate(() => window.scrollBy(0, Math.round(window.innerHeight * 0.7)));
    await page.waitForTimeout(SCROLL_DELAY_MS);

    if (i > 0 && i % 20 === 0) console.log(`...scrolled ${i} steps, ${seen.size} apps found so far`);
  }

  return [...seen.values()];
}

// Discovers every app across Mobbin's whole catalog (web + ios + android), or a subset of
// those platforms if given. One browser session, navigating between platforms in turn.
export async function discoverApps(platforms: readonly string[] = PLATFORMS): Promise<AppTarget[]> {
  const context = await launchMobbinContext();
  const page = context.pages()[0] ?? (await context.newPage());

  const seen = new Map<string, AppTarget>(); // url -> target, deduped across platforms
  for (const platform of platforms) {
    await page.goto(catalogUrlFor(platform), { waitUntil: "domcontentloaded" });
    await waitUntilVisible(page, 'a[href^="/apps/"]', LOGIN_WAIT_MS, "the app catalog grid");

    console.log(`[${platform}] Scrolling to enumerate every app...`);
    const apps = await collectAppLinks(page);
    console.log(`[${platform}] Found ${apps.length} apps.`);
    for (const app of apps) if (!seen.has(app.url)) seen.set(app.url, app);
  }

  console.log(`Found ${seen.size} apps total across ${platforms.length} platform(s).`);
  await context.close();
  return [...seen.values()];
}
