import type express from "express";
import type { ObjectMetadata } from "../../../src/objectStore.ts";
import type { SiteVersionDetail, SitesStore } from "../../../src/sitesStore.ts";
import { SitesCursorError } from "../../../src/sitesCursor.ts";
import type { DiscoveryFilter } from "../../../src/vitrine/discoveryTypes.ts";
import { searchDiscoveryFacets } from "../../../src/discoveryFacetSearch.ts";

export interface SitesRouteDependencies {
  store: Pick<
    SitesStore,
    "listReadySites" | "listReadySitesPage" | "readyVersionDetail" | "siteMediaObject"
  >;
  cursorSecret: string;
  sendObject(metadata: ObjectMetadata, res: express.Response): Promise<void>;
}

export function mountSitesRoutes(
  app: express.Express,
  dependencies: SitesRouteDependencies,
): void {
  mountLegacyReadySitesList(app, dependencies);
  mountPrivateSitesRoutes(app, dependencies);
}

export function mountPublicSitesRoutes(
  app: express.Express,
  dependencies: SitesRouteDependencies,
): void {
  mountPublicReadySitesList(app, dependencies);

  app.get(
    "/sites/:siteId/versions/:versionId/catalog-media/preview",
    async (req, res) => {
      await sendPublicCatalogMedia(req, res, dependencies, "preview");
    },
  );
  app.get(
    "/sites/:siteId/versions/:versionId/catalog-media/posters/:recordId",
    async (req, res) => {
      await sendPublicCatalogMedia(req, res, dependencies, "poster");
    },
  );
}

export function mountPrivateSitesRoutes(
  app: express.Express,
  dependencies: SitesRouteDependencies,
): void {
  app.get("/sites/:siteSlug", async (req, res) => {
    const routeSlug = routeSlugParameter(req.params.siteSlug);
    if (!routeSlug) {
      res.status(400).json({ error: "invalid Site name" });
      return;
    }
    const sites = withRouteSlugs(await dependencies.store.listReadySites());
    const site = sites.find((candidate) => candidate.routeSlug === routeSlug)
      ?? legacyDuplicateRouteSite(sites, routeSlug);
    if (!site) {
      res.status(404).json({ error: "Site not found" });
      return;
    }
    const requestedVersionId = req.query.version === undefined
      ? site.versionId
      : boundedQueryInteger(req.query.version, 1, Number.MAX_SAFE_INTEGER);
    if (!requestedVersionId) {
      res.status(400).json({ error: "invalid Site version reference" });
      return;
    }
    const version = await dependencies.store.readyVersionDetail(site.siteId, requestedVersionId);
    if (!version) {
      res.status(404).json({ error: "Site version not found" });
      return;
    }
    res.json({ ...clientSiteVersion(version), routeSlug: site.routeSlug });
  });

  app.get("/sites/:siteId/versions/:versionId", async (req, res) => {
    const ids = versionIds(req.params);
    if (!ids) {
      res.status(400).json({ error: "invalid Site version reference" });
      return;
    }
    const [version, sites] = await Promise.all([
      dependencies.store.readyVersionDetail(ids.siteId, ids.versionId),
      dependencies.store.listReadySites(),
    ]);
    if (!version) {
      res.status(404).json({ error: "Site version not found" });
      return;
    }
    const site = withRouteSlugs(sites).find((candidate) => candidate.siteId === ids.siteId);
    if (!site) {
      res.status(404).json({ error: "Site not found" });
      return;
    }
    res.json({ ...clientSiteVersion(version), routeSlug: site.routeSlug });
  });

  mountMedia(app, dependencies, "/sites/:siteId/versions/:versionId/media/preview", "preview");
  mountMedia(app, dependencies, "/sites/:siteId/versions/:versionId/media/mobile", "mobile");
  mountMedia(app, dependencies, "/sites/:siteId/versions/:versionId/pages/:recordId/media", "page");
  mountMedia(app, dependencies, "/sites/:siteId/versions/:versionId/sections/:recordId/media", "section");
  mountMedia(app, dependencies, "/sites/:siteId/versions/:versionId/sections/:recordId/poster", "poster");
}

