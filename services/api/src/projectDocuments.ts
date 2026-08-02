import express from "express";

import {
  normalizeResearchProjectId,
  type ResearchProjectId,
} from "../../../src/researchProject.ts";
import type {
  ProjectDocumentCommentView,
  ProjectDocumentIcon,
  ProjectDocumentPatch,
  ProjectDocumentPageWidth,
  ProjectDocumentStore,
  ProjectDocumentView,
} from "../../../src/projectDocumentStore.ts";

export interface ProjectDocumentRouteDependencies {
  store: Pick<ProjectDocumentStore,
    "ensureDocument" | "getDocument" | "updateDocument" | "listComments" | "addComment" | "resolveComment">;
  enabled: boolean;
}

const pageIcons = new Set<ProjectDocumentIcon>([
  "none", "document", "idea", "task", "schedule", "build",
]);
const pageWidths = new Set<ProjectDocumentPageWidth>(["standard", "full"]);

function asyncRoute(
  handler: (req: express.Request, res: express.Response) => Promise<void>,
): express.RequestHandler {
  return (req, res, next) => { handler(req, res).catch(next); };
}

function projectIdFromRequest(
  request: express.Request,
  response: express.Response,
): ResearchProjectId | undefined {
  const projectId = normalizeResearchProjectId(request.params.id);
  if (!projectId) response.status(400).json({ error: "invalid project id" });
  return projectId;
}

const sendDocument = (
  response: express.Response,
  document: ProjectDocumentView | undefined,
): void => {
  if (!document) {
    response.status(404).json({ error: "research project or document not found" });
    return;
  }
  response.json(document);
};

const sendComment = (
  response: express.Response,
  comment: ProjectDocumentCommentView | undefined,
): void => {
  if (!comment) {
    response.status(404).json({ error: "project document or comment not found" });
    return;
  }
  response.json(comment);
};

function documentPatch(body: unknown): ProjectDocumentPatch | undefined {
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;
  const input = body as Record<string, unknown>;
  const allowed = new Set(["title", "icon", "isFavorite", "pageWidth"]);
  if (!Object.keys(input).length || Object.keys(input).some((key) => !allowed.has(key))) {
    return undefined;
  }
  const patch: ProjectDocumentPatch = {};
  if ("title" in input) {
    if (typeof input.title !== "string") return undefined;
    const title = input.title.trim();
    if (!title || title.length > 120) return undefined;
    patch.title = title;
  }
  if ("icon" in input) {
    if (typeof input.icon !== "string" || !pageIcons.has(input.icon as ProjectDocumentIcon)) {
      return undefined;
    }
    patch.icon = input.icon as ProjectDocumentIcon;
  }
  if ("isFavorite" in input) {
    if (typeof input.isFavorite !== "boolean") return undefined;
    patch.isFavorite = input.isFavorite;
  }
  if ("pageWidth" in input) {
    if (typeof input.pageWidth !== "string"
      || !pageWidths.has(input.pageWidth as ProjectDocumentPageWidth)) {
      return undefined;
    }
    patch.pageWidth = input.pageWidth as ProjectDocumentPageWidth;
  }
  return patch;
}

function commentBody(body: unknown): string | undefined {
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;
  const value = (body as { body?: unknown }).body;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized && normalized.length <= 2000 ? normalized : undefined;
}

export function mountProjectDocumentRoutes(
  app: express.Express,
  dependencies: ProjectDocumentRouteDependencies,
): void {
  app.use("/research-projects/:id/document", (_request, response, next) => {
    if (!dependencies.enabled) response.status(404).json({ error: "Not found" });
    else next();
  });

  app.get("/research-projects/:id/document", asyncRoute(async (request, response) => {
    const projectId = projectIdFromRequest(request, response);
    if (!projectId) return;
    sendDocument(
      response,
      await dependencies.store.getDocument(response.locals.user.id, projectId),
    );
  }));

  app.post("/research-projects/:id/document", asyncRoute(async (request, response) => {
    const projectId = projectIdFromRequest(request, response);
    if (!projectId) return;
    sendDocument(
      response,
      await dependencies.store.ensureDocument(response.locals.user.id, projectId),
    );
  }));

  app.patch("/research-projects/:id/document", asyncRoute(async (request, response) => {
    const projectId = projectIdFromRequest(request, response);
    if (!projectId) return;
    const patch = documentPatch(request.body);
    if (!patch) {
      response.status(400).json({ error: "invalid project document update" });
      return;
    }
    sendDocument(
      response,
      await dependencies.store.updateDocument(response.locals.user.id, projectId, patch),
    );
  }));

  app.get("/research-projects/:id/document/comments", asyncRoute(async (request, response) => {
    const projectId = projectIdFromRequest(request, response);
    if (!projectId) return;
    const comments = await dependencies.store.listComments(response.locals.user.id, projectId);
    if (!comments) {
      response.status(404).json({ error: "research project or document not found" });
      return;
    }
    response.json(comments);
  }));

  app.post("/research-projects/:id/document/comments", asyncRoute(async (request, response) => {
    const projectId = projectIdFromRequest(request, response);
    if (!projectId) return;
    const body = commentBody(request.body);
    if (!body) {
      response.status(400).json({ error: "comment body is required" });
      return;
    }
    const comment = await dependencies.store.addComment(response.locals.user.id, projectId, body);
    if (!comment) {
      response.status(404).json({ error: "research project or document not found" });
      return;
    }
    response.status(201).json(comment);
  }));

  app.patch("/research-projects/:id/document/comments/:commentId", asyncRoute(async (request, response) => {
    const projectId = projectIdFromRequest(request, response);
    if (!projectId) return;
    const commentId = Number(request.params.commentId);
    const resolved = (request.body as { resolved?: unknown } | undefined)?.resolved;
    if (!Number.isSafeInteger(commentId) || commentId < 1 || typeof resolved !== "boolean") {
      response.status(400).json({ error: "invalid comment update" });
      return;
    }
    sendComment(
      response,
      await dependencies.store.resolveComment(
        response.locals.user.id,
        projectId,
        commentId,
        resolved,
      ),
    );
  }));
}
