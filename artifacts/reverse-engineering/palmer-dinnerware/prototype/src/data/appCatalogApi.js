import { APP_CATALOG_PAGE_SIZE } from "./apps";

const AUTH_TOKEN_KEY = "vitrine:auth-token";

function catalogEndpoint(cursor) {
  const params = new URLSearchParams({
    facets: "summary",
    limit: String(APP_CATALOG_PAGE_SIZE),
  });
  if (cursor) params.set("cursor", cursor);
  return `/api/apps?${params.toString()}`;
}

function authorizationHeaders() {
  const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
  return token ? { authorization: `Bearer ${token}` } : {};
}

function parseCatalogPage(value) {
  if (!value || !Array.isArray(value.items)) {
    throw new Error("The Apps API returned an invalid catalog page.");
  }
  return {
    apps: value.items.filter((app) => (
      app
      && typeof app.id === "string"
      && typeof app.app === "string"
      && Number.isFinite(app.totalScreens)
    )),
    nextCursor: typeof value.nextCursor === "string" ? value.nextCursor : null,
    totalCount: Number.isFinite(value.totalCount) ? value.totalCount : value.items.length,
  };
}

export async function fetchAppCatalogPage(cursor = null, signal) {
  const endpoint = catalogEndpoint(cursor);
  const response = await fetch(endpoint, {
    signal,
    cache: "no-store",
    headers: authorizationHeaders(),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `${endpoint} returned ${response.status}`);
  }
  return parseCatalogPage(await response.json());
}
