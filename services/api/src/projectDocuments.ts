import express from "express";
import { createHash, randomUUID } from "node:crypto";

import {
  INTEGRATION_VERSION,
  PROJECT_DOCUMENT_KEY,
} from "../../../src/projectDocumentCompatibility.ts";
import {
  normalizeProjectDocumentProperties,
  type ProjectDocument,
  type ProjectDocumentAccess,
  type ProjectDocumentCollaboratorRole,
  type ProjectDocumentBootstrap,
  type ProjectDocumentCollection,
  type ProjectDocumentCollectionMode,
  type ProjectDocumentCollectionRule,
  type ProjectDocumentFolder,
  type ProjectDocumentIcon,
  type ProjectDocumentLink,
  type ProjectDocumentMode,
  type ProjectDocumentPageWidth,
  type ProjectDocumentPublic,
  type ProjectDocumentSearchResult,
  type PublicProjectDocumentShare,
  type ProjectDocumentSmartCollection,
  type ProjectDocumentTag,
  type ProjectDocumentTagColor,
} from "../../../src/projectDocument.ts";
import type { ProjectDocumentStore } from "../../../src/projectDocumentStore.ts";
import type {
  ObjectMetadata,
  ObjectStore,
  StoredContentType,
} from "../../../src/objectStore.ts";
import type { OctoBaseClient } from "./octobaseClient.ts";
import {
  createProjectDocumentShareToken,
  projectDocumentShareHash,
  validProjectDocumentShareToken,
} from "./projectDocumentShares.ts";

export interface ProjectDocumentRouteDependencies {
  enabled: boolean;
  testProjectId?: number;
  store: ProjectDocumentStore;
  octobaseClient: OctoBaseClient;
  objectStore?: ObjectStore;
  appUrl: string;
  logOrphan?(workspaceId: string): void;
}

export interface PublicProjectDocumentRouteDependencies {
  enabled: boolean;
  store: Pick<ProjectDocumentStore, "publicShare">;
  objectStore?: ObjectStore;
}

const PROJECT_DOCUMENT_BLOB_MAX_BYTES = 25 * 1024 * 1024;
const PROJECT_DOCUMENT_VERSION_MAX_BYTES = 8 * 1024 * 1024;
const PROJECT_DOCUMENT_SEARCH_MAX_CHARACTERS = 200_000;
const projectDocumentBlobContentTypes = new Set<StoredContentType>([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/mpeg",
  "audio/mp4",
  "application/pdf",
  "application/zip",
  "application/json",
  "text/plain",
  "text/markdown",
  "application/octet-stream",
]);

const projectDocumentBlobId = (value: unknown): string | undefined => {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 256 ||
    !/^[A-Za-z0-9_-]+={0,2}$/.test(value)
  ) {
    return undefined;
  }
  return value;
};

const projectDocumentBlobPrefix = (
  projectId: number,
  documentId: number,
): string => `project-documents/${projectId}/${documentId}/blobs/`;

const projectDocumentBlobKey = (
  projectId: number,
  documentId: number,
  blobId: string,
): string =>
  `${projectDocumentBlobPrefix(projectId, documentId)}` +
  Buffer.from(blobId, "utf8").toString("hex");

const blobIdFromObjectKey = (
  prefix: string,
  key: string,
): string | undefined => {
  if (!key.startsWith(prefix)) return undefined;
  const encoded = key.slice(prefix.length);
  if (!encoded || encoded.length % 2 !== 0 || !/^[0-9a-f]+$/.test(encoded)) {
    return undefined;
  }
  return projectDocumentBlobId(Buffer.from(encoded, "hex").toString("utf8"));
};

const projectDocumentBlobType = (
  value: string | undefined,
): StoredContentType => {
  const normalized = value?.split(";", 1)[0]?.trim().toLowerCase();
  return projectDocumentBlobContentTypes.has(normalized as StoredContentType)
    ? (normalized as StoredContentType)
    : "application/octet-stream";
};

async function sendProjectDocumentBlob(
  store: ObjectStore,
  key: string,
  res: express.Response,
): Promise<void> {
  try {
    const stored = await store.get(key);
    res.setHeader("content-type", stored.metadata.contentType);
    res.setHeader("content-length", stored.body.byteLength);
    res.setHeader("cache-control", "private, max-age=2592000, immutable");
    res.send(stored.body);
  } catch {
    res.status(404).json({ error: "Project document blob not found" });
  }
}

async function listProjectDocumentBlobs(
  store: ObjectStore,
  projectId: number,
  documentId: number,
): Promise<string[]> {
  const prefix = projectDocumentBlobPrefix(projectId, documentId);
  const ids: string[] = [];
  for await (const metadata of store.list(prefix)) {
    const id = blobIdFromObjectKey(prefix, metadata.key);
    if (id) ids.push(id);
  }
  return ids;
}

async function deleteProjectDocumentBlobs(
  store: ObjectStore,
  projectId: number,
  documentId: number,
): Promise<void> {
  const prefix = projectDocumentBlobPrefix(projectId, documentId);
  const keys: string[] = [];
  for await (const metadata of store.list(prefix)) keys.push(metadata.key);
  await Promise.all(keys.map((key) => store.delete(key)));
}

async function copyProjectDocumentBlobs(
  store: ObjectStore,
  projectId: number,
  sourceDocumentId: number,
  targetDocumentId: number,
): Promise<void> {
  const sourcePrefix = projectDocumentBlobPrefix(projectId, sourceDocumentId);
  for await (const metadata of store.list(sourcePrefix)) {
    const blobId = blobIdFromObjectKey(sourcePrefix, metadata.key);
    if (!blobId) continue;
    const stored = await store.get(metadata.key);
    await store.put({
      ...stored.metadata,
      key: projectDocumentBlobKey(projectId, targetDocumentId, blobId),
      body: stored.body,
    });
  }
}

const positiveId = (value: unknown): number | undefined => {
  if (typeof value !== "string") return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const positiveBodyId = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const positiveIdArray = (value: unknown): number[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const ids = value.map(positiveBodyId);
  if (ids.some((id) => id === undefined)) return undefined;
  return [...new Set(ids as number[])];
};

const projectDocumentIcons = new Set<ProjectDocumentIcon>([
  "none",
  "document",
  "idea",
  "task",
  "schedule",
  "build",
]);

const projectDocumentPageWidths = new Set<ProjectDocumentPageWidth>([
  "standard",
  "full",
]);

const projectDocumentTagColors = new Set<ProjectDocumentTagColor>([
  "blue",
  "purple",
  "green",
  "amber",
  "rose",
  "slate",
]);

const projectDocumentCollectionModes = new Set<ProjectDocumentCollectionMode>([
  "manual",
  "rules",
]);

const isoDate = (value: unknown): string | undefined => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
    ? undefined
    : value;
};

