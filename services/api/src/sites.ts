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
  app.get("/sites/:siteId/versions/:versionId", async (req, res) => {
    const ids = versionIds(req.params);
    if (!ids) {
      res.status(400).json({ error: "invalid Site version reference" });
      return;
    }
    const version = await dependencies.store.readyVersionDetail(ids.siteId, ids.versionId);
    if (!version) {
      res.status(404).json({ error: "Site version not found" });
      return;
    }
    res.json(clientSiteVersion(version));
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
        sourceMetadata: {
          patterns: Array.isArray(section.sourceMetadata.patterns)
            ? section.sourceMetadata.patterns.filter(
                (pattern): pattern is string => typeof pattern === "string" && Boolean(pattern),
              )
            : [],
        },
      })),
    })),
  };
}

function mountReadySitesList(
  app: express.Express,
  dependencies: SitesRouteDependencies,
  publicCatalogMedia: boolean,
): void {
  app.get("/sites", async (req, res) => {
    const sites = await dependencies.store.listReadySites();
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
