import express from "express";
import {
  normalizeDesignerCanvasSnapshot,
  type DesignerCanvasFile,
  type DesignerCanvasStore,
} from "../../../src/designerCanvas.ts";
import {
  RESEARCH_LIMITS,
  normalizeResearchProjectId,
} from "../../../src/researchProject.ts";
import type { ObjectMetadata, ObjectStore } from "../../../src/objectStore.ts";
import { researchUploadObjectKey } from "../../../src/objectStore.ts";
import { validateResearchUpload } from "../../../src/researchUpload.ts";

export interface DesignerCanvasRouteDependencies {
  store: DesignerCanvasStore;
  enabled: boolean;
  objectStore?: ObjectStore;
}

interface CanvasRouteShape {
  documentPath: string;
  assetPath: string;
  assetUrl(projectId: string, assetId: string): string;
}

const routeShapes: readonly CanvasRouteShape[] = [
  {
    documentPath: "/designer-canvases/:projectId",
    assetPath: "/designer-canvases/:projectId/assets/:assetId",
    assetUrl: (projectId, assetId) =>
      `/api/designer-canvases/${projectId}/assets/${encodeURIComponent(assetId)}`,
  },
  {
    documentPath: "/research-projects/:projectId/canvas",
    assetPath: "/research-projects/:projectId/canvas/assets/:assetId",
    assetUrl: (projectId, assetId) =>
      `/api/research-projects/${projectId}/canvas/assets/${encodeURIComponent(assetId)}`,
  },
];

const record = (value: unknown): Record<string, unknown> | undefined => value
  && typeof value === "object" && !Array.isArray(value)
  ? value as Record<string, unknown>
  : undefined;

const canvasAssetId = (value: unknown): string | undefined => typeof value === "string"
  && /^asset:[A-Za-z0-9_-]{1,220}$/.test(value) ? value : undefined;

const canvasFileId = (value: unknown): string | undefined => typeof value === "string"
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ? value : undefined;

const canvasTitle = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const title = value.trim();
  return title && title.length <= 120 ? title : undefined;
};

export function parseDesignerCanvasSnapshot(
  value: unknown,
): Record<string, unknown> | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const body = record(JSON.parse(value));
    return normalizeDesignerCanvasSnapshot(body?.snapshot);
  } catch {
    return undefined;
  }
}

function asyncRoute(
  handler: (req: express.Request, res: express.Response) => Promise<void>,
): express.RequestHandler {
  return (req, res, next) => { handler(req, res).catch(next); };
}

function enabledRoute(
  enabled: boolean,
  handler: express.RequestHandler,
): express.RequestHandler {
  return (req, res, next) => {
    if (!enabled) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    handler(req, res, next);
  };
}

async function sendStoredObject(
  store: ObjectStore,
  metadata: ObjectMetadata,
  res: express.Response,
): Promise<void> {
  const signed = await store.signedGetUrl(metadata.key, 300);
  if (signed) {
    res.redirect(302, signed);
    return;
  }
  const object = await store.get(metadata.key);
  res.setHeader("Content-Type", metadata.contentType);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(object.body);
}

function mountRouteShape(
  app: express.Express,
  deps: DesignerCanvasRouteDependencies,
  shape: CanvasRouteShape,
): void {
  app.get(shape.documentPath, enabledRoute(deps.enabled, asyncRoute(async (req, res) => {
    const projectId = normalizeResearchProjectId(req.params.projectId);
    if (!projectId) {
      res.status(400).json({ error: "invalid project id" });
      return;
    }
    const canvas = await deps.store.getCanvas(res.locals.user.id, projectId);
    if (!canvas) {
      res.status(404).json({ error: "designer project not found" });
      return;
    }
    res.setHeader("ETag", `\"${canvas.revision}\"`);
    res.json(canvas);
  })));

  app.put(
    shape.documentPath,
    express.text({ type: "application/vnd.astryx.excalidraw+json", limit: "5mb" }),
    enabledRoute(deps.enabled, asyncRoute(async (req, res) => {
      const projectId = normalizeResearchProjectId(req.params.projectId);
      const snapshot = parseDesignerCanvasSnapshot(req.body);
      if (!projectId || !snapshot) {
        res.status(400).json({ error: "invalid designer canvas" });
        return;
      }
      const canvas = await deps.store.saveCanvas(res.locals.user.id, projectId, snapshot);
      if (!canvas) {
        res.status(404).json({ error: "designer project not found" });
        return;
      }
      res.setHeader("ETag", `\"${canvas.revision}\"`);
      res.json(canvas);
    })),
  );

  app.post(
    shape.assetPath,
    express.raw({
      type: ["image/png", "image/jpeg", "image/webp"],
      limit: RESEARCH_LIMITS.uploadBytesMax,
    }),
    enabledRoute(deps.enabled, asyncRoute(async (req, res) => {
      const projectId = normalizeResearchProjectId(req.params.projectId);
      const assetId = canvasAssetId(req.params.assetId);
      const contentType = (req.header("content-type") ?? "")
        .split(";", 1)[0]
        .trim()
        .toLowerCase();
      if (!["image/png", "image/jpeg", "image/webp"].includes(contentType)) {
        res.status(415).json({ error: "unsupported canvas asset type" });
        return;
      }
      if (!projectId || !assetId || !Buffer.isBuffer(req.body)) {
        res.status(400).json({ error: "invalid canvas asset" });
        return;
      }
      if (!deps.objectStore) {
        res.status(503).json({ error: "Object storage unavailable" });
        return;
      }
      const validated = validateResearchUpload(req.body, contentType);
      const metadata: ObjectMetadata = {
        key: researchUploadObjectKey(
          res.locals.user.id,
          validated.sha256,
          validated.extension,
        ),
        sha256: validated.sha256,
        byteSize: validated.byteSize,
        contentType: validated.contentType,
        accessClass: "protected",
      };
      const stored = await deps.objectStore.put({ ...metadata, body: req.body });
      try {
        const attached = await deps.store.attachCanvasAsset(
          res.locals.user.id,
          projectId,
          assetId,
          stored.metadata,
        );
        if (!attached) {
          if (stored.created) await deps.objectStore.delete(metadata.key);
          res.status(404).json({ error: "designer project not found" });
          return;
        }
      } catch (error) {
        if (stored.created) await deps.objectStore.delete(metadata.key);
        throw error;
      }
      res.status(201).json({
        assetId,
        src: shape.assetUrl(projectId, assetId),
      });
    })),
  );

  app.get(shape.assetPath, enabledRoute(deps.enabled, asyncRoute(async (req, res) => {
    const projectId = normalizeResearchProjectId(req.params.projectId);
    const assetId = canvasAssetId(req.params.assetId);
    if (!projectId || !assetId) {
      res.status(400).json({ error: "invalid canvas asset" });
      return;
    }
    if (!deps.objectStore) {
      res.status(503).json({ error: "Object storage unavailable" });
      return;
    }
    const metadata = await deps.store.getCanvasAsset(
      res.locals.user.id,
      projectId,
      assetId,
    );
    if (!metadata) {
      res.status(404).json({ error: "canvas asset not found" });
      return;
    }
    await sendStoredObject(deps.objectStore, metadata, res);
  })));
}

