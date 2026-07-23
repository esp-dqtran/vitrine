import express from "express";
import {
  projectAppKnowledge,
  type AppKnowledgeReviewStatus,
  type AppKnowledgeSnapshot,
} from "../../../src/appKnowledge.ts";
import {
  ActiveAppKnowledgeJobError,
  type AppKnowledgeJobView,
  type AppKnowledgeSnapshotView,
  type AppKnowledgeStore,
  type AppKnowledgeTarget,
} from "../../../src/appKnowledgeStore.ts";
import type { AppVersion } from "../../../src/db.ts";
import type { Job } from "../../../src/queue.ts";

export interface ApiUser {
  id: number;
  role: "admin" | "user";
  email?: string;
}

export type TransportJobStatus = "queued" | "running" | "done" | "error" | "cancelled";

interface Notification {
  channel: string;
  payload?: string;
}

export interface AppKnowledgeNotificationClient {
  query(sql: string): Promise<unknown>;
  on(event: "notification", listener: (notification: Notification) => void): this;
  removeListener(event: "notification", listener: (notification: Notification) => void): this;
  release(): void;
}

export interface AppKnowledgeEvent {
  userId: number;
  featureKey: "app_knowledge";
  action: string;
  outcome: string;
  volume?: number;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface AppKnowledgeRouteDependencies {
  store: AppKnowledgeStore;
  canAccessApp(user: ApiUser, app: string): Promise<boolean>;
  resolveAppVersion(
    app: string,
    platform: string,
    version?: number,
    publishedOnly?: boolean,
  ): Promise<AppVersion | undefined>;
  createJob(type: string, payload?: Record<string, unknown>): Promise<number>;
  setJobStatus(jobId: number, status: TransportJobStatus, message?: string): Promise<unknown>;
  publishJob(job: Job): Promise<void>;
  providerModel: string;
  promptVersion: number;
  currentSourceSha256(target: AppKnowledgeTarget): Promise<string | undefined>;
  acquireNotificationClient(): Promise<AppKnowledgeNotificationClient>;
  recordEvent?(input: AppKnowledgeEvent): Promise<void>;
}

const PLATFORMS = new Set(["ios", "android", "web"]);
const ROLES = new Set(["designer", "developer", "product"]);
const REVIEW_STATUSES = new Set<AppKnowledgeReviewStatus>(["draft", "in_review", "approved"]);
const REVIEW_ACTIONS = new Set([
  "claim_edited",
  "claim_approved",
  "claim_rejected",
  "component_confirmed",
  "component_rejected",
  "token_confirmed",
  "token_rejected",
  "snapshot_submitted",
  "snapshot_approved",
]);
const TERMINAL_JOB_STATUSES = new Set(["done", "error", "cancelled", "stale"]);

function asyncRoute(
  handler: (req: express.Request, res: express.Response) => Promise<void>,
): express.RequestHandler {
  return (req, res) => {
    handler(req, res).catch(() => {
      if (res.headersSent) {
        res.end();
        return;
      }
      res.status(500).json({
        error: "App Knowledge request failed",
        code: "app_knowledge_unavailable",
      });
    });
  };
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

function positiveInteger(value: unknown): number | undefined {
  const parsed = typeof value === "string" && /^[1-9][0-9]*$/.test(value) ? Number(value) : value;
  return Number.isSafeInteger(parsed) && Number(parsed) > 0 ? Number(parsed) : undefined;
}

function boundedText(value: unknown, maximum: number, required = false): string | undefined {
  if (typeof value !== "string") return undefined;
  const result = value.trim();
  return ((!result && required) || result.length > maximum) ? undefined : result;
}

function platform(value: unknown): AppKnowledgeTarget["platform"] | undefined {
  return typeof value === "string" && PLATFORMS.has(value)
    ? value as AppKnowledgeTarget["platform"]
    : undefined;
}

function targetRequest(value: unknown): {
  app: string;
  platform: AppKnowledgeTarget["platform"];
  version?: number;
} | undefined {
  const body = exactBody(value, ["app", "platform", "version"]);
  const app = boundedText(body?.app, 160, true);
  const requestedPlatform = platform(body?.platform);
  const version = body?.version === undefined ? undefined : positiveInteger(body.version);
  if (!app || !requestedPlatform || (body?.version !== undefined && !version)) return undefined;
  return { app, platform: requestedPlatform, ...(version ? { version } : {}) };
}

function resolvedTarget(
  version: AppVersion,
  app: string,
  requestedPlatform: AppKnowledgeTarget["platform"],
): AppKnowledgeTarget | undefined {
  const appId = positiveInteger(version.app_id);
  const platformId = positiveInteger(version.platform_id);
  const captureVersionId = positiveInteger(version.id);
  const versionNumber = positiveInteger(version.version_number);
  if (
    !appId || !platformId || !captureVersionId || !versionNumber
    || version.app !== app || version.platform !== requestedPlatform
  ) return undefined;
  return {
    appId,
    app,
    platformId,
    platform: requestedPlatform,
    captureVersionId,
    versionNumber,
  };
}

function safeQueueMessage(): string {
  return "App Knowledge queue is unavailable";
}

function publicRevision(view: AppKnowledgeSnapshotView) {
  const revision = view.currentRevision;
  if (!revision || revision.reviewStatus !== "approved") return undefined;
  const { identity, coverage, ...knowledge } = revision.content;
  return {
    id: revision.id,
    revisionNumber: revision.revisionNumber,
    reviewStatus: revision.reviewStatus,
    createdAt: revision.createdAt,
    evidence: revision.manifest
      .filter(({ eligibility }) => eligibility !== "quarantined")
      .map(({ evidenceId, imageId, kind, flow }) => ({
        evidenceId,
        imageId,
        kind,
        ...(flow ? {
          flow: {
            id: flow.id,
            stepIndex: flow.stepIndex,
          },
        } : {}),
      })),
    content: {
      identity: {
        app: identity.app,
        platform: identity.platform,
        captureVersionId: identity.captureVersionId,
        generatedAt: identity.generatedAt,
      },
      coverage: {
        total: coverage.total,
        eligible: coverage.eligible,
        analyzed: coverage.analyzed,
        skipped: coverage.skipped,
        failed: coverage.failed,
        flowReferences: coverage.flowReferences,
      },
      ...knowledge,
    },
  };
}

function claims(snapshot: AppKnowledgeSnapshot) {
  const direct = [
    ...Object.values(snapshot.designLanguage).flat(),
    ...Object.values(snapshot.productKnowledge).flat(),
  ];
  return [
    ...direct,
    ...snapshot.screens.flatMap((screen) => screen.claims),
    ...snapshot.componentCandidates.flatMap((component) => component.claims),
    ...snapshot.flows.flatMap((flow) => [
      flow.userGoal,
      ...flow.actors,
      flow.entryPoint,
      flow.completionPoint,
      ...flow.effectivePatterns,
      ...flow.risks,
      ...flow.inconsistencies,
      ...flow.openQuestions,
      ...flow.steps.flatMap((step) => step.claims),
    ]),
  ];
}

function hasReviewEntity(
  snapshot: AppKnowledgeSnapshot,
  action: string,
  entityId: string,
): boolean {
  if (action === "snapshot_submitted" || action === "snapshot_approved") {
    return entityId === "snapshot";
  }
  if (action.startsWith("claim_")) {
    return claims(snapshot).some(({ id }) => id === entityId);
  }
  if (action.startsWith("component_")) {
    return snapshot.componentCandidates.some(({ id }) => id === entityId);
  }
  if (action.startsWith("token_")) {
    return Object.values(snapshot.designLanguage)
      .flat()
      .some(({ id }) => id === entityId);
  }
  return false;
}

function qualityDiagnostics(snapshot: AppKnowledgeSnapshot) {
  return {
    partialCoverage: snapshot.coverage.failed > 0,
    failedEvidenceCount: snapshot.coverage.failed,
    needsReviewScreenIds: snapshot.screens
      .filter(({ reviewStatus }) => reviewStatus === "needs_review")
      .map(({ id }) => id),
    candidateComponentIds: snapshot.componentCandidates
      .filter(({ status }) => status === "candidate")
      .map(({ id }) => id),
    lowConfidenceClaimIds: claims(snapshot)
      .filter(({ confidence }) => confidence < 0.7)
      .map(({ id }) => id),
  };
}

function hasPartialCoverageAcknowledgement(view: AppKnowledgeSnapshotView, revisionId: number): boolean {
  return view.reviewEvents.some((event) =>
    event.action === "partial_coverage_acknowledged"
    && (event.revisionId === undefined || event.revisionId === revisionId));
}

async function markQueueFailure(
  deps: AppKnowledgeRouteDependencies,
  durableJobId: number,
  transportJobId: number,
): Promise<void> {
  await Promise.all([
    deps.store.failJob(durableJobId, "queue_unavailable", safeQueueMessage()),
    deps.setJobStatus(transportJobId, "error", safeQueueMessage()),
  ]);
}

async function publishDurableJob(
  deps: AppKnowledgeRouteDependencies,
  durable: AppKnowledgeJobView,
  transportJobId: number,
): Promise<boolean> {
  try {
    await deps.publishJob({
      type: "generate-app-knowledge",
      runId: String(durable.id),
      jobId: transportJobId,
    });
    return true;
  } catch {
    await markQueueFailure(deps, durable.id, transportJobId);
    return false;
  }
}

export function mountAppKnowledgeRoutes(
  app: express.Express,
  requireAdmin: express.RequestHandler,
  deps: AppKnowledgeRouteDependencies,
): void {
  const audit = (
    res: express.Response,
    action: string,
    outcome: string,
    metadata?: AppKnowledgeEvent["metadata"],
  ) => deps.recordEvent?.({
    userId: res.locals.user.id,
    featureKey: "app_knowledge",
    action,
    outcome,
    ...(metadata ? { metadata } : {}),
  });

  app.get("/apps/:app/analysis", asyncRoute(async (req, res) => {
    const appName = boundedText(req.params.app, 160, true);
    const requestedPlatform = platform(req.query.platform);
    const requestedVersion = req.query.version === undefined
      ? undefined
      : positiveInteger(req.query.version);
    const role = req.query.role === undefined ? "designer" : req.query.role;
    if (
      !appName || !requestedPlatform || (req.query.version !== undefined && !requestedVersion)
      || typeof role !== "string" || !ROLES.has(role)
    ) {
      res.status(400).json({ error: "Invalid App Knowledge request", code: "invalid_request" });
      return;
    }
    if (!(await deps.canAccessApp(res.locals.user, appName))) {
      res.status(404).json({ error: "App Knowledge not found" });
      return;
    }
    const version = await deps.resolveAppVersion(
      appName,
      requestedPlatform,
      requestedVersion,
      res.locals.user.role !== "admin",
    );
    if (!version) {
      res.status(404).json({ error: "App Knowledge not found" });
      return;
    }
    if (res.locals.user.role === "admin") {
      const snapshotView = await deps.store.getAdminSnapshotForApp(
        appName,
        requestedPlatform,
        version.version_number,
      );
      if (!snapshotView) {
        res.status(404).json({ error: "App Knowledge not found" });
        return;
      }
      const current = snapshotView.currentRevision?.content;
      const currentSource = await deps.currentSourceSha256(snapshotView.target);
      res.json({
        snapshot: snapshotView,
        job: await deps.store.getLatestJobForSnapshot(snapshotView.id),
        coverage: current?.coverage ?? null,
        qualityDiagnostics: current ? {
          ...qualityDiagnostics(current),
          sourceChanged: !currentSource || currentSource !== current.identity.sourceSha256,
        } : null,
      });
      return;
    }
    const approved = await deps.store.getApprovedSnapshotForApp(
      appName,
      requestedPlatform,
      version.version_number,
    );
    const revision = approved && publicRevision(approved);
    if (!approved?.currentRevision || !revision) {
      res.status(404).json({ error: "App Knowledge not found" });
      return;
    }
    res.json({
      revision,
      projection: projectAppKnowledge(
        approved.currentRevision.content,
        role as "designer" | "developer" | "product",
      ),
    });
  }));

  app.post("/app-knowledge/jobs", requireAdmin, asyncRoute(async (req, res) => {
    const request = targetRequest(req.body);
    if (!request) {
      res.status(400).json({ error: "Invalid App Knowledge request", code: "invalid_request" });
      return;
    }
    if (!deps.providerModel.trim() || !positiveInteger(deps.promptVersion)) {
      res.status(503).json({
        error: "App Knowledge provider is not configured",
        code: "provider_unavailable",
      });
      return;
    }
    if (!(await deps.canAccessApp(res.locals.user, request.app))) {
      res.status(404).json({ error: "App capture version not found" });
      return;
    }
    const version = await deps.resolveAppVersion(
      request.app,
      request.platform,
      request.version,
      false,
    );
    const target = version && resolvedTarget(version, request.app, request.platform);
    if (!target) {
      res.status(404).json({ error: "App capture version not found" });
      return;
    }
    const transportJobId = await deps.createJob("generate-app-knowledge", {});
    let durable: AppKnowledgeJobView;
    try {
      durable = await deps.store.createJob(
        res.locals.user.id,
        target,
        transportJobId,
        deps.providerModel,
        deps.promptVersion,
      );
    } catch (error) {
      await deps.setJobStatus(
        transportJobId,
        "error",
        error instanceof ActiveAppKnowledgeJobError
          ? "An App Knowledge job is already active"
          : "App Knowledge job could not be created",
      );
      if (error instanceof ActiveAppKnowledgeJobError) {
        res.status(409).json({
          error: "An App Knowledge job is already active",
          code: "active_job_exists",
        });
        return;
      }
      throw error;
    }
    if (!(await publishDurableJob(deps, durable, transportJobId))) {
      await audit(res, "app_knowledge_generation_requested", "failed");
      res.status(503).json({ error: safeQueueMessage(), code: "queue_unavailable" });
      return;
    }
    await audit(res, "app_knowledge_generation_requested", "created", {
      app: target.app,
      platform: target.platform,
      version: target.versionNumber,
    });
    res.status(201).json(durable);
  }));

  app.get("/app-knowledge/jobs/:jobId", requireAdmin, asyncRoute(async (req, res) => {
    const jobId = positiveInteger(req.params.jobId);
    if (!jobId) {
      res.status(400).json({ error: "Invalid App Knowledge job", code: "invalid_request" });
      return;
    }
    const job = await deps.store.getJob(jobId);
    if (!job) {
      res.status(404).json({ error: "App Knowledge job not found" });
      return;
    }
    res.json(job);
  }));

  app.post("/app-knowledge/jobs/:jobId/cancel", requireAdmin, asyncRoute(async (req, res) => {
    const jobId = positiveInteger(req.params.jobId);
    if (!jobId || !exactBody(req.body ?? {}, [])) {
      res.status(400).json({ error: "Invalid cancellation", code: "invalid_request" });
      return;
    }
    const job = await deps.store.requestCancel(jobId);
    if (!job) {
      res.status(409).json({ error: "App Knowledge job cannot be cancelled", code: "job_not_cancellable" });
      return;
    }
    await audit(res, "app_knowledge_job_cancelled", "completed", { jobId });
    res.json(job);
  }));

  const republish = (
    mode: "resume" | "retry",
  ): express.RequestHandler => asyncRoute(async (req, res) => {
    const jobId = positiveInteger(req.params.jobId);
    if (!jobId || !exactBody(req.body ?? {}, [])) {
      res.status(400).json({ error: "Invalid App Knowledge retry", code: "invalid_request" });
      return;
    }
    if (!(await deps.store.getJob(jobId))) {
      res.status(404).json({ error: "App Knowledge job not found" });
      return;
    }
    const transportJobId = await deps.createJob("generate-app-knowledge", {});
    const updated = mode === "resume"
      ? await deps.store.resumeJob(jobId, transportJobId)
      : await deps.store.retryFailedEvidence(jobId, transportJobId);
    if (!updated) {
      await deps.setJobStatus(transportJobId, "error", "App Knowledge job cannot be retried");
      res.status(409).json({
        error: "App Knowledge job cannot be retried",
        code: "job_not_retryable",
      });
      return;
    }
    if (!(await publishDurableJob(deps, updated, transportJobId))) {
      res.status(503).json({ error: safeQueueMessage(), code: "queue_unavailable" });
      return;
    }
    await audit(res, `app_knowledge_job_${mode}`, "created", { jobId });
    res.status(202).json(updated);
  });

  app.post("/app-knowledge/jobs/:jobId/resume", requireAdmin, republish("resume"));
  app.post(
    "/app-knowledge/jobs/:jobId/retry-failed-evidence",
    requireAdmin,
    republish("retry"),
  );

  app.post(
    "/app-knowledge/snapshots/:snapshotId/regenerations",
    requireAdmin,
    asyncRoute(async (req, res) => {
      const snapshotId = positiveInteger(req.params.snapshotId);
      if (!snapshotId || !exactBody(req.body ?? {}, [])) {
        res.status(400).json({ error: "Invalid regeneration", code: "invalid_request" });
        return;
      }
      if (!deps.providerModel.trim() || !positiveInteger(deps.promptVersion)) {
        res.status(503).json({
          error: "App Knowledge provider is not configured",
          code: "provider_unavailable",
        });
        return;
      }
      const existing = await deps.store.getAdminSnapshot(snapshotId);
      if (!existing) {
        res.status(404).json({ error: "App Knowledge snapshot not found" });
        return;
      }
      const transportJobId = await deps.createJob("generate-app-knowledge", {});
      let durable: AppKnowledgeJobView;
      try {
        durable = await deps.store.createJob(
          res.locals.user.id,
          existing.target,
          transportJobId,
          deps.providerModel,
          deps.promptVersion,
        );
      } catch (error) {
        await deps.setJobStatus(transportJobId, "error", "App Knowledge regeneration unavailable");
        if (error instanceof ActiveAppKnowledgeJobError) {
          res.status(409).json({
            error: "An App Knowledge job is already active",
            code: "active_job_exists",
          });
          return;
        }
        throw error;
      }
      if (!(await publishDurableJob(deps, durable, transportJobId))) {
        res.status(503).json({ error: safeQueueMessage(), code: "queue_unavailable" });
        return;
      }
      res.status(202).json(durable);
    }),
  );

  app.patch(
    "/app-knowledge/snapshots/:snapshotId/revisions",
    requireAdmin,
    asyncRoute(async (req, res) => {
      const snapshotId = positiveInteger(req.params.snapshotId);
      const body = exactBody(req.body, ["revisionId", "content"]);
      const revisionId = positiveInteger(body?.revisionId);
      if (!snapshotId || !revisionId || !record(body?.content)) {
        res.status(400).json({ error: "Invalid App Knowledge revision", code: "invalid_request" });
        return;
      }
      try {
        const revision = await deps.store.saveRevision(
          snapshotId,
          revisionId,
          body!.content as unknown as AppKnowledgeSnapshot,
          res.locals.user.id,
        );
        await audit(res, "app_knowledge_revision_saved", "created", { snapshotId });
        res.status(201).json(revision);
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (/not found/i.test(message)) {
          res.status(404).json({ error: "App Knowledge revision not found" });
          return;
        }
        if (/approved revision cannot be edited/i.test(message)) {
          res.status(409).json({
            error: "Approved App Knowledge revisions are immutable",
            code: "approved_revision_immutable",
          });
          return;
        }
        if (/identity|must|invalid|duplicate|evidence/i.test(message)) {
          res.status(400).json({ error: "Invalid App Knowledge revision", code: "invalid_revision" });
          return;
        }
        throw error;
      }
    }),
  );

  app.post(
    "/app-knowledge/snapshots/:snapshotId/review-actions",
    requireAdmin,
    asyncRoute(async (req, res) => {
      const snapshotId = positiveInteger(req.params.snapshotId);
      const body = exactBody(req.body, ["revisionId", "action", "entityId"]);
      const revisionId = positiveInteger(body?.revisionId);
      const action = boundedText(body?.action, 80, true);
      const entityId = boundedText(body?.entityId, 240, true);
      if (!snapshotId || !revisionId || !action || !entityId || !REVIEW_ACTIONS.has(action)) {
        res.status(400).json({ error: "Invalid review action", code: "invalid_request" });
        return;
      }
      const view = await deps.store.getAdminSnapshot(snapshotId);
      const revision = view?.revisions.find(({ id }) => id === revisionId);
      if (!revision) {
        res.status(404).json({ error: "App Knowledge revision not found" });
        return;
      }
      if (!hasReviewEntity(revision.content, action, entityId)) {
        res.status(400).json({ error: "Invalid review entity", code: "invalid_review_entity" });
        return;
      }
      const event = await deps.store.recordReviewEvent({
        snapshotId,
        revisionId,
        userId: res.locals.user.id,
        action,
        details: { entityId },
      });
      await audit(res, `app_knowledge_${action}`, "completed", { snapshotId });
      res.status(201).json(event);
    }),
  );

  app.post(
    "/app-knowledge/snapshots/:snapshotId/coverage-acknowledgements",
    requireAdmin,
    asyncRoute(async (req, res) => {
      const snapshotId = positiveInteger(req.params.snapshotId);
      const body = exactBody(req.body, ["revisionId", "note"]);
      const revisionId = positiveInteger(body?.revisionId);
      const note = body?.note === undefined ? "" : boundedText(body.note, 1_000);
      if (!snapshotId || !revisionId || note === undefined) {
        res.status(400).json({ error: "Invalid coverage acknowledgement", code: "invalid_request" });
        return;
      }
      const view = await deps.store.getAdminSnapshot(snapshotId);
      const revision = view?.revisions.find(({ id }) => id === revisionId);
      if (!view || !revision || revision.content.coverage.failed < 1) {
        res.status(409).json({
          error: "Partial coverage acknowledgement is not required",
          code: "coverage_acknowledgement_not_required",
        });
        return;
      }
      const event = await deps.store.recordReviewEvent({
        snapshotId,
        revisionId,
        userId: res.locals.user.id,
        action: "partial_coverage_acknowledged",
        details: note ? { note } : {},
      });
      res.status(201).json(event);
    }),
  );

  app.post(
    "/app-knowledge/snapshots/:snapshotId/review-status",
    requireAdmin,
    asyncRoute(async (req, res) => {
      const snapshotId = positiveInteger(req.params.snapshotId);
      const body = exactBody(req.body, ["revisionId", "status"]);
      const revisionId = positiveInteger(body?.revisionId);
      const status = body?.status as AppKnowledgeReviewStatus;
      if (!snapshotId || !revisionId || !REVIEW_STATUSES.has(status)) {
        res.status(400).json({ error: "Invalid review transition", code: "invalid_request" });
        return;
      }
      const view = await deps.store.getAdminSnapshot(snapshotId);
      const revision = view?.revisions.find(({ id }) => id === revisionId);
      if (!view || !revision) {
        res.status(404).json({ error: "App Knowledge revision not found" });
        return;
      }
      if (status === "approved") {
        const currentSha = await deps.currentSourceSha256(view.target);
        if (!currentSha || currentSha !== revision.sourceSha256) {
          res.status(409).json({
            error: "The App capture source changed",
            code: "source_changed",
          });
          return;
        }
        if (
          revision.content.coverage.failed > 0
          && !hasPartialCoverageAcknowledgement(view, revisionId)
        ) {
          res.status(409).json({
            error: "Partial evidence coverage requires review",
            code: "coverage_review_required",
          });
          return;
        }
      }
      try {
        const updated = await deps.store.setReviewStatus(
          snapshotId,
          revisionId,
          status,
          res.locals.user.id,
        );
        await audit(res, "app_knowledge_review_transition", "completed", {
          snapshotId,
          revisionId,
          status,
        });
        res.json(updated);
      } catch (error) {
        if (error instanceof Error && /review transition|review status/i.test(error.message)) {
          res.status(409).json({
            error: "Invalid review transition",
            code: "invalid_review_transition",
          });
          return;
        }
        throw error;
      }
    }),
  );

  app.get(
    "/app-knowledge/jobs/:jobId/events",
    requireAdmin,
    asyncRoute(async (req, res) => {
      const jobId = positiveInteger(req.params.jobId);
      if (!jobId) {
        res.status(400).json({ error: "Invalid App Knowledge job", code: "invalid_request" });
        return;
      }
      let client: AppKnowledgeNotificationClient | undefined;
      try {
        client = await deps.acquireNotificationClient();
        await client.query("LISTEN app_knowledge_jobs");
      } catch {
        client?.release();
        res.status(503).json({
          error: "App Knowledge progress is unavailable",
          code: "progress_unavailable",
        });
        return;
      }
      if (!client) return;
      let pending = false;
      let ready = false;
      let closed = false;
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      const close = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        client.removeListener("notification", notification);
        client.query("UNLISTEN app_knowledge_jobs").catch(() => {});
        client.release();
      };
      const send = (value: AppKnowledgeJobView) => {
        if (res.writableEnded) return;
        res.write(`event: app-knowledge-progress\ndata: ${JSON.stringify(value)}\n\n`);
        if (TERMINAL_JOB_STATUSES.has(value.status)) {
          res.end();
          close();
        }
      };
      const notification = (notice: Notification) => {
        if (notice.channel !== "app_knowledge_jobs" || notice.payload !== String(jobId)) return;
        if (!ready) {
          pending = true;
          return;
        }
        deps.store.getJob(jobId).then((current) => {
          if (current) send(current);
        }).catch(() => {});
      };
      client.on("notification", notification);
      const initial = await deps.store.getJob(jobId);
      if (!initial) {
        close();
        res.status(404).json({ error: "App Knowledge job not found" });
        return;
      }
      res.status(200);
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();
      send(initial);
      ready = true;
      if (pending && !closed) {
        pending = false;
        const current = await deps.store.getJob(jobId);
        if (current) send(current);
      }
      if (!closed) {
        heartbeat = setInterval(() => {
          if (!res.writableEnded) res.write(": heartbeat\n\n");
        }, 25_000);
        req.once("close", close);
      }
    }),
  );
}
