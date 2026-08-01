import sharp from "sharp";
import { canonicalPublicPageUrl } from "./publicPage.ts";

export type AppIconSource =
  | "apple-app-store"
  | "google-play"
  | "web-manifest"
  | "apple-touch-icon"
  | "website-icon";

export interface AppIconCandidate {
  url: string;
  source: AppIconSource;
  declaredSize?: number;
}

export interface ResolvedAppIcon extends AppIconCandidate {
  width: number | null;
  height: number | null;
  format: string | null;
}

const USER_AGENT = "Astryx app icon resolver/1.0";
const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;
const MAX_ICON_BYTES = 8 * 1024 * 1024;
const MAX_CANDIDATES = 16;

function isAppleStoreHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "apps.apple.com" || host === "itunes.apple.com";
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function attributes(tag: string): Map<string, string> {
  const result = new Map<string, string>();
  const body = tag.replace(/^<\s*[a-z0-9:-]+/i, "").replace(/\/?\s*>$/, "");
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of body.matchAll(pattern)) {
    result.set(match[1].toLowerCase(), decodeHtml(match[2] ?? match[3] ?? match[4] ?? ""));
  }
  return result;
}

function publicUrl(value: string, base?: string): string | null {
  try {
    return canonicalPublicPageUrl(new URL(value.trim(), base).toString()).requestedUrl;
  } catch {
    return null;
  }
}

function declaredSize(value: string | undefined, url: string): number | undefined {
  if (/\.svg(?:$|[?#])/i.test(url)) return 2_048;
  const sizes = value?.match(/\d+\s*x\s*\d+/gi) ?? [];
  const parsed = sizes
    .map((size) => size.toLowerCase().split("x").map(Number))
    .filter(([width, height]) => width > 0 && height > 0)
    .map(([width, height]) => Math.min(width, height));
  return parsed.length ? Math.max(...parsed) : undefined;
}

function candidateScore(candidate: AppIconCandidate): number {
  const sourceBonus: Record<AppIconSource, number> = {
    "apple-app-store": 5_000,
    "google-play": 5_000,
    "web-manifest": 1_000,
    "apple-touch-icon": 800,
    "website-icon": 200,
  };
  return sourceBonus[candidate.source] + Math.min(candidate.declaredSize ?? 0, 4_096);
}

function uniqueCandidates(candidates: AppIconCandidate[]): AppIconCandidate[] {
  const seen = new Set<string>();
  return candidates
    .filter(({ url }) => {
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    })
    .sort((left, right) => candidateScore(right) - candidateScore(left))
    .slice(0, MAX_CANDIDATES);
}

export function appleAppStoreId(value: string): string | null {
  try {
    const url = new URL(value);
    if (!isAppleStoreHost(url.hostname)) return null;
    return url.pathname.match(/\/id(\d+)(?:\/|$)/i)?.[1] ?? null;
  } catch {
    return null;
  }
}

export function appleAppStoreCountry(value: string): string {
  try {
    const url = new URL(value);
    if (!isAppleStoreHost(url.hostname)) return "us";
    const country = url.pathname.split("/").filter(Boolean)[0]?.toLowerCase();
    return country && /^[a-z]{2}$/.test(country) ? country : "us";
  } catch {
    return "us";
  }
}

function jsonImageUrls(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(jsonImageUrls);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  return [record.url, record.contentUrl].flatMap(jsonImageUrls);
}

function jsonSoftwareImages(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(jsonSoftwareImages);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const type = record["@type"];
  const types = Array.isArray(type) ? type : [type];
  const own = types.some((entry) => typeof entry === "string" && /softwareapplication/i.test(entry))
    ? jsonImageUrls(record.image)
    : [];
  return [...own, ...Object.values(record).flatMap(jsonSoftwareImages)];
}

export function extractGooglePlayIconUrls(html: string, baseUrl: string): string[] {
  const urls: string[] = [];
  for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*(?:"application\/ld\+json"|'application\/ld\+json'|application\/ld\+json)[^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    try {
      urls.push(...jsonSoftwareImages(JSON.parse(match[1])));
    } catch {
      // Ignore malformed structured data and try the remaining page metadata.
    }
  }
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attrs = attributes(tag);
    const marker = (attrs.get("property") ?? attrs.get("itemprop") ?? "").toLowerCase();
    if (marker === "og:image" || marker === "image") {
      const content = attrs.get("content");
      if (content) urls.push(content);
    }
  }
  return [...new Set(urls.map((url) => publicUrl(url, baseUrl)).filter((url): url is string => Boolean(url)))];
}

export function extractWebsiteIconCandidates(html: string, baseUrl: string): {
  manifests: string[];
  icons: AppIconCandidate[];
} {
  const manifests: string[] = [];
  const icons: AppIconCandidate[] = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const attrs = attributes(tag);
    const rel = (attrs.get("rel") ?? "").toLowerCase().split(/\s+/).filter(Boolean);
    const href = attrs.get("href");
    if (!href) continue;
    const url = publicUrl(href, baseUrl);
    if (!url) continue;
    if (rel.includes("manifest")) manifests.push(url);
    const source = rel.some((part) => part === "apple-touch-icon" || part === "apple-touch-icon-precomposed")
      ? "apple-touch-icon"
      : rel.some((part) => part === "icon" || part === "shortcut")
        ? "website-icon"
        : null;
    if (source) icons.push({
      url,
      source,
      declaredSize: declaredSize(attrs.get("sizes"), url),
    });
  }
  return { manifests: [...new Set(manifests)], icons: uniqueCandidates(icons) };
}

export function extractManifestIconCandidates(value: unknown, manifestUrl: string): AppIconCandidate[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const icons = (value as { icons?: unknown }).icons;
  if (!Array.isArray(icons)) return [];
  return uniqueCandidates(icons.flatMap((entry): AppIconCandidate[] => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    if (typeof record.src !== "string") return [];
    const url = publicUrl(record.src, manifestUrl);
    if (!url) return [];
    return [{
      url,
      source: "web-manifest",
      declaredSize: declaredSize(typeof record.sizes === "string" ? record.sizes : undefined, url),
    }];
  }));
}

