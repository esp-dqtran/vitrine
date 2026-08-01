import { useEffect, useSyncExternalStore } from "react";
import type { Platform } from "../platformFromUrl.ts";
import { normalizeResearchProjectId } from "../researchProject.ts";

export type FlowRepresentation = "visual" | "document";

export type SiteVersionRoute =
  | {
      name: "site-version";
      siteSlug: string;
      version?: number;
      section?: string;
      sectionId?: number;
    }
  | {
      name: "site-version";
      siteId: number;
      versionId: number;
      section?: string;
      sectionId?: number;
    };

export type Route =
  | { name: "landing" }
  | { name: "not-found"; pathname: string }
  | { name: "build-in-public" }
  | { name: "pricing" }
  | { name: "billing-success" }
  | { name: "settings-billing" }
  | { name: "signin" }
  | { name: "search" }
  | { name: "apps" }
  | { name: "flows" }
  | {
      name: "app";
      appId: string;
      section?: string;
      platform?: Platform;
      version?: number;
      evidence?: string;
      flow?: string;
      step?: number;
      flowView?: FlowRepresentation;
    }
  | { name: "sites" }
  | SiteVersionRoute
  | { name: "projects" }
  | { name: "project"; projectId: string }
  | { name: "project-playground"; projectId: string }
  | { name: "feature-document"; documentId: number }
  | { name: "feature-document-share"; token: string }
  | { name: "admin" };

interface LocationTarget {
  location: { pathname: string; search: string };
  history: {
    pushState(state: unknown, title: string, path: string): void;
    replaceState(state: unknown, title: string, path: string): void;
  };
  dispatchEvent(event: Event): boolean;
}

export function updateLocation(
  path: string,
  options: { replace?: boolean; target?: LocationTarget } = {},
): void {
  const target = options.target ?? window;
  if (path === `${target.location.pathname}${target.location.search}`) return;
  target.history[options.replace ? "replaceState" : "pushState"](
    null,
    "",
    path,
  );
  const event =
    typeof PopStateEvent === "function"
      ? new PopStateEvent("popstate")
      : new Event("popstate");
  target.dispatchEvent(event);
}

function subscribe(fn: () => void) {
  window.addEventListener("popstate", fn);
  return () => window.removeEventListener("popstate", fn);
}

function browserLocationSnapshot(): string {
  return `${window.location.pathname}${window.location.search}`;
}

export function useLocationKey(): string {
  return useSyncExternalStore(subscribe, browserLocationSnapshot, () => "/");
}

export function parseRoutePath(pathname: string): Route {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/" || path === "/landing") return { name: "landing" };
  if (path === "/build-in-public") return { name: "build-in-public" };
  if (path === "/pricing") return { name: "pricing" };
  if (path === "/billing/success") return { name: "billing-success" };
  if (path === "/settings/billing") return { name: "settings-billing" };
  if (path === "/signin") return { name: "signin" };
  if (path === "/search") return { name: "search" };
  if (path === "/apps") return { name: "apps" };
  if (path === "/flows") return { name: "flows" };
  if (path === "/sites") return { name: "sites" };
  const siteMatch = path.match(
    /^\/sites\/([1-9]\d*)\/versions\/([1-9]\d*)(?:\/([^/]+)(?:\/([1-9]\d*))?)?$/,
  );
  if (siteMatch) {
    const siteId = Number(siteMatch[1]);
    const versionId = Number(siteMatch[2]);
    const section = siteMatch[3] ? decodeSegment(siteMatch[3]) : undefined;
    const sectionId = siteMatch[4] ? Number(siteMatch[4]) : undefined;
    return Number.isSafeInteger(siteId) &&
      Number.isSafeInteger(versionId) &&
      section !== null &&
      (sectionId === undefined ||
        (section === "sections" && Number.isSafeInteger(sectionId)))
      ? {
          name: "site-version",
          siteId,
          versionId,
          ...(section ? { section } : {}),
          ...(sectionId ? { sectionId } : {}),
        }
      : { name: "not-found", pathname: path };
  }
  const namedSiteMatch = path.match(
    /^\/sites\/([^/]+)(?:\/([^/]+)(?:\/([1-9]\d*))?)?$/,
  );
  if (namedSiteMatch) {
    const siteSlug = decodeSegment(namedSiteMatch[1]);
    const section = namedSiteMatch[2]
      ? decodeSegment(namedSiteMatch[2])
      : undefined;
    const sectionId = namedSiteMatch[3] ? Number(namedSiteMatch[3]) : undefined;
    return siteSlug &&
      section !== null &&
      (sectionId === undefined ||
        (section === "sections" && Number.isSafeInteger(sectionId)))
      ? {
          name: "site-version",
          siteSlug,
          ...(section ? { section } : {}),
          ...(sectionId ? { sectionId } : {}),
        }
      : { name: "not-found", pathname: path };
  }
  if (path === "/projects") return { name: "projects" };
  const projectPlaygroundMatch = path.match(
    /^\/projects\/([^/]+)\/playground$/,
  );
  if (projectPlaygroundMatch) {
    const projectId = normalizeResearchProjectId(projectPlaygroundMatch[1]);
    return projectId
      ? { name: "project-playground", projectId }
      : { name: "not-found", pathname: path };
  }
  const projectMatch = path.match(/^\/projects\/([^/]+)$/);
  if (projectMatch) {
    const projectId = normalizeResearchProjectId(projectMatch[1]);
    return projectId
      ? { name: "project", projectId }
      : { name: "not-found", pathname: path };
  }
  const featureDocumentMatch = path.match(/^\/feature-documents\/([1-9]\d*)$/);
  if (featureDocumentMatch) {
    const documentId = Number(featureDocumentMatch[1]);
    return Number.isSafeInteger(documentId)
      ? { name: "feature-document", documentId }
      : { name: "not-found", pathname: path };
  }
  const featureDocumentShareMatch = path.match(
    /^\/feature-document-shares\/([^/]+)$/,
  );
  if (featureDocumentShareMatch) {
    const token = decodeSegment(featureDocumentShareMatch[1]);
    return token
      ? { name: "feature-document-share", token }
      : { name: "not-found", pathname: path };
  }
  if (path === "/admin") return { name: "admin" };
  const appMatch = path.match(/^\/apps\/([^/]+)(?:\/([^/]+))?$/);
  if (appMatch) {
    const appId = decodeSegment(appMatch[1]);
    const section = appMatch[2] ? decodeSegment(appMatch[2]) : undefined;
    return appId && section !== null
      ? { name: "app", appId, ...(section ? { section } : {}) }
      : { name: "not-found", pathname: path };
  }
  return { name: "not-found", pathname: path };
}

