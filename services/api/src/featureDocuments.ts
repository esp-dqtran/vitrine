import express from "express";
import { createHash, randomBytes } from "node:crypto";
import type { DesignFlow } from "../../../src/designSystem.ts";
import type { AppVersion, CrawledImage } from "../../../src/db.ts";
import {
  featureEvidenceManifestSha256,
  renderFeatureDocumentMarkdown,
  type FeatureDocumentContent,
  type FeatureDocumentReviewStatus,
  type FeatureEvidenceManifestItem,
  type FeatureSourceFlow,
} from "../../../src/featureDocument.ts";
import type {
  FeatureDocumentStore,
  PublicFeatureDocumentShare,
} from "../../../src/featureDocumentStore.ts";
import type { ObjectMetadata } from "../../../src/objectStore.ts";
import type { Job } from "../../../src/queue.ts";

interface FeatureDocumentUser {
  id: number;
  role: "admin" | "user";
}

interface Notification {
  channel: string;
  payload?: string;
}

export interface FeatureDocumentNotificationClient {
  query(sql: string): Promise<unknown>;
  on(event: "notification", listener: (notification: Notification) => void): this;
  removeListener(event: "notification", listener: (notification: Notification) => void): this;
  release(): void;
}

interface FeatureEvent {
  userId: number;
  featureKey: "feature_documents";
  action: string;
  outcome: string;
  volume?: number;
}

export interface PublicFeatureDocumentRouteDependencies {
  store: Pick<FeatureDocumentStore, "publicShare" | "publicShareImage">;
  sendObject(metadata: ObjectMetadata, res: express.Response): Promise<void>;
}

export interface FeatureDocumentRouteDependencies extends PublicFeatureDocumentRouteDependencies {
  store: FeatureDocumentStore;
  canAccessApp(user: FeatureDocumentUser, app: string): Promise<boolean>;
  listAppVersions(app: string, platform: string, publishedOnly?: boolean): Promise<Array<Pick<AppVersion, "id" | "version_number" | "status">>>;
  getVersionFlows(app: string, platform: string, versionNumber?: number | null, publishedOnly?: boolean): Promise<DesignFlow[]>;
  flowEvidenceImages(input: {
    app: string;
    platform: string;
    versionNumber?: number | null;
    imageIds: number[];
    publishedOnly?: boolean;
  }): Promise<Array<Pick<CrawledImage, "id" | "description" | "captured_at">>>;
  imageObjectById(imageId: number): Promise<ObjectMetadata | undefined>;
  createJob(type: string, payload?: Record<string, unknown>, parentId?: number): Promise<number>;
  setJobStatus(jobId: number, status: "queued" | "running" | "done" | "error" | "cancelled", message?: string): Promise<unknown>;
  publishJob(job: Job): Promise<void>;
  providerModel: string;
  promptVersion: number;
  appUrl: string;
  acquireNotificationClient(): Promise<FeatureDocumentNotificationClient>;
  recordEvent?(input: FeatureEvent): Promise<void>;
}

type GenerationRequest = {
  app: string;
  platform: "ios" | "android" | "web";
  version: number;
  flowId: string;
  focusInstruction: string;
};

type PreparedGeneration = {
  source: FeatureSourceFlow;
  evidenceManifest: FeatureEvidenceManifestItem[];
  evidenceManifestSha256: string;
  missing: string[];
};

const REVIEW_STATUSES = new Set<FeatureDocumentReviewStatus>(["draft", "in_review", "approved"]);
const PLATFORM_VALUES = new Set(["ios", "android", "web"]);

