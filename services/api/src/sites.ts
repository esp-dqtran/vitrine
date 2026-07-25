import type express from "express";
import type { ObjectMetadata } from "../../../src/objectStore.ts";
import type { SitesStore } from "../../../src/sitesStore.ts";

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
    res.json(version);
  });

  mountMedia(app, dependencies, "/sites/:siteId/versions/:versionId/media/preview", "preview");
  mountMedia(app, dependencies, "/sites/:siteId/versions/:versionId/media/mobile", "mobile");
  mountMedia(app, dependencies, "/sites/:siteId/versions/:versionId/pages/:recordId/media", "page");
  mountMedia(app, dependencies, "/sites/:siteId/versions/:versionId/sections/:recordId/media", "section");
  mountMedia(app, dependencies, "/sites/:siteId/versions/:versionId/sections/:recordId/poster", "poster");
}

function mountReadySitesList(
  app: express.Express,
  dependencies: SitesRouteDependencies,
  publicCatalogMedia: boolean,
): void {
  app.get("/sites", async (_req, res) => {
    const sites = await dependencies.store.listReadySites();
    res.json(publicCatalogMedia ? sites.map(publicSiteSummary) : sites);
  });
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

  const site = (await dependencies.store.listReadySites()).find(
    (entry) => entry.siteId === ids.siteId && entry.versionId === ids.versionId,
  );
  if (!site || (recordId !== undefined && !site.previews.some((entry) => entry.id === recordId))) {
    res.status(404).json({ error: "Site catalog media not found" });
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
