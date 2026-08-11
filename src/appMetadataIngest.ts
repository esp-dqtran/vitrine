import { chromium, type Page } from "playwright";
import {
  analyzeAppCategories,
  type AnalyzeAppCategoryInput,
  type AppCategoryAnalysis,
  type AppCategoryOption,
} from "./appCategoryAnalysis.ts";
import { resolveAppIcon, type ResolvedAppIcon } from "./appIconResolver.ts";
import { storeAppIcon, storeAppIconBuffer } from "./appIconStore.ts";
import {
  chooseAppWebsiteDescription,
  type WebsiteDescriptionCandidate,
} from "./appWebsiteDescription.ts";
import { query } from "./db.ts";
import type { ObjectStore } from "./objectStore.ts";
import { canonicalPublicPageUrl } from "./publicPage.ts";
import { createPublicNetworkValidator } from "./publicPageBrowser.ts";
import { createPinnedPublicProxy } from "./publicNetworkProxy.ts";

export interface InspectedAppMetadata {
  displayName: string;
  canonicalUrl: string;
  descriptionCandidates: WebsiteDescriptionCandidate[];
  brandIconSvg: string | null;
}

export interface AppMetadataIngestResult {
  id: number;
  app: string;
  displayName: string | null;
  description: string | null;
  websiteUrl: string;
  iconUrl: string | null;
  categories: AppCategoryOption[];
  categoryAnalysis: Pick<AppCategoryAnalysis, "rationale" | "provider"> | null;
  created: boolean;
  complete: boolean;
  issues: string[];
}

interface AppRecordRow extends Record<string, unknown> {
  id: number;
  name: string;
  display_name: string | null;
  description: string | null;
  website_url: string | null;
  icon_url: string | null;
}

export interface AppMetadataIngestDependencies {
  objectStore: ObjectStore;
  runQuery?<T extends Record<string, unknown>>(
    sql: string,
    values?: readonly unknown[],
  ): Promise<{ rows: T[]; rowCount: number | null }>;
  inspect?(sourceUrl: string, appName: string): Promise<InspectedAppMetadata>;
  resolveIcon?(sourceUrl: string, appName: string): Promise<ResolvedAppIcon | null>;
  storeIcon?(appId: number, source: string | Buffer): Promise<string>;
  analyzeCategories?(input: AnalyzeAppCategoryInput): Promise<AppCategoryAnalysis>;
}

function cleanName(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, 160) : "";
}

export async function renderedDescriptionCandidates(page: Page): Promise<{
  displayName: string;
  candidates: WebsiteDescriptionCandidate[];
  brandIconSvg: string | null;
}> {
  // Keep this callback as source text. The tsx/esbuild runtime otherwise injects its
  // private `__name` helper into nested browser functions, where Playwright cannot see it.
  return page.evaluate(String.raw`(() => {
    const clean = (value, maximum = 500) => typeof value === "string"
      ? value.replace(/\s+/g, " ").trim().slice(0, maximum)
      : "";
    const meta = (selector) => clean(
      document.querySelector(selector)?.content,
    );
    const title = clean(
      document.title.replace(/^home\s*[|/\\]\s*/i, "").split(/\s+[|–—-]\s+/)[0],
      160,
    );
    const displayName = meta('meta[property="og:site_name"]')
      || clean(document.querySelector("h1")?.textContent, 160)
      || title
      || location.hostname.replace(/^www\./, "").split(".")[0];
    const escapeXml = (value) => String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const brandLinks = [...document.querySelectorAll('header a, nav a, a[href="/"], a[href="./"]')];
    const brandLink = brandLinks.find((link) => {
      const text = clean(link.textContent, 160).toLowerCase();
      const name = displayName.toLowerCase();
      return link.querySelector("svg path[d]") && (text === name || text.startsWith(name + " "));
    });
    const brandSvg = brandLink?.querySelector("svg");
    const viewBox = brandSvg?.getAttribute("viewBox")?.trim();
    const viewBoxParts = viewBox?.split(/[ ,]+/).map(Number);
    const paths = brandSvg ? [...brandSvg.querySelectorAll("path[d]")].slice(0, 20) : [];
    let brandIconSvg = null;
    if (viewBox && viewBoxParts?.length === 4 && viewBoxParts.every(Number.isFinite) && paths.length) {
      const [x, y, width, height] = viewBoxParts;
      const artwork = paths.map((path) => {
        const rule = path.getAttribute("fill-rule");
        const clipRule = path.getAttribute("clip-rule");
        return '<path d="' + escapeXml(path.getAttribute("d")) + '"'
          + (rule ? ' fill-rule="' + escapeXml(rule) + '"' : "")
          + (clipRule ? ' clip-rule="' + escapeXml(clipRule) + '"' : "")
          + '/>';
      }).join("");
      brandIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + escapeXml(viewBox) + '">'
        + '<rect x="' + x + '" y="' + y + '" width="' + width + '" height="' + height + '" rx="8" fill="#111111"/>'
        + '<g fill="#f5f5f5">' + artwork + '</g></svg>';
    }
    const candidates = [];
    const add = (text, source, position) => {
      if (text) candidates.push({ text, source, position });
    };
    add(meta('meta[property="og:description"]'), "metadata", 0);
    add(meta('meta[name="description"]'), "metadata", 1);
    add(meta('meta[name="twitter:description"]'), "metadata", 2);
    const heading = document.querySelector("h1");
    const hero = heading?.closest("header, main, section, article, div");
    for (const [index, element] of [...(hero?.querySelectorAll("p") ?? [])].slice(0, 4).entries()) {
      add(clean(element.textContent), "hero", index);
    }
    for (const [index, element] of [...document.querySelectorAll("main p, article p")].slice(0, 20).entries()) {
      add(clean(element.textContent), "body", index);
    }
    return { displayName, candidates, brandIconSvg };
  })()`) as Promise<{
    displayName: string;
    candidates: WebsiteDescriptionCandidate[];
    brandIconSvg: string | null;
  }>;
}

