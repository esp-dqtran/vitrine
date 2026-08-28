import type { Route } from "./router.ts";

export interface RootRouteContext {
  auth: "loading" | "guest" | "member" | "admin";
  advancedSearchEnabled: boolean;
  collectionsEnabled: boolean;
  researchProjectsEnabled: boolean;
}

export type RootRouteDecision =
  | { kind: "loading" }
  | {
      kind: "public";
      page:
        | "browse-pricing"
        | "browse-build-in-public"
        | "browse-billing-success"
        | "browse-forgot-password"
        | "browse-reset-password"
        | "browse-not-found"
        | "landing"
        | "not-found"
        | "build-in-public"
        | "pricing"
        | "terms"
        | "privacy"
        | "refunds"
        | "billing-success"
        | "forgot-password"
        | "reset-password"
        | "feature-document-share";
    }
  | { kind: "application" }
  | { kind: "admin-dashboard" }
  | { kind: "signin" }
  | { kind: "redirect"; route: Route }
  | { kind: "denied"; title: string }
  | { kind: "unavailable"; title: string };

export function decideRootRoute(
  route: Route,
  context: RootRouteContext,
): RootRouteDecision {
  if (
    route.name === "browse-pricing" ||
    route.name === "browse-build-in-public" ||
    route.name === "browse-billing-success" ||
    route.name === "browse-forgot-password" ||
    route.name === "browse-reset-password" ||
    route.name === "browse-not-found" ||
    route.name === "pricing" ||
    route.name === "terms" ||
    route.name === "privacy" ||
    route.name === "refunds" ||
    route.name === "build-in-public" ||
    route.name === "feature-document-share" ||
    route.name === "not-found"
  ) {
    return { kind: "public", page: route.name };
  }

  if (route.name === "landing") {
    return { kind: "redirect", route: { name: "apps" } };
  }

  if (context.auth === "loading") return { kind: "loading" };

  switch (route.name) {
    case "signin":
      return context.auth === "guest"
        ? { kind: "signin" }
        : { kind: "redirect", route: { name: "apps" } };
    case "forgot-password":
    case "reset-password":
      return context.auth === "guest"
        ? { kind: "public", page: route.name }
        : { kind: "redirect", route: { name: "apps" } };
    case "apps":
    case "explore":
    case "browse":
    case "browse-app":
    case "browse-flows":
    case "components":
    case "browse-sites":
    case "browse-site":
    case "browse-search":
    case "sites":
    case "color":
    case "color-compose":
    case "color-create":
    case "sites-motion":
    case "flows":
    case "app":
      return { kind: "application" };
    case "billing-success":
      return context.auth === "guest"
        ? { kind: "signin" }
        : { kind: "public", page: "billing-success" };
    case "search":
      if (context.auth === "guest") return { kind: "signin" };
      return { kind: "application" };
    case "browse-collections":
      return context.auth === "guest"
        ? { kind: "signin" }
        : context.collectionsEnabled
          ? { kind: "application" }
          : { kind: "redirect", route: { name: "browse-projects" } };
    case "browse-projects":
      return context.auth === "guest"
        ? { kind: "signin" }
        : context.researchProjectsEnabled
          ? { kind: "application" }
          : { kind: "unavailable", title: "Research projects are unavailable" };
    case "collections":
      return context.auth === "guest"
        ? { kind: "signin" }
        : context.collectionsEnabled
          ? { kind: "application" }
          : { kind: "redirect", route: { name: "projects" } };
    case "projects":
    case "projects-workspace":
    case "project":
    case "project-documents":
    case "project-settings":
    case "project-canvas":
    case "project-document-file":
    case "project-document":
    case "project-playground":
      if (context.auth === "guest") return { kind: "signin" };
      return context.researchProjectsEnabled
        ? { kind: "application" }
        : { kind: "unavailable", title: "Research projects are unavailable" };
    case "browse-admin":
      if (context.auth === "guest") {
        return { kind: "signin" };
      }
      return context.auth === "admin"
        ? { kind: "application" }
        : { kind: "denied", title: "Admin access required" };
    case "admin":
      if (context.auth === "guest") return { kind: "signin" };
      return context.auth === "admin"
        ? { kind: "admin-dashboard" }
        : { kind: "denied", title: "Admin access required" };
    case "browse-settings":
      return context.auth === "guest"
        ? { kind: "signin" }
        : { kind: "application" };
    case "settings-billing":
    case "site-version":
      return context.auth === "guest"
        ? { kind: "signin" }
        : { kind: "application" };
    default:
      return assertNever(route);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled route decision: ${JSON.stringify(value)}`);
}