function decodeSegment(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function positive(value: string | null): number | undefined {
  if (!value || !/^[1-9]\d*$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function bounded(
  value: string | null,
  pattern: RegExp,
  maximum = 240,
): string | undefined {
  return value && value.length <= maximum && pattern.test(value)
    ? value
    : undefined;
}

export function parseRouteLocation(pathname: string, search = ""): Route {
  const route = parseRoutePath(pathname);
  if (route.name === "site-version" && "siteSlug" in route) {
    const version = positive(new URLSearchParams(search).get("version"));
    return {
      ...route,
      ...(version ? { version } : {}),
    };
  }
  if (route.name !== "app") return route;
  const normalizedRoute =
    route.section === "overview" ? { ...route, section: "screens" } : route;
  const params = new URLSearchParams(search);
  const rawPlatform = params.get("platform");
  const platform =
    rawPlatform === "ios" || rawPlatform === "android" || rawPlatform === "web"
      ? rawPlatform
      : undefined;
  const version = positive(params.get("version"));
  const evidence = bounded(
    params.get("evidence"),
    /^(?:SCREEN|FLOW|UI-ELEMENT)-[A-Za-z0-9-]+$/,
    300,
  );
  const flow = bounded(params.get("flow"), /^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
  const step = positive(params.get("step"));
  const rawFlowView = params.get("flowView");
  const flowView: FlowRepresentation | undefined =
    rawFlowView === "visual" || rawFlowView === "document"
      ? rawFlowView
      : undefined;
  return {
    ...normalizedRoute,
    ...(platform ? { platform } : {}),
    ...(version ? { version } : {}),
    ...(evidence ? { evidence } : {}),
    ...(flow ? { flow } : {}),
    ...(step ? { step } : {}),
    ...(flowView ? { flowView } : {}),
  };
}

export function routeToPath(route: Route): string {
  switch (route.name) {
    case "landing":
      return "/landing";
    case "not-found":
      return route.pathname;
    case "build-in-public":
      return "/build-in-public";
    case "pricing":
      return "/pricing";
    case "billing-success":
      return "/billing/success";
    case "settings-billing":
      return "/settings/billing";
    case "signin":
      return "/signin";
    case "search":
      return "/search";
    case "apps":
      return "/apps";
    case "flows":
      return "/flows";
    case "sites":
      return "/sites";
    case "site-version": {
      const base =
        "siteSlug" in route
          ? `/sites/${encodeURIComponent(route.siteSlug)}`
          : `/sites/${route.siteId}/versions/${route.versionId}`;
      const section = route.section
        ? `/${encodeURIComponent(route.section)}`
        : "";
      const sectionId =
        route.section === "sections" && route.sectionId
          ? `/${route.sectionId}`
          : "";
      const version =
        "siteSlug" in route && route.version ? `?version=${route.version}` : "";
      return `${base}${section}${sectionId}${version}`;
    }
    case "projects":
      return "/projects";
    case "project":
      return `/projects/${route.projectId}`;
    case "project-playground":
      return `/projects/${route.projectId}/playground`;
    case "feature-document":
      return `/feature-documents/${route.documentId}`;
    case "feature-document-share":
      return `/feature-document-shares/${encodeURIComponent(route.token)}`;
    case "admin":
      return "/admin";
    case "app": {
      const path = `/apps/${encodeURIComponent(route.appId)}${route.section ? `/${encodeURIComponent(route.section)}` : ""}`;
      const params = new URLSearchParams();
      if (route.platform) params.set("platform", route.platform);
      if (route.version) params.set("version", String(route.version));
      if (route.evidence) params.set("evidence", route.evidence);
      if (route.flow) params.set("flow", route.flow);
      if (route.step) params.set("step", String(route.step));
      if (route.flowView) params.set("flowView", route.flowView);
      const search = params.toString();
      return search ? `${path}?${search}` : path;
    }
  }
}

export function navigate(route: Route) {
  updateLocation(routeToPath(route));
}

export function useRoute(): Route {
  const location = useLocationKey();
  const split = location.indexOf("?");
  const pathname = split < 0 ? location : location.slice(0, split);
  const search = split < 0 ? "" : location.slice(split);
  const rawRoute = parseRoutePath(pathname);
  const route = parseRouteLocation(pathname, search);
  const legacyOverviewPath =
    rawRoute.name === "app" && rawRoute.section === "overview"
      ? routeToPath(route)
      : null;
  useEffect(() => {
    if (legacyOverviewPath)
      updateLocation(legacyOverviewPath, { replace: true });
  }, [legacyOverviewPath]);
  return route;
}