function clientSiteVersion(version: SiteVersionDetail) {
  return {
    ...version,
    pages: version.pages.map((page) => ({
      ...page,
      sections: page.sections.map((section) => ({
        ...section,
        searchText: section.ocrBoxes
          .map(({ text }) => text.trim())
          .filter(Boolean)
          .join(" "),
        ocrBoxes: [],
        sourceMetadata: clientSectionMetadata(section.sourceMetadata),
      })),
    })),
  };
}

function clientSectionMetadata(
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    patterns: stringArray(source.patterns, 20),
  };
  for (const [key, maximum] of [
    ["selector", 1_024],
    ["tagName", 80],
    ["role", 100],
    ["heading", 200],
    ["headingLevel", 10],
    ["anchor", 160],
    ["text", 1_000],
  ] as const) {
    const value = boundedText(source[key], maximum);
    if (value) result[key] = value;
  }
  const classNames = stringArray(source.classNames, 20);
  if (classNames.length) result.classNames = classNames;
  const elementBounds = numericRecord(source.elementBounds, [
    "x",
    "y",
    "width",
    "height",
  ]);
  if (elementBounds) result.elementBounds = elementBounds;
  const style = textRecord(source.style, [
    "display",
    "position",
    "flexDirection",
    "gridTemplateColumns",
    "maxWidth",
    "padding",
    "gap",
    "backgroundColor",
    "color",
  ]);
  if (style) result.style = style;
  const content = numericRecord(source.content, [
    "links",
    "buttons",
    "images",
    "videos",
    "forms",
  ]);
  if (content) result.content = content;
  return result;
}

function boundedText(value: unknown, maximum: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\s+/g, " ").trim().slice(0, maximum);
  return normalized || undefined;
}

function stringArray(value: unknown, maximumItems: number): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, maximumItems)
    : [];
}

function numericRecord(
  value: unknown,
  keys: readonly string[],
): Record<string, number> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const result: Record<string, number> = {};
  for (const key of keys) {
    const item = source[key];
    if (typeof item === "number" && Number.isFinite(item)) {
      result[key] = item;
    }
  }
  return Object.keys(result).length ? result : undefined;
}

function textRecord(
  value: unknown,
  keys: readonly string[],
): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const result: Record<string, string> = {};
  for (const key of keys) {
    const item = boundedText(source[key], 240);
    if (item) result[key] = item;
  }
  return Object.keys(result).length ? result : undefined;
}

function mountPublicReadySitesList(
  app: express.Express,
  dependencies: SitesRouteDependencies,
): void {
  app.get("/sites", async (req, res) => {
    const request = canonicalSitesPageRequest(req.query);
    if (!request) {
      res.status(400).json({ error: "invalid Sites discovery query" });
      return;
    }
    try {
      const page = await dependencies.store.listReadySitesPage({
        ...request,
        cursorSecret: dependencies.cursorSecret,
      });
      const items = withRouteSlugs(page.items).map(publicSiteSummary);
      res.setHeader(
        "Cache-Control",
        req.query.refresh === "1"
          ? "no-store"
          : "public, max-age=60, stale-while-revalidate=240",
      );
      res.json({
        items,
        nextCursor: page.nextCursor,
        totalCount: page.totalCount,
        facets: page.facets,
      });
    } catch (error) {
      if (error instanceof SitesCursorError) {
        res.status(400).json({ error: error.message });
        return;
      }
      throw error;
    }
  });

  app.get("/sites/facets", async (req, res) => {
    const request = canonicalSitesPageRequest({
      ...req.query,
      facets: undefined,
      cursor: undefined,
      limit: "1",
      refresh: undefined,
    });
    const group = typeof req.query.group === "string" ? req.query.group : "";
    const facetQuery = typeof req.query.facet_query === "string"
      && req.query.facet_query.length <= 120
      ? req.query.facet_query.trim()
      : req.query.facet_query === undefined
        ? ""
        : null;
    const selected = queryTextValues(req.query.selected);
    if (!request || !SITE_FILTER_GROUPS.has(group) || facetQuery === null || selected === null) {
      res.status(400).json({ error: "invalid Sites facet query" });
      return;
    }
    const page = await dependencies.store.listReadySitesPage({
      ...request,
      includeFacets: true,
      cursorSecret: dependencies.cursorSecret,
    });
    res.setHeader("Cache-Control", "public, max-age=280");
    res.json({
      facets: searchDiscoveryFacets(page.facets, {
        group,
        ...(facetQuery ? { query: facetQuery } : {}),
        selected,
      }),
    });
  });
}

