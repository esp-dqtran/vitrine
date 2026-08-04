import express from "express";

import {
  normalizeResearchProjectId,
  type ResearchProjectId,
} from "../../../src/researchProject.ts";
import type {
  ProjectDocumentCommentView,
  ProjectDocumentCommentInput,
  ProjectDocumentIcon,
  ProjectDocumentPatch,
  ProjectDocumentPageWidth,
  ProjectDocumentStore,
  ProjectDocumentView,
} from "../../../src/projectDocumentStore.ts";

export interface ProjectDocumentRouteDependencies {
  store: Pick<ProjectDocumentStore,
    "ensureDocument" | "getDocument" | "updateDocument" | "listComments" | "addComment" | "resolveComment">
    & Partial<Pick<ProjectDocumentStore,
      "listDocuments" | "createDocument" | "getDocumentById" | "updateDocumentById"
      | "listCommentsById" | "addCommentById" | "resolveCommentById" | "deleteCommentById">>;
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

function commentInput(body: unknown): ProjectDocumentCommentInput | undefined {
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;
  const value = body as Record<string, unknown>;
  const allowed = new Set(["body", "blockId", "quote", "parentCommentId"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) return undefined;
  const normalizedBody = commentBody(value);
  if (!normalizedBody) return undefined;
  const input: ProjectDocumentCommentInput = { body: normalizedBody };
  if ("blockId" in value) {
    if (typeof value.blockId !== "string") return undefined;
    const blockId = value.blockId.trim();
    if (!blockId || blockId.length > 200) return undefined;
    input.blockId = blockId;
  }
  if ("quote" in value) {
    if (typeof value.quote !== "string" || !input.blockId) return undefined;
    const quote = value.quote.trim();
    if (!quote || quote.length > 500) return undefined;
    input.quote = quote;
  }
  if ("parentCommentId" in value) {
    if (!Number.isSafeInteger(value.parentCommentId) || Number(value.parentCommentId) < 1) {
      return undefined;
    }
    input.parentCommentId = Number(value.parentCommentId);
  }
  return input;
}

function documentIdFromRequest(
  request: express.Request,
  response: express.Response,
): number | undefined {
  const documentId = Number(request.params.documentId);
  if (!Number.isSafeInteger(documentId) || documentId < 1) {
    response.status(400).json({ error: "invalid document id" });
    return undefined;
  }
  return documentId;
}

export function mountProjectDocumentRoutes(
  app: express.Express,
  dependencies: ProjectDocumentRouteDependencies,
): void {
  app.use("/research-projects/:id/documents", (_request, response, next) => {
    if (!dependencies.enabled) response.status(404).json({ error: "Not found" });
    else next();
  });

  app.get("/research-projects/:id/documents", asyncRoute(async (request, response) => {
    const projectId = projectIdFromRequest(request, response);
    if (!projectId) return;
    if (!dependencies.store.listDocuments) {
      response.status(404).json({ error: "Not found" });
      return;
    }
    const documents = await dependencies.store.listDocuments(response.locals.user.id, projectId);
    if (!documents) {
      response.status(404).json({ error: "research project not found" });
      return;
    }
    response.json(documents);
  }));

  app.post("/research-projects/:id/documents", asyncRoute(async (request, response) => {
    const projectId = projectIdFromRequest(request, response);
    const title = (request.body as { title?: unknown } | undefined)?.title;
    if (!projectId) return;
    if (typeof title !== "string" || !title.trim() || title.trim().length > 120) {
      response.status(400).json({ error: "document title is required" });
      return;
    }
    if (!dependencies.store.createDocument) {
      response.status(404).json({ error: "Not found" });
      return;
    }
    const document = await dependencies.store.createDocument(
      response.locals.user.id, projectId, title.trim(),
    );
    if (!document) {
      response.status(404).json({ error: "research project not found" });
      return;
    }
    response.status(201).json(document);
  }));

  app.get("/research-projects/:id/documents/:documentId", asyncRoute(async (request, response) => {
    const projectId = projectIdFromRequest(request, response);
    const documentId = documentIdFromRequest(request, response);
    if (!projectId || !documentId) return;
    if (!dependencies.store.getDocumentById) {
      response.status(404).json({ error: "Not found" });
      return;
    }
    sendDocument(response, await dependencies.store.getDocumentById(
      response.locals.user.id, projectId, documentId,
    ));
  }));

  app.patch("/research-projects/:id/documents/:documentId", asyncRoute(async (request, response) => {
    const projectId = projectIdFromRequest(request, response);
    const documentId = documentIdFromRequest(request, response);
    const patch = documentPatch(request.body);
    if (!projectId || !documentId) return;
    if (!patch) {
      response.status(400).json({ error: "invalid project document update" });
      return;
    }
    if (!dependencies.store.updateDocumentById) {
      response.status(404).json({ error: "Not found" });
      return;
    }
    sendDocument(response, await dependencies.store.updateDocumentById(
      response.locals.user.id, projectId, documentId, patch,
    ));
  }));

  app.get("/research-projects/:id/documents/:documentId/comments", asyncRoute(async (request, response) => {
    const projectId = projectIdFromRequest(request, response);
    const documentId = documentIdFromRequest(request, response);
    if (!projectId || !documentId) return;
    if (!dependencies.store.listCommentsById) {
      response.status(404).json({ error: "Not found" });
      return;
    }
    const comments = await dependencies.store.listCommentsById(
      response.locals.user.id, projectId, documentId,
    );
    if (!comments) {
      response.status(404).json({ error: "project document not found" });
      return;
    }
    response.json(comments);
  }));

  app.post("/research-projects/:id/documents/:documentId/comments", asyncRoute(async (request, response) => {
    const projectId = projectIdFromRequest(request, response);
    const documentId = documentIdFromRequest(request, response);
    const input = commentInput(request.body);
    if (!projectId || !documentId) return;
    if (!input) {
      response.status(400).json({ error: "invalid comment" });
      return;
    }
    if (!dependencies.store.addCommentById) {
      response.status(404).json({ error: "Not found" });
      return;
    }
    const comment = await dependencies.store.addCommentById(
      response.locals.user.id, projectId, documentId, input,
    );
    if (comment) response.status(201);
    sendComment(response, comment);
  }));

  app.patch("/research-projects/:id/documents/:documentId/comments/:commentId", asyncRoute(async (request, response) => {
    const projectId = projectIdFromRequest(request, response);
    const documentId = documentIdFromRequest(request, response);
    const commentId = Number(request.params.commentId);
    const resolved = (request.body as { resolved?: unknown } | undefined)?.resolved;
    if (!projectId || !documentId) return;
    if (!Number.isSafeInteger(commentId) || commentId < 1 || typeof resolved !== "boolean") {
      response.status(400).json({ error: "invalid comment update" });
      return;
    }
    if (!dependencies.store.resolveCommentById) {
      response.status(404).json({ error: "Not found" });
      return;
    }
    sendComment(response, await dependencies.store.resolveCommentById(
      response.locals.user.id, projectId, documentId, commentId, resolved,
    ));
  }));

  app.delete("/research-projects/:id/documents/:documentId/comments/:commentId", asyncRoute(async (request, response) => {
    const projectId = projectIdFromRequest(request, response);
    const documentId = documentIdFromRequest(request, response);
    const commentId = Number(request.params.commentId);
    if (!projectId || !documentId) return;
    if (!Number.isSafeInteger(commentId) || commentId < 1) {
      response.status(400).json({ error: "invalid comment id" });
      return;
    }
    if (!dependencies.store.deleteCommentById) {
      response.status(404).json({ error: "Not found" });
      return;
    }
    const deleted = await dependencies.store.deleteCommentById(
      response.locals.user.id, projectId, documentId, commentId,
    );
    if (!deleted) {
      response.status(404).json({ error: "project document or comment not found" });
      return;
    }
    response.status(204).end();
  }));

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
