import { spawn } from "node:child_process";
import { chromium, type Page } from "playwright";
import { closePool, pool } from "../src/db.ts";
import {
  googlePlayListing,
  googlePlayListingsInHtml,
  googlePlayTitleMatches,
  googlePlayWebsiteMatches,
} from "../src/googlePlayImport.ts";

interface Candidate {
  app: string;
  displayName: string;
  versionId: number;
  websiteUrl: string;
}

interface OfficialIdentity {
  website: string;
  searchName: string;
}

interface ResolvedListing {
  listing: string;
  packageId: string;
  title: string;
  source: "official-site" | "verified-search";
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

function positiveInteger(value: string | undefined, name: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

async function fetchPage(url: string): Promise<{ html: string; finalUrl: string }> {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "Mozilla/5.0 (compatible; VitrinesCatalog/1.0)",
    },
  });
  if (!response.ok) throw new Error(`official website returned ${response.status}`);
  const html = await response.text();
  if (html.length > 8 * 1024 * 1024) throw new Error("official website response is too large");
  return { html, finalUrl: response.url };
}

async function redirectedUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; VitrinesCatalog/1.0)" },
    });
    return response.url || url;
  } catch {
    return url;
  }
}

async function appleIdentity(candidate: Candidate, url: URL): Promise<OfficialIdentity | null> {
  const appStoreId = url.pathname.match(/\/id(\d+)\/?$/)?.[1];
  if (!appStoreId) return null;
  const endpoint = new URL("https://itunes.apple.com/lookup");
  endpoint.search = new URLSearchParams({
    id: appStoreId,
    country: url.pathname.split("/")[1] || "us",
    entity: "software",
  }).toString();
  const response = await fetch(endpoint, {
    signal: AbortSignal.timeout(15_000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Apple identity lookup returned ${response.status}`);
  const result = (await response.json() as {
    results?: Array<{ sellerUrl?: unknown; trackName?: unknown }>;
  }).results?.[0];
  return typeof result?.sellerUrl === "string"
    ? {
      website: result.sellerUrl,
      searchName: typeof result.trackName === "string" ? result.trackName : candidate.displayName,
    }
    : null;
}

async function officialIdentity(candidate: Candidate): Promise<{
  identity: OfficialIdentity | null;
  direct: ResolvedListing | null;
}> {
  let parsed: URL;
  try {
    parsed = new URL(candidate.websiteUrl);
  } catch {
    return { identity: null, direct: null };
  }
  if (parsed.hostname === "apps.apple.com" || parsed.hostname === "itunes.apple.com") {
    return { identity: await appleIdentity(candidate, parsed), direct: null };
  }
  if (!parsed.protocol.startsWith("http")) return { identity: null, direct: null };
  let page: { html: string; finalUrl: string };
  try {
    page = await fetchPage(parsed.toString());
  } catch {
    // A protected official site may reject automated HTML requests while its
    // hostname still provides a strong identity check against Google Play's
    // developer website field.
    return {
      identity: { website: parsed.toString(), searchName: candidate.displayName },
      direct: null,
    };
  }
  const listings = googlePlayListingsInHtml(page.html);
  const direct = listings.length === 1
    ? { ...listings[0]!, listing: listings[0]!.url, title: candidate.displayName, source: "official-site" as const }
    : null;
  return {
    identity: { website: page.finalUrl, searchName: candidate.displayName },
    direct,
  };
}

async function searchGooglePlay(
  page: Page,
  candidate: Candidate,
  identity: OfficialIdentity,
): Promise<ResolvedListing | null> {
  const search = new URL("https://play.google.com/store/search");
  search.search = new URLSearchParams({ q: identity.searchName, c: "apps", hl: "en_US", gl: "US" }).toString();
  await page.goto(search.toString(), { waitUntil: "domcontentloaded", timeout: 45_000 });
  const first = page.locator('a[href*="/store/apps/details?id="]').first();
  await first.waitFor({ state: "attached", timeout: 15_000 });
  const result = await first.evaluate((anchor) => ({
    href: (anchor as HTMLAnchorElement).href,
    title: anchor.getAttribute("aria-label")
      || anchor.querySelector("span")?.textContent?.trim()
      || "",
  }));
  if (!result.href || (!googlePlayTitleMatches(identity.searchName, result.title)
    && !googlePlayTitleMatches(candidate.displayName, result.title))) return null;
  const listing = googlePlayListing(result.href);
  await page.goto(listing.url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  const title = (await page.locator("h1").first().innerText({ timeout: 15_000 })).trim();
  if (!googlePlayTitleMatches(identity.searchName, title)
    && !googlePlayTitleMatches(candidate.displayName, title)) return null;
  const websiteLink = page.locator('a[aria-label^="Website "]').first();
  if (await websiteLink.count() === 0) return null;
  const storeWebsite = await websiteLink.getAttribute("href");
  if (!storeWebsite) return null;
  if (!googlePlayWebsiteMatches(identity.website, storeWebsite)) {
    const [resolvedIdentityWebsite, resolvedStoreWebsite] = await Promise.all([
      redirectedUrl(identity.website),
      redirectedUrl(storeWebsite),
    ]);
    if (!googlePlayWebsiteMatches(resolvedIdentityWebsite, resolvedStoreWebsite)) return null;
  }
  return { listing: listing.url, packageId: listing.packageId, title, source: "verified-search" };
}

async function runImporter(candidate: Candidate, listing: string, apply: boolean): Promise<void> {
  const args = [
    "--env-file=.env", "--import", "tsx",
    "scripts/import-google-play-screenshots.ts",
    "--app", candidate.app,
    "--version-id", String(candidate.versionId),
    "--listing", listing,
    ...(apply ? ["--apply"] : []),
  ];
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(), env: process.env, stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stdout.on("data", (chunk) => process.stdout.write(chunk));
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.once("error", reject);
    child.once("close", (code) => code === 0
      ? resolve()
      : reject(new Error(stderr.trim() || `Google Play importer exited ${code}`)));
  });
}

const apply = process.argv.includes("--apply");
const limit = option("--limit") === undefined ? Infinity : positiveInteger(option("--limit"), "--limit");
const startAfter = option("--start-after")?.trim();
const startAt = option("--start-at")?.trim();
const endBefore = option("--end-before")?.trim();
const candidates = await pool.query<Candidate>(
  `WITH latest AS (
     SELECT DISTINCT ON (av.app_id) av.id AS version_id, av.app_id, av.source_url
     FROM app_versions av
     WHERE av.platform = 'android' AND av.status = 'published'
     ORDER BY av.app_id, av.version_number DESC
   )
   SELECT a.name AS app, COALESCE(a.display_name, a.name) AS "displayName",
     latest.version_id AS "versionId", a.website_url AS "websiteUrl"
   FROM latest JOIN apps a ON a.id = latest.app_id
   WHERE COALESCE(latest.source_url, '') !~ '^https://play\\.google\\.com/store/apps/details\\?[^#]*id='
     AND COALESCE(a.website_url, '') !~ '^https://play\\.google\\.com/store/apps/details\\?[^#]*id='
   ORDER BY a.name`,
);
const queue = candidates.rows
  .filter((candidate) => !startAfter || candidate.app > startAfter)
  .filter((candidate) => !startAt || candidate.app >= startAt)
  .filter((candidate) => !endBefore || candidate.app < endBefore)
  .slice(0, limit);
console.log(JSON.stringify({
  status: "queued", candidates: candidates.rows.length, processing: queue.length,
  apply, startAfter: startAfter ?? null, startAt: startAt ?? null, endBefore: endBefore ?? null,
}));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ locale: "en-US", viewport: { width: 1_440, height: 1_200 } });
let imported = 0;
let skipped = 0;
let failed = 0;
try {
  for (const [index, candidate] of queue.entries()) {
    try {
      console.log(JSON.stringify({ status: "resolving", index: index + 1, total: queue.length, app: candidate.app }));
      const official = await officialIdentity(candidate);
      const resolved = official.direct
        ?? (official.identity ? await searchGooglePlay(page, candidate, official.identity) : null);
      if (!resolved) {
        skipped += 1;
        console.log(JSON.stringify({
          status: "skipped", index: index + 1, total: queue.length,
          app: candidate.app, reason: "no verified Google Play match",
        }));
        continue;
      }
      console.log(JSON.stringify({
        status: "matched", index: index + 1, total: queue.length, app: candidate.app,
        packageId: resolved.packageId, title: resolved.title, source: resolved.source,
      }));
      await runImporter(candidate, resolved.listing, apply);
      imported += 1;
    } catch (error) {
      failed += 1;
      console.error(JSON.stringify({
        status: "failed", index: index + 1, total: queue.length, app: candidate.app,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }
} finally {
  await browser.close();
  await closePool();
}
console.log(JSON.stringify({ status: "complete", processed: queue.length, imported, skipped, failed, apply }));