function collectionRules(
  value: unknown,
): ProjectDocumentCollectionRule[] | undefined {
  if (!Array.isArray(value) || value.length > 20) return undefined;
  const rules: ProjectDocumentCollectionRule[] = [];
  for (const rule of value) {
    if (!rule || typeof rule !== "object") return undefined;
    const candidate = rule as Record<string, unknown>;
    if (
      (candidate.field === "favorite" || candidate.field === "journal") &&
      typeof candidate.value === "boolean"
    ) {
      rules.push({
        field: candidate.field,
        value: candidate.value,
      } as ProjectDocumentCollectionRule);
      continue;
    }
    if (candidate.field === "tag") {
      const tagId = positiveBodyId(candidate.value);
      if (!tagId) return undefined;
      rules.push({ field: "tag", value: tagId });
      continue;
    }
    if (
      candidate.field === "createdAfter" ||
      candidate.field === "updatedAfter"
    ) {
      const date = isoDate(candidate.value);
      if (!date) return undefined;
      rules.push({ field: candidate.field, value: date });
      continue;
    }
    if (
      candidate.field === "mode" &&
      (candidate.value === "page" || candidate.value === "edgeless")
    ) {
      rules.push({ field: "mode", value: candidate.value });
      continue;
    }
    if (
      candidate.field === "pageWidth" &&
      (candidate.value === "standard" || candidate.value === "full")
    ) {
      rules.push({ field: "pageWidth", value: candidate.value });
      continue;
    }
    return undefined;
  }
  return rules;
}

function publicDocument(document: ProjectDocument): ProjectDocumentPublic {
  const { octobaseDocumentId: _privateWorkspaceId, ...safe } = document;
  return safe;
}

function syncInstanceId(document: ProjectDocument): string {
  return createHash("sha256")
    .update(document.octobaseDocumentId)
    .digest("hex")
    .slice(0, 24);
}

function bootstrap(
  document: ProjectDocument,
  created: boolean,
): ProjectDocumentBootstrap {
  return {
    document: publicDocument(document),
    created,
    syncBaseUrl: `/api/project-document-sync/${document.projectId}`,
    blobBaseUrl:
      `/api/research-projects/${document.projectId}` +
      `/document/${document.id}/blobs`,
    syncInstanceId: syncInstanceId(document),
  };
}

async function projectDocumentCollection(
  deps: ProjectDocumentRouteDependencies,
  userId: number,
  projectId: number,
): Promise<ProjectDocumentCollection> {
  const [documents, trash, folders, tags, collections, links] =
    await Promise.all([
      deps.store.listOwned(userId, projectId),
      deps.store.listTrashed(userId, projectId),
      deps.store.listFolders?.(userId, projectId) ??
        Promise.resolve([] as ProjectDocumentFolder[]),
      deps.store.listTags?.(userId, projectId) ??
        Promise.resolve([] as ProjectDocumentTag[]),
      deps.store.listCollections?.(userId, projectId) ??
        Promise.resolve([] as ProjectDocumentSmartCollection[]),
      deps.store.listLinks?.(userId, projectId) ??
        Promise.resolve([] as ProjectDocumentLink[]),
    ]);
  return {
    documents: documents.map(publicDocument),
    trash: trash.map(publicDocument),
    folders,
    tags,
    collections,
    links,
  };
}

function asyncRoute(
  handler: (req: express.Request, res: express.Response) => Promise<void>,
): express.RequestHandler {
  return (req, res, next) => {
    handler(req, res).catch(next);
  };
}

export function mountPublicProjectDocumentRoutes(
  app: express.Express,
  deps: PublicProjectDocumentRouteDependencies,
): void {
  app.get(
    "/project-document-shares/:token",
    asyncRoute(async (req, res) => {
      const token = validProjectDocumentShareToken(req.params.token);
      if (!deps.enabled || !token || !deps.store.publicShare) {
        res.status(404).json({
          error: "Project document share unavailable",
        });
        return;
      }
      const shared = await deps.store.publicShare(
        projectDocumentShareHash(token),
      );
      if (!shared) {
        res.status(404).json({
          error: "Project document share unavailable",
        });
        return;
      }
      const body: PublicProjectDocumentShare = {
        document: publicDocument(shared.document),
        syncBaseUrl: `/api/project-document-share-sync/${encodeURIComponent(token)}`,
        blobBaseUrl: `/api/project-document-shares/${encodeURIComponent(token)}/blobs`,
        syncInstanceId: syncInstanceId(shared.document),
        sharedAt: shared.sharedAt,
      };
      res.json(body);
    }),
  );

  app.get(
    "/project-document-shares/:token/blobs",
    asyncRoute(async (req, res) => {
      const token = validProjectDocumentShareToken(req.params.token);
      if (!deps.enabled || !token || !deps.store.publicShare) {
        res.status(404).json({ error: "Project document share unavailable" });
        return;
      }
      if (!deps.objectStore) {
        res
          .status(503)
          .json({ error: "Project document blob storage unavailable" });
        return;
      }
      const shared = await deps.store.publicShare(
        projectDocumentShareHash(token),
      );
      if (!shared) {
        res.status(404).json({ error: "Project document share unavailable" });
        return;
      }
      res.json({
        ids: await listProjectDocumentBlobs(
          deps.objectStore,
          shared.document.projectId,
          shared.document.id,
        ),
      });
    }),
  );

  app.get(
    "/project-document-shares/:token/blobs/:blobId",
    asyncRoute(async (req, res) => {
      const token = validProjectDocumentShareToken(req.params.token);
      const blobId = projectDocumentBlobId(req.params.blobId);
      if (!deps.enabled || !token || !blobId || !deps.store.publicShare) {
        res.status(404).json({ error: "Project document share unavailable" });
        return;
      }
      if (!deps.objectStore) {
        res
          .status(503)
          .json({ error: "Project document blob storage unavailable" });
        return;
      }
      const shared = await deps.store.publicShare(
        projectDocumentShareHash(token),
      );
      if (!shared) {
        res.status(404).json({ error: "Project document share unavailable" });
        return;
      }
      await sendProjectDocumentBlob(
        deps.objectStore,
        projectDocumentBlobKey(
          shared.document.projectId,
          shared.document.id,
          blobId,
        ),
        res,
      );
    }),
  );
}

