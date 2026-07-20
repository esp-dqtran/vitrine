import express from "express";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  query,
  allImages,
  adminAppPage,
  createJob,
  listJobs,
  getJob,
  setJobStatus,
  getDesignSystem,
  listDesignSystems,
  appImages,
  appPlatforms,
  getAppFlows,
  getFlowDocument,
  saveFlowDocument,
  saveDesignSystem,
  saveAppFlows,
  listAppFlowSets,
  createCollection,
  listCollections,
  addCollectionItem,
  updateCollectionItemNotes,
  removeCollectionItem,
  deleteCollection,
  createAppVersion,
  ensureActiveAppVersion,
  listAppVersions,
  getVersionPublicationBlockers,
  submitAppVersionForReview,
  publishAppVersion,
  getVersionDesignSystem,
  versionImages,
  publishedImages,
  publishedPreviewImages,
  listPublishedDesignSystems,
  listPublishedFlowSets,
  appMetadata,
  appEvidencePage,
  getVersionFlows,
  flowEvidenceImages,
} from "../../../src/db.ts";
import {
  authenticateUser,
  changePassword,
  createSession,
  deleteSession,
  registerUser,
  resolveSession,
  resolveSessionState,
} from "../../../src/authStore.ts";
import { getDailySignups, getGrowthStats } from "../../../src/adminStats.ts";
import {
  ADMIN_USER_FILTERS,
  listAdminUsersPage,
  setAdminUserActive,
  type AdminUserFilter,
} from "../../../src/adminUsers.ts";
import {
  getFeatureUsageOverview,
  getUserFeatureUsage,
  parseUsageRange,
} from "../../../src/featureUsage.ts";
import { parseJob, publishJob, type Job, type ResearchProvider } from "../../../src/queue.ts";
import { isPlatform, platformFromUrl, type Platform } from "../../../src/platformFromUrl.ts";
import { readProgress, requestCancel, subscribeProgress } from "../../../src/progress.ts";
import { bulkImageHash, findBulkImage, isAppSlug, legacyRefSuffix, parseImageSource, publicImageUrl } from "../../../src/imageSource.ts";
import { hydrateDesignSystem } from "../../../src/designSystem.ts";
import { buildAdminGalleryApps, buildAppMetadata, buildCatalogPage, buildEvidencePage, buildGalleryApps } from "../../../src/gallery.ts";
import {
  authorizedExportObject,
  canAccessApp,
  completeExport,
  createExport,
  failExport,
  getAccountEntitlements,
  recordAccessEvent,
  reserveExportOperation,
  unlockFreeApp,
} from "../../../src/pricingStore.ts";
import { createMediaToken, verifyMediaToken } from "../../../src/mediaToken.ts";
import type { BillingService } from "./billing.ts";
import { createDistinctValueLimiter, createFixedWindowLimiter, ipPrefix } from "./rateLimit.ts";
import { buildComparison, searchCatalog, type CatalogEntityKind } from "../../../src/catalogResearch.ts";
import { buildExportArtifact, type ExportFormat, type ExportScope } from "../../../src/exportEngine.ts";
import { applyCuratorAction, type CuratorAction } from "../../../src/curatorReview.ts";
import { exportObjectKey, type ObjectMetadata, type ObjectStore, type StoredContentType } from "../../../src/objectStore.ts";
import { verifyObjectStoreReady } from "../../../src/objectStorageReady.ts";
import {
  adminImageObject,
  crawlFailureObject,
  entitledImageObject,
  imageObjectById,
  legacyImageReference,
  publishedPreviewObject,
} from "../../../src/objectStoreDb.ts";
import { parseCrawlPlan, parseCrawlStep } from "../../../src/crawlPlan.ts";
import { buildRepairPrompt, extractJson } from "../../../src/appResearch.ts";
import { startChatSession } from "../../../src/llmChat.ts";
import { createCrawlRunService } from "../../../src/crawlRun.ts";
import {
  approvePlan as approveCrawlPlan,
  applyRepair as applyCrawlRepair,
  getPlan as getCrawlPlan,
  getRun as getCrawlRun,
  listPlans as listCrawlPlans,
  listRunEvidence as listCrawlRunEvidence,
  listRunRepairs as listCrawlRunRepairs,
  listRuns as listCrawlRuns,
  listRunSteps as listCrawlRunSteps,
  markQueuedRunInterrupted as markQueuedCrawlRunInterrupted,
  proposeRepair,
  rejectRepair as rejectCrawlRepair,
  saveDraftPlan as saveCrawlPlan,
  type CrawlPlanRecord,
  type CrawlEvidenceRecord,
  type CrawlRepairRecord,
  type CrawlRunStepRecord,
} from "../../../src/crawlStore.ts";
import type { StepActual, StepFailure } from "../../../src/smartCrawler.ts";
import { createAutonomousStore } from "../../../src/autonomousStore.ts";
import { encryptStorageState, type StorageState } from "../../../src/crawlSession.ts";
import { createResearchProjectStore } from "../../../src/researchProjectStore.ts";
import { createOrganizationStore } from "../../../src/organizationStore.ts";
import { createResearchSynthesisProvider } from "../../../src/researchSynthesisProvider.ts";
import type { ResearchSuggestionCandidate } from "../../../src/researchSuggestions.ts";
import { mountResearchProjectRoutes } from "./researchProjects.ts";
import { mountOrganizationRoutes } from "./organizations.ts";
import { canonicalMobbinSitesUrl } from "../../../src/sites.ts";
import { publishSitesJob } from "../../../src/sitesQueue.ts";
import { createSitesStore } from "../../../src/sitesStore.ts";
import { mountSitesRoutes } from "./sites.ts";

const JOB_TYPES = ["discover-catalog", "import-app", "caption-app", "synthesize-app", "import-site"] as const;
export const DEFAULT_API_PORT = 3010;
const disabledBilling: BillingService = {
  createCheckout: async () => { throw new Error("Billing is not configured"); },
  createPortal: async () => { throw new Error("Billing is not configured"); },
  handleWebhook: async () => { throw new Error("Billing is not configured"); },
};
const apiCrawlRunService = createCrawlRunService({ workerId: "api" });
const apiAutonomousStore = createAutonomousStore();
const apiSitesStore = createSitesStore();

type RepairProvider = ResearchProvider;
interface CrawlRepairRequest {
  runId: string;
  flowId: string;
  stepId: string;
  provider: RepairProvider;
}

interface CrawlRepairRequesterDependencies {
  getRun: typeof getCrawlRun;
  getPlan: typeof getCrawlPlan;
  listRunSteps: typeof listCrawlRunSteps;
  crawlFailureObject: typeof crawlFailureObject;
  objectStore?: ObjectStore;
  startChatSession: typeof startChatSession;
  proposeRepair: typeof proposeRepair;
}

const crawlRepairRequesterDefaults: CrawlRepairRequesterDependencies = {
  getRun: getCrawlRun,
  getPlan: getCrawlPlan,
  listRunSteps: listCrawlRunSteps,
  crawlFailureObject,
  startChatSession,
  proposeRepair,
};

export function createCrawlRepairRequester(overrides: Partial<CrawlRepairRequesterDependencies> = {}) {
  const dependencies = { ...crawlRepairRequesterDefaults, ...overrides };
  return async function requestCrawlRepair(input: CrawlRepairRequest): Promise<CrawlRepairRecord> {
    const [run, steps] = await Promise.all([
      dependencies.getRun(input.runId),
      dependencies.listRunSteps(input.runId),
    ]);
    if (!run) throw new Error("Crawl run not found");
    if (run.run_kind !== "planned" || !run.plan_id) throw new Error("Only planned crawl runs can be repaired");
    const planRecord = await dependencies.getPlan(run.plan_id);
    if (!planRecord) throw new Error("Pinned crawl plan not found");
    const flow = planRecord.plan.flows.find(({ id }) => id === input.flowId);
    const stepIndex = flow?.steps.findIndex(({ id }) => id === input.stepId) ?? -1;
    const step = stepIndex >= 0 ? flow!.steps[stepIndex] : undefined;
    const failureRow = steps.find((candidate) =>
      candidate.flow_id === input.flowId && candidate.step_id === input.stepId && candidate.status === "failed"
    );
    if (!flow || !step || !failureRow) throw new Error("A failed crawl step is required for repair");

    const failure: StepFailure = {
      flow: flow.id,
      flowTitle: flow.title,
      stepIndex,
      stepId: step.id,
      step,
      ...(step.role ? { locator: { role: step.role, name: step.name } }
        : step.text ? { locator: { text: step.text } }
          : step.css ? { locator: { css: step.css } } : {}),
      currentUrl: failureRow.final_url ?? failureRow.source_url ?? planRecord.plan.startUrl,
      expected: step.expected,
      actual: failureRow.actual as StepActual | undefined,
      errorClass: failureRow.error_class ?? "CrawlStepError",
      error: failureRow.error_message ?? "Crawl step failed",
      screenshot: failureRow.failure_object_key ?? "",
    };
    const session = await dependencies.startChatSession(input.provider);
    try {
      let attachment: Parameters<typeof session.ask>[1];
      if (dependencies.objectStore) {
        const metadata = await dependencies.crawlFailureObject({
          runId: String(run.id),
          flowId: flow.id,
          stepId: step.id,
        });
        if (metadata) {
          attachment = {
            name: "crawl-failure.png",
            mimeType: metadata.contentType,
            buffer: verifiedObjectBody(metadata, await dependencies.objectStore.get(metadata.key)),
          };
        }
      }
      const reply = await session.ask(buildRepairPrompt(failure, flow.steps), attachment);
      const proposedStep = parseCrawlStep(JSON.parse(extractJson(reply)));
      return await dependencies.proposeRepair({
        planId: run.plan_id,
        runId: run.id,
        flowId: flow.id,
        stepId: step.id,
        proposedStep,
        failure: { ...failure, screenshot: attachment ? "attached" : "" },
        provider: input.provider,
      });
    } finally {
      await session.close();
    }
  };
}

const requestCrawlRepair = createCrawlRepairRequester();