function mountLegacyReadySitesList(
  app: express.Express,
  dependencies: SitesRouteDependencies,
): void {
  app.get("/sites", async (req, res) => {
    const sites = withRouteSlugs(await dependencies.store.listReadySites());
    const requestedPage = req.query.limit !== undefined || req.query.offset !== undefined;
    if (!requestedPage) {
      res.json(sites);
      return;
    }
    const limit = boundedQueryInteger(req.query.limit, 1, 48);
    const offset = boundedQueryInteger(req.query.offset, 0, 100_000);
    if (limit === undefined || offset === undefined) {
      res.status(400).json({ error: "invalid Site catalog page" });
      return;
    }
    const nextOffset = offset + limit < sites.length ? offset + limit : null;
    res.json({
      sites: sites.slice(offset, offset + limit),
      nextOffset,
      total: sites.length,
    });
  });
}

const SITE_FILTER_GROUPS = new Set(["categories", "sections", "styles"]);

function canonicalSitesPageRequest(query: express.Request["query"]): {
  cursor?: string;
  limit?: number;
  platform: "web";
  sort: "latest" | "popular";
  query?: string;
  filters: DiscoveryFilter[];
  includeFacets?: false;
} | null {
  if (query.offset !== undefined) return null;
  const cursor = query.cursor === undefined
    ? undefined
    : typeof query.cursor === "string"
      && query.cursor.length > 0
      && query.cursor.length <= 2_048
      ? query.cursor
      : null;
  const limit = query.limit === undefined
    ? undefined
    : boundedQueryInteger(query.limit, 1, 48);
  const platform = query.platform === undefined ? "web" : query.platform;
  const sort = query.sort === undefined ? "latest" : query.sort;
  const search = query.query === undefined
    ? undefined
    : typeof query.query === "string" && query.query.length <= 120
      ? query.query.trim() || undefined
      : null;
  const filters = siteFilters(query.filter);
  const validRefresh = query.refresh === undefined || query.refresh === "1";
  const includeFacets = query.facets !== "summary";
  if (cursor === null
    || (query.limit !== undefined && limit === undefined)
    || platform !== "web"
    || (sort !== "latest" && sort !== "popular")
    || search === null
    || filters === null
    || (query.facets !== undefined && query.facets !== "summary")
    || !validRefresh) {
    return null;
  }
  return {
    ...(cursor ? { cursor } : {}),
    ...(limit ? { limit } : {}),
    platform,
    sort,
    ...(search ? { query: search } : {}),
    filters,
    ...(includeFacets ? {} : { includeFacets: false as const }),
  };
}

function siteFilters(value: unknown): DiscoveryFilter[] | null {
  const tokens = Array.isArray(value) ? value : value === undefined ? [] : [value];
  if (tokens.length > 40) return null;
  const filters: DiscoveryFilter[] = [];
  for (const token of tokens) {
    if (typeof token !== "string") return null;
    const separator = token.indexOf(".");
    const group = token.slice(0, separator).trim();
    const filterValue = token.slice(separator + 1).trim();
    if (separator < 1
      || !SITE_FILTER_GROUPS.has(group)
      || !filterValue
      || filterValue.length > 120) {
      return null;
    }
    filters.push({ group, value: filterValue });
  }
  return filters;
}

function queryTextValues(value: unknown): string[] | null {
  const tokens = Array.isArray(value) ? value : value === undefined ? [] : [value];
  if (tokens.length > 40) return null;
  const values: string[] = [];
  for (const token of tokens) {
    if (typeof token !== "string") return null;
    const trimmed = token.trim();
    if (!trimmed || trimmed.length > 120) return null;
    values.push(trimmed);
  }
  return values;
}

type ReadySite = Awaited<ReturnType<SitesStore["listReadySites"]>>[number];
type RoutedReadySite = ReadySite & { routeSlug: string };

