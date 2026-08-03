import { chromium, type BrowserContext, type Page } from "playwright";
import {
  chooseAppWebsiteDescription,
  type WebsiteDescriptionCandidate,
  type WebsiteDescriptionSource,
} from "../src/appWebsiteDescription.ts";
import { closePool, query } from "../src/db.ts";
import { canonicalPublicPageUrl } from "../src/publicPage.ts";
import { createPublicNetworkValidator } from "../src/publicPageBrowser.ts";
import { createPinnedPublicProxy } from "../src/publicNetworkProxy.ts";
import { runPool } from "../src/pool.ts";

interface AppDescriptionRow {
  id: number;
  name: string;
  display_name: string | null;
  website_url: string;
}

type PlatformFilter = "web" | "ios" | "android" | "all";

type BackfillResult = {
  appId: number;
  app: string;
  status: "resolved";
  description: string;
  source: WebsiteDescriptionSource;
  sourceUrl: string;
  applied: boolean;
} | {
  appId: number;
  app: string;
  status: "failed";
  reason: string;
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
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${flag} must be a positive integer`);
  }
  return value;
}

function nonNegativeArgument(flag: string, fallback: number): number {
  const raw = argument(flag);
  if (raw === null) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${flag} must be a non-negative integer`);
  }
  return value;
}

function platformArgument(): PlatformFilter {
  const value = argument("--platform") ?? "web";
  if (value !== "web" && value !== "ios" && value !== "android" && value !== "all") {
    throw new Error("--platform must be web, ios, android, or all");
  }
  return value;
}

async function sourceRows(input: {
  platform: PlatformFilter;
  app: string | null;
  limit: number | null;
  sample: boolean;
}): Promise<AppDescriptionRow[]> {
  const result = await query<AppDescriptionRow>(
    `SELECT app.id, app.name, app.display_name, app.website_url
     FROM apps app
     WHERE NULLIF(BTRIM(app.description), '') IS NULL
       AND NULLIF(BTRIM(app.website_url), '') IS NOT NULL
       AND ($1::text IS NULL OR app.name = $1 OR app.display_name = $1)
       AND EXISTS (
         SELECT 1
         FROM app_versions version
         WHERE version.app_id = app.id
           AND version.status = 'published'
           AND ($2::text IS NULL OR version.platform = $2)
       )
     ORDER BY ${input.sample ? "md5(app.id::text)" : "app.id"}
     LIMIT COALESCE($3::integer, 2147483647)`,
    [input.app, input.platform === "all" ? null : input.platform, input.limit],
  );
  return result.rows;
}

const wait = (milliseconds: number) => new Promise((resolve) => {
  setTimeout(resolve, milliseconds);
});

async function renderedCandidates(page: Page): Promise<WebsiteDescriptionCandidate[]> {
  return await page.evaluate<WebsiteDescriptionCandidate[]>(`(() => {
    const candidates = [];
    const clean = (value) => value ? value.replace(/\\s+/g, " ").trim() : "";
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden"
        && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0;
    };
    const push = (elements, source) => {
      let position = 0;
      for (const element of elements) {
        if (!visible(element)) continue;
        const text = clean(element.textContent);
        if (text) candidates.push({ text, source, position });
        position += 1;
      }
    };

    const heading = [...document.querySelectorAll("h1")]
      .find((element) => visible(element) && clean(element.textContent).length > 5);
    if (heading) {
      let hero = heading.parentElement;
      for (let depth = 0; hero && depth < 5; depth += 1) {
        const paragraphs = hero.querySelectorAll(":scope p");
        if (paragraphs.length > 0) {
          push(paragraphs, "hero");
          break;
        }
        hero = hero.parentElement;
      }
    }

    push(document.querySelectorAll("main p, [role='main'] p, body p"), "body");
    const metadata = [...document.querySelectorAll(
      "meta[name='description'], meta[property='og:description']",
    )]
      .map((element) => clean(element.content))
      .filter((text, index, values) => text && values.indexOf(text) === index);
    metadata.forEach((text, position) => {
      candidates.push({ text, source: "metadata", position });
    });
    if (metadata.length > 1) {
      const combined = [...metadata]
        .sort((left, right) => right.length - left.length)
        .join(" ");
      candidates.push({ text: combined, source: "metadata", position: -1 });
    }
    return candidates;
  })()`);
}

