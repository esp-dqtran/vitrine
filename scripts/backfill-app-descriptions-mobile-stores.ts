import { chromium, type BrowserContext } from "playwright";
import {
  appleStoreCountry,
  appleStoreId,
  chooseAppStoreDescription,
  googlePlayId,
} from "../src/appStoreDescription.ts";
import { closePool, query } from "../src/db.ts";
import { runPool } from "../src/pool.ts";

type PlatformFilter = "ios" | "android" | "all";

interface AppRow {
  id: number;
  name: string;
  display_name: string | null;
  website_url: string;
}

interface AppleLookupItem {
  trackId?: number;
  description?: string;
  trackViewUrl?: string;
}

interface ResolvedListing {
  description: string;
  source: "apple-app-store-listing" | "google-play-listing";
  sourceUrl: string;
}

type Result = {
  appId: number;
  app: string;
  status: "resolved";
  applied: boolean;
} & ResolvedListing | {
  appId: number;
  app: string;
  status: "failed";
  reason: string;
  sourceUrl: string;
};

const hasFlag = (flag: string) => process.argv.includes(flag);

function argument(flag: string): string | null {
  const index = process.argv.lastIndexOf(flag);
  if (index < 0) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

function positiveArgument(flag: string, fallback: number): number {
  const raw = argument(flag);
  if (raw === null) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${flag} must be a positive integer`);
  return value;
}

function platformArgument(): PlatformFilter {
  const value = argument("--platform") ?? "all";
  if (value !== "ios" && value !== "android" && value !== "all") {
    throw new Error("--platform must be ios, android, or all");
  }
  return value;
}

async function sourceRows(input: {
  platform: PlatformFilter;
  app: string | null;
  limit: number | null;
}): Promise<AppRow[]> {
  const platforms = input.platform === "all" ? ["ios", "android"] : [input.platform];
  const result = await query<AppRow>(
    `SELECT app.id, app.name, app.display_name, app.website_url
     FROM apps app
     WHERE NULLIF(BTRIM(app.description), '') IS NULL
       AND NULLIF(BTRIM(app.website_url), '') IS NOT NULL
       AND ($1::text IS NULL OR app.name = $1 OR app.display_name = $1)
       AND EXISTS (
         SELECT 1 FROM app_versions version
         WHERE version.app_id = app.id
           AND version.status = 'published'
           AND version.platform = ANY($2::text[])
       )
     ORDER BY app.id
     LIMIT COALESCE($3::integer, 2147483647)`,
    [input.app, platforms, input.limit],
  );
  return result.rows;
}

function chunks<T>(values: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function fetchJson(url: string): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "Astryx catalog description backfill/1.0" },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`Store lookup returned ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw lastError;
}

async function loadAppleListings(rows: readonly AppRow[]): Promise<Map<string, AppleLookupItem>> {
  const groups = new Map<string, Set<string>>();
  for (const row of rows) {
    const storeId = appleStoreId(row.website_url);
    if (!storeId) continue;
    const country = appleStoreCountry(row.website_url);
    const ids = groups.get(country) ?? new Set<string>();
    ids.add(storeId);
    groups.set(country, ids);
  }

  const batches = [...groups.entries()].flatMap(([country, ids]) =>
    chunks([...ids], 50).map((storeIds) => ({ country, storeIds }))
  );
  const listings = new Map<string, AppleLookupItem>();
  await runPool(batches, [0, 1, 2], async (_lane, batch) => {
    const url = new URL("https://itunes.apple.com/lookup");
    url.searchParams.set("id", batch.storeIds.join(","));
    url.searchParams.set("country", batch.country);
    url.searchParams.set("entity", "software");
    const payload = await fetchJson(url.toString()) as { results?: AppleLookupItem[] };
    for (const item of payload.results ?? []) {
      if (item.trackId) listings.set(String(item.trackId), item);
    }
  });

  const missing = rows.flatMap((row) => {
    const storeId = appleStoreId(row.website_url);
    return storeId && !listings.has(storeId)
      ? [{ storeId, country: appleStoreCountry(row.website_url) }]
      : [];
  });
  const uniqueMissing = [...new Map(missing.map((item) => [item.storeId, item])).values()];
  await runPool(uniqueMissing, [0, 1, 2, 3], async (_lane, item) => {
    for (const country of [...new Set([item.country, "us"])]) {
      try {
        const url = new URL("https://itunes.apple.com/lookup");
        url.searchParams.set("id", item.storeId);
        url.searchParams.set("country", country);
        url.searchParams.set("entity", "software");
        const payload = await fetchJson(url.toString()) as { results?: AppleLookupItem[] };
        const listing = payload.results?.find((candidate) => String(candidate.trackId) === item.storeId);
        if (listing) {
          listings.set(item.storeId, listing);
          return;
        }
      } catch {
        // Removed or region-locked listings remain unresolved for a fallback pass.
      }
    }
  });
  return listings;
}

async function scanGooglePlay(
  context: BrowserContext,
  value: string,
  appName: string,
): Promise<ResolvedListing> {
  const packageId = googlePlayId(value);
  if (!packageId) throw new Error("Not a Google Play listing URL");
  const sourceUrl = `https://play.google.com/store/apps/details?id=${encodeURIComponent(packageId)}&hl=en_US&gl=US`;
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const page = await context.newPage();
    try {
      const response = await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
      if (!response || response.status() >= 400) {
        throw new Error(`Google Play returned ${response?.status() ?? "no response"}`);
      }
      const raw = await page.locator('[data-g-id="description"]').first().innerText({ timeout: 10_000 });
      const description = chooseAppStoreDescription(raw, appName);
      if (!description) throw new Error("No suitable About this app description found");
      return { description, source: "google-play-listing", sourceUrl };
    } catch (error) {
      lastError = error;
      if (attempt < 2) await page.waitForTimeout(500);
    } finally {
      await page.close();
    }
  }
  throw lastError;
}