function asyncRoute(handler: (req: express.Request, res: express.Response) => Promise<void>): express.RequestHandler {
  return (req, res, next) => { handler(req, res).catch(next); };
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function exactBody(value: unknown, keys: readonly string[]): Record<string, unknown> | undefined {
  const body = record(value);
  return body && Object.keys(body).every((key) => keys.includes(key)) ? body : undefined;
}

function positiveId(value: unknown): number | undefined {
  const parsed = typeof value === "string" && /^[1-9][0-9]*$/.test(value) ? Number(value) : value;
  return Number.isSafeInteger(parsed) && Number(parsed) > 0 ? Number(parsed) : undefined;
}

function boundedText(value: unknown, maximum: number, required = false): string | undefined {
  if (typeof value !== "string") return undefined;
  const result = value.trim();
  return ((!result && required) || result.length > maximum) ? undefined : result;
}

function generationRequest(value: unknown): GenerationRequest | undefined {
  const body = exactBody(value, ["app", "platform", "version", "flowId", "focusInstruction"]);
  if (!body) return undefined;
  const app = boundedText(body.app, 160, true);
  const flowId = boundedText(body.flowId, 240, true);
  const focusInstruction = boundedText(body.focusInstruction, 2_000);
  const version = positiveId(body.version);
  if (!app || !flowId || focusInstruction === undefined || !version || !PLATFORM_VALUES.has(body.platform as string)) return undefined;
  return { app, platform: body.platform as GenerationRequest["platform"], version, flowId, focusInstruction };
}

function evidenceId(stepIndex: number, imageId: number): string {
  return `FLOW-STEP-${String(stepIndex + 1).padStart(2, "0")}-IMAGE-${imageId}`;
}

async function prepareGeneration(
  deps: FeatureDocumentRouteDependencies,
  user: FeatureDocumentUser,
  request: GenerationRequest,
): Promise<PreparedGeneration | undefined> {
  const publishedOnly = user.role !== "admin";
  const versions = await deps.listAppVersions(request.app, request.platform, publishedOnly);
  const version = versions.find((candidate) => candidate.version_number === request.version);
  if (!version || (publishedOnly && version.status !== "published")) return undefined;
  const flows = await deps.getVersionFlows(request.app, request.platform, request.version, publishedOnly);
  const matches = flows.filter(({ id }) => id === request.flowId);
  if (matches.length !== 1) return undefined;
  const flow = matches[0];
  const imageIds = flow.steps.flatMap(({ evidence }) => evidence);
  if (imageIds.length < 1 || imageIds.length > 500) return undefined;
  const images = await deps.flowEvidenceImages({
    app: request.app,
    platform: request.platform,
    versionNumber: request.version,
    imageIds,
    publishedOnly,
  });
  const imageById = new Map(images.map((image) => [Number(image.id), image]));
  const manifest: FeatureEvidenceManifestItem[] = [];
  const missing: string[] = [];
  for (const [stepIndex, step] of flow.steps.entries()) {
    for (const [imageIndex, imageId] of step.evidence.entries()) {
      const identity = evidenceId(stepIndex, imageId);
      const image = imageById.get(imageId);
      const metadata = image ? await deps.imageObjectById(imageId) : undefined;
      if (!image || !metadata) {
        missing.push(identity);
        continue;
      }
      manifest.push({
        stepIndex,
        imageIndex,
        imageId,
        evidenceId: identity,
        stepLabel: step.label,
        ...(step.interaction ? { interaction: step.interaction } : {}),
        description: image.description,
        ...(image.captured_at ? { capturedAt: new Date(image.captured_at).toISOString() } : {}),
      });
    }
  }
  const source: FeatureSourceFlow = {
    app: request.app,
    platform: request.platform,
    versionId: version.id,
    flowId: flow.id,
    title: flow.title,
    description: flow.description,
    ...(flow.category ? { category: flow.category } : {}),
    tags: flow.tags,
  };
  return {
    source,
    evidenceManifest: manifest,
    evidenceManifestSha256: featureEvidenceManifestSha256(manifest),
    missing,
  };
}

async function prepareFromSource(
  deps: FeatureDocumentRouteDependencies,
  user: FeatureDocumentUser,
  source: FeatureSourceFlow,
  focusInstruction: string,
): Promise<PreparedGeneration | undefined> {
  const versions = await deps.listAppVersions(source.app, source.platform, user.role !== "admin");
  const version = source.versionId === undefined
    ? versions[0]
    : versions.find(({ id }) => id === source.versionId);
  if (!version) return undefined;
  return prepareGeneration(deps, user, {
    app: source.app,
    platform: source.platform,
    version: version.version_number,
    flowId: source.flowId,
    focusInstruction,
  });
}

function missingEvidence(res: express.Response, missing: string[]): void {
  res.status(409).json({ error: "Flow evidence is incomplete", code: "flow_evidence_incomplete", missing });
}

async function publishGeneration(
  deps: FeatureDocumentRouteDependencies,
  userId: number,
  prepared: PreparedGeneration,
  focusInstruction: string,
  documentId?: number,
): Promise<{ documentId: number; jobId: number } | undefined> {
  const transportJobId = await deps.createJob("generate-feature-document", {});
  const generationInput = {
    transportJobId,
    source: prepared.source,
    evidenceManifest: prepared.evidenceManifest,
    evidenceManifestSha256: prepared.evidenceManifestSha256,
    focusInstruction,
    promptVersion: deps.promptVersion,
    providerModel: deps.providerModel,
  };
  const generation = documentId === undefined
    ? await deps.store.createGeneration(userId, generationInput)
    : await deps.store.createRegeneration(userId, documentId, generationInput);
  if (!generation) return undefined;
  const dedicatedJob = "job" in generation ? generation.job : generation;
  const dedicatedDocumentId = "document" in generation ? generation.document.id : dedicatedJob.documentId;
  try {
    await deps.publishJob({ type: "generate-feature-document", runId: String(dedicatedJob.id), jobId: transportJobId });
  } catch {
    await Promise.all([
      deps.store.failJob(dedicatedJob.id, "queue_unavailable", "Feature document queue is unavailable"),
      deps.setJobStatus(transportJobId, "error", "Feature document queue is unavailable"),
    ]);
    throw new Error("feature_document_queue_unavailable");
  }
  return { documentId: dedicatedDocumentId, jobId: dedicatedJob.id };
}

function validShareToken(value: unknown): string | undefined {
  return typeof value === "string" && value.length === 43 && /^[A-Za-z0-9_-]{43}$/.test(value)
    ? value
    : undefined;
}

function shareHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function unavailableShare(res: express.Response): void {
  res.status(404).json({ error: "Feature document share unavailable" });
}

export function mountPublicFeatureDocumentRoutes(
  app: express.Express,
  deps: PublicFeatureDocumentRouteDependencies,
): void {
  app.get("/feature-document-shares/:token", asyncRoute(async (req, res) => {
    const token = validShareToken(req.params.token);
    if (!token) { unavailableShare(res); return; }
    const share = await deps.store.publicShare(shareHash(token), new Date());
    if (!share) { unavailableShare(res); return; }
    res.json(share);
  }));

  app.get("/feature-document-shares/:token/media/:imageId", asyncRoute(async (req, res) => {
    const imageId = positiveId(req.params.imageId);
    const token = validShareToken(req.params.token);
    if (!token || !imageId) { unavailableShare(res); return; }
    const metadata = await deps.store.publicShareImage(shareHash(token), imageId, new Date());
    if (!metadata) { unavailableShare(res); return; }
    try {
      await deps.sendObject(metadata, res);
    } catch {
      res.status(503).json({ error: "media storage unavailable" });
    }
  }));
}

export function mountFeatureDocumentRoutes(
  app: express.Express,
  deps: FeatureDocumentRouteDependencies,
): void {
  const event = (res: express.Response, action: string, outcome: string, volume?: number) => deps.recordEvent?.({
    userId: res.locals.user.id,
    featureKey: "feature_documents",
    action,
    outcome,
    ...(volume === undefined ? {} : { volume }),
  });

  app.post("/feature-documents", asyncRoute(async (req, res) => {
    const input = generationRequest(req.body);
    if (!input) { res.status(400).json({ error: "Invalid Feature Document request" }); return; }
    if (!deps.providerModel || !Number.isSafeInteger(deps.promptVersion) || deps.promptVersion < 1) {
      res.status(503).json({ error: "Feature document provider is not configured", code: "provider_unavailable" }); return;
    }
    if (!(await deps.canAccessApp(res.locals.user, input.app))) {
      res.status(403).json({ error: "Upgrade required", code: "upgrade_required" }); return;
    }
    const prepared = await prepareGeneration(deps, res.locals.user, input);
    if (!prepared) { res.status(404).json({ error: "Flow not found" }); return; }
    if (prepared.missing.length) { missingEvidence(res, prepared.missing); return; }
    try {
      const generation = await publishGeneration(deps, res.locals.user.id, prepared, input.focusInstruction);
      if (!generation) { res.status(404).json({ error: "Flow not found" }); return; }
      await event(res, "feature_document_generation_requested", "created", prepared.evidenceManifest.length);
      res.status(201).json(generation);
    } catch (error) {
      if (error instanceof Error && error.message === "feature_document_queue_unavailable") {
        await event(res, "feature_document_generation_requested", "failed");
        res.status(503).json({ error: "Feature document queue unavailable", code: "queue_unavailable" });
        return;
      }
      throw error;
    }
  }));

  app.get("/feature-documents/:documentId", asyncRoute(async (req, res) => {
    const documentId = positiveId(req.params.documentId);
    if (!documentId) { res.status(400).json({ error: "Invalid Feature Document" }); return; }
    let document = await deps.store.getDocument(res.locals.user.id, documentId);
    if (!document) { res.status(404).json({ error: "Feature Document not found" }); return; }
    if (document.currentRevision) {
      const current = await prepareFromSource(
        deps,
        res.locals.user,
        document.currentRevision.source,
        document.currentRevision.focusInstruction,
      );
      if (current && current.missing.length === 0) {
        document = await deps.store.getDocument(
          res.locals.user.id,
          documentId,
          current.evidenceManifestSha256,
        ) ?? document;
      } else {
        document = { ...document, sourceChanged: true };
      }
    }
    res.json(document);
  }));

  app.get("/feature-documents/:documentId/revisions/:revisionId/media/:imageId", asyncRoute(async (req, res) => {
    const documentId = positiveId(req.params.documentId);
    const revisionId = positiveId(req.params.revisionId);
    const imageId = positiveId(req.params.imageId);
    if (!documentId || !revisionId || !imageId) { res.status(400).json({ error: "Invalid Feature Document media" }); return; }
    const metadata = await deps.store.documentImage(res.locals.user.id, documentId, revisionId, imageId);
    if (!metadata) { res.status(404).json({ error: "Feature Document media not found" }); return; }
    await deps.sendObject(metadata, res);
  }));

  app.patch("/feature-documents/:documentId/revisions", asyncRoute(async (req, res) => {
    const documentId = positiveId(req.params.documentId);
    const body = exactBody(req.body, ["revisionId", "content"]);
    const revisionId = positiveId(body?.revisionId);
    if (!documentId || !revisionId || !record(body?.content)) { res.status(400).json({ error: "Invalid Feature Document revision" }); return; }
    const revision = await deps.store.saveRevision(res.locals.user.id, documentId, revisionId, body!.content as FeatureDocumentContent);
    if (!revision) {
      const document = await deps.store.getDocument(res.locals.user.id, documentId);
      res.status(document ? 409 : 404).json({ error: document ? "Feature Document revision conflict" : "Feature Document not found", ...(document ? { code: "revision_conflict" } : {}) });
      return;
    }
    await event(res, "feature_document_revision_saved", "created");
    res.status(201).json(revision);
  }));

  app.post("/feature-documents/:documentId/regenerations", asyncRoute(async (req, res) => {
    const documentId = positiveId(req.params.documentId);
    const body = exactBody(req.body, ["focusInstruction"]);
    const focusInstruction = boundedText(body?.focusInstruction, 2_000);
    if (!documentId || focusInstruction === undefined) { res.status(400).json({ error: "Invalid regeneration request" }); return; }
    if (!deps.providerModel || !Number.isSafeInteger(deps.promptVersion) || deps.promptVersion < 1) {
      res.status(503).json({ error: "Feature document provider is not configured", code: "provider_unavailable" }); return;
    }
    const document = await deps.store.getDocument(res.locals.user.id, documentId);
    if (!document?.currentRevision) { res.status(404).json({ error: "Feature Document not found" }); return; }
    const prepared = await prepareFromSource(deps, res.locals.user, document.currentRevision.source, focusInstruction);
    if (!prepared) { res.status(409).json({ error: "Source Flow is unavailable", code: "source_unavailable" }); return; }
    if (prepared.missing.length) { missingEvidence(res, prepared.missing); return; }
    const generation = await publishGeneration(deps, res.locals.user.id, prepared, focusInstruction, documentId);
    if (!generation) { res.status(404).json({ error: "Feature Document not found" }); return; }
    await event(res, "feature_document_generation_requested", "created", prepared.evidenceManifest.length);
    res.status(202).json((await deps.store.getJob(res.locals.user.id, generation.jobId)) ?? generation);
  }));

  app.post("/feature-documents/:documentId/revisions/:revisionId/restore", asyncRoute(async (req, res) => {
    const documentId = positiveId(req.params.documentId);
    const revisionId = positiveId(req.params.revisionId);
    if (!documentId || !revisionId || !exactBody(req.body ?? {}, [])) { res.status(400).json({ error: "Invalid restore request" }); return; }
    const revision = await deps.store.restoreRevision(res.locals.user.id, documentId, revisionId);
    if (!revision) { res.status(404).json({ error: "Feature Document revision not found" }); return; }
    await event(res, "feature_document_revision_restored", "created");
    res.status(201).json(revision);
  }));

  app.post("/feature-documents/:documentId/review-status", asyncRoute(async (req, res) => {
    const documentId = positiveId(req.params.documentId);
    const body = exactBody(req.body, ["revisionId", "status"]);
    const revisionId = positiveId(body?.revisionId);
    const status = body?.status as FeatureDocumentReviewStatus;
    if (!documentId || !revisionId || !REVIEW_STATUSES.has(status)) { res.status(400).json({ error: "Invalid review transition" }); return; }
    const document = await deps.store.setReviewStatus(res.locals.user.id, documentId, revisionId, status);
    if (!document) { res.status(404).json({ error: "Feature Document not found" }); return; }
    await event(res, "feature_document_review_transition", "completed");
    res.json(document);
  }));

  app.post("/feature-documents/:documentId/source-change/acknowledge", asyncRoute(async (req, res) => {
    const documentId = positiveId(req.params.documentId);
    if (!documentId || !exactBody(req.body ?? {}, [])) { res.status(400).json({ error: "Invalid acknowledgement" }); return; }
    const document = await deps.store.getDocument(res.locals.user.id, documentId);
    if (!document?.currentRevision) { res.status(404).json({ error: "Feature Document not found" }); return; }
    const prepared = await prepareFromSource(deps, res.locals.user, document.currentRevision.source, document.currentRevision.focusInstruction);
    if (!prepared || prepared.missing.length) { res.status(409).json({ error: "Source Flow is unavailable", code: "source_unavailable" }); return; }
    const acknowledged = await deps.store.acknowledgeSourceChange(res.locals.user.id, documentId, prepared.evidenceManifestSha256);
    if (!acknowledged) { res.status(409).json({ error: "Source changed again", code: "source_changed" }); return; }
    res.json(acknowledged);
  }));

  app.get("/feature-documents/:documentId/export.md", asyncRoute(async (req, res) => {
    const documentId = positiveId(req.params.documentId);
    if (!documentId) { res.status(400).json({ error: "Invalid Feature Document" }); return; }
    const document = await deps.store.getDocument(res.locals.user.id, documentId);
    const revision = document?.currentRevision;
    if (!document || !revision) { res.status(404).json({ error: "Feature Document not found" }); return; }
    const markdown = renderFeatureDocumentMarkdown(document.title, revision.content, {
      sourceFlowTitle: revision.source.title,
      generatedAt: revision.createdAt,
    });
    res.type("text/markdown");
    res.setHeader("Content-Disposition", `attachment; filename="feature-document-${document.id}-r${revision.revisionNumber}.md"`);
    await event(res, "feature_document_exported", "completed");
    res.send(markdown);
  }));

  app.post("/feature-documents/:documentId/shares", asyncRoute(async (req, res) => {
    const documentId = positiveId(req.params.documentId);
    const body = exactBody(req.body, ["revisionId"]);
    const revisionId = positiveId(body?.revisionId);
    if (!documentId || !revisionId) { res.status(400).json({ error: "Invalid share request" }); return; }
    const token = randomBytes(32).toString("base64url");
    const share = await deps.store.createShare(res.locals.user.id, documentId, revisionId, shareHash(token), new Date());
    if (!share) { res.status(404).json({ error: "Feature Document not found" }); return; }
    await event(res, "feature_document_share_created", "created");
    res.status(201).json({ ...share, url: `${deps.appUrl}/feature-document-shares/${token}` });
  }));

  app.delete("/feature-documents/:documentId/shares/:shareId", asyncRoute(async (req, res) => {
    const documentId = positiveId(req.params.documentId);
    const shareId = positiveId(req.params.shareId);
    if (!documentId || !shareId) { res.status(400).json({ error: "Invalid share" }); return; }
    if (!(await deps.store.revokeShare(res.locals.user.id, documentId, shareId))) {
      res.status(404).json({ error: "Feature Document share not found" }); return;
    }
    await event(res, "feature_document_share_revoked", "completed");
    res.status(204).end();
  }));

  app.get("/feature-document-jobs/:jobId", asyncRoute(async (req, res) => {
    const jobId = positiveId(req.params.jobId);
    if (!jobId) { res.status(400).json({ error: "Invalid Feature Document job" }); return; }
    const job = await deps.store.getJob(res.locals.user.id, jobId);
    if (!job) { res.status(404).json({ error: "Feature Document job not found" }); return; }
    res.json(job);
  }));

  app.post("/feature-document-jobs/:jobId/cancel", asyncRoute(async (req, res) => {
    const jobId = positiveId(req.params.jobId);
    if (!jobId || !exactBody(req.body ?? {}, [])) { res.status(400).json({ error: "Invalid cancellation" }); return; }
    const job = await deps.store.requestCancel(res.locals.user.id, jobId);
    if (!job) { res.status(404).json({ error: "Feature Document job not found" }); return; }
    res.json(job);
  }));

  app.get("/feature-document-jobs/:jobId/events", asyncRoute(async (req, res) => {
    const jobId = positiveId(req.params.jobId);
    if (!jobId) { res.status(400).json({ error: "Invalid Feature Document job" }); return; }
    const initial = await deps.store.getJob(res.locals.user.id, jobId);
    if (!initial) { res.status(404).json({ error: "Feature Document job not found" }); return; }
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    const send = (value: typeof initial) => {
      res.write(`event: feature-document-progress\ndata: ${JSON.stringify(value)}\n\n`);
    };
    send(initial);
    const client = await deps.acquireNotificationClient();
    await client.query("LISTEN feature_document_jobs");
    const notification = (notice: Notification) => {
      if (notice.channel !== "feature_document_jobs" || notice.payload !== String(jobId)) return;
      deps.store.getJob(res.locals.user.id, jobId).then((current) => {
        if (current && !res.writableEnded) send(current);
      }).catch(() => {});
    };
    client.on("notification", notification);
    const heartbeat = setInterval(() => {
      if (!res.writableEnded) res.write(": heartbeat\n\n");
    }, 25_000);
    const close = () => {
      clearInterval(heartbeat);
      client.removeListener("notification", notification);
      client.query("UNLISTEN feature_document_jobs").catch(() => {});
      client.release();
    };
    req.once("close", close);
  }));
}