async function scanWebsite(
  context: BrowserContext,
  validateNavigation: (url: string) => Promise<void>,
  appName: string,
  value: string,
): Promise<{
  description: string;
  source: WebsiteDescriptionSource;
  sourceUrl: string;
}> {
  const requestedUrl = canonicalPublicPageUrl(value).requestedUrl;
  await validateNavigation(requestedUrl);
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const page = await context.newPage();
    try {
      const response = await page.goto(requestedUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      if (!response || response.status() >= 400) {
        throw new Error(`Official website returned ${response?.status() ?? "no response"}`);
      }
      await page.waitForTimeout(1_000);
      const sourceUrl = canonicalPublicPageUrl(page.url()).requestedUrl;
      await validateNavigation(sourceUrl);
      const selected = chooseAppWebsiteDescription(
        await renderedCandidates(page),
        appName,
      );
      if (!selected) throw new Error("No suitable visible description found");
      const requestedHostname = new URL(requestedUrl).hostname.replace(/^www\./, "");
      const sourceHostname = new URL(sourceUrl).hostname.replace(/^www\./, "");
      const sameSite = requestedHostname === sourceHostname
        || requestedHostname.endsWith(`.${sourceHostname}`)
        || sourceHostname.endsWith(`.${requestedHostname}`);
      if (
        !sameSite
        && !selected.description.toLocaleLowerCase().includes(appName.toLocaleLowerCase())
      ) {
        throw new Error("Official URL redirected to a different product");
      }
      return { ...selected, sourceUrl };
    } catch (error) {
      lastError = error;
      if (attempt < 2) await wait(750);
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
const sample = hasFlag("--sample");
const concurrency = positiveArgument("--concurrency", 3);
const delayMs = nonNegativeArgument("--delay-ms", 250);
const rows = await sourceRows({ platform, app, limit, sample });
const results: BackfillResult[] = [];
const proxy = await createPinnedPublicProxy();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  proxy: { server: proxy.server },
  serviceWorkers: "block",
});
await context.route("**/*", async (route) => {
  const resourceType = route.request().resourceType();
  if (resourceType === "image" || resourceType === "media" || resourceType === "font") {
    await route.abort("blockedbyclient");
    return;
  }
  await route.continue();
});
const validateNavigation = createPublicNetworkValidator();
let completed = 0;

try {
  const lanes = Array.from(
    { length: Math.min(concurrency, Math.max(rows.length, 1)) },
    (_, index) => index,
  );
  await runPool(rows, lanes, async (_lane, row) => {
    const appName = row.display_name?.trim() || row.name;
    try {
      const scanned = await scanWebsite(
        context,
        validateNavigation,
        appName,
        row.website_url,
      );
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
          [
            scanned.description,
            `official-website-${scanned.source}`,
            scanned.sourceUrl,
            row.id,
          ],
        );
        applied = updated.rowCount === 1;
      }
      results.push({
        appId: row.id,
        app: appName,
        status: "resolved",
        ...scanned,
        applied,
      });
    } catch (error) {
      results.push({
        appId: row.id,
        app: appName,
        status: "failed",
        reason: error instanceof Error ? error.message : "Official website scan failed",
      });
    }
    completed += 1;
    console.error(`Website description scan ${completed}/${rows.length}: ${appName}`);
    if (delayMs > 0) await wait(delayMs);
  });
} finally {
  await context.close();
  await browser.close();
  await proxy.close();
  await closePool();
}

const resolved = results.filter(
  (result): result is Extract<BackfillResult, { status: "resolved" }> =>
    result.status === "resolved",
);
const failed = results.filter(
  (result): result is Extract<BackfillResult, { status: "failed" }> =>
    result.status === "failed",
);

console.log(JSON.stringify({
  mode: apply ? "apply" : "dry-run",
  provider: "official website scan",
  platform,
  examined: rows.length,
  resolved: resolved.length,
  applied: resolved.filter((result) => result.applied).length,
  failed: failed.length,
  sources: {
    hero: resolved.filter((result) => result.source === "hero").length,
    body: resolved.filter((result) => result.source === "body").length,
    metadataFallback: resolved.filter((result) => result.source === "metadata").length,
  },
  resolvedExamples: resolved.slice(0, 25),
  failedExamples: failed.slice(0, 25),
}, null, 2));
