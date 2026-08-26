import { buildSitemapXml } from "./seoSitemap.ts";
import {
  metadataForApp,
  metadataForPath,
  metadataForSite,
  type SeoMetadata,
} from "./seoMetadata.ts";

interface StaticAssetsBinding {
  fetch(request: Request): Promise<Response>;
}

interface R2ObjectBody {
  body: ReadableStream | null;
  /** Size of the whole object, even when a range was requested. */
  size?: number;
  range?: { offset?: number; length?: number };
  httpMetadata?: { contentType?: string };
  writeHttpMetadata?(headers: Headers): void;
}

interface R2Range {
  offset?: number;
  length?: number;
  suffix?: number;
}

interface MediaBucketBinding {
  get(key: string, options?: { range: R2Range }): Promise<R2ObjectBody | null>;
}

// Video elements ask for byte ranges; answering every one with the whole file
// makes seeking impossible and re-sends megabytes. Only a single range is
// honoured — a multi-range request falls back to the full body, which is a
// valid response to any Range request.
export function parseByteRange(header: string | null): R2Range | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return null;
  if (!rawStart) return { suffix: Number(rawEnd) };
  const offset = Number(rawStart);
  if (!rawEnd) return { offset };
  const end = Number(rawEnd);
  return end < offset ? null : { offset, length: end - offset + 1 };
}

export interface CloudflareFrontendEnvironment {
  ASSETS: StaticAssetsBinding;
  API_ORIGIN?: string;
  /** R2 bucket holding crawled media. Optional so local dev works without it. */
  MEDIA?: MediaBucketBinding;
  /**
   * Key prefix the API writes under (OBJECT_STORE_S3_PREFIX). Object keys in
   * the database are stored without it, so the Worker has to add it back.
   */
  MEDIA_PREFIX?: string;
}

export function bucketKey(key: string, prefix: string | undefined): string {
  const trimmed = prefix?.replace(/^\/+|\/+$/g, "") ?? "";
  return trimmed ? `${trimmed}/${key}` : key;
}

// Object keys are namespaced by kind, and that namespace *is* the access
// boundary: `images/` and `research/` hold full-resolution screens and
// user-owned assets, which sit behind the unlock paywall. Everything below is
// already displayed to signed-out visitors on the public catalog, so it can be
// served straight from R2 without an origin call or a database lookup.
//
// Serving by prefix keeps that decision in one place. The bucket itself stays
// private — only these prefixes are reachable, and only through this Worker.
//
// Each prefix also needs a `run_worker_first` entry in wrangler.jsonc, or the
// static-asset router answers first and this code never runs.
export const PUBLIC_MEDIA_PREFIXES = ["thumbnails/", "sites/", "ui-elements/", "icons/"];

// `sites/` is the one prefix that mixes both cases. A Site version stores its
// card media next to the full-page screenshots, the per-section crops, the
// capture graph and the analysis evidence — the last four are the paid product
// and must keep going through the API's entitlement checks.
//
// Key shape: sites/<site>/versions/<version>/<kind>/<identity>/<sha>.<ext>
const PUBLIC_SITE_KINDS = new Set(["preview", "poster"]);

function isPublicMediaKey(key: string): boolean {
  if (!PUBLIC_MEDIA_PREFIXES.some((prefix) => key.startsWith(prefix))) return false;
  if (!key.startsWith("sites/")) return true;
  const segments = key.split("/");
  return segments[2] === "versions" && PUBLIC_SITE_KINDS.has(segments[4]);
}

// Keys embed a sha256 of their contents, so a changed image is a new key and
// these can never go stale.
const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

export function publicMediaKey(pathname: string): string | null {
  if (!pathname.startsWith("/assets/")) return null;
  let key: string;
  try {
    key = decodeURIComponent(pathname.slice("/assets/".length));
  } catch {
    return null;
  }
  // `..` cannot escape an R2 keyspace, but reject it anyway so the allowlist
  // below can never be sidestepped by a traversal-looking key.
  if (!key || key.includes("..")) return null;
  return isPublicMediaKey(key) ? key : null;
}