const defaults = {
  query,
  allImages,
  adminAppPage,
  createJob,
  listJobs,
  getJob,
  setJobStatus,
  getDesignSystem,
  listDesignSystems,
  appImages,
  appPlatforms,
  getAppFlows,
  getFlowDocument,
  saveFlowDocument,
  saveDesignSystem,
  saveAppFlows,
  listAppFlowSets,
  createCollection,
  listCollections,
  addCollectionItem,
  updateCollectionItemNotes,
  removeCollectionItem,
  deleteCollection,
  createAppVersion,
  listAppVersions,
  getVersionPublicationBlockers,
  submitAppVersionForReview,
  publishAppVersion,
  getVersionDesignSystem,
  versionImages,
  publishedImages,
  publishedPreviewImages,
  listPublishedDesignSystems,
  listPublishedFlowSets,
  appMetadata,
  appEvidencePage,
  getVersionFlows,
  flowEvidenceImages,
  createExport,
  completeExport,
  failExport,
  authorizedExportObject,
  publishJob,
  publishSitesJob,
  readProgress,
  subscribeProgress,
  requestCancel,
  listCrawlPlans,
  getCrawlPlan,
  saveCrawlPlan,
  approveCrawlPlan,
  createCrawlRun: apiCrawlRunService.create,
  listCrawlRuns,
  getCrawlRun,
  listCrawlRunSteps,
  listCrawlRunEvidence,
  listCrawlRunRepairs,
  cancelCrawlRun: apiCrawlRunService.cancel,
  retryCrawlRun: apiCrawlRunService.retry,
  markQueuedCrawlRunInterrupted,
  ensureActiveAppVersion,
  createAutonomousRun: apiAutonomousStore.createAutonomousRun,
  getAutonomousRun: apiAutonomousStore.autonomousRunDetail,
  pauseAutonomousRun: apiAutonomousStore.requestPause,
  resumeAutonomousRun: apiAutonomousStore.clearPause,
  cancelAutonomousRun: apiAutonomousStore.cancelRun,
  markAutonomousRunInterrupted: apiAutonomousStore.markInterrupted,
  saveCrawlAccountSession: apiAutonomousStore.saveAccountSession,
  getCrawlAccountSession: apiAutonomousStore.accountSession,
  crawlSessionEncryptionKey: process.env.CRAWL_SESSION_ENCRYPTION_KEY,
  requestCrawlRepair,
  applyCrawlRepair,
  rejectCrawlRepair,
  isCrawlSecretConfigured: (name: string) => typeof process.env[name] === "string" && process.env[name]!.length > 0,
  authenticateUser,
  registerUser,
  changePassword,
  createSession,
  resolveSession,
  resolveSessionState,
  deleteSession,
  canAccessApp,
  unlockFreeApp,
  getAccountEntitlements,
  recordAccessEvent,
  reserveExportOperation,
  listAdminUsersPage,
  setAdminUserActive,
  getFeatureUsageOverview,
  getUserFeatureUsage,
  getGrowthStats,
  getDailySignups,
  billing: disabledBilling,
  generalRateLimit: 300,
  mediaRateLimit: 500,
  appTraversalLimit: 20,
  mediaSigningSecret: process.env.MEDIA_SIGNING_SECRET ?? "development-media-signing-secret",
  nowSeconds: () => Math.floor(Date.now() / 1000),
  dataDir: process.env.DATA_DIR ?? "data",
  objectStore: undefined as ObjectStore | undefined,
  storageReady: undefined as (() => Promise<void>) | undefined,
  adminImageObject,
  crawlFailureObject,
  entitledImageObject,
  legacyImageReference,
  publishedPreviewObject,
  imageObjectById,
  researchProjectStore: createResearchProjectStore(),
  researchSynthesisProvider: createResearchSynthesisProvider(),
  researchProjectsEnabled: process.env.RESEARCH_PROJECTS_ENABLED === "true",
  organizationStore: createOrganizationStore(),
  organizationsEnabled: process.env.TEAMS_ENABLED === "true",
  listResearchCandidates: undefined as ((userId: number) => Promise<ResearchSuggestionCandidate[]>) | undefined,
  sitesStore: apiSitesStore,
};
type ApiDeps = typeof defaults;

type ExportSelection = ExportScope;

function parseExportSelection(value: unknown): ExportSelection | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const body = value as Record<string, unknown>;
  if (body.kind === "design-system") return { kind: "design-system" };
  if (body.kind === "screens") {
    if (!Array.isArray(body.ids) || body.ids.length < 1 || body.ids.length > 10) return undefined;
    if (!body.ids.every((id) => Number.isInteger(id) && Number(id) > 0)) return undefined;
    const ids = body.ids as number[];
    return new Set(ids).size === ids.length ? { kind: "screens", ids } : undefined;
  }
  if (body.kind === "component-family" || body.kind === "foundation-category") {
    return typeof body.id === "string" && body.id.trim()
      ? { kind: body.kind, id: body.id.trim() }
      : undefined;
  }
  if (body.kind === "selected") {
    if (!Array.isArray(body.componentIds) || !Array.isArray(body.screenIds)) return undefined;
    if (!body.componentIds.every((id) => typeof id === "string" && id.trim()) || !body.screenIds.every((id) => Number.isInteger(id) && Number(id) > 0)) return undefined;
    const componentIds = [...new Set(body.componentIds as string[])];
    const screenIds = [...new Set(body.screenIds as number[])];
    if (componentIds.length + screenIds.length < 1 || componentIds.length + screenIds.length > 20) return undefined;
    return { kind: "selected", componentIds, screenIds };
  }
  return undefined;
}

const catalogKinds = new Set<CatalogEntityKind>(["app", "screen", "component", "token", "flow", "pattern"]);
const collectionKinds = new Set(["app", "screen", "component", "token", "flow", "pattern"] as const);
const exportFormats = new Set<ExportFormat>(["figma", "json", "css", "tailwind", "component-spec", "react", "design-md", "flow-md"]);
const exportStorageTypes = new Map<string, { contentType: StoredContentType; extension: string }>([
  ["application/zip", { contentType: "application/zip", extension: "zip" }],
  ["application/json", { contentType: "application/json", extension: "json" }],
  ["text/css", { contentType: "text/css", extension: "css" }],
  ["text/javascript", { contentType: "text/javascript", extension: "js" }],
  ["text/typescript", { contentType: "text/typescript", extension: "tsx" }],
  ["text/markdown", { contentType: "text/markdown", extension: "md" }],
]);
const crawlPlanStatuses = new Set(["draft", "approved", "superseded"]);
const crawlRunStatuses = new Set(["queued", "running", "succeeded", "failed", "cancelled", "interrupted"]);
const repairProviders = new Set<RepairProvider>(["chatgpt", "claude"]);
const BIGINT_MAX = 9_223_372_036_854_775_807n;

function optionalQuery(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function platformQuery(value: unknown): Platform | undefined {
  return typeof value === "string" && isPlatform(value) ? value : undefined;
}

function positiveId(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function crawlId(value: string): string | undefined {
  if (!/^[1-9]\d*$/.test(value)) return undefined;
  try {
    return BigInt(value) <= BIGINT_MAX ? value : undefined;
  } catch {
    return undefined;
  }
}

function crawlIdentifier(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const parsed = value.trim();
  return parsed.length <= 120 && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(parsed) ? parsed : undefined;
}

function publicHttpUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2_000) return undefined;
  try {
    const normalized = new URL(value).toString();
    const parsed = parseJob({ type: "research-app", name: "url-check", homepageUrl: normalized });
    return parsed.type === "research-app" ? parsed.homepageUrl : undefined;
  } catch {
    return undefined;
  }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function boundedInteger(value: unknown, minimum: number, maximum: number): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum ? value : undefined;
}

function safeSessionView(session: { id: string; state_version: number; updated_at: Date }): { id: string; stateVersion: number; updatedAt: Date } {
  return { id: session.id, stateVersion: session.state_version, updatedAt: session.updated_at };
}

function exactBody(value: unknown, allowed: readonly string[]): Record<string, unknown> | undefined {
  const body = record(value);
  if (!body || Object.keys(body).some((key) => !allowed.includes(key))) return undefined;
  return body;
}

function crawlEnvironment(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined) return {};
  const environment = exactBody(value, ["headless", "browserName", "locale", "timezone", "viewport"]);
  if (!environment) return undefined;
  if (environment.headless !== undefined && typeof environment.headless !== "boolean") return undefined;
  if (environment.browserName !== undefined && environment.browserName !== "chromium") return undefined;
  for (const key of ["locale", "timezone"] as const) {
    if (environment[key] !== undefined
      && (typeof environment[key] !== "string" || !environment[key].trim() || environment[key].length > 100)) return undefined;
  }
  if (environment.viewport !== undefined) {
    const viewport = exactBody(environment.viewport, ["width", "height"]);
    if (!viewport
      || !Number.isInteger(viewport.width) || Number(viewport.width) < 1 || Number(viewport.width) > 10_000
      || !Number.isInteger(viewport.height) || Number(viewport.height) < 1 || Number(viewport.height) > 10_000) return undefined;
  }
  return environment;
}

function publicPlanBody(value: unknown): ReturnType<typeof parseCrawlPlan> {
  const plan = parseCrawlPlan(JSON.stringify(value));
  if (!isAppSlug(plan.app)
    || !publicHttpUrl(plan.startUrl)
    || plan.sources.some((source) => !publicHttpUrl(source))) {
    throw new Error("Crawl plan URLs must be public HTTP(S) URLs");
  }
  return plan;
}

function crawlPlanView(
  plan: CrawlPlanRecord,
  configured: (name: string) => boolean,
): CrawlPlanRecord & { requiredSecrets: Array<{ name: string; configured: boolean }> } {
  const names = [...new Set(plan.plan.flows.flatMap((flow) => flow.requiredSecrets))].sort();
  return {
    ...plan,
    requiredSecrets: names.map((name) => ({ name, configured: configured(name) })),
  };
}

function crawlStepView(runId: string, step: CrawlRunStepRecord): Omit<CrawlRunStepRecord, "failure_screenshot" | "failure_object_key"> & {
  failureScreenshotUrl?: string;
} {
  const { failure_screenshot, failure_object_key, ...view } = step;
  return {
    ...view,
    ...(failure_object_key
      ? { failureScreenshotUrl: `/api/crawl/runs/${runId}/failures/${encodeURIComponent(step.flow_id)}/${encodeURIComponent(step.step_id)}/screenshot` }
      : {}),
  };
}

function crawlEvidenceView(app: string, evidence: CrawlEvidenceRecord): CrawlEvidenceRecord & { imageUrl?: string } {
  const hash = /^[0-9a-f]{64}$/.test(evidence.screenshot_hash)
    ? evidence.screenshot_hash.slice(0, 16)
    : undefined;
  return {
    ...evidence,
    ...(hash ? { imageUrl: `/api/media/${app}/${hash}` } : {}),
  };
}

function crawlRepairView(repair: CrawlRepairRecord): CrawlRepairRecord {
  const failure = { ...repair.failure };
  delete failure.screenshot;
  delete failure.failureScreenshot;
  delete failure.failure_screenshot;
  return { ...repair, failure };
}

function boundedText(value: unknown, max: number, required = false): string | undefined {
  if (typeof value !== "string") return required ? undefined : "";
  const parsed = value.trim();
  if ((required && !parsed) || parsed.length > max) return undefined;
  return parsed;
}

const SESSION_COOKIE = "astryx_session";
const cookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