export function withRouteSlugs(sites: ReadySite[]): RoutedReadySite[] {
  const groups = new Map<string, ReadySite[]>();
  for (const site of sites) {
    const base = routeSlugBase(site.name, site.siteId);
    const group = groups.get(base) ?? [];
    group.push(site);
    groups.set(base, group);
  }
  const routeSlugs = new Map<number, string>();
  for (const [base, group] of groups) {
    group
      .sort((left, right) => left.siteId - right.siteId)
      .forEach((site, index) => {
        routeSlugs.set(site.siteId, index === 0 ? base : `${base}-${index + 1}`);
      });
  }
  return sites.map((site) => ({
    ...site,
    routeSlug: routeSlugs.get(site.siteId) ?? routeSlugBase(site.name, site.siteId),
  }));
}

function legacyDuplicateRouteSite(
  sites: RoutedReadySite[],
  routeSlug: string,
): RoutedReadySite | undefined {
  const match = routeSlug.match(/^(.+)-([2-9]\d*)$/);
  if (!match) return undefined;
  return sites.find((candidate) => candidate.routeSlug === match[1]);
}

function routeSlugBase(name: string, siteId: number): string {
  const normalized = name
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || `site-${siteId}`;
}

function routeSlugParameter(value: unknown): string | undefined {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 240
    && value.trim() === value
    && !value.includes("/")
    ? value
    : undefined;
}

function boundedQueryInteger(
  value: unknown,
  minimum: number,
  maximum: number,
): number | undefined {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : undefined;
}

function publicSiteSummary(
  site: Awaited<ReturnType<SitesStore["listReadySites"]>>[number],
) {
  const root = `/api/sites/${site.siteId}/versions/${site.versionId}/catalog-media`;
  return {
    ...site,
    previewUrl: `${root}/preview`,
    previews: site.previews.map((preview) => ({
      ...preview,
      url: `${root}/posters/${preview.id}`,
    })),
  };
}

async function sendPublicCatalogMedia(
  req: express.Request,
  res: express.Response,
  dependencies: SitesRouteDependencies,
  kind: "preview" | "poster",
): Promise<void> {
  const ids = versionIds(req.params);
  const recordId = kind === "poster" ? positiveId(req.params.recordId) : undefined;
  if (!ids || (kind === "poster" && !recordId)) {
    res.status(400).json({ error: "invalid Site catalog media reference" });
    return;
  }

  const metadata = await dependencies.store.siteMediaObject({
    ...ids,
    kind: kind === "preview" ? "preview" : "page",
    ...(recordId === undefined ? {} : { recordId }),
  });
  if (!metadata || metadata.accessClass === "internal") {
    res.status(404).json({ error: "Site catalog media not found" });
    return;
  }
  try {
    await dependencies.sendObject(metadata, res);
  } catch {
    res.status(503).json({ error: "media storage unavailable" });
  }
}

function mountMedia(
  app: express.Express,
  dependencies: SitesRouteDependencies,
  path: string,
  kind: "preview" | "mobile" | "page" | "section" | "poster",
): void {
  app.get(path, async (req, res) => {
    const ids = versionIds(req.params);
    const versionMedia = kind === "preview" || kind === "mobile";
    const recordId = versionMedia ? undefined : positiveId(req.params.recordId);
    if (!ids || (!versionMedia && !recordId)) {
      res.status(400).json({ error: "invalid Site media reference" });
      return;
    }
    const metadata = await dependencies.store.siteMediaObject({
      ...ids,
      kind,
      ...(recordId === undefined ? {} : { recordId }),
    });
    if (!metadata || metadata.accessClass === "internal") {
      res.status(404).json({ error: "Site media not found" });
      return;
    }
    try {
      await dependencies.sendObject(metadata, res);
    } catch {
      res.status(503).json({ error: "media storage unavailable" });
    }
  });
}

function versionIds(params: Record<string, string | string[] | undefined>): {
  siteId: number;
  versionId: number;
} | undefined {
  const siteId = positiveId(params.siteId);
  const versionId = positiveId(params.versionId);
  return siteId && versionId ? { siteId, versionId } : undefined;
}

function positiveId(value: string | string[] | undefined): number | undefined {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}
