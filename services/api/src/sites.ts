import type express from "express";
import type { ObjectMetadata } from "../../../src/objectStore.ts";
import type { SiteVersionDetail, SitesStore } from "../../../src/sitesStore.ts";

export interface SitesRouteDependencies {
  store: Pick<SitesStore, "listReadySites" | "readyVersionDetail" | "siteMediaObject">;
  sendObject(metadata: ObjectMetadata, res: express.Response): Promise<void>;
}

export function mountSitesRoutes(
  app: express.Express,
  dependencies: SitesRouteDependencies,
): void {
  mountReadySitesList(app, dependencies, false);
  mountPrivateSitesRoutes(app, dependencies);
}

export function mountPublicSitesRoutes(
  app: express.Express,
  dependencies: SitesRouteDependencies,
): void {
  mountReadySitesList(app, dependencies, true);

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

function mountReadySitesList(
  app: express.Express,
  dependencies: SitesRouteDependencies,
  publicCatalogMedia: boolean,
): void {
  app.get("/sites", async (req, res) => {
    const sites = withRouteSlugs(await dependencies.store.listReadySites());
    const summaries = publicCatalogMedia ? sites.map(publicSiteSummary) : sites;
    const requestedPage = req.query.limit !== undefined || req.query.offset !== undefined;
    if (!requestedPage) {
      res.json(summaries);
      return;
    }
    const limit = boundedQueryInteger(req.query.limit, 1, 48);
    const offset = boundedQueryInteger(req.query.offset, 0, 100_000);
    if (limit === undefined || offset === undefined) {
      res.status(400).json({ error: "invalid Site catalog page" });
      return;
    }
    const nextOffset = offset + limit < summaries.length ? offset + limit : null;
    res.setHeader("Cache-Control", "public, max-age=60");
    res.json({
      sites: summaries.slice(offset, offset + limit),
      nextOffset,
      total: summaries.length,
    });
  });
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
