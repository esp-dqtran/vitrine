interface StaticAssetsBinding {
  fetch(request: Request): Promise<Response>;
}

export interface CloudflareFrontendEnvironment {
  ASSETS: StaticAssetsBinding;
  API_ORIGIN?: string;
}

type ApiFetch = (request: Request) => Promise<Response>;

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
) {
  return {
    async fetch(
      request: Request,
      environment: CloudflareFrontendEnvironment,
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
        return fetchApi(apiRequest(request, origin));
      }
      return environment.ASSETS.fetch(request);
    },
  };
}

export default createCloudflareFrontendWorker();
