import express from "express";
import {
  RESEARCH_LIMITS,
  ResearchProjectConflictError,
  type AddResearchItemInput,
  type ProjectPatch,
  type ResearchPlatform,
  type ResearchProjectWorkspace,
} from "../../../src/researchProject.ts";
import type { ResearchProjectStore } from "../../../src/researchProjectStore.ts";
import {
  rankResearchSuggestions,
  type ResearchSuggestionCandidate,
} from "../../../src/researchSuggestions.ts";
import {
  renderResearchProjectMarkdown,
  synthesizeResearchProject,
  type ResearchSynthesisProvider,
} from "../../../src/researchSynthesis.ts";
import { storeResearchUpload } from "../../../src/researchUpload.ts";
import type { ObjectMetadata, ObjectStore } from "../../../src/objectStore.ts";
import type { FeatureKey } from "../../../src/featureUsage.ts";

interface ResearchUser {
  id: number;
  role: "admin" | "user";
}

export interface ResearchProjectRouteDependencies {
  store: ResearchProjectStore;
  enabled: boolean;
  objectStore?: ObjectStore;
  synthesisProvider?: ResearchSynthesisProvider;
  canAccessApp(user: ResearchUser, app: string): Promise<boolean>;
  listPublishedCandidates(userId: number): Promise<ResearchSuggestionCandidate[]>;
  getPrivateObject?(userId: number, projectId: number, itemId: number): Promise<ObjectMetadata | undefined>;
  recordEvent?(input: { userId: number; featureKey: FeatureKey; action: string; outcome: string; volume?: number }): Promise<void>;
}

const platforms = new Set<ResearchPlatform>(["all", "ios", "android", "web"]);
const positiveId = (value: unknown): number | undefined => {
  if (typeof value !== "string") return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
};
const record = (value: unknown): Record<string, unknown> | undefined => value
  && typeof value === "object" && !Array.isArray(value)
  ? value as Record<string, unknown>
  : undefined;
const boundedText = (value: unknown, max: number, required = false): string | undefined => {
  if (typeof value !== "string") return required ? undefined : "";
  const parsed = value.trim();
  return (!parsed && required) || parsed.length > max ? undefined : parsed;
};
const revision = (value: unknown): number | undefined => typeof value === "number"
  && Number.isSafeInteger(value) && value > 0 ? value : undefined;

function parsePatch(body: Record<string, unknown>): ProjectPatch | undefined {
  const patch: ProjectPatch = {};
  const definitions: Array<[Exclude<keyof ProjectPatch, "platformFilter">, number]> = [
    ["title", 120],
    ["question", 1000],
    ["constraints", 4000],
    ["decision", 8000],
    ["rationale", 8000],
    ["openQuestions", 4000],
  ];
  for (const [key, max] of definitions) {
    if (body[key] === undefined) continue;
    const value = boundedText(body[key], max, key === "title" || key === "question");
    if (value === undefined) return undefined;
    patch[key] = value;
  }
  if (body.platformFilter !== undefined) {
    if (!platforms.has(body.platformFilter as ResearchPlatform)) return undefined;
    patch.platformFilter = body.platformFilter as ResearchPlatform;
  }
  return patch;
}

function asyncRoute(
  handler: (req: express.Request, res: express.Response) => Promise<void>,
): express.RequestHandler {
  return (req, res, next) => { handler(req, res).catch(next); };
}

