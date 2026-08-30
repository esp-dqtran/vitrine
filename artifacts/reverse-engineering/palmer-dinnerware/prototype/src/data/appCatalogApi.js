import { APP_CATALOG_PAGE_SIZE } from "./apps.js";

const AUTH_TOKEN_KEY = "vitrine:auth-token";
const initialPageRequests = new Map();
const CATALOG_REQUEST_START_MARK = "vitrines:explore-catalog-request-start";
const CATALOG_REQUEST_END_MARK = "vitrines:explore-catalog-request-end";
const CATALOG_REQUEST_MEASURE = "vitrines:explore-catalog-request";

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

async function requestAppCatalogPage(cursor, signal) {
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

function catalogSessionKey() {
  return window.localStorage.getItem(AUTH_TOKEN_KEY) ?? "guest";
}

export function preloadInitialAppCatalogPage() {
  const sessionKey = catalogSessionKey();
  const existing = initialPageRequests.get(sessionKey);
  if (existing) return existing;
  window.performance?.mark?.(CATALOG_REQUEST_START_MARK);
  const request = requestAppCatalogPage(null)
    .then((page) => {
      window.performance?.mark?.(CATALOG_REQUEST_END_MARK);
      window.performance?.measure?.(
        CATALOG_REQUEST_MEASURE,
        CATALOG_REQUEST_START_MARK,
        CATALOG_REQUEST_END_MARK,
      );
      return page;
    })
    .catch((error) => {
      initialPageRequests.delete(sessionKey);
      throw error;
    });
  initialPageRequests.set(sessionKey, request);
  return request;
}

export function fetchAppCatalogPage(cursor = null, signal) {
  if (cursor || signal) return requestAppCatalogPage(cursor, signal);
  const sessionKey = catalogSessionKey();
  const request = preloadInitialAppCatalogPage();
  const release = () => {
    if (initialPageRequests.get(sessionKey) === request) {
      initialPageRequests.delete(sessionKey);
    }
  };
  void request.then(release, release);
  return request;
}
