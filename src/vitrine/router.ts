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

/* Admin sections are addressable so a dashboard view can be linked and reloaded. */
export type AdminRouteSection = "insights" | "threads";

export type ProjectWorkspaceScope =
  | { kind: "personal" }
  | { kind: "team"; teamId: number };

export type ProjectWorkspaceSection = "people" | "settings";

export type Route =
  | { name: "landing" }
  | { name: "not-found"; pathname: string }
  | { name: "build-in-public" }
  | { name: "pricing" }
  | { name: "billing-success" }
  | { name: "settings-billing" }
  | { name: "signin" }
  | { name: "forgot-password" }
  | { name: "reset-password"; token?: string }
  | { name: "search" }
  | { name: "apps" }
  /* The rebuilt browse surface. Runs beside /apps rather than replacing it. */
  | { name: "browse" }
  | { name: "browse-app"; appId: string }
  | { name: "browse-flows" }
  | { name: "browse-sites" }
  | { name: "browse-site"; siteSlug: string }
  | { name: "browse-search" }
  | { name: "browse-pricing" }
  | { name: "browse-build-in-public" }
  | { name: "browse-billing-success" }
  | { name: "browse-forgot-password" }
  | { name: "browse-reset-password"; token?: string }
  | { name: "browse-not-found"; pathname: string }
  | { name: "browse-collections" }
  | { name: "browse-projects" }
  | { name: "browse-settings" }
  | { name: "browse-admin" }
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
  | { name: "color" }
  | { name: "color-create"; paletteId?: string }
  | { name: "sites-motion" }
  | SiteVersionRoute
  | { name: "collections"; collectionId?: number }
  /* `/projects` is intentionally retained as the entry route. App replaces it
     with the Personal workspace without adding an extra history entry. */
  | { name: "projects" }
  | {
      name: "projects-workspace";
      workspace: ProjectWorkspaceScope;
      section?: ProjectWorkspaceSection;
    }
  | { name: "project"; projectId: string }
  | { name: "project-documents"; projectId: string }
  | { name: "project-settings"; projectId: string }
  | { name: "project-canvas"; projectId: string; canvasId: string; insert?: string }
  | { name: "project-document-file"; projectId: string; documentId: number }
  | { name: "project-document"; projectId: string }
  | { name: "project-playground"; projectId: string }
  | { name: "feature-document-share"; token: string }
  | { name: "admin"; section?: AdminRouteSection };

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
  if (path === "/forgot-password") return { name: "forgot-password" };
  if (path === "/reset-password") return { name: "reset-password" };
  if (path === "/search") return { name: "search" };
  if (path === "/apps") return { name: "apps" };
  if (path === "/browse") return { name: "browse" };
  if (path === "/browse/flows") return { name: "browse-flows" };
  if (path === "/browse/sites") return { name: "browse-sites" };
  if (path.startsWith("/browse/sites/")) {
    const siteSlug = decodeURIComponent(path.slice("/browse/sites/".length));
    if (siteSlug && !siteSlug.includes("/")) return { name: "browse-site", siteSlug };
  }
  if (path === "/browse/search") return { name: "browse-search" };
  if (path === "/browse/pricing") return { name: "browse-pricing" };
  if (path === "/browse/build-in-public") return { name: "browse-build-in-public" };
  if (path === "/browse/billing-success") return { name: "browse-billing-success" };
  if (path === "/browse/forgot-password") return { name: "browse-forgot-password" };
  if (path === "/browse/reset-password") return { name: "browse-reset-password" };
  if (path === "/browse/collections") return { name: "browse-collections" };
  if (path === "/browse/projects") return { name: "browse-projects" };
  if (path === "/browse/settings") return { name: "browse-settings" };
  if (path === "/browse/admin") return { name: "browse-admin" };
  if (path.startsWith("/browse/")) {
    const appId = decodeURIComponent(path.slice("/browse/".length));
    if (appId) return { name: "browse-app", appId };
  }
  if (path === "/flows") return { name: "flows" };
  if (path === "/sites") return { name: "sites" };
  if (path === "/colors" || path === "/color") return { name: "color" };
  if (path === "/colors/create" || path === "/color/create") return { name: "color-create" };
  if (path === "/sites/motion") return { name: "sites-motion" };
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
  if (path === "/projects/personal") {
    return { name: "projects-workspace", workspace: { kind: "personal" } };
  }
  const teamWorkspaceMatch = path.match(
    /^\/projects\/team\/([1-9]\d*)(?:\/(people|settings))?$/,
  );
  if (teamWorkspaceMatch) {
    const teamId = Number(teamWorkspaceMatch[1]);
    const section = teamWorkspaceMatch[2] as ProjectWorkspaceSection | undefined;
    return Number.isSafeInteger(teamId)
      ? {
          name: "projects-workspace",
          workspace: { kind: "team", teamId },
          ...(section ? { section } : {}),
        }
      : { name: "not-found", pathname: path };
  }
  const collectionMatch = path.match(/^\/collections(?:\/([1-9]\d*))?$/);
  if (collectionMatch) {
    const collectionId = collectionMatch[1]
      ? Number(collectionMatch[1])
      : undefined;
    return {
      name: "collections",
      ...(collectionId ? { collectionId } : {}),
    };
  }
  const projectCanvasMatch = path.match(
    /^\/projects\/([^/]+)\/canvases\/([0-9a-f-]{36})$/i,
  );
  if (projectCanvasMatch) {
    const projectId = normalizeResearchProjectId(projectCanvasMatch[1]);
    return projectId
      ? { name: "project-canvas", projectId, canvasId: projectCanvasMatch[2] }
      : { name: "not-found", pathname: path };
  }
  const projectDocumentFileMatch = path.match(
    /^\/projects\/([^/]+)\/documents\/([1-9]\d*)$/,
  );
  if (projectDocumentFileMatch) {
    const projectId = normalizeResearchProjectId(projectDocumentFileMatch[1]);
    const documentId = Number(projectDocumentFileMatch[2]);
    return projectId && Number.isSafeInteger(documentId)
      ? { name: "project-document-file", projectId, documentId }
      : { name: "not-found", pathname: path };
  }
  const projectDocumentsMatch = path.match(/^\/projects\/([^/]+)\/documents$/);
  if (projectDocumentsMatch) {
    const projectId = normalizeResearchProjectId(projectDocumentsMatch[1]);
    return projectId
      ? { name: "project-documents", projectId }
      : { name: "not-found", pathname: path };
  }
  const projectSettingsMatch = path.match(/^\/projects\/([^/]+)\/settings$/);
  if (projectSettingsMatch) {
    const projectId = normalizeResearchProjectId(projectSettingsMatch[1]);
    return projectId
      ? { name: "project-settings", projectId }
      : { name: "not-found", pathname: path };
  }
  const projectPlaygroundMatch = path.match(
    /^\/projects\/([^/]+)\/playground$/,
  );
  if (projectPlaygroundMatch) {
    const projectId = normalizeResearchProjectId(projectPlaygroundMatch[1]);
    return projectId
      ? { name: "project-playground", projectId }
      : { name: "not-found", pathname: path };
  }
  const projectDocumentMatch = path.match(/^\/projects\/([^/]+)\/document$/);
  if (projectDocumentMatch) {
    const projectId = normalizeResearchProjectId(projectDocumentMatch[1]);
    return projectId
      ? { name: "project-document", projectId }
      : { name: "not-found", pathname: path };
  }
  const projectMatch = path.match(/^\/projects\/([^/]+)$/);
  if (projectMatch) {
    const projectId = normalizeResearchProjectId(projectMatch[1]);
    return projectId
      ? { name: "project", projectId }
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
  if (path === "/admin/insights") return { name: "admin", section: "insights" };
  if (path === "/admin/threads") return { name: "admin", section: "threads" };
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
  if (route.name === "color-create") {
    const paletteId = bounded(
      new URLSearchParams(search).get("palette"),
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      120,
    );
    return paletteId ? { ...route, paletteId } : route;
  }
  if (route.name === "reset-password") {
    const token = bounded(new URLSearchParams(search).get("token"), /^[A-Za-z0-9_-]{43}$/, 43);
    return token ? { ...route, token } : route;
  }
  if (route.name === "site-version" && "siteSlug" in route) {
    const version = positive(new URLSearchParams(search).get("version"));
    return {
      ...route,
      ...(version ? { version } : {}),
    };
  }
  if (route.name === "project-canvas") {
    const insert = bounded(
      new URLSearchParams(search).get("insert"),
      /^[A-Za-z0-9-]{16,80}$/,
      80,
    );
    return insert ? { ...route, insert } : route;
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
    case "forgot-password":
      return "/forgot-password";
    case "reset-password":
      return `/reset-password${route.token ? `?token=${encodeURIComponent(route.token)}` : ""}`;
    case "search":
      return "/search";
    case "apps":
      return "/apps";
    case "browse":
      return "/browse";
    case "browse-app":
      return `/browse/${encodeURIComponent(route.appId)}`;
    case "browse-flows":
      return "/browse/flows";
    case "browse-sites":
      return "/browse/sites";
    case "browse-site":
      return `/browse/sites/${encodeURIComponent(route.siteSlug)}`;
    case "browse-search":
      return "/browse/search";
    case "browse-pricing":
      return "/browse/pricing";
    case "browse-build-in-public":
      return "/browse/build-in-public";
    case "browse-billing-success":
      return "/browse/billing-success";
    case "browse-forgot-password":
      return "/browse/forgot-password";
    case "browse-reset-password":
      return "/browse/reset-password";
    case "browse-not-found":
      return route.pathname;
    case "browse-collections":
      return "/browse/collections";
    case "browse-projects":
      return "/browse/projects";
    case "browse-settings":
      return "/browse/settings";
    case "browse-admin":
      return "/browse/admin";
    case "flows":
      return "/flows";
    case "sites":
      return "/sites";
    case "color":
      return "/colors";
    case "color-create":
      return `/colors/create${route.paletteId ? `?palette=${encodeURIComponent(route.paletteId)}` : ""}`;
    case "sites-motion":
      return "/sites/motion";
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
    case "collections":
      return route.collectionId
        ? `/collections/${route.collectionId}`
        : "/collections";
    case "projects":
      return "/projects";
    case "projects-workspace": {
      if (route.workspace.kind === "personal") return "/projects/personal";
      const section = route.section ? `/${route.section}` : "";
      return `/projects/team/${route.workspace.teamId}${section}`;
    }
    case "project":
      return `/projects/${route.projectId}`;
    case "project-documents":
      return `/projects/${route.projectId}/documents`;
    case "project-settings":
      return `/projects/${route.projectId}/settings`;
    case "project-canvas":
      return `/projects/${route.projectId}/canvases/${route.canvasId}${route.insert ? `?insert=${encodeURIComponent(route.insert)}` : ""}`;
    case "project-document-file":
      return `/projects/${route.projectId}/documents/${route.documentId}`;
    case "project-document":
      return `/projects/${route.projectId}/document`;
    case "project-playground":
      return `/projects/${route.projectId}/playground`;
    case "feature-document-share":
      return `/feature-document-shares/${encodeURIComponent(route.token)}`;
    case "admin":
      return route.section === "insights" ? "/admin/insights"
        : route.section === "threads" ? "/admin/threads" : "/admin";
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
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/";
  const legacyColorPath =
    normalizedPathname === "/color" || normalizedPathname === "/color/create"
      ? `${normalizedPathname.replace(/^\/color/, "/colors")}${search}`
      : null;
  const canonicalPath = legacyOverviewPath ?? legacyColorPath;
  useEffect(() => {
    if (canonicalPath)
      updateLocation(canonicalPath, { replace: true });
  }, [canonicalPath]);
  return route;
}
