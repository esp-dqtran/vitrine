import express from "express";
import compression from "compression";
import { bearerToken } from "./bearerAuth.ts";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  query,
  withTransaction,
  pool,
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
  saveDesignSystem,
  saveAppFlows,
  listAppFlowSets,
  createCollection,
  listCollections,
  listCollectionScreens,
  addCollectionItem,
  updateCollectionItemNotes,
  removeCollectionItem,
  deleteCollection,
  ensureActiveAppVersion,
  listAppVersions,
  resolveAppVersion,
  getVersionPublicationBlockers,
  submitAppVersionForReview,
  publishAppVersion,
  getVersionDesignSystem,
  versionImages,
  publishedImages,
  publishedPreviewImages,
  catalogStats,
  listPublishedDesignSystems,
  listPublishedFlowSets,
  appMetadata,
  publishedAppPreviewMetadata,
  publishedAppPreviewFlows,
  appEvidencePage,
  appScreenTypes,
  appUiElementSummary,
  appKnowledgeEvidenceSource,
  getVersionFlows,
  flowEvidenceImages,
  replaceAppPreviewImages,
} from "../../../src/db.ts";
import {
  authenticateUser,
  changePassword,
  normalizeEmail,
  registerUser,
  type AuthUser,
} from "../../../src/authStore.ts";
import {
  createPasswordReset,
  resetPasswordWithToken,
} from "../../../src/passwordResetStore.ts";
import { validPasswordResetToken } from "../../../src/passwordResetToken.ts";
import type { PasswordResetEmailSender } from "../../../src/passwordResetEmail.ts";
import {
  createMcpAccessToken,
  listMcpAccessTokens,
  revokeMcpAccessToken,
  verifyMcpAccessToken,
} from "../../../src/mcpTokenStore.ts";
import { createJwtAuth } from "../../../src/jwtAuth.ts";
import { getDailySignups, getGrowthStats } from "../../../src/adminStats.ts";
import {
  ADMIN_USER_FILTERS,
  grantAdminUserPro,
  listAdminUsersPage,
  revokeAdminUserProGrant,
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
import {
  buildAdminGalleryApps,
  buildAppMetadata,
  buildEvidencePage,
  buildGalleryApps,
  buildPublishedCatalogPage,
  buildPublishedPreviewScreens,
} from "../../../src/gallery.ts";
import {
  adminCatalogPage,
  publishedCatalogAppSlugs,
  publishedCatalogPage,
} from "../../../src/publicCatalogStore.ts";
import { CatalogCursorError } from "../../../src/catalogCursor.ts";
import {
  parsePublicFacet,
  type PublicCatalogFacetInput,
  type PublicFacetGroup,
} from "../../../src/publicFacetPreview.ts";
import type { DiscoveryFilter } from "../../../src/vitrine/discoveryTypes.ts";
import { searchDiscoveryFacets } from "../../../src/discoveryFacetSearch.ts";
import { publishedFacetPreviews } from "../../../src/publicFacetPreviewStore.ts";
import {
  FlowCatalogCursorError,
  publishedFlowCatalogPage,
} from "../../../src/flowCatalogStore.ts";
import {
  createFlowTaxonomyStore,
  FlowTaxonomyNotFoundError,
  FlowTaxonomyValidationError,
  parseFlowClassificationInput,
} from "../../../src/flowTaxonomyStore.ts";
import { mountFlowMcpRoute } from "./flowMcp.ts";
import { createCategoryStore } from "../../../src/categoryStore.ts";
import {
  authorizedExportObject,
  canAccessApp,
  countUserCollections,
  createFreeCollection,
  completeExport,
  createExport,
  failExport,
  getAccountEntitlements,
  recordAccessEvent,
  reserveExportOperation,
  unlockFreeApp,
} from "../../../src/pricingStore.ts";
import type { BillingService } from "./billing.ts";
import { createDistinctValueLimiter, createFixedWindowLimiter, ipPrefix } from "./rateLimit.ts";
import { buildComparison, searchCatalog, type CatalogEntityKind } from "../../../src/catalogResearch.ts";
import type { TypesenseCatalogClient } from "../../../src/typesenseCatalog.ts";
import type { TypesenseAppCatalogClient } from "../../../src/typesenseAppCatalog.ts";
import type { TypesenseFlowCatalogClient } from "../../../src/typesenseFlowCatalog.ts";
import type { TypesenseSiteCatalogClient } from "../../../src/typesenseSiteCatalog.ts";
import { buildExportArtifact, type ExportFormat, type ExportScope } from "../../../src/exportEngine.ts";
import { applyCuratorAction, type CuratorAction } from "../../../src/curatorReview.ts";
import { exportObjectKey, type ObjectMetadata, type ObjectStore, type StoredContentType } from "../../../src/objectStore.ts";
import { verifyObjectStoreReady } from "../../../src/objectStorageReady.ts";
import {
  adminImageObject,
  crawlFailureObject,
  entitledImageObject,
  imageObjectById,
  publishedFlowCatalogPreviewObject,
  publishedFacetPreviewObject,
  publishedPreviewObject,
} from "../../../src/objectStoreDb.ts";
import { parseCrawlPlan, parseCrawlStep } from "../../../src/crawlPlan.ts";
import { buildRepairPrompt, extractJson } from "../../../src/appResearch.ts";
import { ingestAppMetadata } from "../../../src/appMetadataIngest.ts";
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
import { createProjectDocumentStore } from "../../../src/projectDocumentStore.ts";
import { createOrganizationStore } from "../../../src/organizationStore.ts";
import { createResearchSynthesisProvider } from "../../../src/researchSynthesisProvider.ts";
import type { ResearchSuggestionCandidate } from "../../../src/researchSuggestions.ts";
import { mountResearchProjectRoutes } from "./researchProjects.ts";
import { mountDesignerCanvasRoutes } from "./designerCanvases.ts";
import { mountProjectDocumentRoutes } from "./projectDocuments.ts";
import { mountOrganizationRoutes } from "./organizations.ts";
import { createFeatureDocumentStore } from "../../../src/featureDocumentStore.ts";
import { kiroCliFeatureDocumentProviderModelFromEnvironment } from "../../../src/kiroCliFeatureDocumentProvider.ts";
import { getImportedCurrentDesignSystem } from "../../../src/getdesignImportStore.ts";
import {
  mountFeatureDocumentRoutes,
  mountPublicFeatureDocumentRoutes,
  type FeatureDocumentNotificationClient,
} from "./featureDocuments.ts";
import {
  mountAppKnowledgeRoutes,
  type AppKnowledgeNotificationClient,
} from "./appKnowledge.ts";
import {
  createAppKnowledgeStore,
  type AppKnowledgeTarget,
} from "../../../src/appKnowledgeStore.ts";
import { buildAppKnowledgeEvidenceManifest } from "../../../src/appKnowledgeEvidence.ts";
import { appKnowledgeProviderModelFromEnvironment } from "../../../src/appKnowledgeProviderConfig.ts";
import { classifySiteImportUrl } from "../../../src/sites.ts";
import {
  PUBLIC_CATALOG_GUEST_LIMIT,
  PUBLIC_FLOW_CATALOG_GUEST_LIMIT,
} from "../../../src/publicCatalogAccess.ts";
import { publishSitesJob } from "../../../src/sitesQueue.ts";
import { createSitesStore } from "../../../src/sitesStore.ts";
import {
  mountPrivateSitesRoutes,
  mountPublicSitesRoutes,
  withRouteSlugs,
} from "./sites.ts";
import { canonicalPublicPageUrl } from "../../../src/publicPage.ts";
import { publishPublicPageJob } from "../../../src/publicPageQueue.ts";
import { createPublicPageStore } from "../../../src/publicPageStore.ts";
import { buildSitemapXml } from "../../../src/seoSitemap.ts";
import {
  activateProMonth,
  attributeReferralSignup,
  createReferralCode,
  recordReferralAppOpen,
  referralSummary,
  referralCampaignMetrics,
  revokePromotionalEntitlement,
  revokeReferral,
  revokeReferralReward,
  validateReferralToken,
  type ReferralCampaign,
} from "../../../src/referralStore.ts";
import { createThreadsMarketingStore } from "../../../src/threadsMarketingStore.ts";
import { createColorPaletteStore } from "../../../src/colorPaletteStore.ts";
import {
  createThreadsClient,
  createThreadsMarketingService,
  mountThreadsMarketingPublicRoutes,
  mountThreadsMarketingRoutes,
  threadsMarketingConfigFromEnv,
} from "./threadsMarketing.ts";
import { mountColorPaletteRoutes } from "./colorPalettes.ts";

const JOB_TYPES = ["discover-catalog", "import-app", "caption-app", "synthesize-app", "import-site", "crawl-public-page"] as const;
// The product's Site import UI was deliberately removed, but the site crawler
// is still the only way the Sites catalog gets populated and refreshed (app
// card thumbnails read from it, and captures go stale as marketing sites are
// redesigned). Keep the job type disabled by default and let an operator opt
// back in explicitly rather than deleting the guard.
const DISABLED_IMPORT_JOB_TYPES = new Set([
  "discover-catalog",
  "import-app",
  ...(process.env.SITE_IMPORTS_ENABLED === "true" ? [] : ["import-site"]),
  "crawl-public-page",
]);
const IMPORTS_DISABLED_RESPONSE = { error: "Imports are disabled" } as const;
export const DEFAULT_API_PORT = 3010;
const disabledBilling: BillingService = {
  createCheckout: async () => { throw new Error("Billing is not configured"); },
  createTeamCheckout: async () => { throw new Error("Billing is not configured"); },
  createPortal: async () => { throw new Error("Billing is not configured"); },
  reconcileCheckoutSession: async () => { throw new Error("Billing is not configured"); },
  handleWebhook: async () => { throw new Error("Billing is not configured"); },
};
const apiCrawlRunService = createCrawlRunService({ workerId: "api" });
const apiAutonomousStore = createAutonomousStore();
const apiSitesStore = createSitesStore();
const apiPublicPageStore = createPublicPageStore();
const apiThreadsMarketingStore = createThreadsMarketingStore(query);
const disabledReferralCampaign: ReferralCampaign = {
  id: "disabled",
  startsAt: new Date(0),
  endsAt: new Date(0),
  rewardCap: 3,
};

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
const defaultJwtAuth = createJwtAuth({
  secret: process.env.JWT_SIGNING_SECRET ?? "development-only-jwt-signing-secret-32-characters",
  issuer: process.env.JWT_ISSUER?.trim()
    || process.env.APP_URL?.trim().replace(/\/$/, "")
    || "http://localhost:5173",
  audience: process.env.JWT_AUDIENCE?.trim() || "vitrines",
});
const categoryStore = createCategoryStore(
  (sql, values) => query(sql, values ? [...values] : undefined),
  (work) => withTransaction((client) =>
    work((sql, values) => client.query(sql, values ? [...values] : undefined))),
);
const flowTaxonomyStore = createFlowTaxonomyStore(
  (sql, values) => query(sql, values ? [...values] : undefined),
);

const defaults = {
  query,
  allImages,
  adminAppPage,
  adminCatalogPage,
  createJob,
  listJobs,
  getJob,
  setJobStatus,
  getDesignSystem,
  listDesignSystems,
  appImages,
  appPlatforms,
  getAppFlows,
  saveDesignSystem,
  saveAppFlows,
  listAppFlowSets,
  createCollection,
  listCollections,
  listCollectionScreens,
  addCollectionItem,
  updateCollectionItemNotes,
  removeCollectionItem,
  deleteCollection,
  listAppVersions,
  resolveAppVersion,
  getVersionPublicationBlockers,
  submitAppVersionForReview,
  publishAppVersion,
  getVersionDesignSystem,
  getImportedCurrentDesignSystem: (app: string, platform: string) => getImportedCurrentDesignSystem(pool, app, platform),
  versionImages,
  publishedImages,
  publishedPreviewImages,
  publishedCatalogAppSlugs,
  publishedCatalogPage,
  publishedFacetPreviews,
  publishedFlowCatalogPage,
  categoryStore,
  flowTaxonomyStore,
  catalogStats,
  listPublishedDesignSystems,
  listPublishedFlowSets,
  appMetadata,
  publishedAppPreviewMetadata,
  publishedAppPreviewFlows,
  appEvidencePage,
  appScreenTypes,
  appUiElementSummary,
  getVersionFlows,
  flowEvidenceImages,
  replaceAppPreviewImages,
  createExport,
  completeExport,
  failExport,
  authorizedExportObject,
  publishJob,
  publishSitesJob,
  publishPublicPageJob,
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
  ingestAppMetadata,
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
  createPasswordReset,
  resetPasswordWithToken,
  passwordResetEmailSender: undefined as PasswordResetEmailSender | undefined,
  issueAuthToken: defaultJwtAuth.issueAuthToken,
  verifyAuthToken: defaultJwtAuth.verifyAuthToken,
  verifyMcpAccessToken,
  createMcpAccessToken,
  listMcpAccessTokens,
  revokeMcpAccessToken,
  canAccessApp,
  unlockFreeApp,
  getAccountEntitlements,
  countUserCollections,
  createFreeCollection,
  recordAccessEvent,
  reserveExportOperation,
  activateProMonth,
  attributeReferralSignup,
  createReferralCode,
  recordReferralAppOpen,
  referralSummary,
  referralCampaignMetrics,
  revokePromotionalEntitlement,
  revokeReferral,
  revokeReferralReward,
  validateReferralToken,
  referralCampaign: disabledReferralCampaign,
  appUrl: process.env.APP_URL?.replace(/\/$/, "") ?? "http://localhost:5173",
  listAdminUsersPage,
  setAdminUserActive,
  grantAdminUserPro,
  revokeAdminUserProGrant,
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
  publishedFacetPreviewObject,
  publishedFlowCatalogPreviewObject,
  publishedPreviewObject,
  imageObjectById,
  researchProjectStore: createResearchProjectStore(),
  projectDocumentStore: createProjectDocumentStore(),
  researchSynthesisProvider: createResearchSynthesisProvider(),
  researchProjectsEnabled: process.env.RESEARCH_PROJECTS_ENABLED === "true",
  organizationStore: createOrganizationStore(),
  organizationsEnabled: process.env.TEAMS_ENABLED === "true",
  listResearchCandidates: undefined as ((userId: number) => Promise<ResearchSuggestionCandidate[]>) | undefined,
  sitesStore: apiSitesStore,
  publicPageStore: apiPublicPageStore,
  featureDocumentStore: createFeatureDocumentStore(),
  featureDocumentProviderModel: kiroCliFeatureDocumentProviderModelFromEnvironment(process.env),
  featureDocumentPromptVersion: 7,
  acquireFeatureDocumentNotificationClient: async () => pool.connect() as unknown as FeatureDocumentNotificationClient,
  appKnowledgeStore: createAppKnowledgeStore(),
  appKnowledgeProviderModel: appKnowledgeProviderModelFromEnvironment(),
  appKnowledgePromptVersion: 1,
  appKnowledgeCurrentSourceSha256: undefined as
    | ((target: AppKnowledgeTarget) => Promise<string | undefined>)
    | undefined,
  typesenseCatalog: undefined as TypesenseCatalogClient | undefined,
  typesenseAppCatalog: undefined as TypesenseAppCatalogClient | undefined,
  typesenseFlowCatalog: undefined as TypesenseFlowCatalogClient | undefined,
  typesenseSiteCatalog: undefined as TypesenseSiteCatalogClient | undefined,
  syncTypesenseAppCatalog: undefined as ((app: string, platform: Platform) => Promise<void>) | undefined,
  colorPaletteStore: createColorPaletteStore(query),
  acquireAppKnowledgeNotificationClient: async () =>
    pool.connect() as unknown as AppKnowledgeNotificationClient,
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
const exportFormats = new Set<ExportFormat>(["figma", "json", "css", "tailwind", "component-spec", "react", "design-md"]);
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

const catalogFilterGroups = new Set<PublicFacetGroup>([
  "categories",
  "screens",
  "elements",
  "flows",
]);

function catalogFacetMedia(input: {
  group?: unknown;
  value?: unknown;
  platform?: unknown;
}): PublicCatalogFacetInput | null {
  const staticFacet = parsePublicFacet(input);
  if (staticFacet) return staticFacet;
  if (
    (input.group !== "screens" && input.group !== "elements")
    || typeof input.value !== "string"
    || typeof input.platform !== "string"
    || !isPlatform(input.platform)
  ) {
    return null;
  }
  const value = input.value.trim();
  if (!value || value.length > 120) return null;
  return { group: input.group, value, platform: input.platform };
}

function catalogFilters(value: unknown): DiscoveryFilter[] | null {
  const tokens = Array.isArray(value) ? value : value === undefined ? [] : [value];
  if (tokens.length > 40) return null;
  const filters: DiscoveryFilter[] = [];
  for (const raw of tokens) {
    if (typeof raw !== "string") return null;
    const separator = raw.indexOf(".");
    if (separator < 1) return null;
    const group = raw.slice(0, separator).trim();
    const filterValue = raw.slice(separator + 1).trim();
    if (!catalogFilterGroups.has(group as PublicFacetGroup)
      || !filterValue
      || filterValue.length > 120) {
      return null;
    }
    filters.push({ group, value: filterValue });
  }
  return filters;
}

interface FlowCatalogFilters {
  flowCategories: string[];
  flowTypes: string[];
}

function flowCatalogFilters(value: unknown): FlowCatalogFilters | null {
  const tokens = Array.isArray(value) ? value : value === undefined ? [] : [value];
  if (tokens.length > 40) return null;
  const flowCategories: string[] = [];
  const flowTypes: string[] = [];
  for (const raw of tokens) {
    if (typeof raw !== "string") return null;
    const separator = raw.indexOf(".");
    const group = raw.slice(0, separator);
    const filterValue = raw.slice(separator + 1).trim();
    if (!filterValue || filterValue.length > 120) return null;
    if (group === "flowCategories" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(filterValue)) {
      flowCategories.push(filterValue);
      continue;
    }
    if (group === "flowTypes"
      && /^[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(filterValue)) {
      flowTypes.push(filterValue);
      continue;
    }
    return null;
  }
  return { flowCategories, flowTypes };
}

function flowFacetGroup(value: unknown): "flowCategories" | "flowTypes" | undefined {
  return value === "flowCategories" || value === "flowTypes" ? value : undefined;
}

function facetSearchValues(value: unknown, maximumItems = 40): string[] | null {
  const tokens = Array.isArray(value) ? value : value === undefined ? [] : [value];
  if (tokens.length > maximumItems) return null;
  const values: string[] = [];
  for (const token of tokens) {
    if (typeof token !== "string") return null;
    const trimmed = token.trim();
    if (!trimmed || trimmed.length > 120) return null;
    values.push(trimmed);
  }
  return values;
}

function facetSearchText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > 120) return null;
  return value.trim();
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

const LEGACY_AUTH_COOKIE = "astryx_session";
const legacyCookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

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
  forceBody = false,
): Promise<void> {
  res.setHeader("Content-Type", metadata.contentType);
  res.setHeader("X-Content-Type-Options", "nosniff");
  // 300s is S3ObjectStore's own hard ceiling on presigned URL lifetime (a deliberate security
  // limit, not just a default) — matching it here lets the redirect itself be cached for
  // nearly that long. Content is immutable per hash, so repeat views/reloads within the
  // window reuse the cached redirect instead of re-signing and re-fetching from scratch.
  const signed = forceBody || metadata.accessClass === "internal"
    ? undefined
    : await store.signedGetUrl(metadata.key, 300);
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

function safePublicPageJobError(): string {
  return "Public page queue unavailable";
}

export function createApiApp(overrides: Partial<ApiDeps> = {}) {
  const deps = {
    ...defaults,
    ...overrides,
    appScreenTypes: overrides.appScreenTypes ?? (overrides.appEvidencePage
      ? async () => []
      : defaults.appScreenTypes),
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
  const resolveRequestUser = async (
    req: express.Request,
  ): Promise<AuthUser | undefined> => {
    const token = bearerToken(req.headers.authorization);
    return token ? deps.verifyAuthToken(token) : undefined;
  };
  const resolveMcpRequestUser = async (req: express.Request): Promise<AuthUser | undefined> => {
    const token = bearerToken(req.headers.authorization);
    return token ? deps.verifyMcpAccessToken(token) : undefined;
  };
  const isCatalogLimitedRequest = async (req: express.Request): Promise<boolean> => {
    const user = await resolveRequestUser(req);
    if (!user) return true;
    if (user.role === "admin") return false;
    return (await deps.getAccountEntitlements(user.id)).plan === "free";
  };
  app.use(compression());
  const generalLimiter = createFixedWindowLimiter({ limit: deps.generalRateLimit, windowMs: 5 * 60_000 });
  // MCP calls can fan out to catalog and object storage. Keep a stricter budget than ordinary
  // browser API traffic, including for admin-owned personal access tokens.
  const mcpLimiter = createFixedWindowLimiter({ limit: Math.min(deps.generalRateLimit, 60), windowMs: 5 * 60_000 });
  // Protect both the delivery source and a recipient inbox. The address key is
  // normalized only in process memory and is never returned to the caller.
  const passwordResetIpLimiter = createFixedWindowLimiter({ limit: 10, windowMs: 60 * 60_000 });
  const passwordResetEmailLimiter = createFixedWindowLimiter({ limit: 3, windowMs: 60 * 60_000 });
  const traversalLimiter = createDistinctValueLimiter({ limit: deps.appTraversalLimit, windowMs: 10 * 60_000 });
  app.post("/billing/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    try {
      const result = await deps.billing.handleWebhook(
        req.body as Buffer,
        req.header("paddle-signature"),
      );
      res.json({ received: true, result });
    } catch {
      res.status(400).json({ error: "Invalid Paddle webhook" });
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

  app.get("/referrals/validate", async (req, res) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    const visitor = typeof req.query.visitor === "string" && req.query.visitor.length <= 128
      ? req.query.visitor
      : undefined;
    const valid = await deps.validateReferralToken(token, deps.referralCampaign, visitor);
    res.json({ valid });
  });

  app.post("/auth/login", async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const user = await deps.authenticateUser(email, password);
    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    const auth = await deps.issueAuthToken(user);
    res.clearCookie(LEGACY_AUTH_COOKIE, legacyCookieOptions).json({
      user,
      token: auth.token,
      expiresAt: auth.expiresAt.toISOString(),
    });
  });

  app.post("/auth/signup", async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const referralToken = typeof req.body?.referralToken === "string"
      && req.body.referralToken.length >= 32
      && req.body.referralToken.length <= 128
      ? req.body.referralToken
      : undefined;
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
    if (referralToken) {
      try {
        await deps.attributeReferralSignup({
          token: referralToken,
          invitedUserId: user.id,
          campaign: deps.referralCampaign,
        });
      } catch {
        // Referral attribution is best-effort and must never block account creation.
      }
    }
    const auth = await deps.issueAuthToken(user);
    res.clearCookie(LEGACY_AUTH_COOKIE, legacyCookieOptions).json({
      user,
      token: auth.token,
      expiresAt: auth.expiresAt.toISOString(),
    });
  });

  // This endpoint always acknowledges a request, whether or not the address exists.
  // The raw token is used only to compose the email and is never returned or stored.
  app.post("/auth/password-reset/request", async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    const validEmail = email.length > 0 && email.length <= 320;
    const ipAllowed = passwordResetIpLimiter.check(`password-reset-ip:${req.ip ?? "unknown"}`);
    const emailAllowed = validEmail
      ? passwordResetEmailLimiter.check(`password-reset-email:${normalizeEmail(email)}`)
      : { allowed: false as const };
    if (ipAllowed.allowed && emailAllowed.allowed) {
      try {
        const reset = await deps.createPasswordReset(email);
        if (reset && deps.passwordResetEmailSender) {
          const url = new URL("/reset-password", `${deps.appUrl.replace(/\/$/, "")}/`);
          url.searchParams.set("token", reset.token);
          await deps.passwordResetEmailSender.send({ to: reset.email, resetUrl: url.toString() });
        }
      } catch {
        // Deliberately neutral: callers must never learn account or delivery state.
        console.error("[auth] password reset request failed");
      }
    }
    res.status(202).json({ accepted: true });
  });

  app.post("/auth/password-reset", async (req, res) => {
    const token = typeof req.body?.token === "string" ? req.body.token : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }
    if (!validPasswordResetToken(token) || !(await deps.resetPasswordWithToken(token, password))) {
      res.status(400).json({ error: "This password reset link is invalid or has expired" });
      return;
    }
    res.status(204).end();
  });

  app.post("/auth/logout", (_req, res) => {
    res.clearCookie(LEGACY_AUTH_COOKIE, legacyCookieOptions).status(204).end();
  });

  app.get("/auth/me", async (req, res) => {
    res.clearCookie(LEGACY_AUTH_COOKIE, legacyCookieOptions)
      .json((await resolveRequestUser(req)) ?? null);
  });

  const listApps = async (req: express.Request, res: express.Response) => {
    const isCatalogLimited = await isCatalogLimitedRequest(req);
    const isSearchRequest = req.path === "/apps/search";
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
    const platform = req.query.platform === undefined
      ? undefined
      : platformQuery(req.query.platform);
    const search = req.query.query === undefined
      ? undefined
      : typeof req.query.query === "string" && req.query.query.length <= 120
        ? req.query.query.trim() || undefined
        : null;
    const sort = req.query.sort === undefined ? "latest" : req.query.sort;
    const includeFacets = req.query.facets !== "summary";
    const hasCanonicalFilters = req.query.filter !== undefined;
    let filters = hasCanonicalFilters ? catalogFilters(req.query.filter) : [];
    const hasLegacyFacet = !hasCanonicalFilters
      && (req.query.group !== undefined || req.query.value !== undefined);
    if (hasLegacyFacet) {
      const legacy = catalogFilters(
        typeof req.query.group === "string" && typeof req.query.value === "string"
          ? `${req.query.group}.${req.query.value}`
          : null,
      );
      filters = legacy;
    }
    const invalidLegacyFacet = hasLegacyFacet
      && (filters === null || platform === undefined);
    if (invalidLegacyFacet) {
      res.status(400).json({ error: "invalid catalog facet" });
      return;
    }
    if ((isSearchRequest && !search)
      || platform === undefined && req.query.platform !== undefined
      || search === null
      || (sort !== "latest" && sort !== "trending")
      || (req.query.facets !== undefined && req.query.facets !== "summary")
      || filters === null) {
      res.status(400).json({ error: "invalid catalog query" });
      return;
    }
    if (isCatalogLimited && cursor) {
      res.status(403).json({
        error: "Create an account or sign in to continue browsing the catalog",
        code: "guest_catalog_limit",
      });
      return;
    }
    const pageLimit = isCatalogLimited
      ? Math.min(limit ?? PUBLIC_CATALOG_GUEST_LIMIT, PUBLIC_CATALOG_GUEST_LIMIT)
      : limit;
    const typesenseCursorPrefix = "typesense-app:";
    const typesensePage = cursor?.startsWith(typesenseCursorPrefix)
      ? Number(cursor.slice(typesenseCursorPrefix.length))
      : 1;
    const supportsTypesenseAppSearch = isSearchRequest
      && Boolean(search)
      && sort === "latest"
      && filters.every(({ group }) => group === "categories")
      && Number.isInteger(typesensePage)
      && typesensePage >= 1
      && (!cursor || cursor.startsWith(typesenseCursorPrefix));
    if (deps.typesenseAppCatalog && platform && supportsTypesenseAppSearch) {
      const startedAt = performance.now();
      try {
        const result = await deps.typesenseAppCatalog.search({
          ...(search ? { query: search } : {}),
          platform,
          filters,
          sort,
          page: typesensePage,
          ...(pageLimit ? { limit: pageLimit } : {}),
        });
        const durationMs = Math.round((performance.now() - startedAt) * 100) / 100;
        res.setHeader("Cache-Control", "private, max-age=280");
        res.setHeader("Server-Timing", `typesense-app;dur=${durationMs}`);
        console.info(JSON.stringify({
          event: "typesense_app_catalog_search",
          outcome: "success",
          durationMs,
          platform,
          hasQuery: Boolean(search),
          filterCount: filters.length,
        }));
        res.json({
          items: result.apps,
          nextCursor: isCatalogLimited ? null : result.nextPage ? `${typesenseCursorPrefix}${result.nextPage}` : null,
          totalCount: isCatalogLimited
            ? Math.min(result.totalCount, PUBLIC_CATALOG_GUEST_LIMIT)
            : result.totalCount,
          facets: includeFacets ? result.facets : [],
        });
        return;
      } catch {
        const durationMs = Math.round((performance.now() - startedAt) * 100) / 100;
        res.setHeader("Server-Timing", `typesense-app;dur=${durationMs};desc=\"fallback\"`);
        console.warn(JSON.stringify({
          event: "typesense_app_catalog_search",
          outcome: "fallback",
          durationMs,
          platform,
          hasQuery: Boolean(search),
          filterCount: filters.length,
        }));
      }
    }
    try {
      const page = await deps.publishedCatalogPage({
        cursor,
        limit: pageLimit,
        filters,
        ...(includeFacets ? {} : { includeFacets: false }),
        ...(platform ? { platform } : {}),
        ...(search ? { query: search } : {}),
        sort,
      });
      res.setHeader("Cache-Control", "private, max-age=280");
      const catalog = buildPublishedCatalogPage(page);
      res.json({
        items: catalog.apps,
        nextCursor: isCatalogLimited ? null : page.nextCursor,
        totalCount: isCatalogLimited
          ? Math.min(page.totalCount ?? catalog.apps.length, PUBLIC_CATALOG_GUEST_LIMIT)
          : page.totalCount ?? catalog.apps.length,
        facets: page.facets ?? [],
      });
    } catch (error) {
      if (error instanceof CatalogCursorError) {
        res.status(400).json({ error: error.message });
        return;
      }
      throw error;
    }
  };
  app.get("/apps", listApps);
  app.get("/apps/search", listApps);

  app.get("/apps/facets", async (req, res) => {
    const platform = req.query.platform === undefined
      ? undefined
      : platformQuery(req.query.platform);
    const group = typeof req.query.group === "string" ? req.query.group : "";
    const search = facetSearchText(req.query.query);
    const facetQuery = facetSearchText(req.query.facet_query);
    const filters = catalogFilters(req.query.filter);
    const selected = facetSearchValues(req.query.selected);
    if (
      (platform === undefined && req.query.platform !== undefined)
      || !catalogFilterGroups.has(group as PublicFacetGroup)
      || search === null
      || facetQuery === null
      || filters === null
      || selected === null
    ) {
      res.status(400).json({ error: "invalid catalog facet query" });
      return;
    }
    const page = await deps.publishedCatalogPage({
      limit: 1,
      filters,
      facetGroups: [group as PublicFacetGroup],
      includeFacets: true,
      ...(platform ? { platform } : {}),
      ...(search ? { query: search } : {}),
    });
    res.setHeader("Cache-Control", "private, max-age=280");
    res.json({
      facets: searchDiscoveryFacets(page.facets ?? [], {
        group,
        ...(facetQuery ? { query: facetQuery } : {}),
        selected,
      }),
    });
  });

  app.get("/apps/stats", async (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=600");
    res.json(await deps.catalogStats());
  });

  app.get("/apps/categories", async (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json({ categories: await deps.categoryStore.listPublished() });
  });

  app.get("/flow-taxonomy", async (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json({ categories: await deps.flowTaxonomyStore.listPublished() });
  });

  const listFlows = async (req: express.Request, res: express.Response) => {
    const isCatalogLimited = await isCatalogLimitedRequest(req);
    const isSearchRequest = req.path === "/flows/search";
    const platform = platformQuery(req.query.platform);
    const cursor = req.query.cursor === undefined
      ? undefined
      : typeof req.query.cursor === "string"
        ? req.query.cursor
        : null;
    const limit = req.query.limit === undefined
      ? undefined
      : typeof req.query.limit === "string" && /^[1-9]\d*$/.test(req.query.limit)
        ? Number(req.query.limit)
        : null;
    const search = req.query.query === undefined
      ? undefined
      : typeof req.query.query === "string"
        ? req.query.query.trim()
        : null;
    const requestedSort = req.query.sort;
    const legacyView = req.query.view;
    const flowFilters = flowCatalogFilters(req.query.filter);
    const sort = "grouped";
    const includeFacets = req.query.facets !== "summary";
    if (!platform
      || (isSearchRequest && !search)
      || cursor === null
      || (cursor !== undefined && cursor.length > 2_048)
      || limit === null
      || (limit !== undefined && limit > 100)
      || search === null
      || (search !== undefined && search.length > 120)
      || flowFilters === null
      || (req.query.facets !== undefined && req.query.facets !== "summary")
      || (requestedSort !== undefined
        && requestedSort !== "popular"
        && requestedSort !== "grouped")
      || (legacyView !== undefined
        && (typeof legacyView !== "string"
          || (legacyView !== "browse" && legacyView !== "grouped")))
      || (requestedSort !== undefined && legacyView !== undefined)) {
      res.status(400).json({ error: "invalid Flow catalog query" });
      return;
    }
    if (isCatalogLimited && cursor) {
      res.status(403).json({
        error: "Create an account or sign in to continue browsing the catalog",
        code: "guest_catalog_limit",
      });
      return;
    }
    const pageLimit = isCatalogLimited
      ? Math.min(limit ?? PUBLIC_FLOW_CATALOG_GUEST_LIMIT, PUBLIC_FLOW_CATALOG_GUEST_LIMIT)
      : limit;
    const typesenseCursorPrefix = "typesense-flow:";
    const typesensePage = cursor?.startsWith(typesenseCursorPrefix)
      ? Number(cursor.slice(typesenseCursorPrefix.length))
      : 1;
    const supportsTypesenseFlowSearch = isSearchRequest
      && Boolean(search)
      && Number.isInteger(typesensePage)
      && typesensePage >= 1
      && (!cursor || cursor.startsWith(typesenseCursorPrefix));
    if (deps.typesenseFlowCatalog && supportsTypesenseFlowSearch) {
      const startedAt = performance.now();
      try {
        const result = await deps.typesenseFlowCatalog.search({
          query: search!,
          platform,
          ...flowFilters,
          page: typesensePage,
          ...(pageLimit ? { limit: pageLimit } : {}),
        });
        const durationMs = Math.round((performance.now() - startedAt) * 100) / 100;
        res.setHeader("Cache-Control", "public, max-age=300");
        res.setHeader("Server-Timing", `typesense-flow;dur=${durationMs}`);
        console.info(JSON.stringify({
          event: "typesense_flow_catalog_search",
          outcome: "success",
          durationMs,
          platform,
          filterCount: flowFilters.flowCategories.length + flowFilters.flowTypes.length,
        }));
        const page = {
          items: result.items,
          nextCursor: isCatalogLimited ? null : result.nextPage ? `${typesenseCursorPrefix}${result.nextPage}` : null,
          totalCount: isCatalogLimited
            ? Math.min(result.totalCount, PUBLIC_FLOW_CATALOG_GUEST_LIMIT)
            : result.totalCount,
          facets: includeFacets ? result.facets : [],
        };
        res.json(page);
        return;
      } catch {
        const durationMs = Math.round((performance.now() - startedAt) * 100) / 100;
        res.setHeader("Server-Timing", `typesense-flow;dur=${durationMs};desc="fallback"`);
        console.warn(JSON.stringify({
          event: "typesense_flow_catalog_search",
          outcome: "fallback",
          durationMs,
          platform,
          filterCount: flowFilters.flowCategories.length + flowFilters.flowTypes.length,
        }));
      }
    }
    try {
      const page = await deps.publishedFlowCatalogPage({
        platform,
        cursor,
        limit: pageLimit,
        ...(includeFacets ? {} : { includeFacets: false }),
        ...(search ? { query: search } : {}),
        sort,
        ...flowFilters,
        cursorSecret: deps.mediaSigningSecret,
      });
      res.setHeader("Cache-Control", "public, max-age=300");
      res.json({
        items: page.items,
        nextCursor: isCatalogLimited ? null : page.nextCursor,
        totalCount: isCatalogLimited
          ? Math.min(page.totalCount, PUBLIC_FLOW_CATALOG_GUEST_LIMIT)
          : page.totalCount,
        facets: page.facets,
      });
    } catch (error) {
      if (error instanceof FlowCatalogCursorError) {
        res.status(400).json({ error: error.message });
        return;
      }
      throw error;
    }
  };
  app.get("/flows", listFlows);
  app.get("/flows/search", listFlows);

  app.get("/flows/facets", async (req, res) => {
    const platform = platformQuery(req.query.platform);
    const search = facetSearchText(req.query.query);
    const facetQuery = facetSearchText(req.query.facet_query);
    const flowFilters = flowCatalogFilters(req.query.filter);
    const group = flowFacetGroup(req.query.group);
    const selected = facetSearchValues(req.query.selected);
    if (!platform
      || search === null
      || facetQuery === null
      || flowFilters === null
      || !group
      || selected === null) {
      res.status(400).json({ error: "invalid Flow facet query" });
      return;
    }
    const page = await deps.publishedFlowCatalogPage({
      platform,
      limit: 1,
      ...(search ? { query: search } : {}),
      ...flowFilters,
      includeFacets: true,
      cursorSecret: deps.mediaSigningSecret,
    });
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json({
      facets: searchDiscoveryFacets(page.facets, {
        group,
        ...(facetQuery ? { query: facetQuery } : {}),
        selected,
      }),
    });
  });

  app.get("/flows/media/:app/:platform/:versionId/:versionFlowId/:rank", async (req, res) => {
    const platform = platformQuery(req.params.platform);
    const versionId = positiveId(req.params.versionId);
    const versionFlowId = positiveId(req.params.versionFlowId);
    const rank = Number(req.params.rank);
    const variant = req.query.variant === "thumb" ? "thumb" : "full";
    if (
      !isAppSlug(req.params.app)
      || !platform
      || !versionId
      || !versionFlowId
      || !Number.isInteger(rank)
      || rank < 1
    ) {
      res.status(400).json({ error: "invalid Flow catalog media reference" });
      return;
    }
    if (!deps.objectStore) {
      res.status(503).json({ error: "media storage unavailable" });
      return;
    }
    const metadata = await deps.publishedFlowCatalogPreviewObject({
      app: req.params.app,
      platform,
      versionId,
      versionFlowId,
      rank,
      variant,
    });
    if (!metadata) {
      res.status(404).json({ error: "Flow catalog preview not found" });
      return;
    }
    try {
      await sendStoredObject(deps.objectStore, metadata, res, req.query.inline === "1");
    } catch {
      res.status(503).json({ error: "media storage unavailable" });
    }
  });

  app.get("/apps/facet-preview", async (req, res) => {
    const facet = parsePublicFacet({
      group: req.query.group,
      value: req.query.value,
      platform: req.query.platform,
    });
    if (!facet) {
      res.status(400).json({ error: "invalid facet preview" });
      return;
    }
    const previews = await deps.publishedFacetPreviews(facet);
    if (previews.length === 0) {
      res.status(404).json({ error: "facet preview not found" });
      return;
    }
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json({
      previews: previews.slice(0, 6).map((preview) => ({
        kind: preview.kind,
        app: preview.app,
        label: preview.label,
        iconUrl: preview.iconUrl,
        media: Array.from({ length: preview.mediaCount }, (_, index) => [
          "/api/apps/facet-media",
          encodeURIComponent(preview.app),
          encodeURIComponent(facet.group),
          encodeURIComponent(facet.value),
          encodeURIComponent(facet.platform),
          index + 1,
        ].join("/")),
      })),
    });
  });

  app.get("/apps/facet-media/:app/:group/:value/:platform/:rank", async (req, res) => {
    const facet = catalogFacetMedia({
      group: req.params.group,
      value: req.params.value,
      platform: req.params.platform,
    });
    const rank = Number(req.params.rank);
    const maxRank = facet?.group === "flows" ? 3 : 1;
    if (
      !facet
      || !isAppSlug(req.params.app)
      || !Number.isInteger(rank)
      || rank < 1
      || rank > maxRank
      || facet.group === "categories"
    ) {
      res.status(400).json({ error: "invalid facet media reference" });
      return;
    }
    if (!deps.objectStore) {
      res.status(503).json({ error: "media storage unavailable" });
      return;
    }
    const metadata = await deps.publishedFacetPreviewObject({
      app: req.params.app,
      ...facet,
      rank,
    });
    if (!metadata) {
      res.status(404).json({ error: "facet preview not found" });
      return;
    }
    try {
      await sendStoredObject(deps.objectStore, metadata, res);
    } catch {
      res.status(503).json({ error: "media storage unavailable" });
    }
  });

  app.get("/preview-media/:app/:platform/:rank", async (req, res) => {
    const rank = Number(req.params.rank);
    const platform = platformQuery(req.params.platform);
    const variant = req.query.variant === "full" ? "full" : "thumb";
    if (!isAppSlug(req.params.app) || !platform || !Number.isInteger(rank) || rank < 1 || rank > 3) {
      res.status(400).json({ error: "invalid media reference" });
      return;
    }
    if (!deps.objectStore) {
      res.status(503).json({ error: "media storage unavailable" });
      return;
    }
    const metadata = await deps.publishedPreviewObject({ app: req.params.app, platform, rank, variant });
    if (!metadata) {
      res.status(404).json({ error: "preview not found" });
      return;
    }
    try {
      await sendStoredObject(deps.objectStore, metadata, res, req.query.inline === "1");
    } catch {
      res.status(503).json({ error: "media storage unavailable" });
    }
  });

  app.get("/apps/:app/preview", async (req, res) => {
    const appSlug = req.params.app;
    if (!isAppSlug(appSlug)) {
      res.status(400).json({ error: "invalid app slug" });
      return;
    }
    const [row, previews] = await Promise.all([
      deps.publishedAppPreviewMetadata(appSlug),
      deps.publishedPreviewImages(appSlug),
    ]);
    if (!row) {
      res.status(404).json({ error: "app preview not found" });
      return;
    }

    const platform = row.available_platforms.includes("web")
      ? "web"
      : row.available_platforms.find(isPlatform);
    const [uiElementsResult, flowsResult] = platform
      ? await Promise.allSettled([
          deps.appUiElementSummary({
            app: appSlug,
            platform,
            publishedOnly: true,
            limit: 3,
          }),
          deps.publishedAppPreviewFlows(appSlug, platform),
        ])
      : [];
    const uiElementSummary = uiElementsResult?.status === "fulfilled"
      ? uiElementsResult.value
      : null;
    const uiElements = uiElementSummary?.items.slice(0, 3) ?? [];
    const flows = flowsResult?.status === "fulfilled" ? flowsResult.value : [];

    void deps.recordAccessEvent({
      ipPrefix: ipPrefix(req.ip ?? "unknown"),
      appSlug,
      featureKey: "library",
      action: "preview_viewed",
      outcome: "success",
    }).catch(() => undefined);
    res.setHeader("Cache-Control", "private, max-age=60, stale-while-revalidate=300");
    res.json({
      app: {
        ...buildAppMetadata(row),
        totalUiElements: uiElementSummary?.totalOccurrences ?? 0,
      },
      previewScreens: buildPublishedPreviewScreens(
        appSlug,
        previews.filter((preview) => preview.app === appSlug),
      ).filter(
        (screen): screen is typeof screen & { url: string } => typeof screen.url === "string",
      ),
      previewUiElements: uiElements.map((item) => ({
        type: item.component_type,
        group: item.component_group,
        count: item.occurrence_count,
        thumbnailUrl: [
          "/api/apps/facet-media",
          encodeURIComponent(appSlug),
          "elements",
          encodeURIComponent(item.component_type),
          encodeURIComponent(platform ?? "web"),
          "1",
        ].join("/"),
      })),
      previewFlows: flows.map((flow) => {
        const observedSteps = flow.steps.filter((step) => (
          Array.isArray(step.evidence)
          && step.evidence.some((value) => Number.isSafeInteger(value) && Number(value) > 0)
        ));
        const mediaBase = [
          "/api/flows/media",
          encodeURIComponent(appSlug),
          encodeURIComponent(platform ?? "web"),
          String(flow.version_id),
          String(flow.version_flow_id),
        ].join("/");
        return {
          id: flow.source_flow_id,
          title: flow.title,
          description: flow.description || null,
          platform,
          stepCount: flow.steps.length,
          screens: observedSteps.slice(0, 3).map((step, index) => ({
            label: typeof step.label === "string" && step.label.trim()
              ? step.label
              : `Step ${index + 1}`,
            imageUrl: `${mediaBase}/${index + 1}?variant=full`,
            thumbnailUrl: `${mediaBase}/${index + 1}?variant=thumb`,
          })),
        };
      }),
    });
  });

  mountPublicFeatureDocumentRoutes(app, {
    store: deps.featureDocumentStore,
    sendObject: async (metadata, res) => {
      if (!deps.objectStore) throw new Error("Object storage is unavailable");
      await sendStoredObject(deps.objectStore, metadata, res);
    },
  });
  const sitesRouteDependencies = {
    store: deps.sitesStore,
    cursorSecret: deps.mediaSigningSecret,
    isCatalogLimitedRequest,
    ...(deps.typesenseSiteCatalog ? { typesenseSiteCatalog: deps.typesenseSiteCatalog } : {}),
    sendObject: async (metadata: ObjectMetadata, res: express.Response) => {
      if (!deps.objectStore) throw new Error("Object storage is unavailable");
      await sendStoredObject(deps.objectStore, metadata, res);
    },
  };
  mountPublicSitesRoutes(app, sitesRouteDependencies);

  app.get("/seo/sitemap.xml", async (_req, res) => {
    try {
      const appSlugs = await deps.publishedCatalogAppSlugs({ platform: "web" });
      const siteSlugs = withRouteSlugs(await deps.sitesStore.listReadySites())
        .map((site) => site.routeSlug);
      res
        .setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400")
        .type("application/xml")
        .send(buildSitemapXml({ appSlugs, siteSlugs }));
    } catch {
      res.status(503).type("application/xml").send(buildSitemapXml());
    }
  });

  // Browser-native image requests cannot attach the bearer token kept in session storage, so
  // this endpoint is limited to derivatives explicitly classified for the public catalog.
  // Protected and internal assets must use an authenticated delivery path instead.
  app.get("/media/:app/:hash", async (req, res) => {
    if (!isAppSlug(req.params.app) || !/^[0-9a-f]{16}$/.test(req.params.hash)) {
      res.status(400).json({ error: "invalid media reference" });
      return;
    }
    const variant = req.query.variant === "thumb" ? "thumb" : "full";
    const imageKind = typeof req.query.kind === "string" && /^[a-z_]+$/.test(req.query.kind)
      ? req.query.kind
      : undefined;
    const imageIndex = typeof req.query.i === "string" && /^\d+$/.test(req.query.i)
      ? req.query.i
      : undefined;
    const ref = legacyRefSuffix({ hash: req.params.hash, imageKind, index: imageIndex });
    if (deps.objectStore) {
      const user = await resolveRequestUser(req);
      const metadata = user
        ? await deps.entitledImageObject({
            userId: user.id,
            app: req.params.app,
            hash: ref,
            variant,
          })
        : await deps.adminImageObject({
            app: req.params.app,
            hash: ref,
            variant,
          });
      if (metadata && (user || metadata.accessClass === "public-preview")) {
        try {
          await sendStoredObject(
            deps.objectStore,
            metadata,
            res,
            req.query.delivery === "inline",
          );
        } catch {
          res.status(503).json({ error: "media storage unavailable" });
        }
        return;
      }
    }
    res.status(404).json({ error: "image not found" });
  });
  // Threads fetches the post image itself, without Vitrines credentials. This
  // route must remain ahead of the authenticated API middleware, like /media.
  mountThreadsMarketingPublicRoutes(app, apiThreadsMarketingStore);

  app.use(async (req, res, next) => {
    // Public discovery is deliberately limited to published search results.
    // All other routes still establish an authenticated user below.
    if (req.path === "/search") {
      next();
      return;
    }
    const user = req.path === "/mcp"
      ? await resolveMcpRequestUser(req)
      : await resolveRequestUser(req);
    if (!user) {
      res.status(401).json({ error: req.path === "/mcp" ? "Flow access token required" : "Authentication required" });
      return;
    }
    res.locals.user = user;
    next();
  });

  app.use(async (req, res, next) => {
    if (req.path === "/search") {
      const blocked = generalLimiter.check(`public-search:${req.ip}`);
      if (!blocked.allowed) {
        res.setHeader("Retry-After", String(blocked.retryAfterSeconds));
        res.status(429).json({
          error: "Too many search requests",
          retryAfterSeconds: blocked.retryAfterSeconds,
        });
        return;
      }
      next();
      return;
    }
    if (res.locals.user.role === "admin" && req.path !== "/mcp") {
      next();
      return;
    }
    const isMcpRequest = req.path === "/mcp";
    const limiter = isMcpRequest ? mcpLimiter : generalLimiter;
    const byUser = limiter.check(`user:${res.locals.user.id}`);
    // MCP tokens are already authenticated and revocable. The API sits behind a local Caddy
    // reverse proxy, so req.ip is the shared proxy address unless a separately validated
    // client-IP boundary is introduced. Keep the strict MCP budget per user to avoid one
    // account consuming a global proxy-IP bucket for every other MCP user.
    const blocked = byUser.allowed && !isMcpRequest
      ? limiter.check(`ip:${req.ip}`)
      : byUser;
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

  mountColorPaletteRoutes(app, deps.colorPaletteStore);

  const threadsMarketingConfig = threadsMarketingConfigFromEnv(process.env);
  const threadsMarketingService = createThreadsMarketingService({
    store: apiThreadsMarketingStore,
    ...(threadsMarketingConfig
      ? { config: threadsMarketingConfig, client: createThreadsClient(threadsMarketingConfig) }
      : {}),
  });
  mountThreadsMarketingRoutes(app, requireAdmin, threadsMarketingService);

  app.get("/admin/flow-classifications", requireAdmin, async (req, res) => {
    if (Object.keys(req.query).some((key) => key !== "limit")) {
      res.status(400).json({ error: "invalid Flow classification review query" });
      return;
    }
    const rawLimit = req.query.limit;
    if (rawLimit !== undefined && (typeof rawLimit !== "string" || !/^[1-9]\d*$/.test(rawLimit))) {
      res.status(400).json({ error: "invalid Flow classification review query" });
      return;
    }
    try {
      res.json({ items: await deps.flowTaxonomyStore.listReviewQueue(
        rawLimit === undefined ? undefined : Number(rawLimit),
      ) });
    } catch (error) {
      if (error instanceof FlowTaxonomyValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }
      throw error;
    }
  });

  app.put("/admin/flow-classifications/:flowId", requireAdmin, async (req, res) => {
    const flowId = Number(req.params.flowId);
    if (!Number.isSafeInteger(flowId) || flowId < 1) {
      res.status(400).json({ error: "invalid Flow id" });
      return;
    }
    try {
      const input = parseFlowClassificationInput(req.body);
      const classification = await deps.flowTaxonomyStore.saveClassification({
        flowId,
        ...input,
        source: "manual",
        reviewedByUserId: res.locals.user.id,
      });
      res.json({ classification });
    } catch (error) {
      if (error instanceof FlowTaxonomyValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }
      if (error instanceof FlowTaxonomyNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      throw error;
    }
  });

  mountFlowMcpRoute(app, {
    appUrl: deps.appUrl,
    flowCatalogSecret: deps.mediaSigningSecret,
    canAccessApp: deps.canAccessApp,
    publishedCatalogPage: deps.publishedCatalogPage,
    publishedFlowCatalogPage: deps.publishedFlowCatalogPage,
    getVersionFlows: deps.getVersionFlows,
    flowEvidenceImages: deps.flowEvidenceImages,
    appMetadata: deps.appMetadata,
    recordToolCall: async ({ userId, tool, app, outcome, resultCount }) => {
      await deps.recordAccessEvent({
        userId,
        ...(app ? { appSlug: app } : {}),
        action: `mcp-${tool}`,
        outcome,
        ...(resultCount === undefined ? {} : { metadata: { resultCount } }),
      });
    },
    readInlineImage: async (image, maxBytes) => {
      const hash = bulkImageHash(image.image_url);
      if (!hash || !deps.objectStore) return undefined;
      const metadata = await deps.adminImageObject({ app: image.app, hash, variant: "thumb" });
      if (
        !metadata
        || (metadata.contentType !== "image/png"
          && metadata.contentType !== "image/jpeg"
          && metadata.contentType !== "image/webp"
          && metadata.contentType !== "image/gif")
      ) return undefined;
      const stored = await deps.objectStore.get(metadata.key);
      const body = verifiedObjectBody(metadata, stored);
      if (body.byteLength > maxBytes) return undefined;
      return { data: body.toString("base64"), mimeType: metadata.contentType };
    },
  });

  app.get("/admin/catalog/facets", requireAdmin, async (req, res) => {
    const platform = req.query.platform === undefined
      ? undefined
      : platformQuery(req.query.platform);
    const group = typeof req.query.group === "string" ? req.query.group : "";
    const search = facetSearchText(req.query.query);
    const facetQuery = facetSearchText(req.query.facet_query);
    const filters = catalogFilters(req.query.filter);
    const selected = facetSearchValues(req.query.selected);
    if (
      (platform === undefined && req.query.platform !== undefined)
      || !catalogFilterGroups.has(group as PublicFacetGroup)
      || search === null
      || facetQuery === null
      || filters === null
      || selected === null
    ) {
      res.status(400).json({ error: "invalid admin catalog facet query" });
      return;
    }
    const page = await deps.adminCatalogPage({
      limit: 1,
      filters,
      facetGroups: [group as PublicFacetGroup],
      includeFacets: true,
      ...(platform ? { platform } : {}),
      ...(search ? { query: search } : {}),
    });
    res.setHeader("Cache-Control", "private, max-age=280");
    res.json({
      facets: searchDiscoveryFacets(page.facets ?? [], {
        group,
        ...(facetQuery ? { query: facetQuery } : {}),
        selected,
      }),
    });
  });

  const effectiveCustomerPlan = async (res: express.Response): Promise<"free" | "pro"> =>
    res.locals.user.role === "admin"
      ? "pro"
      : (await deps.getAccountEntitlements(res.locals.user.id)).plan;

  mountFeatureDocumentRoutes(app, {
    store: deps.featureDocumentStore,
    canAccessApp: deps.canAccessApp,
    listAppVersions: deps.listAppVersions,
    getVersionFlows: deps.getVersionFlows,
    flowEvidenceImages: deps.flowEvidenceImages,
    imageObjectById: deps.imageObjectById,
    createJob: deps.createJob,
    setJobStatus: deps.setJobStatus,
    publishJob: deps.publishJob,
    providerModel: deps.featureDocumentProviderModel,
    promptVersion: deps.featureDocumentPromptVersion,
    appUrl: deps.appUrl,
    acquireNotificationClient: deps.acquireFeatureDocumentNotificationClient,
    recordEvent: deps.recordAccessEvent,
    sendObject: async (metadata, res) => {
      if (!deps.objectStore) throw new Error("Object storage is unavailable");
      await sendStoredObject(deps.objectStore, metadata, res);
    },
  });

  mountAppKnowledgeRoutes(app, requireAdmin, {
    store: deps.appKnowledgeStore,
    canAccessApp: deps.canAccessApp,
    resolveAppVersion: deps.resolveAppVersion,
    createJob: deps.createJob,
    setJobStatus: deps.setJobStatus,
    publishJob: deps.publishJob,
    providerModel: deps.appKnowledgeProviderModel,
    promptVersion: deps.appKnowledgePromptVersion,
    acquireNotificationClient: deps.acquireAppKnowledgeNotificationClient,
    recordEvent: deps.recordAccessEvent,
    currentSourceSha256: deps.appKnowledgeCurrentSourceSha256 ?? (async (target) => {
      if (!deps.objectStore) return undefined;
      const source = await appKnowledgeEvidenceSource({
        app: target.app,
        platform: target.platform,
        versionNumber: target.versionNumber,
      });
      if (!source) return undefined;
      const prepared = await buildAppKnowledgeEvidenceManifest({
        source,
        objectStore: deps.objectStore,
        overrides: await deps.appKnowledgeStore.evidenceOverrides(target.captureVersionId),
      });
      return prepared.sourceSha256;
    }),
  });

  app.post("/referrals/link", async (_req, res) => {
    const { token } = await deps.createReferralCode(res.locals.user.id);
    const target = new URL("/", deps.appUrl);
    target.searchParams.set("ref", token);
    res.status(201).json({ url: target.toString() });
  });

  app.get("/referrals/summary", async (_req, res) => {
    res.json(await deps.referralSummary(res.locals.user.id, deps.referralCampaign));
  });

  app.post("/referrals/rewards/activate", async (_req, res) => {
    const result = await deps.activateProMonth(res.locals.user.id);
    if (result.status === "activated") {
      res.json(result);
      return;
    }
    res.status(409).json({ error: "Pro Month cannot be activated", code: result.status });
  });

  mountPrivateSitesRoutes(app, sitesRouteDependencies);

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
        appCategories: image.categories?.map(({ name }) => name) ?? [],
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

  mountDesignerCanvasRoutes(app, {
    store: deps.researchProjectStore,
    enabled: deps.researchProjectsEnabled,
    objectStore: deps.objectStore,
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
    organizationRole: (organizationId, userId) => (
      deps.organizationStore.membershipRole(organizationId, userId)
    ),
  });

  mountProjectDocumentRoutes(app, {
    store: deps.projectDocumentStore,
    enabled: deps.researchProjectsEnabled,
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

  app.post("/crawl/apps/:app/metadata", requireAdmin, async (req, res) => {
    const appSlug = String(req.params.app);
    const body = exactBody(req.body, ["homepageUrl"]);
    const homepageUrl = publicHttpUrl(body?.homepageUrl);
    if (!isAppSlug(appSlug) || !body || !homepageUrl) {
      res.status(400).json({ error: "invalid App metadata request" });
      return;
    }
    if (!deps.objectStore) {
      res.status(503).json({ error: "App icon storage unavailable" });
      return;
    }
    try {
      const result = await deps.ingestAppMetadata(
        { app: appSlug, sourceUrl: homepageUrl },
        { objectStore: deps.objectStore },
      );
      res.status(result.created ? 201 : 200).json(result);
    } catch (error) {
      res.status(422).json({ error: (error as Error).message });
    }
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
      !isAppSlug(appSlug) || !body || !homepageUrl || platform !== "web"
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

  app.get("/auth/mcp-tokens", async (_req, res) => {
    res.json({ tokens: await deps.listMcpAccessTokens(res.locals.user.id) });
  });

  app.post("/auth/mcp-tokens", async (req, res) => {
    const body = exactBody(req.body, ["label"]);
    const label = body?.label === undefined ? undefined : boundedText(body.label, 80);
    if (!body || (body.label !== undefined && label === undefined)) {
      res.status(400).json({ error: "invalid MCP token request" });
      return;
    }
    res.status(201).json(await deps.createMcpAccessToken({ userId: res.locals.user.id, label }));
  });

  app.delete("/auth/mcp-tokens/:tokenId", async (req, res) => {
    const tokenId = positiveId(req.params.tokenId);
    if (!tokenId) {
      res.status(400).json({ error: "invalid MCP token" });
      return;
    }
    if (!await deps.revokeMcpAccessToken({ userId: res.locals.user.id, tokenId })) {
      res.status(404).json({ error: "MCP token not found" });
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
    void req;
    res.status(410).json(IMPORTS_DISABLED_RESPONSE);
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
    try {
      const published = await deps.publishAppVersion(versionId, res.locals.user.id);
      void deps.syncTypesenseAppCatalog?.(published.app, published.platform as Platform)
        .catch(() => { console.warn("[api] Typesense App document sync failed"); });
      res.json(published);
    }
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

  app.put("/apps/:app/preview-screens", requireAdmin, async (req, res) => {
    const appSlug = String(req.params.app);
    const body = exactBody(req.body, ["platform", "version", "imageIds"]);
    const platform = body ? platformQuery(body.platform) : undefined;
    const version = body ? boundedInteger(body.version, 1, Number.MAX_SAFE_INTEGER) : undefined;
    const imageIds = body?.imageIds;
    if (!isAppSlug(appSlug) || !platform || !version || !Array.isArray(imageIds)
      || imageIds.length > 3 || new Set(imageIds).size !== imageIds.length
      || imageIds.some((id) => !Number.isSafeInteger(id) || id < 1)) {
      res.status(400).json({ error: "invalid AppCard preview selection" });
      return;
    }
    try {
      res.json(await deps.replaceAppPreviewImages({
        app: appSlug,
        platform,
        versionNumber: version,
        imageIds,
      }));
    } catch (error) {
      if (error instanceof RangeError) res.status(400).json({ error: error.message });
      else throw error;
    }
  });

  app.get("/search", async (req, res) => {
    const user = await resolveRequestUser(req);
    const isAdmin = user?.role === "admin";
    const requestedKind = optionalQuery(req.query.kind) ?? "all";
    if (requestedKind !== "all" && !catalogKinds.has(requestedKind as CatalogEntityKind)) {
      res.status(400).json({ error: "invalid search kind" });
      return;
    }
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
      platform: optionalQuery(req.query.platform),
      flowTag: optionalQuery(req.query.flowTag),
      limit: optionalQuery(req.query.limit) ? Number(req.query.limit) : undefined,
    };
    let result;
    if (!isAdmin && deps.typesenseCatalog) {
      try {
        result = await deps.typesenseCatalog.search(searchOptions);
      } catch {
        console.warn("[api] Typesense search fallback");
      }
    }
    let imagesById: Map<number, Awaited<ReturnType<typeof deps.publishedImages>>[number]> | undefined;
    if (!result) {
      const [images, systems, flows] = await Promise.all([
        isAdmin ? deps.allImages() : deps.publishedImages(),
        isAdmin ? deps.listDesignSystems() : deps.listPublishedDesignSystems(),
        isAdmin ? deps.listAppFlowSets() : deps.listPublishedFlowSets(),
      ]);
      const appNames = [...new Set([
        ...images.map(({ app }) => app),
        ...systems.map(({ app }) => app),
        ...flows.map(({ app }) => app),
      ])];
      const allowed = new Set(appNames);
      const allowedImages = images.filter(({ app }) => allowed.has(app));
      const appCategories = Object.fromEntries(
        allowedImages.map((image) => [
          image.app,
          image.categories?.map(({ name }) => name) ?? [],
        ]),
      );
      result = searchCatalog({
        images: allowedImages,
        systems: systems.filter(({ app }) => allowed.has(app)),
        flows: flows.filter(({ app }) => allowed.has(app)),
        appCategories,
      }, searchOptions);
      imagesById = new Map(allowedImages.map((image) => [image.id, image]));
    }
    if (user) {
      await deps.recordAccessEvent({
        userId: user.id,
        featureKey: "search",
        action: "catalog-search",
        outcome: "success",
      });
    }
    res.json({
      ...result,
      items: imagesById ? result.items.map((item) => {
        const evidence = item.evidenceIds.map((id) => imagesById.get(id)).find((image) => image !== undefined);
        if (!evidence) return item;
        return {
          ...item,
          imageUrl: publicImageUrl(evidence.app, evidence.image_url),
          thumbnailUrl: publicImageUrl(evidence.app, evidence.image_url, "thumb"),
        };
      }) : result.items,
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

  app.get("/collections/:collectionId/screens", async (req, res) => {
    const collectionId = positiveId(req.params.collectionId);
    if (!collectionId) {
      res.status(400).json({ error: "invalid collection id" });
      return;
    }
    const savedScreens = await deps.listCollectionScreens(res.locals.user.id, collectionId);
    const visibleScreens = await Promise.all(savedScreens.map(async (savedScreen) => {
      if (!await deps.canAccessApp(res.locals.user, savedScreen.app)) return null;
      const screen = buildEvidencePage(
        { rows: [savedScreen], nextCursor: null },
        publicImageUrl,
      ).screens[0];
      return screen ? {
        itemId: savedScreen.item_id,
        app: savedScreen.app,
        accent: savedScreen.accent_color ?? "var(--vitrine-color-action-primary)",
        screen,
      } : null;
    }));
    res.json({ screens: visibleScreens.filter((screen) => screen !== null) });
  });

  app.post("/collections", async (req, res) => {
    const name = boundedText(req.body?.name, 120, true);
    const description = boundedText(req.body?.description, 1000);
    if (name === undefined || description === undefined) {
      res.status(400).json({ error: "invalid collection" });
      return;
    }
    const plan = await effectiveCustomerPlan(res);
    if (plan !== "pro" && description.trim()) {
      res.status(403).json({ error: "Research notes require Pro", code: "upgrade_required" });
      return;
    }
    const collection = plan === "pro"
      ? await deps.createCollection(res.locals.user.id, name, description)
      : await deps.createFreeCollection(res.locals.user.id, name);
    if (!collection) {
      res.status(403).json({ error: "Free includes one collection", code: "plan_limit" });
      return;
    }
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
    if (notes.trim() && await effectiveCustomerPlan(res) !== "pro") {
      res.status(403).json({ error: "Research notes require Pro", code: "upgrade_required" });
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
    if (notes.trim() && await effectiveCustomerPlan(res) !== "pro") {
      res.status(403).json({ error: "Research notes require Pro", code: "upgrade_required" });
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
    } else {
      await deps.recordAccessEvent({
        userId: res.locals.user.id,
        ipPrefix: ipPrefix(req.ip ?? "unknown"),
        action: "checkout_started",
        outcome: "created",
        metadata: { interval },
      });
      res.status(201).json({ transactionId: result.transactionId });
    }
  });

  app.post("/billing/team/checkout", async (req, res) => {
    const organizationId = Number(req.body?.organizationId);
    if (!Number.isInteger(organizationId) || organizationId <= 0) {
      res.status(400).json({ error: "organizationId must be a positive integer" });
      return;
    }
    const result = await deps.billing.createTeamCheckout(res.locals.user, organizationId);
    if (result.status === "not_owner") {
      res.status(403).json({ error: "Only the organization owner can manage Team billing" });
    } else if (result.status === "already_subscribed") {
      res.status(409).json({ error: "Team is already subscribed", code: "already_subscribed" });
    } else {
      await deps.recordAccessEvent({
        userId: res.locals.user.id,
        ipPrefix: ipPrefix(req.ip ?? "unknown"),
        action: "team_checkout_started",
        outcome: "created",
        metadata: { organizationId },
      });
      res.status(201).json({ transactionId: result.transactionId });
    }
  });

  app.post("/billing/portal", async (req, res) => {
    const organizationId = req.body?.organizationId === undefined ? undefined : Number(req.body.organizationId);
    if (organizationId !== undefined && (!Number.isInteger(organizationId) || organizationId <= 0)) {
      res.status(400).json({ error: "organizationId must be a positive integer" });
      return;
    }
    const portal = await deps.billing.createPortal(res.locals.user.id, organizationId);
    if (!portal) res.status(404).json({ error: "Billing customer not found" });
    else res.json(portal);
  });

  app.get("/billing/checkout-sessions/:sessionId", async (req, res) => {
    const result = await deps.billing.reconcileCheckoutSession(res.locals.user.id, req.params.sessionId);
    if (result === "not_found") { res.status(404).json({ error: "Checkout session not found" }); return; }
    res.json({ status: result });
  });

  app.get("/billing/subscription", async (_req, res) => {
    const view = await deps.getAccountEntitlements(res.locals.user.id);
    res.json({
      plan: view.plan,
      entitlementSource: view.entitlementSource,
      promotionExpiresAt: view.promotionExpiresAt,
      status: view.subscription?.status ?? null,
      interval: view.subscription?.billing_interval ?? null,
      currentPeriodEnd: view.subscription?.current_period_end ?? null,
      cancelAtPeriodEnd: view.subscription?.cancel_at_period_end ?? false,
      graceExpiresAt: view.subscription?.grace_expires_at ?? null,
      hasBillingCustomer: Boolean(view.subscription?.paddle_customer_id) || Boolean(view.team),
      team: view.team,
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
    const snapshot = versioned?.snapshot ?? (res.locals.user.role === "admin"
      ? await deps.getDesignSystem(appSlug, platform)
      : await deps.getImportedCurrentDesignSystem(appSlug, platform));
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
    if (await effectiveCustomerPlan(res) === "pro") {
      res.status(409).json({ error: "Pro already includes every app", code: "already_pro" });
      return;
    }
    const result = await deps.unlockFreeApp(res.locals.user.id, req.params.app);
    if (result.status === "unlocked" || result.status === "already_unlocked") {
      await deps.recordAccessEvent({
        userId: res.locals.user.id,
        ipPrefix: ipPrefix(req.ip ?? "unknown"),
        appSlug: req.params.app,
        featureKey: "library",
        action: "unlock_completed",
        outcome: result.status,
        metadata: { remaining: result.remaining },
      });
    }
    const status = result.status === "unlocked" ? 201 : result.status === "app_not_found" ? 404 : 200;
    res.status(status).json(result);
  });

  const appFunnelActions = new Set(["unlock_clicked", "paywall_viewed"]);
  app.post("/apps/:app/funnel-events", async (req, res) => {
    const action = req.body?.action;
    if (!isAppSlug(req.params.app) || typeof action !== "string" || !appFunnelActions.has(action)) {
      res.status(400).json({ error: "invalid app funnel event" });
      return;
    }
    await deps.recordAccessEvent({
      userId: res.locals.user.id,
      ipPrefix: ipPrefix(req.ip ?? "unknown"),
      appSlug: req.params.app,
      featureKey: "library",
      action,
      outcome: "viewed",
    });
    res.status(204).end();
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
    try {
      await deps.recordReferralAppOpen(
        res.locals.user.id,
        appSlug,
        new Date(),
        deps.referralCampaign,
      );
    } catch {
      console.error(`[referrals] app-open recording failed for user ${res.locals.user.id}`);
    }
    return true;
  };

  const resolveAppSection = async (req: express.Request, res: express.Response) => {
    const appSlug = Array.isArray(req.params.app) ? req.params.app[0] : req.params.app;
    const platformValue = optionalQuery(req.query.platform);
    if (platformValue && !isPlatform(platformValue)) {
      res.status(400).json({ error: "invalid platform" });
      return undefined;
    }
    const platforms = await deps.appPlatforms(appSlug);
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
    const version = await deps.resolveAppVersion(appSlug, platform, requestedVersion, publishedOnly);
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
    const appSlug = Array.isArray(req.params.app) ? req.params.app[0] : req.params.app;
    await deps.recordAccessEvent({
      userId: res.locals.user.id,
      ipPrefix: ipPrefix(req.ip ?? "unknown"),
      appSlug,
      featureKey: "library",
      action: "app-detail",
      outcome: "success",
    });
  };

  app.get("/apps/:app/screens", async (req, res) => {
    if (!await authorizeAppDetail(req, res)) return;
    if (Object.keys(req.query).some((key) => !["platform", "version", "cursor", "limit", "type"].includes(key))) {
      res.status(400).json({ error: "invalid screens query" });
      return;
    }
    const section = await resolveAppSection(req, res);
    if (!section) return;
    const limit = req.query.limit === undefined ? 48 : Number(req.query.limit);
    const cursor = optionalQuery(req.query.cursor);
    const screenTypes = req.query.type === undefined
      ? []
      : (Array.isArray(req.query.type) ? req.query.type : [req.query.type])
        .map(optionalQuery)
        .filter((value): value is string => Boolean(value));
    if (!Number.isInteger(limit) || limit < 1 || limit > 48 || (req.query.cursor !== undefined && !cursor)
      || screenTypes.length > 64 || screenTypes.some((type) => type.length > 120)) {
      res.status(400).json({ error: "invalid pagination" });
      return;
    }
    try {
      const queryInput = {
        app: req.params.app,
        kind: "screen" as const,
        platform: section.platform,
        versionNumber: section.version?.version_number,
        publishedOnly: section.publishedOnly,
      };
      const [evidence, screenTypesFacet] = await Promise.all([
        deps.appEvidencePage({ ...queryInput, cursor, limit, screenTypes }),
        deps.appScreenTypes(queryInput),
      ]);
      const page = buildEvidencePage(
        evidence,
        publicImageUrl,
      );
      await recordAppDetailSuccess(req, res);
      res.json({
        ...page,
        screenTypes: screenTypesFacet,
        platform: section.platform,
        version: section.version ?? null,
      });
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
      const page = buildEvidencePage(
        await deps.appEvidencePage({
          app: req.params.app,
          kind: "ui_element",
          platform: section.platform,
          versionNumber: section.version?.version_number,
          cursor,
          limit,
          publishedOnly: section.publishedOnly,
        }),
        publicImageUrl,
      );
      await recordAppDetailSuccess(req, res);
      res.json({ ...page, platform: section.platform, version: section.version ?? null });
    } catch (error) {
      if (error instanceof RangeError) res.status(400).json({ error: error.message });
      else throw error;
    }
  });

  app.get("/apps/:app/ui-element-summary", async (req, res) => {
    if (!await authorizeAppDetail(req, res)) return;
    if (Object.keys(req.query).some((key) => !["platform", "version", "limit"].includes(key))) {
      res.status(400).json({ error: "invalid UI element summary query" });
      return;
    }
    const section = await resolveAppSection(req, res);
    if (!section) return;
    const limit = req.query.limit === undefined ? 12 : Number(req.query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      res.status(400).json({ error: "invalid summary limit" });
      return;
    }
    const summary = await deps.appUiElementSummary({
      app: req.params.app,
      platform: section.platform,
      versionNumber: section.version?.version_number,
      publishedOnly: section.publishedOnly,
      limit,
    });
    await recordAppDetailSuccess(req, res);
    res.json({
      ...summary,
      items: summary.items.map((item) => ({
        type: item.component_type,
        group: item.component_group,
        count: item.occurrence_count,
        imageId: item.image_id,
        imageUrl: publicImageUrl(req.params.app, item.image_url),
        thumbnailUrl: publicImageUrl(req.params.app, item.image_url, "thumb"),
        description: item.description,
        purpose: item.purpose,
        visibleStates: item.visible_states,
      })),
      platform: section.platform,
      version: section.version ?? null,
    });
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
    const hydrated = hydrateDesignSystem(emptySnapshot, images);
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

  app.get("/apps/:app/page-preview/:versionId", async (req, res) => {
    const versionId = positiveId(req.params.versionId);
    if (!isAppSlug(req.params.app) || !versionId) {
      res.status(400).json({ error: "invalid page preview reference" });
      return;
    }
    if (res.locals.user.role !== "admin" && !(await deps.canAccessApp(res.locals.user, req.params.app))) {
      res.status(403).json({ error: "Upgrade required", code: "upgrade_required" });
      return;
    }
    if (!deps.objectStore) {
      res.status(503).json({ error: "media storage unavailable" });
      return;
    }
    const metadata = await deps.publicPageStore.previewObject(
      req.params.app,
      versionId,
      res.locals.user.role !== "admin",
    );
    if (!metadata) {
      res.status(404).json({ error: "page preview not found" });
      return;
    }
    try {
      await sendStoredObject(deps.objectStore, metadata, res);
    } catch {
      res.status(503).json({ error: "media storage unavailable" });
    }
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
    if (DISABLED_IMPORT_JOB_TYPES.has(type)) {
      res.status(410).json(IMPORTS_DISABLED_RESPONSE);
      return;
    }
    if (type === "import-site") {
      let canonicalUrl: string;
      try {
        canonicalUrl = classifySiteImportUrl(url).canonicalUrl;
      } catch {
        res.status(400).json({
          error: "import-site requires a public HTTP(S) URL",
        });
        return;
      }
      // Deliberately no "already imported, skip" short-circuit. It matched on
      // site_versions.canonical_url, which is a per-version UNIQUE key rather
      // than a site identity — for Mobbin imports it holds a mobbin.com URL,
      // so it never matched the real site and the check silently did nothing.
      //
      // It cannot be repaired by pointing it at the real URL either: 64 sites
      // have several versions, and they would all need the same canonical_url.
      // Site identity belongs to sites.source_url, which beginImport matches on
      // (hostname-normalized) to attach a re-crawl as a new version.
      //
      // Recrawling is the point — it is how a Site gets a fresher version — so
      // the request proceeds and beginImport decides new-site vs new-version.
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
    if (type === "crawl-public-page") {
      let canonicalUrl: string;
      try {
        canonicalUrl = canonicalPublicPageUrl(url).requestedUrl;
      } catch {
        res.status(400).json({ error: "crawl-public-page requires a public HTTP(S) URL" });
        return;
      }
      if (!await requireStorageReady(res)) return;
      const id = await deps.createJob(type, { url: canonicalUrl });
      try {
        await deps.publishPublicPageJob({ type, url: canonicalUrl, jobId: id });
      } catch {
        const message = safePublicPageJobError();
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

  app.get("/admin/users", requireAdmin, async (req, res) => {
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

  app.get("/admin/users/growth", requireAdmin, async (_req, res) => {
    const [stats, dailySignups] = await Promise.all([deps.getGrowthStats(), deps.getDailySignups()]);
    res.json({ stats, dailySignups });
  });

  app.get("/admin/referrals/metrics", requireAdmin, async (_req, res) => {
    res.json(await deps.referralCampaignMetrics(deps.referralCampaign.id));
  });

  app.post("/admin/referrals/:id/revoke", requireAdmin, async (req, res) => {
    const id = positiveId(String(req.params.id));
    if (!id) {
      res.status(400).json({ error: "invalid referral id" });
      return;
    }
    if (!await deps.revokeReferral(id)) {
      res.status(404).json({ error: "referral not found" });
      return;
    }
    res.status(204).end();
  });

  app.post("/admin/referral-rewards/:id/revoke", requireAdmin, async (req, res) => {
    const id = positiveId(String(req.params.id));
    if (!id) {
      res.status(400).json({ error: "invalid referral reward id" });
      return;
    }
    if (!await deps.revokeReferralReward(id)) {
      res.status(404).json({ error: "referral reward not found" });
      return;
    }
    res.status(204).end();
  });

  app.post("/admin/promotional-entitlements/:id/revoke", requireAdmin, async (req, res) => {
    const id = positiveId(String(req.params.id));
    if (!id) {
      res.status(400).json({ error: "invalid promotional entitlement id" });
      return;
    }
    if (!await deps.revokePromotionalEntitlement(id)) {
      res.status(404).json({ error: "promotional entitlement not found" });
      return;
    }
    res.status(204).end();
  });

  app.get("/admin/users/usage", requireAdmin, async (req, res) => {
    const range = parseUsageRange(req.query.range === undefined ? undefined : String(req.query.range));
    if (!range) {
      res.status(400).json({ error: "range must be 7d, 30d, or 90d" });
      return;
    }
    res.json(await deps.getFeatureUsageOverview(range));
  });

  app.get("/admin/users/:id/usage", requireAdmin, async (req, res) => {
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

  app.patch("/admin/users/:id/active", requireAdmin, async (req, res) => {
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

  app.post("/admin/users/:id/subscription/upgrade", requireAdmin, async (req, res) => {
    const userId = positiveId(String(req.params.id));
    if (!userId) {
      res.status(400).json({ error: "invalid user id" });
      return;
    }
    const result = await deps.grantAdminUserPro({ actorUserId: res.locals.user.id, userId });
    if (result.status === "not_found") {
      res.status(404).json({ error: "user not found" });
      return;
    }
    if (result.status === "already_pro") {
      res.status(409).json({ error: "user already has Pro access", user: result.user });
      return;
    }
    res.json(result.user);
  });

  app.delete("/admin/users/:id/subscription/grant", requireAdmin, async (req, res) => {
    const userId = positiveId(String(req.params.id));
    if (!userId) {
      res.status(400).json({ error: "invalid user id" });
      return;
    }
    const result = await deps.revokeAdminUserProGrant(userId);
    if (result.status === "not_found") {
      res.status(404).json({ error: "user not found" });
      return;
    }
    if (result.status === "already_pro") {
      res.status(409).json({ error: "user does not have a manual Pro grant", user: result.user });
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
    const versionedSnapshot = versioned?.snapshot;
    const versionedPlaceholder = versionedSnapshot
      && versionedSnapshot.tokens.length === 0
      && versionedSnapshot.components.length === 0
      && (versionedSnapshot.rules?.length ?? 0) === 0;
    const importedCurrent = res.locals.user.role !== "admin"
      && requestedVersion === undefined
      && (!versionedSnapshot || versionedPlaceholder)
      ? await deps.getImportedCurrentDesignSystem(appSlug, platform)
      : undefined;
    const snapshot = (versionedPlaceholder ? importedCurrent ?? versionedSnapshot : versionedSnapshot)
      ?? (res.locals.user.role === "admin" ? await deps.getDesignSystem(appSlug, platform) : importedCurrent);
    const flows = versioned?.flows ?? await deps.getAppFlows(appSlug, platform);
    // Flows come from the crawl and don't require AI synthesis — don't hide them behind a
    // missing design-system snapshot (e.g. an app that's only been through crawl-only import).
    if (!snapshot && flows.length === 0) {
      res.status(404).json({ error: "design system not found" });
      return;
    }
    const effectiveSnapshot = snapshot ?? { app: appSlug, generatedAt: new Date().toISOString(), tokens: [], components: [], flows: [] };
    const sourceImages = versioned
      ? await deps.versionImages(appSlug, platform, versioned.version.version_number, ["screen", "flow_step"])
      : await deps.appImages(appSlug, ["screen", "flow_step"]);
    const cropImageIds = new Set(
      effectiveSnapshot.components.flatMap(({ variants }) =>
        variants.flatMap(({ occurrences }) =>
          (occurrences ?? []).flatMap(({ cropImageId }) =>
            cropImageId === undefined ? [] : [cropImageId]))),
    );
    const cropImages = cropImageIds.size === 0
      ? []
      : (await deps.appImages(appSlug, ["ui_element"]))
          .filter(({ id }) => cropImageIds.has(id));
    const images = [...sourceImages, ...cropImages];
    const hydrated = hydrateDesignSystem({ ...effectiveSnapshot, flows }, images);
    res.json({ ...hydrated, version: versioned?.version ?? null });
  });

  return app;
}