async function sendStoredObject(store: ObjectStore, metadata: ObjectMetadata, res: express.Response): Promise<void> {
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

export function mountResearchProjectRoutes(
  app: express.Express,
  deps: ResearchProjectRouteDependencies,
): void {
  app.use("/research-projects", (_req, res, next) => {
    if (!deps.enabled) res.status(404).json({ error: "Not found" });
    else next();
  });

  app.get("/research-projects", asyncRoute(async (_req, res) => {
    res.json(await deps.store.listProjects(res.locals.user.id));
  }));

  app.post("/research-projects", asyncRoute(async (req, res) => {
    const title = boundedText(req.body?.title, 120, true);
    const question = boundedText(req.body?.question, 1000, true);
    const platformFilter = req.body?.platformFilter as ResearchPlatform;
    if (!title || !question || !platforms.has(platformFilter)) {
      res.status(400).json({ error: "invalid research project" });
      return;
    }
    const project = await deps.store.createProject(res.locals.user.id, { title, question, platformFilter });
    await deps.recordEvent?.({ userId: res.locals.user.id, featureKey: "research", action: "research_project_created", outcome: "created" });
    res.status(201).json(project);
  }));

  app.get("/research-projects/:id", asyncRoute(async (req, res) => {
    const projectId = positiveId(req.params.id);
    if (!projectId) { res.status(400).json({ error: "invalid project id" }); return; }
    const project = await deps.store.getProject(res.locals.user.id, projectId);
    if (!project) { res.status(404).json({ error: "research project not found" }); return; }
    for (const item of project.lanes.flatMap(({ items }) => items)) {
      if (item.snapshot.app && !(await deps.canAccessApp(res.locals.user, item.snapshot.app))) {
        item.restricted = true;
        delete item.mediaUrl;
      }
    }
    res.json(project);
  }));

  app.patch("/research-projects/:id", asyncRoute(async (req, res) => {
    const projectId = positiveId(req.params.id);
    const expectedRevision = revision(req.body?.expectedRevision);
    const body = record(req.body);
    const patch = body ? parsePatch(body) : undefined;
    if (!projectId || !expectedRevision || !patch) { res.status(400).json({ error: "invalid project update" }); return; }
    const project = await deps.store.updateProject(res.locals.user.id, projectId, expectedRevision, patch);
    if (!project) res.status(404).json({ error: "research project not found" });
    else res.json(project);
  }));

  app.delete("/research-projects/:id", asyncRoute(async (req, res) => {
    const projectId = positiveId(req.params.id);
    if (!projectId) { res.status(400).json({ error: "invalid project id" }); return; }
    const deleted = await deps.store.deleteProject(res.locals.user.id, projectId);
    if (!deleted.deleted) { res.status(404).json({ error: "research project not found" }); return; }
    if (deps.objectStore) await Promise.all(deleted.privateObjectKeys.map((key) => deps.objectStore!.delete(key)));
    res.status(204).end();
  }));

  app.post("/research-projects/:id/duplicate", asyncRoute(async (req, res) => {
    const projectId = positiveId(req.params.id);
    if (!projectId) { res.status(400).json({ error: "invalid project id" }); return; }
    const project = await deps.store.duplicateProject(res.locals.user.id, projectId);
    if (!project) res.status(404).json({ error: "research project not found" });
    else res.status(201).json(project);
  }));

  app.post("/research-projects/:id/lanes", asyncRoute(async (req, res) => {
    const projectId = positiveId(req.params.id);
    const expectedRevision = revision(req.body?.expectedRevision);
    const title = boundedText(req.body?.title, 120, true);
    if (!projectId || !expectedRevision || !title) { res.status(400).json({ error: "invalid lane" }); return; }
    const project = await deps.store.createLane(res.locals.user.id, { projectId, expectedRevision, title });
    if (!project) res.status(404).json({ error: "research project not found" });
    else res.status(201).json(project);
  }));

  app.patch("/research-projects/:id/lanes/:laneId", asyncRoute(async (req, res) => {
    const projectId = positiveId(req.params.id);
    const laneId = positiveId(req.params.laneId);
    const expectedRevision = revision(req.body?.expectedRevision);
    const title = req.body?.title === undefined ? undefined : boundedText(req.body.title, 120, true);
    const conclusion = req.body?.conclusion === undefined ? undefined : boundedText(req.body.conclusion, 4000);
    if (!projectId || !laneId || !expectedRevision || title === undefined && req.body?.title !== undefined
      || conclusion === undefined && req.body?.conclusion !== undefined) {
      res.status(400).json({ error: "invalid lane update" }); return;
    }
    const project = await deps.store.updateLane(res.locals.user.id, {
      projectId, laneId, expectedRevision, title, conclusion,
    });
    if (!project) res.status(404).json({ error: "research lane not found" });
    else res.json(project);
  }));

  app.delete("/research-projects/:id/lanes/:laneId", asyncRoute(async (req, res) => {
    const projectId = positiveId(req.params.id);
    const laneId = positiveId(req.params.laneId);
    const expectedRevision = revision(req.body?.expectedRevision ?? Number(req.query.revision));
    if (!projectId || !laneId || !expectedRevision) { res.status(400).json({ error: "invalid lane delete" }); return; }
    const project = await deps.store.deleteEmptyLane(res.locals.user.id, { projectId, laneId, expectedRevision });
    if (!project) res.status(404).json({ error: "research lane not found" });
    else res.json(project);
  }));

  app.post("/research-projects/:id/items", asyncRoute(async (req, res) => {
    const projectId = positiveId(req.params.id);
    const laneId = positiveId(String(req.body?.laneId));
    const expectedRevision = revision(req.body?.expectedRevision);
    const snapshot = record(req.body?.snapshot);
    const sourceKind = req.body?.sourceKind;
    const catalog = record(req.body?.catalog);
    if (!projectId || !laneId || !expectedRevision || !snapshot || typeof snapshot.title !== "string"
      || !["catalog_screen", "catalog_flow_step"].includes(sourceKind)) {
      res.status(400).json({ error: "invalid research evidence" }); return;
    }
    const appName = typeof catalog?.app === "string" ? catalog.app : "";
    if (!appName || !(await deps.canAccessApp(res.locals.user, appName))) {
      res.status(403).json({ error: "Upgrade required", code: "upgrade_required", app: appName }); return;
    }
    const input: AddResearchItemInput = {
      projectId, laneId, expectedRevision, sourceKind,
      snapshot: snapshot as unknown as AddResearchItemInput["snapshot"],
      catalog: {
        app: appName,
        versionId: Number(catalog?.versionId),
        imageId: Number(catalog?.imageId),
        flowId: typeof catalog?.flowId === "string" ? catalog.flowId : undefined,
        stepIndex: typeof catalog?.stepIndex === "number" ? catalog.stepIndex : undefined,
      },
    };
    if (!Number.isSafeInteger(input.catalog!.versionId) || input.catalog!.versionId <= 0
      || !Number.isSafeInteger(input.catalog!.imageId) || input.catalog!.imageId <= 0) {
      res.status(400).json({ error: "invalid catalog evidence" }); return;
    }
    const project = await deps.store.addItem(res.locals.user.id, input);
    if (!project) res.status(404).json({ error: "research project or lane not found" });
    else res.status(201).json(project);
  }));

  app.patch("/research-projects/:id/items/:itemId", asyncRoute(async (req, res) => {
    const projectId = positiveId(req.params.id);
    const itemId = positiveId(req.params.itemId);
    const expectedRevision = revision(req.body?.expectedRevision);
    if (!projectId || !itemId || !expectedRevision) { res.status(400).json({ error: "invalid item update" }); return; }
    const project = await deps.store.updateItem(res.locals.user.id, {
      projectId, itemId, expectedRevision,
      stepLabel: req.body?.stepLabel,
      note: req.body?.note,
      tags: req.body?.tags,
      important: req.body?.important,
    });
    if (!project) res.status(404).json({ error: "research item not found" });
    else res.json(project);
  }));

  app.post("/research-projects/:id/items/:itemId/move", asyncRoute(async (req, res) => {
    const projectId = positiveId(req.params.id);
    const itemId = positiveId(req.params.itemId);
    const targetLaneId = positiveId(String(req.body?.targetLaneId));
    const targetPosition = Number(req.body?.targetPosition);
    const expectedRevision = revision(req.body?.expectedRevision);
    if (!projectId || !itemId || !targetLaneId || !expectedRevision
      || !Number.isSafeInteger(targetPosition) || targetPosition < 0) {
      res.status(400).json({ error: "invalid item move" }); return;
    }
    const project = await deps.store.moveItem(res.locals.user.id, {
      projectId, itemId, targetLaneId, targetPosition, expectedRevision,
    });
    if (!project) res.status(404).json({ error: "research item not found" });
    else res.json(project);
  }));

  app.delete("/research-projects/:id/items/:itemId", asyncRoute(async (req, res) => {
    const projectId = positiveId(req.params.id);
    const itemId = positiveId(req.params.itemId);
    const expectedRevision = revision(req.body?.expectedRevision ?? Number(req.query.revision));
    if (!projectId || !itemId || !expectedRevision) { res.status(400).json({ error: "invalid item delete" }); return; }
    const removed = await deps.store.removeItem(res.locals.user.id, { projectId, itemId, expectedRevision });
    if (!removed.project) { res.status(404).json({ error: "research item not found" }); return; }
    if (removed.unreferencedPrivateObjectKey && deps.objectStore) {
      await deps.objectStore.delete(removed.unreferencedPrivateObjectKey);
    }
    res.json(removed.project);
  }));

  app.get("/research-projects/:id/suggestions", asyncRoute(async (req, res) => {
    const projectId = positiveId(req.params.id);
    if (!projectId) { res.status(400).json({ error: "invalid project id" }); return; }
    const project = await deps.store.getProject(res.locals.user.id, projectId);
    if (!project) { res.status(404).json({ error: "research project not found" }); return; }
    const query = typeof req.query.q === "string" && req.query.q.trim() ? req.query.q.trim() : project.question;
    const candidates = await deps.listPublishedCandidates(res.locals.user.id);
    res.json(rankResearchSuggestions(query, candidates, { platform: project.platformFilter, limit: 20 }));
  }));

  app.post(
    "/research-projects/:id/uploads",
    express.raw({ type: ["image/png", "image/jpeg", "image/webp"], limit: RESEARCH_LIMITS.uploadBytesMax }),
    asyncRoute(async (req, res) => {
      const projectId = positiveId(req.params.id);
      const laneId = positiveId(String(req.query.laneId));
      const expectedRevision = revision(Number(req.query.revision));
      const contentType = (req.header("content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
      if (!["image/png", "image/jpeg", "image/webp"].includes(contentType)) {
        res.status(415).json({ error: "unsupported research upload type" }); return;
      }
      if (!projectId || !laneId || !expectedRevision || !Buffer.isBuffer(req.body)) {
        res.status(400).json({ error: "invalid research upload" }); return;
      }
      if (!deps.objectStore) { res.status(503).json({ error: "Object storage unavailable" }); return; }
      const filename = boundedText(req.header("x-upload-filename"), 240) || "Private screenshot";
      const project = await storeResearchUpload({
        userId: res.locals.user.id,
        body: req.body,
        contentType: req.header("content-type") ?? "",
        objectStore: deps.objectStore,
        persist: (metadata) => deps.store.addPrivateItem(res.locals.user.id, {
          projectId, laneId, expectedRevision, sourceKind: "private_upload",
          privateObjectKey: metadata.key,
          snapshot: { title: filename, sourcePath: `/projects/${projectId}/private-media/pending` },
        }, metadata),
      });
      if (!project) res.status(404).json({ error: "research project or lane not found" });
      else res.status(201).json(project);
    }),
  );

  app.get("/research-projects/:id/private-media/:itemId", asyncRoute(async (req, res) => {
    const projectId = positiveId(req.params.id);
    const itemId = positiveId(req.params.itemId);
    if (!projectId || !itemId) { res.status(400).json({ error: "invalid private media id" }); return; }
    if (!deps.objectStore || !deps.getPrivateObject) { res.status(503).json({ error: "Object storage unavailable" }); return; }
    const metadata = await deps.getPrivateObject(res.locals.user.id, projectId, itemId);
    if (!metadata) { res.status(404).json({ error: "private media not found" }); return; }
    await sendStoredObject(deps.objectStore, metadata, res);
  }));

  app.post("/research-projects/:id/synthesize", asyncRoute(async (req, res) => {
    const projectId = positiveId(req.params.id);
    if (!projectId) { res.status(400).json({ error: "invalid project id" }); return; }
    if (!deps.synthesisProvider) { res.status(503).json({ error: "Research synthesis is not configured" }); return; }
    const project = await deps.store.getProject(res.locals.user.id, projectId);
    if (!project) { res.status(404).json({ error: "research project not found" }); return; }
    if (project.lanes.filter(({ items }) => items.length > 0).length < 2) {
      res.status(422).json({ error: "Add evidence to at least two lanes before synthesis" }); return;
    }
    const result = await synthesizeResearchProject(project, deps.synthesisProvider);
    const synthesis = await deps.store.recordSynthesis(res.locals.user.id, {
      projectId, projectRevision: project.revision, status: "complete", result,
      model: deps.synthesisProvider.model, schemaVersion: 1,
    });
    if (!synthesis) { res.status(409).json({ error: "Project changed during synthesis", code: "revision_conflict" }); return; }
    await deps.recordEvent?.({ userId: res.locals.user.id, featureKey: "ai_analysis", action: "research_synthesis_created", outcome: "created" });
    res.status(201).json(synthesis);
  }));

  app.get("/research-projects/:id/export.md", asyncRoute(async (req, res) => {
    const projectId = positiveId(req.params.id);
    if (!projectId) { res.status(400).json({ error: "invalid project id" }); return; }
    const project = await deps.store.getProject(res.locals.user.id, projectId);
    if (!project) { res.status(404).json({ error: "research project not found" }); return; }
    const filename = `${project.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "research"}-DESIGN.md`;
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(renderResearchProjectMarkdown(project));
  }));

  app.use((error: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.path.startsWith("/research-projects")) { next(error); return; }
    if (error && typeof error === "object" && "type" in error && error.type === "entity.too.large") {
      res.status(413).json({ error: "Research upload exceeds 10 MiB" });
      return;
    }
    if (error instanceof ResearchProjectConflictError) {
      const projectId = positiveId(req.params.id ?? "");
      void (projectId ? deps.store.getProject(res.locals.user.id, projectId) : Promise.resolve(undefined))
        .then((project) => res.status(409).json({
          error: "Research project changed in another session",
          code: "revision_conflict",
          project,
        }));
      return;
    }
    if (error instanceof Error && error.name === "TimeoutError") {
      res.status(504).json({ error: "Research synthesis timed out" });
      return;
    }
    if (error instanceof Error && /limit|required|invalid|empty/i.test(error.message)) {
      res.status(422).json({ error: error.message });
      return;
    }
    next(error);
  });
}