export function mountDesignerCanvasRoutes(
  app: express.Express,
  deps: DesignerCanvasRouteDependencies,
): void {
  app.get("/research-projects/:projectId/canvases", enabledRoute(deps.enabled, asyncRoute(async (req, res) => {
    const projectId = normalizeResearchProjectId(req.params.projectId);
    if (!projectId) {
      res.status(400).json({ error: "invalid project id" });
      return;
    }
    if (!deps.store.listCanvasFiles) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const canvases = await deps.store.listCanvasFiles(res.locals.user.id, projectId);
    if (!canvases) {
      res.status(404).json({ error: "designer project not found" });
      return;
    }
    res.json(canvases);
  })));

  app.post("/research-projects/:projectId/canvases", enabledRoute(deps.enabled, asyncRoute(async (req, res) => {
    const projectId = normalizeResearchProjectId(req.params.projectId);
    const title = canvasTitle((req.body as { title?: unknown } | undefined)?.title);
    const snapshot = normalizeDesignerCanvasSnapshot(
      (req.body as { snapshot?: unknown } | undefined)?.snapshot,
    );
    if (!projectId || !title || !snapshot) {
      res.status(400).json({ error: "invalid designer canvas" });
      return;
    }
    if (!deps.store.createCanvasFile) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const canvas = await deps.store.createCanvasFile(
      res.locals.user.id, projectId, title, snapshot,
    );
    if (!canvas) {
      res.status(404).json({ error: "designer project not found" });
      return;
    }
    res.status(201).json(canvas);
  })));

  const sendCanvasFile = (res: express.Response, canvas: DesignerCanvasFile | undefined) => {
    if (!canvas) {
      res.status(404).json({ error: "designer canvas not found" });
      return;
    }
    res.setHeader("ETag", `\"${canvas.revision}\"`);
    res.json(canvas);
  };

  app.get("/research-projects/:projectId/canvases/:canvasId", enabledRoute(deps.enabled, asyncRoute(async (req, res) => {
    const projectId = normalizeResearchProjectId(req.params.projectId);
    const canvasId = canvasFileId(req.params.canvasId);
    if (!projectId || !canvasId) {
      res.status(400).json({ error: "invalid designer canvas" });
      return;
    }
    if (!deps.store.getCanvasFile) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    sendCanvasFile(res, await deps.store.getCanvasFile(res.locals.user.id, projectId, canvasId));
  })));

  app.put(
    "/research-projects/:projectId/canvases/:canvasId",
    express.text({ type: "application/vnd.astryx.excalidraw+json", limit: "5mb" }),
    enabledRoute(deps.enabled, asyncRoute(async (req, res) => {
      const projectId = normalizeResearchProjectId(req.params.projectId);
      const canvasId = canvasFileId(req.params.canvasId);
      const snapshot = parseDesignerCanvasSnapshot(req.body);
      if (!projectId || !canvasId || !snapshot) {
        res.status(400).json({ error: "invalid designer canvas" });
        return;
      }
      if (!deps.store.saveCanvasFile) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      sendCanvasFile(
        res,
        await deps.store.saveCanvasFile(res.locals.user.id, projectId, canvasId, snapshot),
      );
    })),
  );

  for (const shape of routeShapes) mountRouteShape(app, deps, shape);
}