type ApiFetch = (request: Request) => Promise<Response>;

interface EdgeCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

const ORIGIN_CACHE_CONTROL_HEADER = "X-Vitrines-Origin-Cache-Control";
const EDGE_CACHE_VERSION = "2";

const PUBLIC_API_CACHE_PATHS = new Set([
  "/api/apps/stats",
  "/api/apps/categories",
  "/api/flows",
  "/api/flows/facets",
  "/api/apps/facet-preview",
  "/api/apps",
  "/api/sites",
  "/api/sites/facets",
]);

function defaultEdgeCache(): EdgeCache | null {
  return (globalThis as typeof globalThis & {
    caches?: { default?: EdgeCache };
  }).caches?.default ?? null;
}

function responseWithHeader(
  response: Response,
  name: string,
  value: string,
): Response {
  const headers = new Headers(response.headers);
  headers.set(name, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function publicApiResponseIsCacheable(response: Response): boolean {
  if (!response.ok || response.headers.has("set-cookie")) return false;
  const cacheControl = response.headers.get("cache-control")?.toLowerCase() ?? "";
  return cacheControl.includes("public")
    && !cacheControl.includes("private")
    && !cacheControl.includes("no-store");
}

function responseForEdgeCache(response: Response): Response {
  const headers = new Headers(response.headers);
  const cacheControl = headers.get("cache-control");
  if (cacheControl) headers.set(ORIGIN_CACHE_CONTROL_HEADER, cacheControl);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function cachedResponseForClient(response: Response): Response {
  const headers = new Headers(response.headers);
  const originCacheControl = headers.get(ORIGIN_CACHE_CONTROL_HEADER);
  if (originCacheControl) headers.set("Cache-Control", originCacheControl);
  headers.delete(ORIGIN_CACHE_CONTROL_HEADER);
  headers.set("X-Vitrines-Edge-Cache", "HIT");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function cacheKeyForRequest(request: Request): Request {
  const url = new URL(request.url);
  url.searchParams.set("__vitrines_cache", EDGE_CACHE_VERSION);
  return new Request(url, { method: "GET" });
}

function apiOrigin(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:")
      || url.username
      || url.password
      || url.pathname !== "/"
      || url.search
      || url.hash
    ) return null;
    return url;
  } catch {
    return null;
  }
}

function apiRequest(request: Request, origin: URL): Request {
  const incoming = new URL(request.url);
  const target = new URL(origin);
  target.pathname = incoming.pathname === "/api"
    ? "/"
    : incoming.pathname.slice("/api".length);
  target.search = incoming.search;
  return new Request(target, request);
}

// The API origin does not include the `/api` prefix, except for the canvas
// WebSocket gateway: Caddy uses that public path to select the collaboration
// service before falling back to the HTTP API. Keep this one path intact while
// preserving the request's Upgrade and Sec-WebSocket-Protocol headers.
function collaborationRequest(request: Request, origin: URL): Request {
  const incoming = new URL(request.url);
  const target = new URL(origin);
  target.pathname = incoming.pathname;
  target.search = incoming.search;
  return new Request(target, request);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceHtmlMeta(
  html: string,
  attribute: "name" | "property",
  key: string,
  content: string,
): string {
  const tag = `<meta ${attribute}="${key}" content="${escapeHtml(content)}" />`;
  const pattern = new RegExp(
    `<meta\\s+${attribute}=["']${escapeRegExp(key)}["'][^>]*>`,
    "i",
  );
  return pattern.test(html)
    ? html.replace(pattern, tag)
    : html.replace("</head>", `  ${tag}\n</head>`);
}

export function applyHtmlSeo(html: string, metadata: SeoMetadata): string {
  let result = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(metadata.title)}</title>`);
  result = replaceHtmlMeta(result, "name", "description", metadata.description);
  result = replaceHtmlMeta(result, "name", "robots", metadata.robots);
  result = replaceHtmlMeta(result, "property", "og:type", metadata.ogType ?? "website");
  result = replaceHtmlMeta(result, "property", "og:site_name", "Vitrines");
  result = replaceHtmlMeta(result, "property", "og:title", metadata.title);
  result = replaceHtmlMeta(result, "property", "og:description", metadata.description);
  result = replaceHtmlMeta(result, "property", "og:url", `https://vitrines.ai${metadata.canonicalPath}`);
  result = replaceHtmlMeta(result, "property", "og:image", metadata.image ?? "https://vitrines.ai/landing/vitrines-social-card-v6.png");
  result = replaceHtmlMeta(result, "property", "og:image:alt", `${metadata.title} — Vitrines`);
  result = replaceHtmlMeta(result, "name", "twitter:card", "summary_large_image");
  result = replaceHtmlMeta(result, "name", "twitter:title", metadata.title);
  result = replaceHtmlMeta(result, "name", "twitter:description", metadata.description);
  result = replaceHtmlMeta(result, "name", "twitter:image", metadata.image ?? "https://vitrines.ai/landing/vitrines-social-card-v6.png");
  result = replaceHtmlMeta(result, "name", "twitter:image:alt", `${metadata.title} — Vitrines`);
  result = result.replace(
    /<link\s+rel=["']canonical["'][^>]*>/i,
    `<link rel="canonical" href="https://vitrines.ai${escapeHtml(metadata.canonicalPath)}" />`,
  );
  const jsonLd = metadata.jsonLd
    ? `  <script type="application/ld+json">${JSON.stringify(metadata.jsonLd)
      .replace(/</g, "\\u003c")
      .replace(/>/g, "\\u003e")
      .replace(/&/g, "\\u0026")}</script>`
    : "";
  const jsonLdPattern = /\s*<script\s+type=["']application\/ld\+json["'][\s\S]*?<\/script>/i;
  result = jsonLdPattern.test(result)
    ? result.replace(jsonLdPattern, jsonLd)
    : jsonLd
      ? result.replace("</head>", `\n${jsonLd}\n</head>`)
      : result;
  return result;
}

function isKnownHtmlRoute(pathname: string): boolean {
  if ([
    "/",
    "/landing",
    "/build-in-public",
    "/pricing",
    "/terms",
    "/privacy",
    "/refunds",
    "/billing/success",
    "/settings/billing",
    "/signin",
    "/forgot-password",
    "/reset-password",
    "/search",
    "/apps",
    "/browse",
    "/browse/flows",
    "/components",
    "/browse/sites",
    "/browse/search",
    "/browse/pricing",
    "/browse/build-in-public",
    "/browse/billing-success",
    "/browse/forgot-password",
    "/browse/reset-password",
    "/browse/collections",
    "/browse/projects",
    "/browse/settings",
    "/browse/admin",
    "/flows",
    "/sites",
    "/colors",
    "/color",
    "/colors/compose",
    "/color/compose",
    "/colors/create",
    "/color/create",
    "/sites/motion",
    "/projects",
    "/collections",
    "/admin",
  ].includes(pathname)) return true;
  return /^\/(?:browse|apps|sites|projects|collections|feature-document-shares)\/[^/]+(?:\/.*)?$/.test(pathname);
}

async function catalogRouteMetadata(
  pathname: string,
  search: string,
  request: Request,
  environment: CloudflareFrontendEnvironment,
  fetchApi: ApiFetch,
): Promise<{ exists: boolean | null; metadata?: SeoMetadata }> {
  const origin = apiOrigin(environment.API_ORIGIN);
  if (!origin) return { exists: null };
  const appMatch = pathname.match(/^\/browse\/([^/]+)$/);
  const siteMatch = pathname.match(/^\/browse\/sites\/([^/]+)$/);
  if (!appMatch && !siteMatch) return { exists: null };
  let decodedSlug: string;
  try {
    decodedSlug = decodeURIComponent((appMatch ?? siteMatch)![1]);
  } catch {
    return { exists: false };
  }
  const target = new URL(origin);
  target.pathname = appMatch
    ? `/apps/${encodeURIComponent(decodedSlug)}/preview`
    : `/sites/${encodeURIComponent(decodedSlug)}`;
  target.search = appMatch ? "v=2" : "";
  const response = await fetchApi(new Request(target, {
    method: "GET",
    headers: { accept: "application/json", "user-agent": request.headers.get("user-agent") ?? "" },
  }));
  if (response.status === 404) return { exists: false };
  if (!response.ok) return { exists: null };
  try {
    const body = await response.json() as {
      app?: Parameters<typeof metadataForApp>[0];
      site?: Parameters<typeof metadataForSite>[0];
      routeSlug?: string;
    };
    if (appMatch && body.app) return { exists: true, metadata: metadataForApp(body.app, search) };
    if (siteMatch && body.site && body.routeSlug) {
      return {
        exists: true,
        metadata: metadataForSite({
          routeSlug: body.routeSlug,
          name: body.site.name,
          description: body.site.description,
          logoUrl: body.site.logoUrl,
          sourceUrl: body.site.sourceUrl,
        }, search),
      };
    }
  } catch {
    // The route still exists when the API payload cannot be used for head metadata.
  }
  return { exists: true };
}

async function htmlAssetResponse(
  request: Request,
  environment: CloudflareFrontendEnvironment,
  metadata: SeoMetadata,
  status = 200,
): Promise<Response> {
  const asset = await environment.ASSETS.fetch(request);
  if (!asset.headers.get("content-type")?.includes("text/html")) return asset;
  const html = applyHtmlSeo(await asset.text(), metadata);
  const headers = new Headers(asset.headers);
  headers.set("content-type", "text/html; charset=UTF-8");
  return new Response(html, { status, headers });
}

async function sitemapResponse(
  request: Request,
  environment: CloudflareFrontendEnvironment,
  fetchApi: ApiFetch,
): Promise<Response> {
  const origin = apiOrigin(environment.API_ORIGIN);
  if (origin) {
    const target = new URL(origin);
    target.pathname = "/seo/sitemap.xml";
    target.search = "";
    const response = await fetchApi(new Request(target, request));
    if (response.ok) return response;
  }
  return new Response(buildSitemapXml(), {
    headers: {
      "content-type": "application/xml; charset=UTF-8",
      "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}

export function createCloudflareFrontendWorker(
  fetchApi: ApiFetch = (request) => fetch(request),
  edgeCache: EdgeCache | null = defaultEdgeCache(),
) {
  return {
    async fetch(
      request: Request,
      environment: CloudflareFrontendEnvironment,
      context?: ExecutionContext,
    ): Promise<Response> {
      const url = new URL(request.url);

      if (url.pathname === "/sitemap.xml" && (request.method === "GET" || request.method === "HEAD")) {
        return sitemapResponse(request, environment, fetchApi);
      }

      const mediaKey = publicMediaKey(url.pathname);
      if (mediaKey) {
        if (request.method !== "GET" && request.method !== "HEAD") {
          return new Response("Method not allowed", { status: 405 });
        }
        if (!environment.MEDIA) {
          return Response.json({ error: "Media bucket is not configured" }, { status: 503 });
        }
        const objectKey = bucketKey(mediaKey, environment.MEDIA_PREFIX);
        const mediaHeaders = (object: R2ObjectBody): Headers => {
          const headers = new Headers();
          object.writeHttpMetadata?.(headers);
          if (!headers.has("content-type") && object.httpMetadata?.contentType) {
            headers.set("content-type", object.httpMetadata.contentType);
          }
          headers.set("Cache-Control", IMMUTABLE_CACHE_CONTROL);
          headers.set("Accept-Ranges", "bytes");
          headers.set("X-Content-Type-Options", "nosniff");
          return headers;
        };

        // A ranged read is a partial response, which the Cache API refuses to
        // store — so it skips the cache on both sides and goes to R2 directly.
        const range = parseByteRange(request.headers.get("range"));
        if (range) {
          const part = await environment.MEDIA.get(objectKey, { range });
          if (!part) return new Response("Not found", { status: 404 });
          const size = part.size ?? 0;
          const offset = part.range?.offset ?? range.offset ?? Math.max(size - (range.suffix ?? 0), 0);
          const length = part.range?.length ?? range.length ?? size - offset;
          const headers = mediaHeaders(part);
          headers.set("Content-Range", `bytes ${offset}-${offset + length - 1}/${size}`);
          headers.set("Content-Length", String(length));
          return new Response(request.method === "HEAD" ? null : part.body, { status: 206, headers });
        }

        // Keys are content-addressed, so a cached response can never be wrong.
        // Without this every image costs an R2 read even though the colo
        // already has the bytes.
        const mediaCacheKey = new Request(url.toString(), { method: "GET" });
        const cached = await edgeCache?.match(mediaCacheKey);
        if (cached) {
          return request.method === "HEAD"
            ? new Response(null, { status: cached.status, headers: cached.headers })
            : cached;
        }
        const object = await environment.MEDIA.get(objectKey);
        if (!object) return new Response("Not found", { status: 404 });
        const media = new Response(object.body, { headers: mediaHeaders(object) });
        if (edgeCache) {
          const stored = media.clone();
          const write = edgeCache.put(mediaCacheKey, stored).catch(() => undefined);
          if (context) context.waitUntil(write); else await write;
        }
        return request.method === "HEAD"
          ? new Response(null, { status: media.status, headers: media.headers })
          : media;
      }

      if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
        const origin = apiOrigin(environment.API_ORIGIN);
        if (!origin) {
          return Response.json(
            { error: "API origin is not configured" },
            { status: 503 },
          );
        }
        const forwardedRequest = url.pathname === "/api/designer-canvas-collaboration"
          ? collaborationRequest(request, origin)
          : apiRequest(request, origin);
        const useEdgeCache = request.method === "GET"
          && PUBLIC_API_CACHE_PATHS.has(url.pathname)
          && edgeCache !== null;
        if (!useEdgeCache) return fetchApi(forwardedRequest);

        const cacheKey = cacheKeyForRequest(request);
        const cached = await edgeCache.match(cacheKey);
        if (cached) return cachedResponseForClient(cached);

        const response = await fetchApi(forwardedRequest);
        if (!publicApiResponseIsCacheable(response)) return response;

        const write = edgeCache.put(
          cacheKey,
          responseForEdgeCache(response.clone()),
        ).catch(() => undefined);
        if (context) context.waitUntil(write);
        else await write;
        return responseWithHeader(response, "X-Vitrines-Edge-Cache", "MISS");
      }

      if (request.method === "GET" && request.headers.get("accept")?.includes("text/html")) {
        if (!isKnownHtmlRoute(url.pathname)) {
          return htmlAssetResponse(request, environment, metadataForPath(url.pathname, url.search), 404);
        }
        const routeMetadata = await catalogRouteMetadata(url.pathname, url.search, request, environment, fetchApi);
        if (routeMetadata?.exists === false) {
          return htmlAssetResponse(request, environment, metadataForPath(url.pathname, url.search), 404);
        }
        return htmlAssetResponse(
          request,
          environment,
          routeMetadata?.metadata ?? metadataForPath(url.pathname, url.search),
        );
      }
      return environment.ASSETS.fetch(request);
    },
  };
}

export default createCloudflareFrontendWorker();