async function boundedBody(response: Response, maximum: number): Promise<Buffer> {
  const length = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > maximum) throw new Error(`response exceeded ${maximum} bytes`);
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximum) {
      await reader.cancel();
      throw new Error(`response exceeded ${maximum} bytes`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks, total);
}

async function fetchDocument(url: string): Promise<{ body: string; url: string }> {
  const response = await fetch(url, {
    headers: { accept: "text/html,application/json", "user-agent": USER_AGENT },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`${new URL(url).hostname} returned ${response.status}`);
  const finalUrl = publicUrl(response.url) ?? url;
  return { body: (await boundedBody(response, MAX_DOCUMENT_BYTES)).toString("utf8"), url: finalUrl };
}

async function appleCandidates(url: string): Promise<AppIconCandidate[]> {
  const id = appleAppStoreId(url);
  if (!id) return [];
  const lookup = new URL("https://itunes.apple.com/lookup");
  lookup.search = new URLSearchParams({ id, country: appleAppStoreCountry(url), entity: "software" }).toString();
  const document = await fetchDocument(lookup.toString());
  const payload = JSON.parse(document.body) as { results?: Array<Record<string, unknown>> };
  const result = payload.results?.[0];
  if (!result) return [];
  const candidates = [
    [result.artworkUrl512, 512],
    [result.artworkUrl100, 100],
    [result.artworkUrl60, 60],
  ] as const;
  return uniqueCandidates(candidates.flatMap(([raw, size]) => {
    if (typeof raw !== "string") return [];
    const iconUrl = publicUrl(raw);
    return iconUrl ? [{ url: iconUrl, source: "apple-app-store" as const, declaredSize: size }] : [];
  }));
}

function normalizedName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sameProductHost(left: string, right: string): boolean {
  try {
    const leftHost = new URL(left).hostname.toLowerCase().replace(/^www\./, "");
    const rightHost = new URL(right).hostname.toLowerCase().replace(/^www\./, "");
    return leftHost === rightHost || leftHost.endsWith(`.${rightHost}`) || rightHost.endsWith(`.${leftHost}`);
  } catch {
    return false;
  }
}

async function appleSearchCandidates(appName: string, productUrl: string): Promise<AppIconCandidate[]> {
  const expected = normalizedName(appName);
  if (expected.length < 2) return [];
  const search = new URL("https://itunes.apple.com/search");
  search.search = new URLSearchParams({ term: appName, entity: "software", country: "us", limit: "10" }).toString();
  const document = await fetchDocument(search.toString());
  const payload = JSON.parse(document.body) as { results?: Array<Record<string, unknown>> };
  const matches = (payload.results ?? []).flatMap((result) => {
    if (typeof result.trackName !== "string" || typeof result.sellerUrl !== "string") return [];
    const candidate = normalizedName(result.trackName);
    if (!sameProductHost(result.sellerUrl, productUrl)) return [];
    const rawName = result.trackName.trim().toLowerCase();
    const rawExpected = appName.trim().toLowerCase();
    const rank = candidate === expected
      ? 0
      : new RegExp(`^${rawExpected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[:—-]`).test(rawName)
        ? 1
        : candidate.startsWith(`${expected} `)
          ? 2
          : null;
    return rank === null ? [] : [{ result, rank }];
  });
  const bestRank = matches.length ? Math.min(...matches.map(({ rank }) => rank)) : null;
  const best = matches.filter(({ rank }) => rank === bestRank);
  if (best.length !== 1) return [];
  const result = best[0].result;
  return uniqueCandidates(([
    [result.artworkUrl512, 512],
    [result.artworkUrl100, 100],
    [result.artworkUrl60, 60],
  ] as const).flatMap(([raw, size]) => {
    if (typeof raw !== "string") return [];
    const iconUrl = publicUrl(raw);
    return iconUrl ? [{ url: iconUrl, source: "apple-app-store" as const, declaredSize: size }] : [];
  }));
}

async function googlePlayCandidates(url: string): Promise<AppIconCandidate[]> {
  const pageUrl = new URL(url);
  if (pageUrl.hostname.toLowerCase() !== "play.google.com") return [];
  pageUrl.searchParams.set("hl", "en");
  pageUrl.searchParams.set("gl", "US");
  const document = await fetchDocument(pageUrl.toString());
  return extractGooglePlayIconUrls(document.body, document.url).map((iconUrl) => ({
    url: iconUrl,
    source: "google-play",
    declaredSize: 512,
  }));
}

async function websiteCandidates(url: string): Promise<AppIconCandidate[]> {
  const document = await fetchDocument(url);
  const extracted = extractWebsiteIconCandidates(document.body, document.url);
  const manifestIcons: AppIconCandidate[] = [];
  for (const manifestUrl of extracted.manifests.slice(0, 3)) {
    try {
      const manifest = await fetchDocument(manifestUrl);
      manifestIcons.push(...extractManifestIconCandidates(JSON.parse(manifest.body), manifest.url));
    } catch {
      // A broken manifest should not hide valid touch icons or favicons from the page.
    }
  }
  const fallback = publicUrl("/favicon.ico", document.url);
  return uniqueCandidates([
    ...manifestIcons,
    ...extracted.icons,
    ...(fallback ? [{ url: fallback, source: "website-icon" as const }] : []),
  ]);
}

export async function discoverAppIconCandidates(websiteUrl: string): Promise<AppIconCandidate[]> {
  const url = canonicalPublicPageUrl(websiteUrl).requestedUrl;
  const host = new URL(url).hostname.toLowerCase();
  if (isAppleStoreHost(host)) return appleCandidates(url);
  if (host === "play.google.com") return googlePlayCandidates(url);
  try {
    return await websiteCandidates(url);
  } catch {
    const fallback = publicUrl("/favicon.ico", url);
    return fallback ? [{ url: fallback, source: "website-icon" }] : [];
  }
}

async function inspectCandidate(candidate: AppIconCandidate): Promise<ResolvedAppIcon | null> {
  const response = await fetch(candidate.url, {
    headers: { accept: "image/*,*/*;q=0.5", "user-agent": USER_AGENT },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) return null;
  const body = await boundedBody(response, MAX_ICON_BYTES);
  if (!body.length) return null;
  const metadata = await sharp(body, { limitInputPixels: 64 * 1024 * 1024 }).metadata();
  const width = metadata.width ?? null;
  const height = metadata.height ?? null;
  if (width && height && (Math.min(width, height) < 24 || Math.min(width, height) / Math.max(width, height) < 0.72)) {
    return null;
  }
  return { ...candidate, width, height, format: metadata.format ?? null };
}

function resolvedScore(icon: ResolvedAppIcon): number {
  const measured = icon.width && icon.height
    ? Math.min(icon.width, icon.height)
    : icon.format === "svg"
      ? 2_048
      : icon.declaredSize ?? 0;
  const sourceBonus: Record<AppIconSource, number> = {
    "apple-app-store": 10_000,
    "google-play": 10_000,
    "web-manifest": 2_000,
    "apple-touch-icon": 1_500,
    "website-icon": 0,
  };
  return sourceBonus[icon.source] + Math.min(measured, 4_096);
}

export async function resolveAppIcon(websiteUrl: string, appName?: string): Promise<ResolvedAppIcon | null> {
  const candidates = await discoverAppIconCandidates(websiteUrl);
  const inspected: ResolvedAppIcon[] = [];
  for (const candidate of candidates) {
    try {
      const icon = await inspectCandidate(candidate);
      if (icon) inspected.push(icon);
    } catch {
      // Keep testing candidates; many sites leave stale icon declarations behind.
    }
  }
  const bestWebsiteIcon = inspected.sort((left, right) => resolvedScore(right) - resolvedScore(left))[0];
  const measuredEdge = bestWebsiteIcon?.width && bestWebsiteIcon.height
    ? Math.min(bestWebsiteIcon.width, bestWebsiteIcon.height)
    : bestWebsiteIcon?.format === "svg"
      ? 2_048
      : bestWebsiteIcon?.declaredSize ?? 0;
  const host = new URL(websiteUrl).hostname.toLowerCase();
  if (appName && !isAppleStoreHost(host) && host !== "play.google.com" && measuredEdge < 128) {
    try {
      for (const candidate of await appleSearchCandidates(appName, websiteUrl)) {
        const icon = await inspectCandidate(candidate);
        if (icon) inspected.push(icon);
      }
    } catch {
      // The official website icon remains a valid fallback when Apple Search is unavailable.
    }
  }
  return inspected.sort((left, right) => resolvedScore(right) - resolvedScore(left))[0] ?? null;
}
