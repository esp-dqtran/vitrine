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
  app.get("/sites", async (_req, res) => {
    res.json(await dependencies.store.listReadySites());
  });

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
  mountMedia(app, dependencies, "/sites/:siteId/versions/:versionId/pages/:recordId/media", "page");
  mountMedia(app, dependencies, "/sites/:siteId/versions/:versionId/sections/:recordId/media", "section");
  mountMedia(app, dependencies, "/sites/:siteId/versions/:versionId/sections/:recordId/poster", "poster");
}

function mountMedia(
  app: express.Express,
  dependencies: SitesRouteDependencies,
  path: string,
  kind: "preview" | "page" | "section" | "poster",
): void {
  app.get(path, async (req, res) => {
    const ids = versionIds(req.params);
    const recordId = kind === "preview" ? undefined : positiveId(req.params.recordId);
    if (!ids || (kind !== "preview" && !recordId)) {
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