export function mountProjectDocumentRoutes(
  app: express.Express,
  deps: ProjectDocumentRouteDependencies,
): void {
  const allowedProject = (
    req: express.Request,
    res: express.Response,
  ): number | undefined => {
    const projectId = positiveId(req.params.projectId);
    if (
      !deps.enabled ||
      !projectId ||
      !deps.testProjectId ||
      projectId !== deps.testProjectId
    ) {
      res.status(404).json({ error: "Not found" });
      return undefined;
    }
    return projectId;
  };

  app.use(
    "/research-projects/:projectId",
    (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      if (
        !/^(?:\/api)?\/research-projects\/\d+\/(?:documents?(?:\/|$)|document-|journals(?:\/|$))/.test(
          req.originalUrl,
        )
      ) {
        next();
        return;
      }
      const projectId = allowedProject(req, res);
      if (!projectId) return;
      const actualUserId = Number(res.locals.user.id);
      const accessPromise = deps.store.accessForUser
        ? deps.store.accessForUser(actualUserId, projectId)
        : Promise.resolve<ProjectDocumentAccess>({
            ownerUserId: actualUserId,
            role: "owner",
          });
      accessPromise
        .then((access) => {
          if (!access) {
            res.status(404).json({ error: "Project unavailable" });
            return;
          }
          if (access.role === "viewer" && req.method !== "GET") {
            res.status(403).json({ error: "View-only project access" });
            return;
          }
          res.locals.projectDocumentActualUserId = actualUserId;
          res.locals.projectDocumentAccess = access;
          res.locals.user = {
            ...res.locals.user,
            id: access.ownerUserId,
          };
          next();
        })
        .catch(next);
    },
  );

  const requestAccess = (res: express.Response): ProjectDocumentAccess =>
    res.locals.projectDocumentAccess as ProjectDocumentAccess;
  const actualUserId = (res: express.Response): number =>
    Number(res.locals.projectDocumentActualUserId ?? res.locals.user.id);
  const requireOwner = (res: express.Response): boolean => {
    if (requestAccess(res).role === "owner") return true;
    res.status(403).json({ error: "Only the Project owner can manage access" });
    return false;
  };
  const findActiveDocument = async (
    res: express.Response,
    projectId: number,
    documentId: number,
  ): Promise<ProjectDocument | undefined> =>
    deps.store.findOwned(Number(res.locals.user.id), projectId, documentId);

  app.get(
    "/research-projects/:projectId/document/:documentId/blobs",
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      const documentId = positiveId(req.params.documentId);
      if (!projectId || !documentId) return;
      if (!deps.objectStore) {
        res
          .status(503)
          .json({ error: "Project document blob storage unavailable" });
        return;
      }
      if (!(await findActiveDocument(res, projectId, documentId))) {
        res.status(404).json({ error: "Project document not found" });
        return;
      }
      res.json({
        ids: await listProjectDocumentBlobs(
          deps.objectStore,
          projectId,
          documentId,
        ),
      });
    }),
  );

  app.get(
    "/research-projects/:projectId/document/:documentId/blobs/:blobId",
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      const documentId = positiveId(req.params.documentId);
      const blobId = projectDocumentBlobId(req.params.blobId);
      if (!projectId || !documentId || !blobId) {
        res.status(400).json({ error: "Invalid project document blob" });
        return;
      }
      if (!deps.objectStore) {
        res
          .status(503)
          .json({ error: "Project document blob storage unavailable" });
        return;
      }
      if (!(await findActiveDocument(res, projectId, documentId))) {
        res.status(404).json({ error: "Project document not found" });
        return;
      }
      await sendProjectDocumentBlob(
        deps.objectStore,
        projectDocumentBlobKey(projectId, documentId, blobId),
        res,
      );
    }),
  );

  app.put(
    "/research-projects/:projectId/document/:documentId/blobs/:blobId",
    express.raw({
      type: () => true,
      limit: PROJECT_DOCUMENT_BLOB_MAX_BYTES,
    }),
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      const documentId = positiveId(req.params.documentId);
      const blobId = projectDocumentBlobId(req.params.blobId);
      if (!projectId || !documentId || !blobId) {
        res.status(400).json({ error: "Invalid project document blob" });
        return;
      }
      if (!deps.objectStore) {
        res
          .status(503)
          .json({ error: "Project document blob storage unavailable" });
        return;
      }
      if (!(await findActiveDocument(res, projectId, documentId))) {
        res.status(404).json({ error: "Project document not found" });
        return;
      }
      if (!Buffer.isBuffer(req.body) || req.body.byteLength < 1) {
        res.status(400).json({ error: "Project document blob is empty" });
        return;
      }
      const sha256 = createHash("sha256").update(req.body).digest("hex");
      const metadata: ObjectMetadata = {
        key: projectDocumentBlobKey(projectId, documentId, blobId),
        sha256,
        byteSize: req.body.byteLength,
        contentType: projectDocumentBlobType(
          req.header("x-astryx-blob-content-type") ??
            req.header("content-type"),
        ),
        accessClass: "protected",
      };
      await deps.objectStore.put({ ...metadata, body: req.body });
      res.status(201).json({ id: blobId });
    }),
  );

  app.delete(
    "/research-projects/:projectId/document/:documentId/blobs/:blobId",
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      const documentId = positiveId(req.params.documentId);
      const blobId = projectDocumentBlobId(req.params.blobId);
      if (!projectId || !documentId || !blobId) {
        res.status(400).json({ error: "Invalid project document blob" });
        return;
      }
      if (!deps.objectStore) {
        res
          .status(503)
          .json({ error: "Project document blob storage unavailable" });
        return;
      }
      if (!(await findActiveDocument(res, projectId, documentId))) {
        res.status(404).json({ error: "Project document not found" });
        return;
      }
      const deleted = await deps.objectStore.delete(
        projectDocumentBlobKey(projectId, documentId, blobId),
      );
      res.status(deleted ? 204 : 404).end();
    }),
  );

  app.get(
    "/research-projects/:projectId/documents/search",
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      if (!projectId) return;
      const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
      if (!query || query.length > 200 || !deps.store.searchOwned) {
        res.status(400).json({ error: "Invalid document search" });
        return;
      }
      const results: ProjectDocumentSearchResult[] =
        await deps.store.searchOwned(
          Number(res.locals.user.id),
          projectId,
          query,
        );
      res.json(results);
    }),
  );

  app.patch(
    "/research-projects/:projectId/document/:documentId/search-index",
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      const documentId = positiveId(req.params.documentId);
      const text = typeof req.body?.text === "string" ? req.body.text : "";
      if (
        !projectId ||
        !documentId ||
        text.length > PROJECT_DOCUMENT_SEARCH_MAX_CHARACTERS ||
        !deps.store.updateSearchText
      ) {
        res.status(400).json({ error: "Invalid document search index" });
        return;
      }
      const updated = await deps.store.updateSearchText(
        Number(res.locals.user.id),
        projectId,
        documentId,
        text,
      );
      if (!updated) {
        res.status(404).json({ error: "Project document not found" });
        return;
      }
      res.status(204).end();
    }),
  );

  app.get(
    "/research-projects/:projectId/documents",
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      if (!projectId) return;
      const collection = await projectDocumentCollection(
        deps,
        Number(res.locals.user.id),
        projectId,
      );
      const access = requestAccess(res);
      res.json({
        ...collection,
        access,
        collaborators:
          access.role === "owner"
            ? ((await deps.store.listCollaborators?.(
                access.ownerUserId,
                projectId,
              )) ?? [])
            : [],
      });
    }),
  );

  app.get(
    "/research-projects/:projectId/document-collaborators",
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      if (!projectId || !requireOwner(res)) return;
      res.json(
        (await deps.store.listCollaborators?.(
          requestAccess(res).ownerUserId,
          projectId,
        )) ?? [],
      );
    }),
  );

  app.post(
    "/research-projects/:projectId/document-collaborators",
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      if (!projectId || !requireOwner(res)) return;
      const email =
        typeof req.body?.email === "string"
          ? req.body.email.trim().toLowerCase()
          : "";
      const role = req.body?.role as ProjectDocumentCollaboratorRole;
      if (
        !email ||
        email.length > 320 ||
        (role !== "editor" && role !== "viewer") ||
        !deps.store.addCollaboratorByEmail
      ) {
        res.status(400).json({ error: "Invalid collaborator" });
        return;
      }
      const collaborator = await deps.store.addCollaboratorByEmail(
        requestAccess(res).ownerUserId,
        projectId,
        actualUserId(res),
        email,
        role,
      );
      if (!collaborator) {
        res.status(404).json({
          error: "No registered Astryx user found for that email",
        });
        return;
      }
      res.status(201).json(collaborator);
    }),
  );

  app.delete(
    "/research-projects/:projectId/document-collaborators/:userId",
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      const userId = positiveId(req.params.userId);
      if (!projectId || !userId || !requireOwner(res)) return;
      const removed = await deps.store.removeCollaborator?.(
        requestAccess(res).ownerUserId,
        projectId,
        userId,
      );
      if (!removed) {
        res.status(404).json({ error: "Collaborator not found" });
        return;
      }
      res.status(204).end();
    }),
  );

  app.get(
    "/research-projects/:projectId/document/:documentId/shares",
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      if (!projectId) return;
      const documentId = positiveId(req.params.documentId);
      if (!documentId || !deps.store.listShares) {
        res.status(400).json({ error: "Invalid document shares" });
        return;
      }
      res.json(
        await deps.store.listShares(
          Number(res.locals.user.id),
          projectId,
          documentId,
        ),
      );
    }),
  );

  app.post(
    "/research-projects/:projectId/document/:documentId/shares",
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      if (!projectId) return;
      if (!requireOwner(res)) return;
      const documentId = positiveId(req.params.documentId);
      if (!documentId || !deps.store.createShare) {
        res.status(400).json({ error: "Invalid document share" });
        return;
      }
      const token = createProjectDocumentShareToken();
      const share = await deps.store.createShare(
        Number(res.locals.user.id),
        projectId,
        documentId,
        projectDocumentShareHash(token),
      );
      if (!share) {
        res.status(404).json({ error: "Project document not found" });
        return;
      }
      res.status(201).json({
        ...share,
        url:
          `${deps.appUrl.replace(/\/+$/, "")}` +
          `/project-document-shares/${token}`,
      });
    }),
  );

  app.delete(
    "/research-projects/:projectId/document/:documentId/shares/:shareId",
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      if (!projectId) return;
      if (!requireOwner(res)) return;
      const documentId = positiveId(req.params.documentId);
      const shareId = positiveId(req.params.shareId);
      if (!documentId || !shareId || !deps.store.revokeShare) {
        res.status(400).json({ error: "Invalid document share" });
        return;
      }
      const revoked = await deps.store.revokeShare(
        Number(res.locals.user.id),
        projectId,
        documentId,
        shareId,
      );
      if (!revoked) {
        res.status(404).json({
          error: "Project document share not found",
        });
        return;
      }
      res.status(204).end();
    }),
  );

  app.post(
    "/research-projects/:projectId/document-folders",
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      if (!projectId) return;
      const name =
        typeof req.body?.name === "string" ? req.body.name.trim() : "";
      const parentFolderId =
        req.body?.parentFolderId === null ||
        req.body?.parentFolderId === undefined
          ? null
          : positiveBodyId(req.body.parentFolderId);
      if (
        !name ||
        name.length > 80 ||
        parentFolderId === undefined ||
        !deps.store.createFolder
      ) {
        res.status(400).json({ error: "Invalid document folder" });
        return;
      }
      const created = await deps.store.createFolder(
        Number(res.locals.user.id),
        projectId,
        { name, parentFolderId },
      );
      if (!created) {
        res.status(404).json({ error: "Project or parent folder not found" });
        return;
      }
      res
        .status(201)
        .json(
          await projectDocumentCollection(
            deps,
            Number(res.locals.user.id),
            projectId,
          ),
        );
    }),
  );

  app.patch(
    "/research-projects/:projectId/document-folders/:folderId",
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      if (!projectId) return;
      const folderId = positiveId(req.params.folderId);
      const name =
        typeof req.body?.name === "string" ? req.body.name.trim() : "";
      const isFavorite = req.body?.isFavorite;
      if (
        !folderId ||
        !name ||
        name.length > 80 ||
        typeof isFavorite !== "boolean" ||
        !deps.store.updateFolder
      ) {
        res.status(400).json({ error: "Invalid document folder" });
        return;
      }
      const updated = await deps.store.updateFolder(
        Number(res.locals.user.id),
        projectId,
        folderId,
        { name, isFavorite },
      );
      if (!updated) {
        res.status(404).json({ error: "Document folder not found" });
        return;
      }
      res.json(
        await projectDocumentCollection(
          deps,
          Number(res.locals.user.id),
          projectId,
        ),
      );
    }),
  );

  app.delete(
    "/research-projects/:projectId/document-folders/:folderId",
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      if (!projectId) return;
      const folderId = positiveId(req.params.folderId);
      if (!folderId || !deps.store.deleteFolder) {
        res.status(400).json({ error: "Invalid document folder" });
        return;
      }
      const deleted = await deps.store.deleteFolder(
        Number(res.locals.user.id),
        projectId,
        folderId,
      );
      if (!deleted) {
        res.status(404).json({ error: "Document folder not found" });
        return;
      }
      res.status(204).end();
    }),
  );

  app.put(
    "/research-projects/:projectId/document-folders/:folderId/documents",
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      if (!projectId) return;
      const folderId = positiveId(req.params.folderId);
      const documentIds = positiveIdArray(req.body?.documentIds);
      if (!folderId || !documentIds || !deps.store.setFolderDocuments) {
        res.status(400).json({ error: "Invalid folder documents" });
        return;
      }
      const updated = await deps.store.setFolderDocuments(
        Number(res.locals.user.id),
        projectId,
        folderId,
        documentIds,
      );
      if (!updated) {
        res.status(404).json({ error: "Folder or document not found" });
        return;
      }
      res.json(
        await projectDocumentCollection(
          deps,
          Number(res.locals.user.id),
          projectId,
        ),
      );
    }),
  );

  app.post(
    "/research-projects/:projectId/document-tags",
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      if (!projectId) return;
      const name =
        typeof req.body?.name === "string" ? req.body.name.trim() : "";
      const color = (req.body?.color ?? "blue") as ProjectDocumentTagColor;
      if (
        !name ||
        name.length > 80 ||
        !projectDocumentTagColors.has(color) ||
        !deps.store.createTag
      ) {
        res.status(400).json({ error: "Invalid document tag" });
        return;
      }
      const created = await deps.store.createTag(
        Number(res.locals.user.id),
        projectId,
        { name, color },
      );
      if (!created) {
        res.status(409).json({ error: "Tag already exists" });
        return;
      }
      res
        .status(201)
        .json(
          await projectDocumentCollection(
            deps,
            Number(res.locals.user.id),
            projectId,
          ),
        );
    }),
  );

  app.patch(
    "/research-projects/:projectId/document-tags/:tagId",
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      if (!projectId) return;
      const tagId = positiveId(req.params.tagId);
      const name =
        typeof req.body?.name === "string" ? req.body.name.trim() : "";
      const color = req.body?.color as ProjectDocumentTagColor | undefined;
      if (
        !tagId ||
        !name ||
        name.length > 80 ||
        !color ||
        !projectDocumentTagColors.has(color) ||
        !deps.store.updateTag
      ) {
        res.status(400).json({ error: "Invalid document tag" });
        return;
      }
      const updated = await deps.store.updateTag(
        Number(res.locals.user.id),
        projectId,
        tagId,
        { name, color },
      );
      if (!updated) {
        res.status(404).json({ error: "Document tag not found" });
        return;
      }
      res.json(
        await projectDocumentCollection(
          deps,
          Number(res.locals.user.id),
          projectId,
        ),
      );
    }),
  );

  app.delete(
    "/research-projects/:projectId/document-tags/:tagId",
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      if (!projectId) return;
      const tagId = positiveId(req.params.tagId);
      if (!tagId || !deps.store.deleteTag) {
        res.status(400).json({ error: "Invalid document tag" });
        return;
      }
      const deleted = await deps.store.deleteTag(
        Number(res.locals.user.id),
        projectId,
        tagId,
      );
      if (!deleted) {
        res.status(404).json({ error: "Document tag not found" });
        return;
      }
      res.status(204).end();
    }),
  );

  app.put(
    "/research-projects/:projectId/document/:documentId/tags",
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      if (!projectId) return;
      const documentId = positiveId(req.params.documentId);
      const tagIds = positiveIdArray(req.body?.tagIds);
      if (!documentId || !tagIds || !deps.store.setDocumentTags) {
        res.status(400).json({ error: "Invalid document tags" });
        return;
      }
      const updated = await deps.store.setDocumentTags(
        Number(res.locals.user.id),
        projectId,
        documentId,
        tagIds,
      );
      if (!updated) {
        res.status(404).json({ error: "Document or tag not found" });
        return;
      }
      res.json(
        await projectDocumentCollection(
          deps,
          Number(res.locals.user.id),
          projectId,
        ),
      );
    }),
  );

  app.put(
    "/research-projects/:projectId/document/:documentId/links",
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      if (!projectId) return;
      const documentId = positiveId(req.params.documentId);
      const documentIds = positiveIdArray(req.body?.documentIds);
      if (!documentId || !documentIds || !deps.store.setDocumentLinks) {
        res.status(400).json({ error: "Invalid linked documents" });
        return;
      }
      const updated = await deps.store.setDocumentLinks(
        Number(res.locals.user.id),
        projectId,
        documentId,
        documentIds,
      );
      if (!updated) {
        res
          .status(404)
          .json({ error: "Document or linked document not found" });
        return;
      }
      res.json(
        await projectDocumentCollection(
          deps,
          Number(res.locals.user.id),
          projectId,
        ),
      );
    }),
  );

  app.get(
    "/research-projects/:projectId/document/:documentId/comments",
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      if (!projectId) return;
      const documentId = positiveId(req.params.documentId);
      if (!documentId || !deps.store.listComments) {
        res.status(400).json({ error: "Invalid document comments" });
        return;
      }
      const userId = Number(res.locals.user.id);
      const document = await deps.store.findOwned(
        userId,
        projectId,
        documentId,
      );
      if (!document) {
        res.status(404).json({ error: "Project document not found" });
        return;
      }
      res.json(await deps.store.listComments(userId, projectId, documentId));
    }),
  );

  app.post(
    "/research-projects/:projectId/document/:documentId/comments",
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      if (!projectId) return;
      const documentId = positiveId(req.params.documentId);
      const body =
        typeof req.body?.body === "string" ? req.body.body.trim() : "";
      const blockId =
        typeof req.body?.blockId === "string" ? req.body.blockId.trim() : "";
      const quote =
        typeof req.body?.quote === "string" ? req.body.quote.trim() : "";
      if (
        !documentId ||
        !body ||
        body.length > 2000 ||
        blockId.length > 200 ||
        quote.length > 500 ||
        (quote && !blockId) ||
        !deps.store.createComment
      ) {
        res.status(400).json({ error: "Invalid document comment" });
        return;
      }
      const created = await deps.store.createComment(
        Number(res.locals.user.id),
        projectId,
        documentId,
        body,
        actualUserId(res),
        blockId
          ? {
              blockId,
              quote: quote || null,
            }
          : undefined,
      );
      if (!created) {
        res.status(404).json({ error: "Project document not found" });
        return;
      }
      res.status(201).json(created);
    }),
  );

  app.patch(
    "/research-projects/:projectId/document/:documentId/comments/:commentId",
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      if (!projectId) return;
      const documentId = positiveId(req.params.documentId);
      const commentId = positiveId(req.params.commentId);
      const resolved = req.body?.resolved;
      if (
        !documentId ||
        !commentId ||
        typeof resolved !== "boolean" ||
        !deps.store.resolveComment
      ) {
        res.status(400).json({ error: "Invalid document comment" });
        return;
      }
      const updated = await deps.store.resolveComment(
        Number(res.locals.user.id),
        projectId,
        documentId,
        commentId,
        resolved,
      );
      if (!updated) {
        res.status(404).json({ error: "Document comment not found" });
        return;
      }
      res.json(updated);
    }),
  );

  app.get(
    "/research-projects/:projectId/document/:documentId/versions",
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      const documentId = positiveId(req.params.documentId);
      if (!projectId || !documentId || !deps.store.listVersions) {
        res.status(400).json({ error: "Invalid document history" });
        return;
      }
      const userId = Number(res.locals.user.id);
      if (!(await deps.store.findOwned(userId, projectId, documentId))) {
        res.status(404).json({ error: "Project document not found" });
        return;
      }
      res.json(await deps.store.listVersions(userId, projectId, documentId));
    }),
  );

  app.post(
    "/research-projects/:projectId/document/:documentId/versions",
    express.raw({
      type: "application/octet-stream",
      limit: PROJECT_DOCUMENT_VERSION_MAX_BYTES,
    }),
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      const documentId = positiveId(req.params.documentId);
      const label =
        typeof req.query.label === "string" ? req.query.label.trim() : "";
      if (
        !projectId ||
        !documentId ||
        !label ||
        label.length > 120 ||
        !Buffer.isBuffer(req.body) ||
        req.body.byteLength < 1 ||
        req.body.byteLength > PROJECT_DOCUMENT_VERSION_MAX_BYTES ||
        !deps.store.createVersion
      ) {
        res.status(400).json({ error: "Invalid document version" });
        return;
      }
      const created = await deps.store.createVersion(
        Number(res.locals.user.id),
        projectId,
        documentId,
        actualUserId(res),
        label,
        new Uint8Array(req.body),
      );
      if (!created) {
        res.status(404).json({ error: "Project document not found" });
        return;
      }
      res.status(201).json(created);
    }),
  );

  app.post(
    "/research-projects/:projectId/document/:documentId/versions/:versionId/restore",
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      const documentId = positiveId(req.params.documentId);
      const versionId = positiveId(req.params.versionId);
      if (
        !projectId ||
        !documentId ||
        !versionId ||
        !deps.store.getVersion ||
        !deps.store.replaceWorkspace
      ) {
        res.status(400).json({ error: "Invalid document version" });
        return;
      }
      const ownerUserId = Number(res.locals.user.id);
      const [document, stored] = await Promise.all([
        deps.store.findOwned(ownerUserId, projectId, documentId),
        deps.store.getVersion(ownerUserId, projectId, documentId, versionId),
      ]);
      if (!document || !stored) {
        res.status(404).json({ error: "Document version not found" });
        return;
      }
      const nextWorkspaceId = await deps.octobaseClient.createWorkspace();
      const restored = await deps.store.replaceWorkspace(
        ownerUserId,
        projectId,
        documentId,
        document.octobaseDocumentId,
        nextWorkspaceId,
        actualUserId(res),
      );
      if (!restored) {
        await deps.octobaseClient
          .deleteWorkspace(nextWorkspaceId)
          .catch(() => deps.logOrphan?.(nextWorkspaceId));
        res.status(409).json({ error: "Project document changed" });
        return;
      }
      await deps.octobaseClient
        .deleteWorkspace(document.octobaseDocumentId)
        .catch(() => deps.logOrphan?.(document.octobaseDocumentId));
      res.json({
        bootstrap: bootstrap(restored, false),
        snapshotBase64: Buffer.from(stored.snapshot).toString("base64"),
      });
    }),
  );

  app.post(
    "/research-projects/:projectId/document-collections",
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      if (!projectId) return;
      const name =
        typeof req.body?.name === "string" ? req.body.name.trim() : "";
      if (!name || name.length > 80 || !deps.store.createCollection) {
        res.status(400).json({ error: "Invalid document collection" });
        return;
      }
      const created = await deps.store.createCollection(
        Number(res.locals.user.id),
        projectId,
        { name },
      );
      if (!created) {
        res.status(409).json({ error: "Collection already exists" });
        return;
      }
      res
        .status(201)
        .json(
          await projectDocumentCollection(
            deps,
            Number(res.locals.user.id),
            projectId,
          ),
        );
    }),
  );

  app.patch(
    "/research-projects/:projectId/document-collections/:collectionId",
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      if (!projectId) return;
      const collectionId = positiveId(req.params.collectionId);
      const name =
        typeof req.body?.name === "string" ? req.body.name.trim() : "";
      const isFavorite = req.body?.isFavorite;
      const mode = req.body?.mode as ProjectDocumentCollectionMode | undefined;
      const rules = collectionRules(req.body?.rules);
      if (
        !collectionId ||
        !name ||
        name.length > 80 ||
        typeof isFavorite !== "boolean" ||
        !mode ||
        !projectDocumentCollectionModes.has(mode) ||
        !rules ||
        !deps.store.updateCollection
      ) {
        res.status(400).json({ error: "Invalid document collection" });
        return;
      }
      const updated = await deps.store.updateCollection(
        Number(res.locals.user.id),
        projectId,
        collectionId,
        { name, isFavorite, mode, rules },
      );
      if (!updated) {
        res.status(404).json({ error: "Document collection not found" });
        return;
      }
      res.json(
        await projectDocumentCollection(
          deps,
          Number(res.locals.user.id),
          projectId,
        ),
      );
    }),
  );

  app.delete(
    "/research-projects/:projectId/document-collections/:collectionId",
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      if (!projectId) return;
      const collectionId = positiveId(req.params.collectionId);
      if (!collectionId || !deps.store.deleteCollection) {
        res.status(400).json({ error: "Invalid document collection" });
        return;
      }
      const deleted = await deps.store.deleteCollection(
        Number(res.locals.user.id),
        projectId,
        collectionId,
      );
      if (!deleted) {
        res.status(404).json({ error: "Document collection not found" });
        return;
      }
      res.status(204).end();
    }),
  );

  app.put(
    "/research-projects/:projectId/document-collections/:collectionId/documents",
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      if (!projectId) return;
      const collectionId = positiveId(req.params.collectionId);
      const documentIds = positiveIdArray(req.body?.documentIds);
      if (!collectionId || !documentIds || !deps.store.setCollectionDocuments) {
        res.status(400).json({ error: "Invalid collection documents" });
        return;
      }
      const updated = await deps.store.setCollectionDocuments(
        Number(res.locals.user.id),
        projectId,
        collectionId,
        documentIds,
      );
      if (!updated) {
        res.status(404).json({ error: "Collection or document not found" });
        return;
      }
      res.json(
        await projectDocumentCollection(
          deps,
          Number(res.locals.user.id),
          projectId,
        ),
      );
    }),
  );

  app.patch(
    "/research-projects/:projectId/document/:documentId/trash",
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      const documentId = positiveId(req.params.documentId);
      if (!projectId || !documentId) return;
      const userId = Number(res.locals.user.id);
      const trashed = await deps.store.trashOwned(
        userId,
        projectId,
        documentId,
      );
      if (!trashed) {
        res.status(404).json({ error: "Project document not found" });
        return;
      }
      res.json(await projectDocumentCollection(deps, userId, projectId));
    }),
  );

  app.patch(
    "/research-projects/:projectId/document/:documentId/restore",
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      const documentId = positiveId(req.params.documentId);
      if (!projectId || !documentId) return;
      const userId = Number(res.locals.user.id);
      const restored = await deps.store.restoreOwned(
        userId,
        projectId,
        documentId,
      );
      if (!restored) {
        res.status(404).json({ error: "Trashed Project document not found" });
        return;
      }
      res.json(await projectDocumentCollection(deps, userId, projectId));
    }),
  );

  app.delete(
    "/research-projects/:projectId/document/:documentId/permanent",
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      const documentId = positiveId(req.params.documentId);
      if (!projectId || !documentId) return;
      const userId = Number(res.locals.user.id);
      const existing = await deps.store.findTrashed(
        userId,
        projectId,
        documentId,
      );
      if (!existing) {
        res.status(404).json({ error: "Trashed Project document not found" });
        return;
      }
      await deps.octobaseClient.deleteWorkspace(existing.octobaseDocumentId);
      const deleted = await deps.store.deleteTrashed(
        userId,
        projectId,
        documentId,
      );
      if (!deleted) {
        res.status(409).json({ error: "Project document changed" });
        return;
      }
      if (deps.objectStore) {
        try {
          await deleteProjectDocumentBlobs(
            deps.objectStore,
            projectId,
            documentId,
          );
        } catch {
          // The document is already gone. Blob cleanup is best-effort and
          // object-store lifecycle policies provide the final safety net.
        }
      }
      res.status(204).end();
    }),
  );

  app.post(
    "/research-projects/:projectId/journals/:journalDate",
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      if (!projectId) return;
      const journalDate = isoDate(req.params.journalDate);
      if (!journalDate) {
        res.status(400).json({ error: "Invalid journal date" });
        return;
      }
      const userId = Number(res.locals.user.id);
      const documentKey = `journal-${journalDate}`;
      const existing = await deps.store.findByKey(
        userId,
        projectId,
        documentKey,
      );
      if (existing) {
        res.json(bootstrap(existing, false));
        return;
      }
      const trashed = (await deps.store.listTrashed(userId, projectId)).find(
        (document) => document.documentKey === documentKey,
      );
      if (trashed) {
        const restored = await deps.store.restoreOwned(
          userId,
          projectId,
          trashed.id,
        );
        if (restored) {
          res.json(bootstrap(restored, false));
          return;
        }
      }
      const workspaceId = await deps.octobaseClient.createWorkspace();
      const title = new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${journalDate}T00:00:00.000Z`));
      const created = await deps.store.createForOwnedProject(
        userId,
        projectId,
        {
          documentKey,
          title,
          octobaseDocumentId: workspaceId,
          integrationVersion: INTEGRATION_VERSION,
          journalDate,
          createdByUserId: actualUserId(res),
        },
      );
      if (created) {
        res.status(201).json(bootstrap(created, true));
        return;
      }
      const raced = await deps.store.findByKey(userId, projectId, documentKey);
      deps.logOrphan?.(workspaceId);
      if (!raced) {
        res.status(404).json({ error: "Research project not found" });
        return;
      }
      res.json(bootstrap(raced, false));
    }),
  );

  app.post(
    "/research-projects/:projectId/documents/from-template/:templateDocumentId",
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      const templateDocumentId = positiveId(req.params.templateDocumentId);
      if (
        !projectId ||
        !templateDocumentId ||
        !deps.store.getTemplateSnapshot
      ) {
        res.status(400).json({ error: "Invalid document template" });
        return;
      }
      const ownerUserId = Number(res.locals.user.id);
      const [template, snapshot] = await Promise.all([
        deps.store.findOwned(ownerUserId, projectId, templateDocumentId),
        deps.store.getTemplateSnapshot(
          ownerUserId,
          projectId,
          templateDocumentId,
        ),
      ]);
      if (!template?.isTemplate || !snapshot) {
        res.status(404).json({ error: "Document template not found" });
        return;
      }

      const workspaceId = await deps.octobaseClient.createWorkspace();
      const created = await deps.store.createForOwnedProject(
        ownerUserId,
        projectId,
        {
          documentKey: `doc-${randomUUID()}`,
          title: template.title,
          octobaseDocumentId: workspaceId,
          integrationVersion: INTEGRATION_VERSION,
          createdByUserId: actualUserId(res),
        },
      );
      if (!created) {
        await deps.octobaseClient
          .deleteWorkspace(workspaceId)
          .catch(() => deps.logOrphan?.(workspaceId));
        res.status(404).json({ error: "Research project not found" });
        return;
      }

      const metadataDocument = await deps.store.updateMetadata(
        ownerUserId,
        projectId,
        created.id,
        {
          title: template.title,
          icon: template.icon,
          isFavorite: false,
          pageWidth: template.pageWidth,
          properties: template.properties,
        },
        actualUserId(res),
      );
      const [modeDocument] = await Promise.all([
        deps.store.updateMode(
          ownerUserId,
          projectId,
          created.id,
          template.lastEditorMode,
          actualUserId(res),
        ),
        deps.objectStore
          ? copyProjectDocumentBlobs(
              deps.objectStore,
              projectId,
              template.id,
              created.id,
            )
          : Promise.resolve(),
      ]);
      const copied = modeDocument ?? metadataDocument ?? created;
      res.status(201).json({
        bootstrap: bootstrap(copied, true),
        snapshotBase64: Buffer.from(snapshot).toString("base64"),
      });
    }),
  );

  app.post(
    "/research-projects/:projectId/documents",
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      if (!projectId) return;
      const title =
        typeof req.body?.title === "string"
          ? req.body.title.trim()
          : "Untitled";
      if (!title || title.length > 200) {
        res.status(400).json({ error: "Invalid document title" });
        return;
      }

      const workspaceId = await deps.octobaseClient.createWorkspace();
      const created = await deps.store.createForOwnedProject(
        Number(res.locals.user.id),
        projectId,
        {
          documentKey: `doc-${randomUUID()}`,
          title,
          octobaseDocumentId: workspaceId,
          integrationVersion: INTEGRATION_VERSION,
          createdByUserId: actualUserId(res),
        },
      );
      if (!created) {
        deps.logOrphan?.(workspaceId);
        res.status(404).json({ error: "Research project not found" });
        return;
      }
      res.status(201).json(bootstrap(created, true));
    }),
  );

  app.post(
    "/research-projects/:projectId/document",
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      if (!projectId) return;
      const userId = Number(res.locals.user.id);
      const existing = await deps.store.findByKey(
        userId,
        projectId,
        PROJECT_DOCUMENT_KEY,
      );
      if (existing) {
        res.json(bootstrap(existing, false));
        return;
      }
      const workspaceId = await deps.octobaseClient.createWorkspace();
      const created = await deps.store.createForOwnedProject(
        userId,
        projectId,
        {
          documentKey: PROJECT_DOCUMENT_KEY,
          title: "Project notes",
          octobaseDocumentId: workspaceId,
          integrationVersion: INTEGRATION_VERSION,
          createdByUserId: actualUserId(res),
        },
      );
      if (created) {
        res.status(201).json(bootstrap(created, true));
        return;
      }

      const raced = await deps.store.findByKey(
        userId,
        projectId,
        PROJECT_DOCUMENT_KEY,
      );
      if (!raced) {
        deps.logOrphan?.(workspaceId);
        res.status(404).json({ error: "Research project not found" });
        return;
      }
      deps.logOrphan?.(workspaceId);
      res.json(bootstrap(raced, false));
    }),
  );

  app.get(
    "/research-projects/:projectId/document/:documentId",
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      if (!projectId) return;
      const documentId = positiveId(req.params.documentId);
      if (!documentId) {
        res.status(400).json({ error: "Invalid project document" });
        return;
      }
      const document = await deps.store.findOwned(
        Number(res.locals.user.id),
        projectId,
        documentId,
      );
      if (!document) {
        res.status(404).json({ error: "Project document not found" });
        return;
      }
      res.json(bootstrap(document, false));
    }),
  );

  app.patch(
    "/research-projects/:projectId/document/:documentId/mode",
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      if (!projectId) return;
      const documentId = positiveId(req.params.documentId);
      const mode = req.body?.mode as ProjectDocumentMode | undefined;
      if (!documentId || (mode !== "page" && mode !== "edgeless")) {
        res.status(400).json({ error: "Invalid editor mode" });
        return;
      }
      const updated = await deps.store.updateMode(
        Number(res.locals.user.id),
        projectId,
        documentId,
        mode,
        actualUserId(res),
      );
      if (!updated) {
        res.status(404).json({ error: "Project document not found" });
        return;
      }
      res.json(publicDocument(updated));
    }),
  );

  app.patch(
    "/research-projects/:projectId/document/:documentId/metadata",
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      if (!projectId) return;
      const documentId = positiveId(req.params.documentId);
      const title =
        typeof req.body?.title === "string" ? req.body.title.trim() : "";
      const icon = req.body?.icon as ProjectDocumentIcon | undefined;
      const isFavorite = req.body?.isFavorite;
      const pageWidth = req.body?.pageWidth as
        | ProjectDocumentPageWidth
        | undefined;
      const properties = normalizeProjectDocumentProperties(
        req.body?.properties,
      );
      if (
        !documentId ||
        !title ||
        title.length > 200 ||
        !icon ||
        !projectDocumentIcons.has(icon) ||
        typeof isFavorite !== "boolean" ||
        !pageWidth ||
        !projectDocumentPageWidths.has(pageWidth) ||
        !properties
      ) {
        res.status(400).json({ error: "Invalid document metadata" });
        return;
      }
      const updated = await deps.store.updateMetadata(
        Number(res.locals.user.id),
        projectId,
        documentId,
        { title, icon, isFavorite, pageWidth, properties },
        actualUserId(res),
      );
      if (!updated) {
        res.status(404).json({ error: "Project document not found" });
        return;
      }
      res.json(publicDocument(updated));
    }),
  );

  app.put(
    "/research-projects/:projectId/document/:documentId/template",
    express.raw({
      type: "application/octet-stream",
      limit: PROJECT_DOCUMENT_VERSION_MAX_BYTES,
    }),
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      const documentId = positiveId(req.params.documentId);
      if (
        !projectId ||
        !documentId ||
        !Buffer.isBuffer(req.body) ||
        req.body.byteLength < 1 ||
        req.body.byteLength > PROJECT_DOCUMENT_VERSION_MAX_BYTES ||
        !deps.store.updateTemplate
      ) {
        res.status(400).json({ error: "Invalid document template" });
        return;
      }
      const updated = await deps.store.updateTemplate(
        Number(res.locals.user.id),
        projectId,
        documentId,
        new Uint8Array(req.body),
        actualUserId(res),
      );
      if (!updated) {
        res.status(404).json({ error: "Project document not found" });
        return;
      }
      res.json(publicDocument(updated));
    }),
  );

  app.delete(
    "/research-projects/:projectId/document/:documentId/template",
    asyncRoute(async (req, res) => {
      const projectId = allowedProject(req, res);
      const documentId = positiveId(req.params.documentId);
      if (!projectId || !documentId || !deps.store.updateTemplate) {
        res.status(400).json({ error: "Invalid document template" });
        return;
      }
      const updated = await deps.store.updateTemplate(
        Number(res.locals.user.id),
        projectId,
        documentId,
        undefined,
        actualUserId(res),
      );
      if (!updated) {
        res.status(404).json({ error: "Project document not found" });
        return;
      }
      res.json(publicDocument(updated));
    }),
  );
}