function cookieValue(header: string | undefined, name: string): string | undefined {
  for (const pair of header?.split(";") ?? []) {
    const [key, ...value] = pair.trim().split("=");
    if (key === name) {
      try {
        return decodeURIComponent(value.join("="));
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

function validMobbinScreensUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "mobbin.com" || url.hostname === "www.mobbin.com") &&
      /^\/apps\/[^/]+\/[^/]+\/screens\/?$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

function sameObjectMetadata(left: ObjectMetadata, right: ObjectMetadata): boolean {
  return left.key === right.key && left.sha256 === right.sha256 && left.byteSize === right.byteSize
    && left.contentType === right.contentType && left.accessClass === right.accessClass;
}

async function sendStoredObject(
  store: ObjectStore,
  metadata: ObjectMetadata,
  res: express.Response,
): Promise<void> {
  res.setHeader("Content-Type", metadata.contentType);
  res.setHeader("X-Content-Type-Options", "nosniff");
  // 300s is S3ObjectStore's own hard ceiling on presigned URL lifetime (a deliberate security
  // limit, not just a default) — matching it here lets the redirect itself be cached for
  // nearly that long. Content is immutable per hash, so repeat views/reloads within the
  // window reuse the cached redirect instead of re-signing and re-fetching from scratch.
  const signed = metadata.accessClass === "internal" ? undefined : await store.signedGetUrl(metadata.key, 300);
  if (signed) {
    res.setHeader("Cache-Control", "private, max-age=280");
    res.status(302).setHeader("Location", signed).end();
    return;
  }
  const object = await store.get(metadata.key);
  verifiedObjectBody(metadata, object);
  res.send(object.body);
}

function verifiedObjectBody(
  expected: ObjectMetadata,
  object: Awaited<ReturnType<ObjectStore["get"]>>,
): Buffer {
  if (
    !sameObjectMetadata(object.metadata, expected)
    || object.body.byteLength !== expected.byteSize
    || createHash("sha256").update(object.body).digest("hex") !== expected.sha256
  ) throw new Error("Object bytes do not match metadata");
  return object.body;
}

function safeDownloadFilename(filename: string): string {
  return filename.replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+/, "").slice(0, 180) || "export";
}

function safeSiteJobError(error: unknown): string {
  const generic = "Sites queue unavailable";
  if (!(error instanceof Error)) return generic;
  const sanitized = error.message
    .replace(/https?:\/\/\S+/gi, "[redacted-url]")
    .replace(/[\0-\x08\x0b\x0c\x0e-\x1f]/g, " ")
    .slice(0, 500)
    .trim();
  return sanitized || generic;
}

export function createApiApp(overrides: Partial<ApiDeps> = {}) {
  const deps = {
    ...defaults,
    ...overrides,
    publishedImages: overrides.publishedImages ?? overrides.allImages ?? defaults.publishedImages,
    listPublishedDesignSystems: overrides.listPublishedDesignSystems ?? overrides.listDesignSystems ?? defaults.listPublishedDesignSystems,
    listPublishedFlowSets: overrides.listPublishedFlowSets ?? overrides.listAppFlowSets ?? defaults.listPublishedFlowSets,
  };
  const requestCrawlRepair = overrides.requestCrawlRepair ?? createCrawlRepairRequester({
    getRun: deps.getCrawlRun,
    getPlan: deps.getCrawlPlan,
    listRunSteps: deps.listCrawlRunSteps,
    crawlFailureObject: deps.crawlFailureObject,
    objectStore: deps.objectStore,
    startChatSession,
    proposeRepair,
  });
  const app = express();
  const generalLimiter = createFixedWindowLimiter({ limit: deps.generalRateLimit, windowMs: 5 * 60_000 });
  const mediaLimiter = createFixedWindowLimiter({ limit: deps.mediaRateLimit, windowMs: 10 * 60_000 });
  const traversalLimiter = createDistinctValueLimiter({ limit: deps.appTraversalLimit, windowMs: 10 * 60_000 });
  app.post("/billing/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    try {
      const result = await deps.billing.handleWebhook(
        req.body as Buffer,
        req.header("stripe-signature"),
      );
      res.json({ received: true, result });
    } catch {
      res.status(400).json({ error: "Invalid Stripe webhook" });
    }
  });
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  const checkStorageReady = async (): Promise<void> => {
    if (deps.storageReady) {
      await deps.storageReady();
      return;
    }
    if (deps.objectStore) await verifyObjectStoreReady(deps.objectStore);
  };
  const requireStorageReady = async (res: express.Response): Promise<boolean> => {
    try {
      await checkStorageReady();
      return true;
    } catch {
      res.status(503).json({ error: "Object storage unavailable", code: "object_storage_unavailable" });
      return false;
    }
  };

  app.get("/ready", async (_req, res) => {
    try {
      await checkStorageReady();
      res.json({ status: "ok" });
    } catch {
      res.status(503).json({ status: "error", error: "object_storage_unavailable" });
    }
  });

  app.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  app.post("/auth/login", async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const user = await deps.authenticateUser(email, password);
    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    const session = await deps.createSession(user.id);
    res.cookie(SESSION_COOKIE, session.token, cookieOptions).json(user);
  });

  app.post("/auth/signup", async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: "Enter a valid email address" });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }
    const user = await deps.registerUser(email, password);
    if (!user) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }
    const session = await deps.createSession(user.id);
    res.cookie(SESSION_COOKIE, session.token, cookieOptions).json(user);
  });

  app.post("/auth/logout", async (req, res) => {
    const token = cookieValue(req.headers.cookie, SESSION_COOKIE);
    if (token) await deps.deleteSession(token);
    res.clearCookie(SESSION_COOKIE, cookieOptions).status(204).end();
  });

  app.get("/catalog", async (req, res) => {
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
    const [images, previews] = await Promise.all([deps.publishedImages(), deps.publishedPreviewImages()]);
    res.setHeader("Cache-Control", "private, max-age=280");
    res.json(buildCatalogPage(images, cursor, limit, previews));
  });

  app.get("/preview-media/:app/:rank", async (req, res) => {
    const rank = Number(req.params.rank);
    if (!isAppSlug(req.params.app) || !Number.isInteger(rank) || rank < 1 || rank > 3) {
      res.status(400).json({ error: "invalid media reference" });
      return;
    }
    if (!deps.objectStore) {
      res.status(503).json({ error: "media storage unavailable" });
      return;
    }
    const metadata = await deps.publishedPreviewObject({ app: req.params.app, rank });
    if (!metadata) {
      res.status(404).json({ error: "preview not found" });
      return;
    }
    try {
      await sendStoredObject(deps.objectStore, metadata, res);
    } catch {
      res.status(503).json({ error: "media storage unavailable" });
    }
  });

  app.use(async (req, res, next) => {
    const token = cookieValue(req.headers.cookie, SESSION_COOKIE);
    let resolution: Awaited<ReturnType<typeof resolveSessionState>> = { status: "invalid" };
    if (token && overrides.resolveSessionState) resolution = await deps.resolveSessionState(token);
    else if (token && overrides.resolveSession) {
      const user = await deps.resolveSession(token);
      resolution = user ? { status: "authenticated", user } : { status: "invalid" };
    } else if (token) resolution = await deps.resolveSessionState(token);
    if (resolution.status === "signed_in_elsewhere") {
      res.status(401).json({
        error: "Signed in on another device",
        code: "signed_in_elsewhere",
      });
      return;
    }
    if (resolution.status !== "authenticated") {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    res.locals.user = resolution.user;
    next();
  });

  app.use(async (req, res, next) => {
    if (res.locals.user.role === "admin") {
      next();
      return;
    }
    const byUser = generalLimiter.check(`user:${res.locals.user.id}`);
    const byIp = generalLimiter.check(`ip:${req.ip}`);
    const blocked = byUser.allowed ? byIp : byUser;
    if (!blocked.allowed) {
      res.setHeader("Retry-After", String(blocked.retryAfterSeconds));
      await deps.recordAccessEvent({
        userId: res.locals.user.id,
        ipPrefix: ipPrefix(req.ip ?? "unknown"),
        action: "protected-request",
        outcome: "blocked",
      });
      res.status(429).json({
        error: "Security verification required",
        code: "verification_required",
        retryAfterSeconds: blocked.retryAfterSeconds,
      });
      return;
    }
    next();
  });

  const requireAdmin: express.RequestHandler = (_req, res, next) => {
    if (res.locals.user.role !== "admin") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    next();
  };

  mountSitesRoutes(app, {
    store: deps.sitesStore,
    sendObject: async (metadata, res) => {
      if (!deps.objectStore) throw new Error("Object storage is unavailable");
      await sendStoredObject(deps.objectStore, metadata, res);
    },
  });

  const listResearchCandidates = deps.listResearchCandidates ?? (async () => {
    const images = await deps.publishedImages();
    const versionEntries = await Promise.all(
      [...new Set(images.map(({ app, platform }) => `${app}\u0000${platform}`))].map(async (key) => {
        const [appName, platform] = key.split("\u0000");
        const published = (await deps.listAppVersions(appName, platform, true))
          .find(({ status }) => status === "published");
        return [key, published?.id] as const;
      }),
    );
    const versions = new Map(versionEntries);
    return images.flatMap((image): ResearchSuggestionCandidate[] => {
      const versionId = versions.get(`${image.app}\u0000${image.platform}`);
      if (!versionId || !["ios", "android", "web"].includes(image.platform)) return [];
      const analysis = image.analysis;
      return [{
        id: `screen:${image.id}`,
        kind: "screen",
        app: image.app,
        platform: image.platform as "ios" | "android" | "web",
        title: analysis?.pageType || image.description || `Screen ${image.id}`,
        description: analysis?.description || image.description || "",
        appCategory: image.category ?? undefined,
        productArea: analysis?.productArea,
        pageType: analysis?.pageType,
        tags: analysis?.contentPatterns ?? [],
        states: analysis?.visibleStates ?? [],
        components: analysis?.componentNames ?? [],
        layouts: analysis?.layoutPatterns ?? [],
        visibleText: analysis?.visibleText ?? [],
        capturedAt: image.captured_at ?? undefined,
        sourcePath: `/apps/${encodeURIComponent(image.app)}?screen=${image.id}`,
        imageId: image.id,
        versionId,
      }];
    });
  });

  mountResearchProjectRoutes(app, {
    store: deps.researchProjectStore,
    enabled: deps.researchProjectsEnabled,
    objectStore: deps.objectStore,
    synthesisProvider: deps.researchSynthesisProvider,
    canAccessApp: deps.canAccessApp,
    listPublishedCandidates: listResearchCandidates,
    getPrivateObject: deps.researchProjectStore.getPrivateObject,
    recordEvent: deps.recordAccessEvent,
  });

  mountOrganizationRoutes(app, {
    store: deps.organizationStore,
    enabled: deps.organizationsEnabled,
  });

  const publishCrawlTransport = async (
    run: Awaited<ReturnType<typeof deps.createCrawlRun>>,
    res: express.Response,
  ): Promise<boolean> => {
    try {
      await deps.publishJob({ type: "smart-crawl-app", name: run.app, runId: String(run.id) });
      return true;
    } catch {
      await deps.markQueuedCrawlRunInterrupted(String(run.id));
      res.status(503).json({
        error: "crawl transport unavailable",
        runId: String(run.id),
        versionId: run.version_id,
        planId: String(run.plan_id),
      });
      return false;
    }
  };

  app.post("/crawl/apps/:app/research", requireAdmin, async (req, res) => {
    const appSlug = String(req.params.app);
    const body = exactBody(req.body, ["homepageUrl", "provider"]);
    const homepageUrl = publicHttpUrl(body?.homepageUrl);
    const provider = body?.provider ?? "chatgpt";
    if (!isAppSlug(appSlug) || !homepageUrl || !repairProviders.has(provider as RepairProvider)) {
      res.status(400).json({ error: "invalid crawl research request" });
      return;
    }
    const job = parseJob({ type: "research-app", name: appSlug, homepageUrl, provider }) as Extract<Job, { type: "research-app" }>;
    const jobId = await deps.createJob("research-app", { name: appSlug, homepageUrl, provider });
    try {
      await deps.publishJob({ ...job, jobId });
    } catch {
      await deps.setJobStatus(jobId, "error", "Research transport unavailable");
      res.status(503).json({ error: "research transport unavailable", jobId });
      return;
    }
    res.status(202).json({ jobId, app: appSlug, homepageUrl });
  });

  app.post("/crawl/apps/:app/autonomous-runs", requireAdmin, async (req, res) => {
    const appSlug = String(req.params.app);
    const body = exactBody(req.body, [
      "homepageUrl", "platform", "provider", "sessionId", "requiredSecrets", "allowAll",
      "allowAllAcknowledged", "ceilings", "agentConcurrency",
    ]);
    const homepageUrl = publicHttpUrl(body?.homepageUrl);
    const platform = platformQuery(body?.platform);
    const provider = body?.provider;
    const ceilings = record(body?.ceilings);
    const sessionId = body?.sessionId === undefined ? undefined : crawlId(String(body.sessionId));
    const requiredSecrets = Array.isArray(body?.requiredSecrets)
      && body.requiredSecrets.length <= 20
      && body.requiredSecrets.every((name) => typeof name === "string" && /^[A-Z][A-Z0-9_]*$/.test(name))
      && new Set(body.requiredSecrets).size === body.requiredSecrets.length
      ? body.requiredSecrets as string[]
      : undefined;
    const parsedCeilings = ceilings ? {
      runtimeMinutes: boundedInteger(ceilings.runtimeMinutes, 1, 1_440),
      actions: boundedInteger(ceilings.actions, 1, 10_000),
      modelRequests: boundedInteger(ceilings.modelRequests, 1, 1_000),
      storageBytes: boundedInteger(ceilings.storageBytes, 1, 10_000_000_000),
    } : undefined;
    const agentConcurrency = boundedInteger(body?.agentConcurrency, 1, 8);
    if (
      !isAppSlug(appSlug) || !body || !homepageUrl || !platform
      || !repairProviders.has(provider as RepairProvider)
      || requiredSecrets === undefined || typeof body.allowAll !== "boolean"
      || typeof body.allowAllAcknowledged !== "boolean"
      || (body.allowAll && body.allowAllAcknowledged !== true)
      || !parsedCeilings || Object.values(parsedCeilings).some((value) => value === undefined)
      || !agentConcurrency || (body.sessionId !== undefined && !sessionId)
    ) {
      res.status(400).json({ error: "invalid autonomous crawl request" });
      return;
    }
    if (sessionId) {
      const session = await deps.getCrawlAccountSession(appSlug);
      if (!session || session.id !== sessionId) {
        res.status(409).json({ error: "crawl account session not found" });
        return;
      }
    }
    try {
      const version = await deps.ensureActiveAppVersion(appSlug, platform, res.locals.user.id, homepageUrl);
      const run = await deps.createAutonomousRun({
        app: appSlug,
        platform,
        versionId: version.id,
        createdBy: res.locals.user.id,
        homepageUrl,
        allowAll: body.allowAll,
        environment: {
          provider,
          ...(sessionId ? { sessionId } : {}),
          requiredSecrets,
          ceilings: parsedCeilings,
          agentConcurrency,
        },
      });
      try {
        await deps.publishJob({ type: "autonomous-crawl-app", name: appSlug, runId: String(run.id) });
      } catch {
        await deps.markAutonomousRunInterrupted(String(run.id), "transport_unavailable");
        res.status(503).json({ error: "autonomous crawl transport unavailable", runId: String(run.id), versionId: run.version_id });
        return;
      }
      res.status(202).json(run);
    } catch (error) {
      res.status(409).json({ error: (error as Error).message });
    }
  });

  app.get("/crawl/autonomous-runs/:runId", requireAdmin, async (req, res) => {
    const runId = crawlId(String(req.params.runId));
    if (!runId) {
      res.status(400).json({ error: "invalid autonomous run id" });
      return;
    }
    const detail = await deps.getAutonomousRun(runId);
    if (!detail) res.status(404).json({ error: "autonomous run not found" });
    else res.json(detail);
  });

  app.post("/crawl/autonomous-runs/:runId/pause", requireAdmin, async (req, res) => {
    const runId = crawlId(String(req.params.runId));
    if (!runId) {
      res.status(400).json({ error: "invalid autonomous run id" });
      return;
    }
    try {
      await deps.pauseAutonomousRun(runId);
      res.json(await deps.getAutonomousRun(runId));
    } catch (error) {
      res.status(409).json({ error: (error as Error).message });
    }
  });

  app.post("/crawl/autonomous-runs/:runId/cancel", requireAdmin, async (req, res) => {
    const runId = crawlId(String(req.params.runId));
    if (!runId) {
      res.status(400).json({ error: "invalid autonomous run id" });
      return;
    }
    try {
      res.json(await deps.cancelAutonomousRun(runId));
    } catch (error) {
      res.status(409).json({ error: (error as Error).message });
    }
  });

  app.post("/crawl/autonomous-runs/:runId/resume", requireAdmin, async (req, res) => {
    const runId = crawlId(String(req.params.runId));
    const body = exactBody(req.body, ["allowAllAcknowledged"]);
    if (!runId || !body || typeof body.allowAllAcknowledged !== "boolean") {
      res.status(400).json({ error: "invalid autonomous resume request" });
      return;
    }
    const detail = await deps.getAutonomousRun(runId);
    if (!detail) {
      res.status(404).json({ error: "autonomous run not found" });
      return;
    }
    if (detail.run.allow_all && body.allowAllAcknowledged !== true) {
      res.status(400).json({ error: "allow_all must be acknowledged again before resume" });
      return;
    }
    try {
      await deps.resumeAutonomousRun(runId);
      try {
        await deps.publishJob({ type: "autonomous-crawl-app", name: detail.run.app, runId });
      } catch {
        await deps.markAutonomousRunInterrupted(runId, "transport_unavailable");
        res.status(503).json({ error: "autonomous crawl transport unavailable", runId });
        return;
      }
      res.status(202).json(await deps.getAutonomousRun(runId));
    } catch (error) {
      res.status(409).json({ error: (error as Error).message });
    }
  });

  app.put("/crawl/apps/:app/session", requireAdmin, async (req, res) => {
    const appSlug = String(req.params.app);
    const body = exactBody(req.body, ["storageState"]);
    const storageState = record(body?.storageState);
    if (!isAppSlug(appSlug) || !storageState || !Array.isArray(storageState.cookies) || !Array.isArray(storageState.origins)
      || JSON.stringify(storageState).length > 1_000_000) {
      res.status(400).json({ error: "invalid crawl storage state" });
      return;
    }
    if (!deps.crawlSessionEncryptionKey) {
      res.status(503).json({ error: "crawl session encryption is not configured" });
      return;
    }
    try {
      const encrypted = encryptStorageState(storageState as unknown as StorageState, deps.crawlSessionEncryptionKey);
      const saved = await deps.saveCrawlAccountSession(appSlug, encrypted, res.locals.user.id);
      res.json(safeSessionView(saved));
    } catch (error) {
      res.status(409).json({ error: (error as Error).message });
    }
  });

  app.get("/crawl/apps/:app/session", requireAdmin, async (req, res) => {
    const appSlug = String(req.params.app);
    if (!isAppSlug(appSlug)) {
      res.status(400).json({ error: "invalid app slug" });
      return;
    }
    const session = await deps.getCrawlAccountSession(appSlug);
    if (!session) res.status(404).json({ error: "crawl account session not found" });
    else res.json(safeSessionView(session));
  });

  app.get("/crawl/apps/:app/plans", requireAdmin, async (req, res) => {
    const appSlug = String(req.params.app);
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    if (!isAppSlug(appSlug) || (status !== undefined && !crawlPlanStatuses.has(status))) {
      res.status(400).json({ error: "invalid crawl plan query" });
      return;
    }
    const plans = await deps.listCrawlPlans(appSlug, status as Parameters<typeof deps.listCrawlPlans>[1]);
    res.json(plans.map((plan) => crawlPlanView(plan, deps.isCrawlSecretConfigured)));
  });

  app.get("/crawl/plans/:planId", requireAdmin, async (req, res) => {
    const planId = crawlId(String(req.params.planId));
    if (!planId) {
      res.status(400).json({ error: "invalid crawl plan id" });
      return;
    }
    const plan = await deps.getCrawlPlan(planId);
    if (!plan) res.status(404).json({ error: "crawl plan not found" });
    else res.json(crawlPlanView(plan, deps.isCrawlSecretConfigured));
  });

  app.put("/crawl/plans/:planId", requireAdmin, async (req, res) => {
    const planId = crawlId(String(req.params.planId));
    let plan: ReturnType<typeof publicPlanBody>;
    try {
      plan = publicPlanBody(req.body);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
      return;
    }
    if (!planId || plan.reviewed) {
      res.status(400).json({ error: "invalid crawl plan revision" });
      return;
    }
    const source = await deps.getCrawlPlan(planId);
    if (!source) {
      res.status(404).json({ error: "crawl plan not found" });
      return;
    }
    if (plan.app !== source.app || plan.revision !== source.revision + 1) {
      res.status(400).json({ error: "crawl plan revision must follow the source plan for the same app" });
      return;
    }
    try {
      const saved = await deps.saveCrawlPlan(plan, res.locals.user.id, { sourcePlanId: source.id });
      res.status(201).json(crawlPlanView(saved, deps.isCrawlSecretConfigured));
    } catch (error) {
      res.status(409).json({ error: (error as Error).message });
    }
  });

  app.post("/crawl/plans/:planId/approve", requireAdmin, async (req, res) => {
    const planId = crawlId(String(req.params.planId));
    if (!planId) {
      res.status(400).json({ error: "invalid crawl plan id" });
      return;
    }
    try {
      const approved = await deps.approveCrawlPlan(planId, res.locals.user.id);
      res.json(crawlPlanView(approved, deps.isCrawlSecretConfigured));
    } catch (error) {
      const message = (error as Error).message;
      res.status(/not found/i.test(message) ? 404 : 409).json({ error: message });
    }
  });

  app.post("/crawl/apps/:app/runs", requireAdmin, async (req, res) => {
    const appSlug = String(req.params.app);
    const body = exactBody(req.body, [
      "planId", "mode", "unsafeApproved", "disposableAccountAcknowledged", "allowSideEffects", "environment",
    ]);
    const planId = typeof body?.planId === "string" ? crawlId(body.planId) : undefined;
    const environment = crawlEnvironment(body?.environment);
    const safety = [body?.unsafeApproved, body?.disposableAccountAcknowledged, body?.allowSideEffects];
    if (!isAppSlug(appSlug) || !body || !planId || body.mode !== "full" || !environment
      || safety.some((value) => value !== undefined && typeof value !== "boolean")) {
      res.status(400).json({ error: "invalid crawl run request" });
      return;
    }
    try {
      const run = await deps.createCrawlRun({
        app: appSlug,
        planId,
        unsafeApproved: body.unsafeApproved as boolean | undefined ?? false,
        disposableAccountAcknowledged: body.disposableAccountAcknowledged as boolean | undefined ?? false,
        allowSideEffects: body.allowSideEffects as boolean | undefined ?? false,
        environment,
        userId: res.locals.user.id,
      });
      if (await publishCrawlTransport(run, res)) res.status(202).json(run);
    } catch (error) {
      res.status(409).json({ error: (error as Error).message });
    }
  });

  app.get("/crawl/apps/:app/runs", requireAdmin, async (req, res) => {
    const appSlug = String(req.params.app);
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    if (!isAppSlug(appSlug) || (status !== undefined && !crawlRunStatuses.has(status))) {
      res.status(400).json({ error: "invalid crawl run query" });
      return;
    }
    res.json(await deps.listCrawlRuns(appSlug, status as Parameters<typeof deps.listCrawlRuns>[1]));
  });

  app.get("/crawl/runs/:runId", requireAdmin, async (req, res) => {
    const runId = crawlId(String(req.params.runId));
    if (!runId) {
      res.status(400).json({ error: "invalid crawl run id" });
      return;
    }
    const run = await deps.getCrawlRun(runId);
    if (!run) {
      res.status(404).json({ error: "crawl run not found" });
      return;
    }
    const [steps, evidence, repairs] = await Promise.all([
      deps.listCrawlRunSteps(runId),
      deps.listCrawlRunEvidence(runId),
      deps.listCrawlRunRepairs(runId),
    ]);
    res.json({
      run,
      steps: steps.map((step) => crawlStepView(runId, step)),
      evidence: evidence.map((item) => crawlEvidenceView(run.app, item)),
      repairs: repairs.map(crawlRepairView),
    });
  });

  app.post("/crawl/runs/:runId/cancel", requireAdmin, async (req, res) => {
    const runId = crawlId(String(req.params.runId));
    if (!runId) {
      res.status(400).json({ error: "invalid crawl run id" });
      return;
    }
    try {
      res.json(await deps.cancelCrawlRun(runId));
    } catch (error) {
      const message = (error as Error).message;
      res.status(/not found/i.test(message) ? 404 : 409).json({ error: message });
    }
  });

  app.post("/crawl/runs/:runId/retry", requireAdmin, async (req, res) => {
    const runId = crawlId(String(req.params.runId));
    const body = exactBody(req.body, ["mode"]);
    if (!runId || !body || (body.mode !== "full" && body.mode !== "failed")) {
      res.status(400).json({ error: "invalid crawl retry request" });
      return;
    }
    try {
      const retry = await deps.retryCrawlRun(runId, body.mode);
      if (await publishCrawlTransport(retry, res)) res.status(202).json(retry);
    } catch (error) {
      res.status(409).json({ error: (error as Error).message });
    }
  });

  app.get("/crawl/runs/:runId/failures/:flowId/:stepId/screenshot", requireAdmin, async (req, res) => {
    const runId = crawlId(String(req.params.runId));
    const flowId = crawlIdentifier(req.params.flowId);
    const stepId = crawlIdentifier(req.params.stepId);
    if (!runId || !flowId || !stepId) {
      res.status(400).json({ error: "invalid crawl failure reference" });
      return;
    }
    if (!deps.objectStore) {
      res.status(503).json({ error: "media storage unavailable" });
      return;
    }
    try {
      const metadata = await deps.crawlFailureObject({ runId, flowId, stepId });
      if (!metadata) {
        res.status(404).json({ error: "failure screenshot not found" });
        return;
      }
      await sendStoredObject(deps.objectStore, metadata, res);
    } catch {
      res.status(503).json({ error: "media storage unavailable" });
    }
  });

  app.post("/crawl/runs/:runId/repairs", requireAdmin, async (req, res) => {
    const runId = crawlId(String(req.params.runId));
    const body = exactBody(req.body, ["flowId", "stepId", "provider"]);
    const flowId = crawlIdentifier(body?.flowId);
    const stepId = crawlIdentifier(body?.stepId);
    const provider = body?.provider ?? "chatgpt";
    if (!runId || !flowId || !stepId || !repairProviders.has(provider as RepairProvider)) {
      res.status(400).json({ error: "invalid crawl repair request" });
      return;
    }
    try {
      const repair = await requestCrawlRepair({
        runId,
        flowId,
        stepId,
        provider: provider as RepairProvider,
      });
      res.status(201).json(crawlRepairView(repair));
    } catch (error) {
      const message = (error as Error).message;
      res.status(/not found/i.test(message) ? 404 : 409).json({ error: message });
    }
  });

  app.post("/crawl/repairs/:repairId/apply", requireAdmin, async (req, res) => {
    const repairId = crawlId(String(req.params.repairId));
    if (!repairId) {
      res.status(400).json({ error: "invalid crawl repair id" });
      return;
    }
    try {
      res.json(crawlRepairView(await deps.applyCrawlRepair(repairId, res.locals.user.id)));
    } catch (error) {
      const message = (error as Error).message;
      res.status(/not found/i.test(message) ? 404 : 409).json({ error: message });
    }
  });

  app.post("/crawl/repairs/:repairId/reject", requireAdmin, async (req, res) => {
    const repairId = crawlId(String(req.params.repairId));
    if (!repairId) {
      res.status(400).json({ error: "invalid crawl repair id" });
      return;
    }
    try {
      res.json(crawlRepairView(await deps.rejectCrawlRepair(repairId, res.locals.user.id)));
    } catch (error) {
      const message = (error as Error).message;
      res.status(/not found/i.test(message) ? 404 : 409).json({ error: message });
    }
  });

  const protectedMediaUrl = (userId: number, appSlug: string, source: string, variant?: "thumb"): string => {
    const parsed = parseImageSource(source);
    if (!parsed) return "";
    if (parsed.kind === "external") return parsed.url;
    const hash = parsed.hash;
    const expiresAt = deps.nowSeconds() + 300;
    const token = createMediaToken(deps.mediaSigningSecret, { userId, app: appSlug, hash, expiresAt });
    // kind/i must survive signing: a crop shares its source screen's hash, so dropping them
    // here would silently resolve the element URL to the full screen. Signed over the hash
    // only (like `variant`) — both qualifiers stay within the app the token already grants.
    const params = new URLSearchParams({ expires: String(expiresAt), token });
    if (variant) params.set("variant", variant);
    if (parsed.imageKind) params.set("kind", parsed.imageKind);
    if (parsed.index) params.set("i", parsed.index);
    return `/api/media/${appSlug}/${hash}?${params.toString()}`;
  };

  app.get("/auth/me", (_req, res) => res.json(res.locals.user));

  app.post("/auth/password", async (req, res) => {
    const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
    const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
    if (newPassword.length < 8) {
      res.status(400).json({ error: "New password must be at least 8 characters" });
      return;
    }
    const ok = await deps.changePassword(res.locals.user.id, currentPassword, newPassword);
    if (!ok) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }
    res.status(204).end();
  });

  app.get("/apps/:app/versions", async (req, res) => {
    const appSlug = String(req.params.app);
    const platform = platformQuery(req.query.platform);
    if (!isAppSlug(appSlug) || !platform) {
      res.status(400).json({ error: "invalid app slug or platform" });
      return;
    }
    res.json(await deps.listAppVersions(appSlug, platform, res.locals.user.role !== "admin"));
  });

  app.post("/apps/:app/versions", requireAdmin, async (req, res) => {
    const appSlug = String(req.params.app);
    const platform = platformQuery(req.body?.platform);
    const sourceUrl = boundedText(req.body?.sourceUrl, 2000);
    if (!isAppSlug(appSlug) || !platform || sourceUrl === undefined || (sourceUrl && !validMobbinScreensUrl(sourceUrl))) {
      res.status(400).json({ error: "invalid recapture request" });
      return;
    }
    try {
      const version = await deps.createAppVersion(appSlug, platform, res.locals.user.id, sourceUrl || undefined);
      if (sourceUrl) {
        if (!await requireStorageReady(res)) return;
        const jobId = await deps.createJob("import-app", { name: appSlug, url: sourceUrl, platform, versionId: version.id });
        try { await deps.publishJob({ type: "import-app", name: appSlug, url: sourceUrl, platform, jobId }); }
        catch (error) {
          await deps.setJobStatus(jobId, "error", (error as Error).message);
          res.status(503).json({ error: (error as Error).message, version, jobId });
          return;
        }
        res.status(201).json({ ...version, recaptureJobId: jobId });
        return;
      }
      res.status(201).json(version);
    } catch (error) {
      res.status(409).json({ error: (error as Error).message });
    }
  });

  app.get("/versions/:versionId/blockers", requireAdmin, async (req, res) => {
    const versionId = positiveId(String(req.params.versionId));
    if (!versionId) {
      res.status(400).json({ error: "invalid version id" });
      return;
    }
    res.json({ blockers: await deps.getVersionPublicationBlockers(versionId) });
  });

  app.post("/versions/:versionId/submit", requireAdmin, async (req, res) => {
    const versionId = positiveId(String(req.params.versionId));
    if (!versionId) {
      res.status(400).json({ error: "invalid version id" });
      return;
    }
    try { res.json(await deps.submitAppVersionForReview(versionId, res.locals.user.id)); }
    catch (error) { res.status(409).json({ error: (error as Error).message }); }
  });

  app.post("/versions/:versionId/publish", requireAdmin, async (req, res) => {
    const versionId = positiveId(String(req.params.versionId));
    if (!versionId) {
      res.status(400).json({ error: "invalid version id" });
      return;
    }
    try { res.json(await deps.publishAppVersion(versionId, res.locals.user.id)); }
    catch (error) { res.status(409).json({ error: (error as Error).message }); }
  });

  app.post("/apps/:app/review-actions", requireAdmin, async (req, res) => {
    const appSlug = String(req.params.app);
    const platform = platformQuery(req.query.platform);
    if (!isAppSlug(appSlug) || !platform || !req.body || typeof req.body !== "object") {
      res.status(400).json({ error: "invalid curator action" });
      return;
    }
    const snapshot = await deps.getDesignSystem(appSlug, platform);
    if (!snapshot) {
      res.status(404).json({ error: "design system not found" });
      return;
    }
    try {
      const reviewed = applyCuratorAction({ ...snapshot, flows: await deps.getAppFlows(appSlug, platform) }, req.body as CuratorAction);
      await deps.saveDesignSystem(appSlug, platform, { ...reviewed, flows: [] });
      await deps.saveAppFlows(appSlug, platform, reviewed.flows);
      res.json(reviewed);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.get("/search", async (req, res) => {
    const requestedKind = optionalQuery(req.query.kind) ?? "all";
    if (requestedKind !== "all" && !catalogKinds.has(requestedKind as CatalogEntityKind)) {
      res.status(400).json({ error: "invalid search kind" });
      return;
    }
    const [images, systems, flows] = await Promise.all([
      res.locals.user.role === "admin" ? deps.allImages() : deps.publishedImages(),
      res.locals.user.role === "admin" ? deps.listDesignSystems() : deps.listPublishedDesignSystems(),
      res.locals.user.role === "admin" ? deps.listAppFlowSets() : deps.listPublishedFlowSets(),
    ]);
    const appNames = [...new Set([
      ...images.map(({ app }) => app),
      ...systems.map(({ app }) => app),
      ...flows.map(({ app }) => app),
    ])];
    const allowed = new Set<string>();
    for (const appName of appNames) {
      // Catalog discovery is public-to-members; entitlement gates the detailed system,
      // protected media, comparison, and exports after a result is opened.
      allowed.add(appName);
    }
    const allowedImages = images.filter(({ app }) => allowed.has(app));
    const appCategories = Object.fromEntries(buildGalleryApps(allowedImages).map(({ id, cat }) => [id, cat]));
    const searchOptions = {
      query: optionalQuery(req.query.q) ?? "",
      kind: requestedKind as CatalogEntityKind | "all",
      theme: optionalQuery(req.query.theme),
      pageType: optionalQuery(req.query.pageType),
      productArea: optionalQuery(req.query.productArea),
      state: optionalQuery(req.query.state),
      layout: optionalQuery(req.query.layout),
      component: optionalQuery(req.query.component),
      appCategory: optionalQuery(req.query.appCategory),
      limit: optionalQuery(req.query.limit) ? Number(req.query.limit) : undefined,
    };
    const result = searchCatalog({
      images: allowedImages,
      systems: systems.filter(({ app }) => allowed.has(app)),
      flows: flows.filter(({ app }) => allowed.has(app)),
      appCategories,
    }, searchOptions);
    const imagesById = new Map(allowedImages.map((image) => [image.id, image]));
    await deps.recordAccessEvent({
      userId: res.locals.user.id,
      featureKey: "search",
      action: "catalog-search",
      outcome: "success",
    });
    res.json({
      ...result,
      items: result.items.map((item) => {
        const evidence = item.evidenceIds.map((id) => imagesById.get(id)).find((image) => image !== undefined);
        if (!evidence) return item;
        return {
          ...item,
          imageUrl: publicImageUrl(evidence.app, evidence.image_url),
          thumbnailUrl: publicImageUrl(evidence.app, evidence.image_url, "thumb"),
        };
      }),
    });
  });

  app.get("/compare", async (req, res) => {
    const apps = optionalQuery(req.query.apps)?.split(",").map((value) => value.trim()).filter(Boolean) ?? [];
    if (apps.length < 2 || apps.length > 5 || new Set(apps).size !== apps.length || !apps.every(isAppSlug)) {
      res.status(400).json({ error: "apps must contain 2 to 5 unique app slugs" });
      return;
    }
    for (const appName of apps) {
      if (!(await deps.canAccessApp(res.locals.user, appName))) {
        res.status(403).json({ error: "Upgrade required", code: "upgrade_required", app: appName });
        return;
      }
    }
    const availableSystems = res.locals.user.role === "admin" ? await deps.listDesignSystems() : await deps.listPublishedDesignSystems();
    const systems = apps.map((appName) => availableSystems.find(({ app }) => app === appName));
    if (systems.some((system) => !system)) {
      res.status(404).json({ error: "design system not found for every selected app" });
      return;
    }
    const availableFlows = res.locals.user.role === "admin" ? await deps.listAppFlowSets() : await deps.listPublishedFlowSets();
    const flowSets = apps.map((appName) => availableFlows.find(({ app }) => app === appName) ?? { app: appName, flows: [] });
    res.json(buildComparison(systems.filter((system) => system !== undefined), flowSets));
  });

  app.get("/collections", async (_req, res) => {
    res.json(await deps.listCollections(res.locals.user.id));
  });

  app.post("/collections", async (req, res) => {
    const name = boundedText(req.body?.name, 120, true);
    const description = boundedText(req.body?.description, 1000);
    if (name === undefined || description === undefined) {
      res.status(400).json({ error: "invalid collection" });
      return;
    }
    const collection = await deps.createCollection(res.locals.user.id, name, description);
    await deps.recordAccessEvent({
      userId: res.locals.user.id,
      featureKey: "collections",
      action: "collection-created",
      outcome: "created",
    });
    res.status(201).json(collection);
  });

  app.delete("/collections/:collectionId", async (req, res) => {
    const collectionId = positiveId(req.params.collectionId);
    if (!collectionId) {
      res.status(400).json({ error: "invalid collection id" });
      return;
    }
    if (!(await deps.deleteCollection(res.locals.user.id, collectionId))) {
      res.status(404).json({ error: "collection not found" });
      return;
    }
    await deps.recordAccessEvent({
      userId: res.locals.user.id,
      featureKey: "collections",
      action: "collection-deleted",
      outcome: "success",
    });
    res.status(204).end();
  });

  app.post("/collections/:collectionId/items", async (req, res) => {
    const collectionId = positiveId(req.params.collectionId);
    const kind = req.body?.kind;
    const appName = boundedText(req.body?.app, 120, true);
    const referenceId = boundedText(req.body?.referenceId, 200, true);
    const title = boundedText(req.body?.title, 240, true);
    const notes = boundedText(req.body?.notes, 4000);
    if (!collectionId || !collectionKinds.has(kind) || !appName || !isAppSlug(appName) || !referenceId || !title || notes === undefined) {
      res.status(400).json({ error: "invalid collection item" });
      return;
    }
    if (!(await deps.canAccessApp(res.locals.user, appName))) {
      res.status(403).json({ error: "Upgrade required", code: "upgrade_required" });
      return;
    }
    const item = await deps.addCollectionItem(res.locals.user.id, collectionId, {
      kind, app: appName, referenceId, title, notes,
    });
    if (!item) res.status(404).json({ error: "collection not found" });
    else {
      await deps.recordAccessEvent({
        userId: res.locals.user.id,
        featureKey: "collections",
        action: "collection-item-added",
        outcome: "created",
      });
      res.status(201).json(item);
    }
  });

  app.patch("/collections/:collectionId/items/:itemId", async (req, res) => {
    const collectionId = positiveId(req.params.collectionId);
    const itemId = positiveId(req.params.itemId);
    const notes = boundedText(req.body?.notes, 4000);
    if (!collectionId || !itemId || notes === undefined) {
      res.status(400).json({ error: "invalid collection item notes" });
      return;
    }
    const item = await deps.updateCollectionItemNotes(res.locals.user.id, collectionId, itemId, notes);
    if (!item) res.status(404).json({ error: "collection item not found" });
    else {
      await deps.recordAccessEvent({
        userId: res.locals.user.id,
        featureKey: "collections",
        action: "collection-item-updated",
        outcome: "success",
      });
      res.json(item);
    }
  });

  app.delete("/collections/:collectionId/items/:itemId", async (req, res) => {
    const collectionId = positiveId(req.params.collectionId);
    const itemId = positiveId(req.params.itemId);
    if (!collectionId || !itemId) {
      res.status(400).json({ error: "invalid collection item" });
      return;
    }
    if (!(await deps.removeCollectionItem(res.locals.user.id, collectionId, itemId))) {
      res.status(404).json({ error: "collection item not found" });
      return;
    }
    await deps.recordAccessEvent({
      userId: res.locals.user.id,
      featureKey: "collections",
      action: "collection-item-removed",
      outcome: "success",
    });
    res.status(204).end();
  });

  app.post("/billing/checkout", async (req, res) => {
    const interval = req.body?.interval;
    if (interval !== "month" && interval !== "year") {
      res.status(400).json({ error: "interval must be month or year" });
      return;
    }
    const result = await deps.billing.createCheckout(res.locals.user, interval);
    if (result.status === "already_subscribed") {
      res.status(409).json({ error: "Already subscribed", code: "already_subscribed" });
    } else res.status(201).json({ url: result.url });
  });

  app.post("/billing/portal", async (_req, res) => {
    const portal = await deps.billing.createPortal(res.locals.user.id);
    if (!portal) res.status(404).json({ error: "Billing customer not found" });
    else res.json(portal);
  });

  app.get("/billing/subscription", async (_req, res) => {
    const view = await deps.getAccountEntitlements(res.locals.user.id);
    res.json({
      plan: view.plan,
      status: view.subscription?.status ?? null,
      interval: view.subscription?.billing_interval ?? null,
      currentPeriodEnd: view.subscription?.current_period_end ?? null,
      cancelAtPeriodEnd: view.subscription?.cancel_at_period_end ?? false,
      graceExpiresAt: view.subscription?.grace_expires_at ?? null,
      freeUnlocks: view.freeUnlocks,
      freeUnlocksRemaining: view.freeUnlocksRemaining,
      exportUsage: view.exportUsage,
    });
  });

  app.post("/design-systems/:app/exports", async (req, res) => {
    const appSlug = req.params.app;
    const format = req.body?.format;
    const platform = platformQuery(req.body?.platform);
    const selection = parseExportSelection(req.body?.selection);
    if (!isAppSlug(appSlug) || !platform || !exportFormats.has(format) || !selection) {
      res.status(400).json({ error: "invalid export request" });
      return;
    }
    if (!(await deps.canAccessApp(res.locals.user, appSlug))) {
      res.status(403).json({ error: "Upgrade required", code: "upgrade_required" });
      return;
    }
    if (!deps.objectStore) {
      res.status(503).json({ error: "Export storage unavailable" });
      return;
    }
    const versioned = res.locals.user.role === "admin" ? undefined : await deps.getVersionDesignSystem(appSlug, platform);
    const snapshot = versioned?.snapshot ?? (res.locals.user.role === "admin" ? await deps.getDesignSystem(appSlug, platform) : undefined);
    const [flows, images] = versioned
      ? [versioned.flows, await deps.versionImages(appSlug, platform, versioned.version.version_number, ["screen", "flow_step"])] as const
      : await Promise.all([deps.getAppFlows(appSlug, platform), deps.appImages(appSlug, ["screen", "flow_step"])]);
    if (!snapshot && flows.length === 0) {
      res.status(404).json({ error: "design system not found" });
      return;
    }
    const effectiveSnapshot = snapshot ?? { app: appSlug, generatedAt: new Date().toISOString(), tokens: [], components: [], flows: [] };
    const store = deps.objectStore;
    let exportImages;
    try {
      exportImages = await Promise.all(images.map(async (image) => {
        const metadata = await deps.imageObjectById(image.id);
        if (metadata) {
          const body = verifiedObjectBody(metadata, await store.get(metadata.key));
          return { ...image, imageData: body.toString("base64") };
        }
        const hash = bulkImageHash(image.image_url);
        const path = hash ? findBulkImage(deps.dataDir, appSlug, hash) : undefined;
        return { ...image, imageData: path ? readFileSync(path).toString("base64") : undefined };
      }));
    } catch {
      res.status(503).json({ error: "Export storage unavailable" });
      return;
    }
    let artifact;
    try {
      artifact = buildExportArtifact({ ...effectiveSnapshot, flows }, exportImages, format, selection);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
      return;
    }
    const reservation = await deps.reserveExportOperation(res.locals.user.id);
    if (reservation.status === "not_pro") {
      res.status(403).json({ error: "Upgrade required", code: "upgrade_required" });
      return;
    }
    if (reservation.status === "limit_reached") {
      res.status(429).json(reservation);
      return;
    }
    const storageType = exportStorageTypes.get(artifact.mime);
    if (!storageType) {
      res.status(500).json({ error: "Unsupported export artifact" });
      return;
    }
    const exportId = await deps.createExport(
      res.locals.user.id,
      appSlug,
      versioned?.version.id,
      selection,
      format,
      artifact.filename,
    );
    const sha256 = createHash("sha256").update(artifact.content).digest("hex");
    const metadata: ObjectMetadata = {
      key: exportObjectKey(String(exportId), sha256, storageType.extension),
      sha256,
      byteSize: artifact.content.byteLength,
      contentType: storageType.contentType,
      accessClass: "protected",
    };
    try {
      const stored = await deps.objectStore.put({ ...metadata, body: artifact.content });
      if (!sameObjectMetadata(stored.metadata, metadata)) throw new Error("Object metadata mismatch");
      await deps.completeExport(exportId, metadata);
    } catch {
      await deps.failExport(exportId);
      res.status(503).json({ error: "Export storage unavailable" });
      return;
    }
    await deps.recordAccessEvent({
      userId: res.locals.user.id,
      ipPrefix: ipPrefix(req.ip ?? "unknown"),
      appSlug,
      featureKey: "design_systems",
      action: `export-${format}`,
      outcome: "completed",
      metadata: { format },
    });
    res.setHeader("Content-Type", artifact.mime);
    res.setHeader("Content-Disposition", `attachment; filename="${artifact.filename}"`);
    res.setHeader("X-Astryx-Export-Used", String(reservation.used));
    res.send(artifact.content);
  });

  // Editable FLOW.md: GET returns the saved PM copy, or the freshly generated
  // default (saved:false) when none has been saved yet; PUT upserts the edit.
  // Generation needs only flows + screen descriptions, so no object store here.
  app.get("/design-systems/:app/flow-doc", async (req, res) => {
    const appSlug = req.params.app;
    const platform = platformQuery(req.query.platform);
    if (!isAppSlug(appSlug) || !platform) {
      res.status(400).json({ error: "invalid flow-doc request" });
      return;
    }
    if (!(await deps.canAccessApp(res.locals.user, appSlug))) {
      res.status(403).json({ error: "Upgrade required", code: "upgrade_required" });
      return;
    }
    const saved = await deps.getFlowDocument(appSlug, platform);
    if (saved) {
      await deps.recordAccessEvent({
        userId: res.locals.user.id,
        appSlug,
        featureKey: "flows",
        action: "flow-document-view",
        outcome: "success",
      });
      res.json({ body: saved.body, saved: true, updatedAt: saved.updatedAt });
      return;
    }
    const [flows, images] = await Promise.all([
      deps.getAppFlows(appSlug, platform),
      deps.appImages(appSlug, ["screen", "flow_step"]),
    ]);
    const snapshot = { app: appSlug, generatedAt: new Date().toISOString(), tokens: [], components: [], flows };
    const artifact = buildExportArtifact(
      snapshot,
      images.map(({ id, image_url, description }) => ({ id, image_url, description })),
      "flow-md",
      { kind: "design-system" },
    );
    await deps.recordAccessEvent({
      userId: res.locals.user.id,
      appSlug,
      featureKey: "flows",
      action: "flow-document-view",
      outcome: "success",
    });
    res.json({ body: artifact.content.toString("utf8"), saved: false });
  });

  app.put("/design-systems/:app/flow-doc", async (req, res) => {
    const appSlug = req.params.app;
    const platform = platformQuery(req.body?.platform);
    const body = req.body?.body;
    if (!isAppSlug(appSlug) || !platform || typeof body !== "string" || body.length > 512 * 1024) {
      res.status(400).json({ error: "invalid flow-doc" });
      return;
    }
    if (!(await deps.canAccessApp(res.locals.user, appSlug))) {
      res.status(403).json({ error: "Upgrade required", code: "upgrade_required" });
      return;
    }
    try {
      const updatedAt = await deps.saveFlowDocument(appSlug, platform, body, res.locals.user.id);
      res.json({ saved: true, updatedAt });
    } catch {
      res.status(404).json({ error: "app not found" });
    }
  });

  app.get("/exports/:id", async (req, res) => {
    const exportId = positiveId(req.params.id);
    if (!exportId) {
      res.status(400).json({ error: "invalid export ID" });
      return;
    }
    if (!deps.objectStore) {
      res.status(503).json({ error: "Export storage unavailable" });
      return;
    }
    let artifact;
    try {
      artifact = await deps.authorizedExportObject({ userId: res.locals.user.id, exportId });
    } catch {
      res.status(503).json({ error: "Export storage unavailable" });
      return;
    }
    if (!artifact) {
      res.status(404).json({ error: "export not found" });
      return;
    }
    res.setHeader("Content-Disposition", `attachment; filename="${safeDownloadFilename(artifact.filename)}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    try {
      await sendStoredObject(deps.objectStore, artifact.metadata, res);
    } catch {
      res.status(503).json({ error: "Export storage unavailable" });
    }
  });

  app.post("/apps/:app/exports/reservations", async (req, res) => {
    const platform = platformQuery(req.query.platform);
    if (!isAppSlug(req.params.app) || !platform) {
      res.status(400).json({ error: "invalid app slug or platform" });
      return;
    }
    const selection = parseExportSelection(req.body);
    if (!selection) {
      res.status(400).json({ error: "invalid export selection" });
      return;
    }
    if (!(await deps.canAccessApp(res.locals.user, req.params.app))) {
      res.status(403).json({ error: "Upgrade required", code: "upgrade_required" });
      return;
    }
    if (selection.kind === "screens") {
      const ids = new Set((await deps.appImages(req.params.app)).map(({ id }) => id));
      if (!selection.ids.every((id) => ids.has(id))) {
        res.status(400).json({ error: "screen does not belong to app" });
        return;
      }
    } else if (selection.kind !== "design-system") {
      const snapshot = await deps.getDesignSystem(req.params.app, platform);
      const foundationKinds: Record<string, string> = {
        colors: "color",
        typography: "typography",
        spacing: "spacing",
        radii: "radius",
        borders: "border",
        effects: "effect",
      };
      const exists = selection.kind === "component-family"
        ? snapshot?.components.some(({ id }) => id === selection.id)
        : selection.kind === "foundation-category"
          ? snapshot?.tokens.some(({ kind }) => kind === foundationKinds[selection.id])
          : selection.componentIds.every((id) => snapshot?.components.some((component) => component.id === id))
            && selection.screenIds.every((id) => (snapshot?.tokens.some(({ evidence }) => evidence.includes(id))
              || snapshot?.components.some(({ variants }) => variants.some(({ evidence }) => evidence.includes(id)))));
      if (!exists) {
        res.status(400).json({ error: "export selection does not belong to app" });
        return;
      }
    }
    const reservation = await deps.reserveExportOperation(res.locals.user.id);
    if (reservation.status === "not_pro") {
      res.status(403).json({ error: "Upgrade required", code: "upgrade_required" });
      return;
    }
    if (reservation.status === "limit_reached") {
      res.status(429).json(reservation);
      return;
    }
    await deps.recordAccessEvent({
      userId: res.locals.user.id,
      ipPrefix: ipPrefix(req.ip ?? "unknown"),
      appSlug: req.params.app,
      featureKey: "exports",
      action: "export-reservation",
      outcome: "accepted",
    });
    res.status(201).json({ ...reservation, selection });
  });

  app.post("/apps/:app/unlock", async (req, res) => {
    if (!isAppSlug(req.params.app)) {
      res.status(400).json({ error: "invalid app slug" });
      return;
    }
    const result = await deps.unlockFreeApp(res.locals.user.id, req.params.app);
    const status = result.status === "unlocked" ? 201 : result.status === "app_not_found" ? 404 : 200;
    res.status(status).json(result);
  });

  const authorizeAppDetail = async (req: express.Request, res: express.Response): Promise<boolean> => {
    const appSlug = String(req.params.app);
    if (!isAppSlug(appSlug)) {
      res.status(400).json({ error: "invalid app slug" });
      return false;
    }
    if (res.locals.user.role !== "admin") {
      const traversal = traversalLimiter.check(`user:${res.locals.user.id}`, appSlug);
      if (!traversal.allowed) {
        res.setHeader("Retry-After", String(traversal.retryAfterSeconds));
        await deps.recordAccessEvent({
          userId: res.locals.user.id,
          ipPrefix: ipPrefix(req.ip ?? "unknown"),
          appSlug,
          featureKey: "library",
          action: "app-detail",
          outcome: "blocked",
        });
        res.status(429).json({
          error: "Security verification required",
          code: "verification_required",
          retryAfterSeconds: traversal.retryAfterSeconds,
        });
        return false;
      }
    }
    if (!(await deps.canAccessApp(res.locals.user, appSlug))) {
      res.status(403).json({ error: "Upgrade required", code: "upgrade_required" });
      return false;
    }
    return true;
  };

  const resolveAppSection = async (req: express.Request, res: express.Response) => {
    const platformValue = optionalQuery(req.query.platform);
    if (platformValue && !isPlatform(platformValue)) {
      res.status(400).json({ error: "invalid platform" });
      return undefined;
    }
    const platforms = await deps.appPlatforms(req.params.app);
    const platform = (platformValue as Platform | undefined) ?? platforms.find(isPlatform);
    if (!platform) {
      res.status(404).json({ error: "app platform not found" });
      return undefined;
    }
    const versionValue = optionalQuery(req.query.version);
    const requestedVersion = versionValue === undefined ? undefined : Number(versionValue);
    if (requestedVersion !== undefined && (!Number.isInteger(requestedVersion) || requestedVersion < 1)) {
      res.status(400).json({ error: "invalid version" });
      return undefined;
    }
    const publishedOnly = res.locals.user.role !== "admin";
    const versions = await deps.listAppVersions(req.params.app, platform, publishedOnly);
    const version = requestedVersion === undefined
      ? versions.find(({ status }) => status === "published")
      : versions.find(({ version_number }) => version_number === requestedVersion);
    if (requestedVersion !== undefined && !version) {
      res.status(404).json({ error: publishedOnly ? "published app version not found" : "app version not found" });
      return undefined;
    }
    if (publishedOnly && !version) {
      res.status(404).json({ error: "published app version not found" });
      return undefined;
    }
    return { platform, version, publishedOnly };
  };

  const recordAppDetailSuccess = async (req: express.Request, res: express.Response) => {
    await deps.recordAccessEvent({
      userId: res.locals.user.id,
      ipPrefix: ipPrefix(req.ip ?? "unknown"),
      appSlug: req.params.app,
      featureKey: "library",
      action: "app-detail",
      outcome: "success",
    });
  };

  app.get("/apps/:app/screens", async (req, res) => {
    if (!await authorizeAppDetail(req, res)) return;
    if (Object.keys(req.query).some((key) => !["platform", "version", "cursor", "limit"].includes(key))) {
      res.status(400).json({ error: "invalid screens query" });
      return;
    }
    const section = await resolveAppSection(req, res);
    if (!section) return;
    const limit = req.query.limit === undefined ? 48 : Number(req.query.limit);
    const cursor = optionalQuery(req.query.cursor);
    if (!Number.isInteger(limit) || limit < 1 || limit > 48 || (req.query.cursor !== undefined && !cursor)) {
      res.status(400).json({ error: "invalid pagination" });
      return;
    }
    try {
      const page = buildEvidencePage(await deps.appEvidencePage({
        app: req.params.app,
        kind: "screen",
        platform: section.platform,
        versionNumber: section.version?.version_number,
        cursor,
        limit,
        publishedOnly: section.publishedOnly,
      }));
      await recordAppDetailSuccess(req, res);
      res.json({ ...page, platform: section.platform, version: section.version ?? null });
    } catch (error) {
      if (error instanceof RangeError) res.status(400).json({ error: error.message });
      else throw error;
    }
  });

  app.get("/apps/:app/ui-elements", async (req, res) => {
    if (!await authorizeAppDetail(req, res)) return;
    if (Object.keys(req.query).some((key) => !["platform", "version", "cursor", "limit"].includes(key))) {
      res.status(400).json({ error: "invalid UI elements query" });
      return;
    }
    const section = await resolveAppSection(req, res);
    if (!section) return;
    const limit = req.query.limit === undefined ? 48 : Number(req.query.limit);
    const cursor = optionalQuery(req.query.cursor);
    if (!Number.isInteger(limit) || limit < 1 || limit > 48 || (req.query.cursor !== undefined && !cursor)) {
      res.status(400).json({ error: "invalid pagination" });
      return;
    }
    try {
      const page = buildEvidencePage(await deps.appEvidencePage({
        app: req.params.app,
        kind: "ui_element",
        platform: section.platform,
        versionNumber: section.version?.version_number,
        cursor,
        limit,
        publishedOnly: section.publishedOnly,
      }));
      await recordAppDetailSuccess(req, res);
      res.json({ ...page, platform: section.platform, version: section.version ?? null });
    } catch (error) {
      if (error instanceof RangeError) res.status(400).json({ error: error.message });
      else throw error;
    }
  });

  app.get("/apps/:app/flows", async (req, res) => {
    if (!await authorizeAppDetail(req, res)) return;
    if (Object.keys(req.query).some((key) => !["platform", "version"].includes(key))) {
      res.status(400).json({ error: "invalid flows query" });
      return;
    }
    const section = await resolveAppSection(req, res);
    if (!section) return;
    const flows = await deps.getVersionFlows(
      req.params.app,
      section.platform,
      section.version?.version_number,
      section.publishedOnly,
    );
    const imageIds = [...new Set(flows.flatMap((flow) => flow.steps.flatMap(({ evidence }) =>
      evidence.filter((id): id is number => typeof id === "number" && Number.isSafeInteger(id) && id > 0))))];
    const images = await deps.flowEvidenceImages({
      app: req.params.app,
      platform: section.platform,
      versionNumber: section.version?.version_number,
      imageIds,
      publishedOnly: section.publishedOnly,
    });
    const emptySnapshot = { app: req.params.app, generatedAt: new Date().toISOString(), tokens: [], components: [], flows };
    const hydrated = res.locals.user.role === "admin"
      ? hydrateDesignSystem(emptySnapshot, images)
      : hydrateDesignSystem(emptySnapshot, images, (appSlug, source) => protectedMediaUrl(res.locals.user.id, appSlug, source));
    await recordAppDetailSuccess(req, res);
    res.json({ flows: hydrated.flows, platform: section.platform, version: section.version ?? null });
  });

  app.get("/apps/:app", async (req, res) => {
    if (!await authorizeAppDetail(req, res)) return;
    if (Object.keys(req.query).length) {
      res.status(400).json({ error: "app metadata does not accept section query parameters" });
      return;
    }
    const row = await deps.appMetadata(req.params.app, res.locals.user.role !== "admin");
    if (!row) {
      res.status(404).json({ error: "app not found" });
      return;
    }
    await recordAppDetailSuccess(req, res);
    res.json({ app: buildAppMetadata(row) });
  });

  app.get("/apps", requireAdmin, async (req, res) => {
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
    const page = await deps.adminAppPage(cursor, limit);
    res.json({ apps: buildAdminGalleryApps(page.images), nextCursor: page.nextCursor, total: page.total });
  });

  app.get("/images", requireAdmin, async (req, res) => {
    const appName = String(req.query.app ?? "");
    if (!appName) {
      res.status(400).json({ error: "app query param required" });
      return;
    }
    const rows = await deps.query(
      `SELECT i.id, a.name AS app, i.image_url, i.description, i.created_at
       FROM images i
       JOIN platforms p ON p.id = i.platform_id
       JOIN apps a ON a.id = p.app_id
       WHERE a.name = $1 ORDER BY i.created_at ASC`,
      [appName]
    );
    res.json(rows.rows);
  });

  app.get("/progress", requireAdmin, (_req, res) => {
    res.json(deps.readProgress());
  });

  app.get("/progress/stream", requireAdmin, (_req, res) => {
    res.status(200);
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();
    const send = (snapshot = deps.readProgress()) => {
      res.write(`event: progress\ndata: ${JSON.stringify(snapshot)}\n\n`);
    };
    send();
    const unsubscribe = deps.subscribeProgress(send);
    const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 25_000);
    res.once("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  app.post("/progress/cancel", requireAdmin, (_req, res) => {
    deps.requestCancel();
    res.status(204).end();
  });

  app.post("/jobs", requireAdmin, async (req, res) => {
    const { type, name, url } = req.body ?? {};
    const platform = platformQuery(req.body?.platform) ?? (typeof url === "string" ? platformFromUrl(url) : undefined);
    if (!JOB_TYPES.includes(type)) {
      res.status(400).json({ error: `type must be one of: ${JOB_TYPES.join(", ")}` });
      return;
    }
    if (type === "import-site") {
      let canonicalUrl: string;
      try {
        canonicalUrl = canonicalMobbinSitesUrl(url).canonicalUrl;
      } catch {
        res.status(400).json({ error: "import-site requires an exact Mobbin Sites preview URL" });
        return;
      }
      const existing = await deps.sitesStore.readyVersionByCanonicalUrl(canonicalUrl);
      if (existing) {
        res.status(200).json({ existing: true, ...existing });
        return;
      }
      if (!await requireStorageReady(res)) return;
      const id = await deps.createJob(type, { url: canonicalUrl });
      try {
        await deps.publishSitesJob({ type, url: canonicalUrl, jobId: id });
      } catch (error) {
        const message = safeSiteJobError(error);
        await deps.setJobStatus(id, "error", message);
        res.status(503).json({ id, error: message });
        return;
      }
      res.status(201).json({ id });
      return;
    }
    if (type === "import-app" && (!isAppSlug(name) || !validMobbinScreensUrl(url) || !platform)) {
      res.status(400).json({
        error: "import-app requires a lowercase app slug, an HTTPS Mobbin screens URL, and a platform",
      });
      return;
    }
    if (type === "caption-app" && !isAppSlug(name)) {
      res.status(400).json({ error: `${type} requires a lowercase app slug` });
      return;
    }
    if (type === "synthesize-app" && (!isAppSlug(name) || !platform)) {
      res.status(400).json({ error: `${type} requires a lowercase app slug and a platform` });
      return;
    }

    const payload = { name, url, platform };
    if (!await requireStorageReady(res)) return;
    const id = await deps.createJob(type, payload);
    try {
      await deps.publishJob({ type, name, url, platform, jobId: id } as Job);
    } catch (error) {
      const message = (error as Error).message;
      await deps.setJobStatus(id, "error", message);
      res.status(503).json({ id, error: message });
      return;
    }
    res.status(201).json({ id });
  });

  app.get("/jobs", requireAdmin, async (_req, res) => {
    res.json(await deps.listJobs());
  });

  app.get("/users", requireAdmin, async (req, res) => {
    const limit = req.query.limit === undefined ? 30 : Number(req.query.limit);
    const filter = req.query.filter === undefined ? "all" : String(req.query.filter);
    if (!Number.isInteger(limit) || !ADMIN_USER_FILTERS.has(filter as AdminUserFilter)) {
      res.status(400).json({ error: "invalid user directory query" });
      return;
    }
    try {
      res.json(await deps.listAdminUsersPage({
        limit,
        cursor: optionalQuery(req.query.cursor),
        query: optionalQuery(req.query.q),
        filter: filter as AdminUserFilter,
      }));
    } catch (error) {
      if ((error as Error).message === "Invalid user cursor") {
        res.status(400).json({ error: "invalid user cursor" });
        return;
      }
      throw error;
    }
  });

  app.get("/users/growth", requireAdmin, async (_req, res) => {
    const [stats, dailySignups] = await Promise.all([deps.getGrowthStats(), deps.getDailySignups()]);
    res.json({ stats, dailySignups });
  });

  app.get("/users/usage", requireAdmin, async (req, res) => {
    const range = parseUsageRange(req.query.range === undefined ? undefined : String(req.query.range));
    if (!range) {
      res.status(400).json({ error: "range must be 7d, 30d, or 90d" });
      return;
    }
    res.json(await deps.getFeatureUsageOverview(range));
  });

  app.get("/users/:id/usage", requireAdmin, async (req, res) => {
    const userId = positiveId(String(req.params.id));
    const range = parseUsageRange(req.query.range === undefined ? undefined : String(req.query.range));
    if (!userId || !range) {
      res.status(400).json({ error: !userId ? "invalid user id" : "range must be 7d, 30d, or 90d" });
      return;
    }
    const usage = await deps.getUserFeatureUsage(userId, range);
    if (!usage) {
      res.status(404).json({ error: "user not found" });
      return;
    }
    res.json(usage);
  });

  app.patch("/users/:id/active", requireAdmin, async (req, res) => {
    const userId = positiveId(String(req.params.id));
    if (!userId || typeof req.body?.active !== "boolean") {
      res.status(400).json({ error: "invalid account state request" });
      return;
    }
    const result = await deps.setAdminUserActive({
      actorUserId: res.locals.user.id,
      userId,
      active: req.body.active,
    });
    if (result.status === "not_found") {
      res.status(404).json({ error: "user not found" });
      return;
    }
    if (result.status === "forbidden") {
      const error = result.reason === "self_disable"
        ? "You cannot disable your own account"
        : "The last active administrator cannot be disabled";
      res.status(403).json({ error, code: result.reason });
      return;
    }
    res.json(result.user);
  });

  app.post("/jobs/:id/cancel", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const job = await deps.getJob(id);
    if (!job) {
      res.status(404).json({ error: "job not found" });
      return;
    }
    if (job.status === "queued" || job.status === "running") {
      if (job.status === "running" && job.type !== "import-site") deps.requestCancel();
      await deps.setJobStatus(id, "cancelled", "Cancelled by user");
    }
    res.json(await deps.getJob(id));
  });

  app.get("/design-systems/:app", async (req, res) => {
    const appSlug = req.params.app;
    const platform = platformQuery(req.query.platform);
    if (!isAppSlug(appSlug) || !platform) {
      res.status(400).json({ error: "invalid app slug or platform" });
      return;
    }
    if (!(await deps.canAccessApp(res.locals.user, appSlug))) {
      res.status(403).json({ error: "Upgrade required", code: "upgrade_required" });
      return;
    }
    const requestedVersion = optionalQuery(req.query.version) ? Number(req.query.version) : undefined;
    if (requestedVersion !== undefined && (!Number.isInteger(requestedVersion) || requestedVersion < 1)) {
      res.status(400).json({ error: "invalid version" });
      return;
    }
    if (res.locals.user.role !== "admin" && requestedVersion !== undefined) {
      const published = await deps.listAppVersions(appSlug, platform, true);
      if (!published.some(({ version_number }) => version_number === requestedVersion)) {
        res.status(404).json({ error: "published design system version not found" });
        return;
      }
    }
    const versioned = requestedVersion !== undefined || res.locals.user.role !== "admin"
      ? await deps.getVersionDesignSystem(appSlug, platform, requestedVersion)
      : undefined;
    const snapshot = versioned?.snapshot ?? (res.locals.user.role === "admin" ? await deps.getDesignSystem(appSlug, platform) : undefined);
    const flows = versioned?.flows ?? await deps.getAppFlows(appSlug, platform);
    // Flows come from the crawl and don't require AI synthesis — don't hide them behind a
    // missing design-system snapshot (e.g. an app that's only been through crawl-only import).
    if (!snapshot && flows.length === 0) {
      res.status(404).json({ error: "design system not found" });
      return;
    }
    const effectiveSnapshot = snapshot ?? { app: appSlug, generatedAt: new Date().toISOString(), tokens: [], components: [], flows: [] };
    const images = versioned
      ? await deps.versionImages(appSlug, platform, versioned.version.version_number, ["screen", "flow_step"])
      : await deps.appImages(appSlug, ["screen", "flow_step"]);
    const hydrated = res.locals.user.role === "admin"
      ? hydrateDesignSystem({ ...effectiveSnapshot, flows }, images)
      : hydrateDesignSystem(
          { ...effectiveSnapshot, flows },
          images,
          (app, source) => protectedMediaUrl(res.locals.user.id, app, source),
        );
    res.json({ ...hydrated, version: versioned?.version ?? null });
  });

  app.get("/media/:app/:hash", async (req, res) => {
    if (!isAppSlug(req.params.app) || !/^[0-9a-f]{16}$/.test(req.params.hash)) {
      res.status(400).json({ error: "invalid media reference" });
      return;
    }
    const variant = req.query.variant === "thumb" ? "thumb" : "full";
    // Derived crops (ui_element/flow_step) share their source screen's hash, so the kind — and
    // the occurrence index when one screen yields several crops — is what disambiguates them.
    // Validated here so the value is only ever composed from a known-safe shape.
    const imageKind = typeof req.query.kind === "string" && /^[a-z_]+$/.test(req.query.kind)
      ? req.query.kind
      : undefined;
    const imageIndex = typeof req.query.i === "string" && /^\d+$/.test(req.query.i)
      ? req.query.i
      : undefined;
    const ref = legacyRefSuffix({ hash: req.params.hash, imageKind, index: imageIndex });
    if (res.locals.user.role !== "admin") {
      const media = mediaLimiter.check(`user:${res.locals.user.id}`);
      if (!media.allowed) {
        res.setHeader("Retry-After", String(media.retryAfterSeconds));
        res.status(429).json({
          error: "Security verification required",
          code: "verification_required",
          retryAfterSeconds: media.retryAfterSeconds,
        });
        return;
      }
      if (!(await deps.canAccessApp(res.locals.user, req.params.app))) {
        res.status(403).json({ error: "Upgrade required", code: "upgrade_required" });
        return;
      }
      const expiresAt = Number(req.query.expires);
      const token = typeof req.query.token === "string" ? req.query.token : "";
      if (expiresAt <= deps.nowSeconds()) {
        res.status(410).json({ error: "media URL expired" });
        return;
      }
      if (!verifyMediaToken(deps.mediaSigningSecret, token, {
        userId: res.locals.user.id,
        app: req.params.app,
        hash: req.params.hash,
        expiresAt,
      }, deps.nowSeconds())) {
        res.status(403).json({ error: "invalid media token" });
        return;
      }
    }
    if (deps.objectStore) {
      const metadata = res.locals.user.role === "admin"
        ? await deps.adminImageObject({ app: req.params.app, hash: ref, variant })
        : await deps.entitledImageObject({ userId: res.locals.user.id, app: req.params.app, hash: ref, variant });
      if (metadata) {
        try {
          await sendStoredObject(deps.objectStore, metadata, res);
        } catch {
          res.status(503).json({ error: "media storage unavailable" });
        }
        return;
      }
      const legacy = await deps.legacyImageReference({
        app: req.params.app,
        hash: ref,
        publishedOnly: res.locals.user.role !== "admin",
      });
      if (!legacy) {
        res.status(404).json({ error: "image not found" });
        return;
      }
    }
    const path = findBulkImage(deps.dataDir, req.params.app, req.params.hash);
    if (!path) {
      res.status(404).json({ error: "image not found" });
      return;
    }
    res.sendFile(resolve(path));
  });

  return app;
}