export async function inspectOfficialAppMetadata(
  sourceUrl: string,
  appName: string,
): Promise<InspectedAppMetadata> {
  const requestedUrl = canonicalPublicPageUrl(sourceUrl).requestedUrl;
  const validateNavigation = createPublicNetworkValidator();
  await validateNavigation(requestedUrl);
  const proxy = await createPinnedPublicProxy();
  const browser = await chromium.launch({ headless: true }).catch(async (error) => {
    await proxy.close();
    throw error;
  });
  try {
    const context = await browser.newContext({
      proxy: { server: proxy.server },
      viewport: { width: 1440, height: 900 },
      serviceWorkers: "block",
    });
    try {
      const page = await context.newPage();
      await page.route("**/*", async (route) => {
        const resourceType = route.request().resourceType();
        if (resourceType === "image" || resourceType === "media" || resourceType === "font") {
          await route.abort("blockedbyclient");
          return;
        }
        await route.continue();
      });
      const response = await page.goto(requestedUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      if (!response || response.status() >= 400) {
        throw new Error(`Official App URL returned ${response?.status() ?? "no response"}`);
      }
      await page.waitForTimeout(500);
      const canonicalUrl = canonicalPublicPageUrl(page.url()).requestedUrl;
      await validateNavigation(canonicalUrl);
      const rendered = await renderedDescriptionCandidates(page);
      return {
        displayName: cleanName(rendered.displayName) || cleanName(appName),
        canonicalUrl,
        descriptionCandidates: rendered.candidates,
        brandIconSvg: rendered.brandIconSvg,
      };
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
    await proxy.close();
  }
}

export async function ingestAppMetadata(
  input: { app: string; sourceUrl: string },
  dependencies: AppMetadataIngestDependencies,
): Promise<AppMetadataIngestResult> {
  const sourceUrl = canonicalPublicPageUrl(input.sourceUrl).requestedUrl;
  const runQuery = dependencies.runQuery ?? (async <T extends Record<string, unknown>>(
    sql: string,
    values?: readonly unknown[],
  ) => query<T>(sql, values ? [...values] : undefined));
  const inserted = await runQuery<AppRecordRow & { created: boolean }>(
    `INSERT INTO apps (name, website_url)
     VALUES ($1, $2)
     ON CONFLICT (name) DO UPDATE SET
       website_url = COALESCE(apps.website_url, EXCLUDED.website_url)
     RETURNING id, name, display_name, description, website_url, icon_url,
       (xmax = 0) AS created`,
    [input.app, sourceUrl],
  );
  const initial = inserted.rows[0];
  if (!initial) throw new Error("App record could not be created");

  const inspect = dependencies.inspect ?? inspectOfficialAppMetadata;
  const resolveIcon = dependencies.resolveIcon ?? resolveAppIcon;
  const storeIcon = dependencies.storeIcon
    ?? ((appId: number, source: string | Buffer) => typeof source === "string"
      ? storeAppIcon({ objectStore: dependencies.objectStore }, appId, source)
      : storeAppIconBuffer({ objectStore: dependencies.objectStore }, appId, source));
  const analyzeCategories = dependencies.analyzeCategories ?? analyzeAppCategories;
  const [inspectionResult, iconResult] = await Promise.allSettled([
    inspect(sourceUrl, initial.display_name ?? input.app),
    resolveIcon(sourceUrl, initial.display_name ?? input.app),
  ]);
  const issues: string[] = [];
  let description: string | null = initial.description;
  let displayName: string | null = initial.display_name;
  let websiteUrl = initial.website_url ?? sourceUrl;
  let iconUrl: string | null = initial.icon_url;
  let categories: AppCategoryOption[] = [];
  let categoryAnalysis: Pick<AppCategoryAnalysis, "rationale" | "provider"> | null = null;

  if (inspectionResult.status === "fulfilled") {
    const inspection = inspectionResult.value;
    const selected = chooseAppWebsiteDescription(
      inspection.descriptionCandidates,
      inspection.displayName || input.app,
    );
    displayName = inspection.displayName || displayName;
    websiteUrl = inspection.canonicalUrl;
    if (selected || displayName || websiteUrl) {
      description = description ?? selected?.description ?? null;
      await runQuery(
        `UPDATE apps SET
           display_name = COALESCE(display_name, $2),
           description = COALESCE(description, $3),
           description_source = CASE WHEN description IS NULL AND $3::text IS NOT NULL THEN $4 ELSE description_source END,
           description_source_url = CASE WHEN description IS NULL AND $3::text IS NOT NULL THEN $5 ELSE description_source_url END,
           description_updated_at = CASE WHEN description IS NULL AND $3::text IS NOT NULL THEN now() ELSE description_updated_at END,
           website_url = $5
         WHERE id = $1`,
        [
          initial.id,
          displayName,
          description,
          selected ? `official-website-${selected.source}` : null,
          websiteUrl,
        ],
      );
    }
    if (!description) {
      issues.push("description_unresolved");
    }
  } else {
    issues.push("description_inspection_failed");
  }

  const inspectedBrandIcon = inspectionResult.status === "fulfilled"
    ? inspectionResult.value.brandIconSvg
    : null;
  const iconSource = inspectedBrandIcon
    ? Buffer.from(inspectedBrandIcon, "utf8")
    : iconResult.status === "fulfilled"
      ? iconResult.value?.url
      : null;
  if (iconSource) {
    try {
      iconUrl = await storeIcon(initial.id, iconSource);
    } catch {
      if (!iconUrl) issues.push("icon_storage_failed");
    }
  } else if (!iconUrl) {
    issues.push(iconResult.status === "rejected" ? "icon_resolution_failed" : "icon_unresolved");
  }

  if (displayName && description && inspectionResult.status === "fulfilled") {
    try {
      const analysis = await analyzeCategories({
        appId: initial.id,
        app: initial.name,
        displayName,
        websiteUrl,
        description,
        researchText: inspectionResult.value.descriptionCandidates.map(({ text }) => text),
      });
      categories = analysis.categories;
      categoryAnalysis = { rationale: analysis.rationale, provider: analysis.provider };
    } catch {
      issues.push("category_analysis_failed");
    }
  }
  if (!categories.length) {
    const existing = await runQuery<AppCategoryOption & Record<string, unknown>>(
      `SELECT c.id, c.name, c.slug
       FROM app_categories ac
       JOIN categories c ON c.id = ac.category_id
       WHERE ac.app_id = $1
       ORDER BY lower(c.name), c.id`,
      [initial.id],
    );
    categories = existing.rows;
  }
  if (!categories.length && !issues.includes("category_analysis_failed")) {
    issues.push("category_unresolved");
  }

  return {
    id: initial.id,
    app: initial.name,
    displayName,
    description,
    websiteUrl,
    iconUrl,
    categories,
    categoryAnalysis,
    created: Boolean(initial.created),
    complete: Boolean(description && iconUrl && categories.length),
    issues,
  };
}
