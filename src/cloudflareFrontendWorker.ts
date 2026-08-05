interface StaticAssetsBinding {
  fetch(request: Request): Promise<Response>;
}

export interface CloudflareFrontendEnvironment {
  ASSETS: StaticAssetsBinding;
  API_ORIGIN?: string;
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
  "/api/catalog/stats",
  "/api/catalog/categories",
  "/api/catalog/flows",
  "/api/catalog/flow-groups",
  "/api/catalog/facet-preview",
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
      if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
        const origin = apiOrigin(environment.API_ORIGIN);
        if (!origin) {
          return Response.json(
            { error: "API origin is not configured" },
            { status: 503 },
          );
        }
        const forwardedRequest = apiRequest(request, origin);
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
      return environment.ASSETS.fetch(request);
    },
  };
}

export default createCloudflareFrontendWorker();