const apply = hasFlag("--apply");
const platform = platformArgument();
const app = argument("--app");
const limit = argument("--limit") === null ? null : positiveArgument("--limit", 1);
const concurrency = positiveArgument("--concurrency", 4);
const rows = await sourceRows({ platform, app, limit });
const appleListings = await loadAppleListings(rows);
const needsBrowser = rows.some((row) => googlePlayId(row.website_url));
const browser = needsBrowser ? await chromium.launch({ headless: true }) : null;
const context = browser ? await browser.newContext({ viewport: { width: 1280, height: 800 } }) : null;
if (context) {
  await context.route("**/*", async (route) => {
    const type = route.request().resourceType();
    if (type === "image" || type === "media" || type === "font") {
      await route.abort("blockedbyclient");
    } else {
      await route.continue();
    }
  });
}

const results: Result[] = [];
let completed = 0;
try {
  const lanes = Array.from({ length: Math.min(concurrency, Math.max(rows.length, 1)) }, (_, index) => index);
  await runPool(rows, lanes, async (_lane, row) => {
    const appName = row.display_name?.trim() || row.name;
    try {
      let listing: ResolvedListing;
      const storeId = appleStoreId(row.website_url);
      if (storeId) {
        const item = appleListings.get(storeId);
        const description = item?.description && chooseAppStoreDescription(item.description, appName);
        if (!description) throw new Error("Apple lookup did not return a suitable description");
        listing = {
          description,
          source: "apple-app-store-listing",
          sourceUrl: item?.trackViewUrl ?? row.website_url,
        };
      } else if (googlePlayId(row.website_url) && context) {
        listing = await scanGooglePlay(context, row.website_url, appName);
      } else {
        throw new Error("Unsupported mobile listing URL");
      }

      let applied = false;
      if (apply) {
        const updated = await query(
          `UPDATE apps
           SET description = $1,
               description_source = $2,
               description_source_url = $3,
               description_updated_at = now()
           WHERE id = $4
             AND NULLIF(BTRIM(description), '') IS NULL`,
          [listing.description, listing.source, listing.sourceUrl, row.id],
        );
        applied = updated.rowCount === 1;
      }
      results.push({ appId: row.id, app: appName, status: "resolved", applied, ...listing });
    } catch (error) {
      results.push({
        appId: row.id,
        app: appName,
        status: "failed",
        reason: error instanceof Error ? error.message : "Mobile store scan failed",
        sourceUrl: row.website_url,
      });
    }
    completed += 1;
    if (completed % 25 === 0 || completed === rows.length) {
      console.error(`Mobile description scan ${completed}/${rows.length}`);
    }
  });
} finally {
  await context?.close();
  await browser?.close();
  await closePool();
}

const resolved = results.filter((result): result is Extract<Result, { status: "resolved" }> =>
  result.status === "resolved"
);
const failed = results.filter((result): result is Extract<Result, { status: "failed" }> =>
  result.status === "failed"
);

console.log(JSON.stringify({
  mode: apply ? "apply" : "dry-run",
  provider: "official mobile store listings",
  platform,
  examined: rows.length,
  resolved: resolved.length,
  applied: resolved.filter((result) => result.applied).length,
  failed: failed.length,
  sources: {
    appleAppStore: resolved.filter((result) => result.source === "apple-app-store-listing").length,
    googlePlay: resolved.filter((result) => result.source === "google-play-listing").length,
  },
  resolvedExamples: resolved.slice(0, 25),
  failedExamples: failed.slice(0, 25),
}, null, 2));
