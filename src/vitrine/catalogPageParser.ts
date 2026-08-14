import type { DiscoveryFacet, DiscoveryPage } from "./discoveryTypes.ts";
import type { App, Category, Screen } from "./types.ts";

export type CatalogDiscoveryItem = Omit<App, "screens"> & {
  previewScreens: Array<Omit<Screen, "url"> & { url: string | null }>;
};

export type CatalogDiscoveryResponse = DiscoveryPage<CatalogDiscoveryItem>;

export interface AdminAppsResponse {
  apps: App[];
  nextCursor: string | null;
  total: number;
  facets: DiscoveryFacet[];
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function invalid(prefix: string, detail: string): never {
  throw new Error(`${prefix}: ${detail}`);
}

function cursor(value: unknown, prefix: string): string | null {
  if (value === null || typeof value === "string") return value;
  return invalid(prefix, "nextCursor");
}

function count(value: unknown, prefix: string, field: string): number {
  if (Number.isSafeInteger(value) && Number(value) >= 0) return Number(value);
  return invalid(prefix, field);
}

function optionalNullableString(
  item: Record<string, unknown>,
  field: string,
): boolean {
  return item[field] === undefined
    || item[field] === null
    || typeof item[field] === "string";
}

function optionalStringArray(
  item: Record<string, unknown>,
  field: string,
): boolean {
  return item[field] === undefined
    || (Array.isArray(item[field])
      && item[field].every((entry) => typeof entry === "string"));
}

function optionalMatchedFacets(
  item: Record<string, unknown>,
): boolean {
  return item.matchedFacets === undefined
    || (Array.isArray(item.matchedFacets)
      && item.matchedFacets.every((raw) => {
        const facet = record(raw);
        return facet
          && typeof facet.group === "string"
          && facet.group.length > 0
          && typeof facet.value === "string"
          && facet.value.length > 0;
      }));
}

function categories(value: unknown, prefix: string): Category[] {
  if (!Array.isArray(value)) return invalid(prefix, "categories");
  return value.map((raw) => {
    const item = record(raw);
    if (!item
      || !Number.isSafeInteger(item.id)
      || Number(item.id) < 1
      || typeof item.name !== "string"
      || typeof item.slug !== "string") {
      return invalid(prefix, "category");
    }
    return item as unknown as Category;
  });
}

function screen(
  value: unknown,
  prefix: string,
  allowNullUrl: boolean,
): Screen | (Omit<Screen, "url"> & { url: string | null }) {
  const item = record(value);
  if (!item
    || !Number.isSafeInteger(item.id)
    || Number(item.id) < 1
    || typeof item.type !== "string"
    || typeof item.productArea !== "string"
    || (item.theme !== "light" && item.theme !== "dark" && item.theme !== "mixed")
    || !Array.isArray(item.visibleStates)
    || !item.visibleStates.every((state) => typeof state === "string")
    || (item.platform !== "web" && item.platform !== "ios" && item.platform !== "android")
    || !(item.description === null || typeof item.description === "string")
    || !optionalNullableString(item, "purpose")
    || !(typeof item.url === "string" || (allowNullUrl && item.url === null))
    || !optionalNullableString(item, "thumbnailUrl")
    || !optionalNullableString(item, "sourceUrl")
    || !optionalStringArray(item, "layoutPatterns")
    || !optionalStringArray(item, "componentNames")
    || !optionalStringArray(item, "visibleText")
    || !optionalStringArray(item, "icons")
    || !optionalStringArray(item, "imagery")
    || !optionalStringArray(item, "contentPatterns")
    || !optionalStringArray(item, "interactionPatterns")
    || !(item.responsiveViewport === undefined
      || item.responsiveViewport === null
      || item.responsiveViewport === "desktop"
      || item.responsiveViewport === "tablet"
      || item.responsiveViewport === "mobile"
      || item.responsiveViewport === "unknown")
    || !optionalMatchedFacets(item)
    || !optionalNullableString(item, "capturedAt")
    || !optionalNullableString(item, "stateContext")
    || !(item.confidence === undefined
      || item.confidence === null
      || (typeof item.confidence === "number"
        && Number.isFinite(item.confidence)
        && item.confidence >= 0
        && item.confidence <= 1))) {
    return invalid(prefix, "previewScreens");
  }
  return item as unknown as Screen;
}

function appBase(
  value: unknown,
  prefix: string,
): Record<string, unknown> {
  const item = record(value);
  if (!item
    || typeof item.id !== "string"
    || !item.id
    || typeof item.app !== "string"
    || typeof item.accent !== "string"
    || !Number.isSafeInteger(item.totalScreens)
    || Number(item.totalScreens) < 0) {
    return invalid(prefix, "item");
  }
  categories(item.categories, prefix);
  if (item.platforms !== undefined
    && (!Array.isArray(item.platforms)
      || !item.platforms.every((platform) =>
        platform === "web" || platform === "ios" || platform === "android"))) {
    return invalid(prefix, "platforms");
  }
  if (item.analyzedScreens !== undefined
    && (!Number.isSafeInteger(item.analyzedScreens)
      || Number(item.analyzedScreens) < 0)) {
    return invalid(prefix, "analyzedScreens");
  }
  for (const field of [
    "lastCapturedAt",
    "websiteUrl",
    "iconUrl",
    "previewUrl",
    "description",
    "previewVideoUrl",
  ] as const) {
    if (!optionalNullableString(item, field)) {
      return invalid(prefix, field);
    }
  }
  return item;
}

function facets(value: unknown, prefix: string): DiscoveryFacet[] {
  if (!Array.isArray(value)) return invalid(prefix, "facets");
  return value.map((raw) => {
    const item = record(raw);
    if (!item
      || typeof item.group !== "string"
      || !item.group
      || typeof item.value !== "string"
      || !item.value
      || !Number.isSafeInteger(item.count)
      || Number(item.count) < 0
      || (item.section !== undefined && typeof item.section !== "string")
      || (item.description !== undefined && typeof item.description !== "string")
      || (item.aliases !== undefined
        && (!Array.isArray(item.aliases)
          || item.aliases.some((alias) => typeof alias !== "string")))
      || (item.sectionPosition !== undefined
        && (!Number.isSafeInteger(item.sectionPosition)
          || Number(item.sectionPosition) < 1))
      || (item.position !== undefined
        && (!Number.isSafeInteger(item.position)
          || Number(item.position) < 1))) {
      return invalid(prefix, "facet");
    }
    return item as unknown as DiscoveryFacet;
  });
}

export function parseCatalogDiscoveryPage(
  value: unknown,
): CatalogDiscoveryResponse {
  const prefix = "invalid catalog response";
  const page = record(value);
  if (!page || !Array.isArray(page.items)) return invalid(prefix, "items");
  const items = page.items.map((raw) => {
    const item = appBase(raw, prefix);
    if (!Array.isArray(item.previewScreens)) {
      return invalid(prefix, "previewScreens");
    }
    item.previewScreens.forEach((entry) => screen(entry, prefix, true));
    return item as unknown as CatalogDiscoveryItem;
  });
  return {
    items,
    nextCursor: cursor(page.nextCursor, prefix),
    totalCount: count(page.totalCount, prefix, "totalCount"),
    facets: facets(page.facets, prefix),
  };
}

export function parseAdminAppsPage(value: unknown): AdminAppsResponse {
  const prefix = "invalid admin Apps response";
  const page = record(value);
  if (!page || !Array.isArray(page.apps)) return invalid(prefix, "apps");
  const apps = page.apps.map((raw) => {
    const item = appBase(raw, prefix);
    if (!Array.isArray(item.screens)) return invalid(prefix, "screens");
    item.screens.forEach((entry) => screen(entry, prefix, false));
    return item as unknown as App;
  });
  return {
    apps,
    nextCursor: cursor(page.nextCursor, prefix),
    total: count(page.total, prefix, "total"),
    facets: page.facets === undefined ? [] : facets(page.facets, prefix),
  };
}
