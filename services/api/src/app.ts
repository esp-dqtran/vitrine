import express from "express";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import {
  query,
  allImages,
  createJob,
  listJobs,
  getJob,
  setJobStatus,
  getDesignSystem,
  listDesignSystems,
  appImages,
  getAppFlows,
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
  recordExport,
} from "../../../src/db.ts";
import {
  authenticateUser,
  createSession,
  deleteSession,
  resolveSession,
  resolveSessionState,
} from "../../../src/authStore.ts";
import { publishJob, type Job } from "../../../src/queue.ts";
import { readProgress, requestCancel } from "../../../src/progress.ts";
import { bulkImageHash, findBulkImage, isAppSlug, parseImageSource } from "../../../src/imageSource.ts";
import { hydrateDesignSystem } from "../../../src/designSystem.ts";
import { buildAppDetailPage, buildCatalogPage, buildGalleryApps } from "../../../src/gallery.ts";
import {
  canAccessApp,
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
import type { ObjectMetadata, ObjectStore } from "../../../src/objectStore.ts";
import {
  adminImageObject,
  entitledImageObject,
  legacyImageReference,
  publishedPreviewObject,
} from "../../../src/objectStoreDb.ts";

const JOB_TYPES = ["discover-catalog", "import-app", "caption-app", "synthesize-app"] as const;
export const DEFAULT_API_PORT = 3010;
const disabledBilling: BillingService = {
  createCheckout: async () => { throw new Error("Billing is not configured"); },
  createPortal: async () => { throw new Error("Billing is not configured"); },
  handleWebhook: async () => { throw new Error("Billing is not configured"); },
};
const defaults = {
  query,
  allImages,
  createJob,
  listJobs,
  getJob,
  setJobStatus,
  getDesignSystem,
  listDesignSystems,
  appImages,
  getAppFlows,
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
  recordExport,
  publishJob,
  readProgress,
  requestCancel,
  authenticateUser,
  createSession,
  resolveSession,
  resolveSessionState,
  deleteSession,
  canAccessApp,
  unlockFreeApp,
  getAccountEntitlements,
  recordAccessEvent,
  reserveExportOperation,
  billing: disabledBilling,
  generalRateLimit: 300,
  mediaRateLimit: 500,
  appTraversalLimit: 20,
  mediaSigningSecret: process.env.MEDIA_SIGNING_SECRET ?? "development-media-signing-secret",
  nowSeconds: () => Math.floor(Date.now() / 1000),
  dataDir: process.env.DATA_DIR ?? "data",
  objectStore: undefined as ObjectStore | undefined,
  adminImageObject,
  entitledImageObject,
  legacyImageReference,
  publishedPreviewObject,
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
const exportFormats = new Set<ExportFormat>(["figma", "json", "css", "tailwind", "component-spec", "react"]);

function optionalQuery(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function positiveId(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
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
  const signed = await store.signedGetUrl(metadata.key, 60);
  if (signed) {
    res.setHeader("Cache-Control", "private, no-store");
    res.redirect(302, signed);
    return;
  }
  const object = await store.get(metadata.key);
  if (!sameObjectMetadata(object.metadata, metadata)) throw new Error("Object metadata mismatch");
  res.setHeader("Content-Type", metadata.contentType);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(object.body);
}

export function createApiApp(overrides: Partial<ApiDeps> = {}) {
  const deps = {
    ...defaults,
    ...overrides,
    publishedImages: overrides.publishedImages ?? overrides.allImages ?? defaults.publishedImages,
    listPublishedDesignSystems: overrides.listPublishedDesignSystems ?? overrides.listDesignSystems ?? defaults.listPublishedDesignSystems,
    listPublishedFlowSets: overrides.listPublishedFlowSets ?? overrides.listAppFlowSets ?? defaults.listPublishedFlowSets,
  };
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

  app.post("/auth/logout", async (req, res) => {
    const token = cookieValue(req.headers.cookie, SESSION_COOKIE);
    if (token) await deps.deleteSession(token);
    res.clearCookie(SESSION_COOKIE, cookieOptions).status(204).end();
  });

  app.get("/catalog", async (req, res) => {
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
    const [images, previews] = await Promise.all([deps.publishedImages(), deps.publishedPreviewImages()]);
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

  const protectedMediaUrl = (userId: number, appSlug: string, source: string): string => {
    const parsed = parseImageSource(source);
    if (!parsed) return "";
    if (parsed.kind === "external") return parsed.url;
    const hash = parsed.hash;
    const expiresAt = deps.nowSeconds() + 300;
    const token = createMediaToken(deps.mediaSigningSecret, { userId, app: appSlug, hash, expiresAt });
    return `/api/media/${appSlug}/${hash}?expires=${expiresAt}&token=${encodeURIComponent(token)}`;
  };

  app.get("/auth/me", (_req, res) => res.json(res.locals.user));

  app.get("/apps/:app/versions", async (req, res) => {
    const appSlug = String(req.params.app);
    if (!isAppSlug(appSlug)) {
      res.status(400).json({ error: "invalid app slug" });
      return;
    }
    res.json(await deps.listAppVersions(appSlug, res.locals.user.role !== "admin"));
  });

  app.post("/apps/:app/versions", requireAdmin, async (req, res) => {
    const appSlug = String(req.params.app);
    const sourceUrl = boundedText(req.body?.sourceUrl, 2000);
    if (!isAppSlug(appSlug) || sourceUrl === undefined || (sourceUrl && !validMobbinScreensUrl(sourceUrl))) {
      res.status(400).json({ error: "invalid recapture request" });
      return;
    }
    try {
      const version = await deps.createAppVersion(appSlug, res.locals.user.id, sourceUrl || undefined);
      if (sourceUrl) {
        const jobId = await deps.createJob("import-app", { name: appSlug, url: sourceUrl, versionId: version.id });
        try { await deps.publishJob({ type: "import-app", name: appSlug, url: sourceUrl, jobId }); }
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
    if (!isAppSlug(appSlug) || !req.body || typeof req.body !== "object") {
      res.status(400).json({ error: "invalid curator action" });
      return;
    }
    const snapshot = await deps.getDesignSystem(appSlug);
    if (!snapshot) {
      res.status(404).json({ error: "design system not found" });
      return;
    }
    try {
      const reviewed = applyCuratorAction({ ...snapshot, flows: await deps.getAppFlows(appSlug) }, req.body as CuratorAction);
      await deps.saveDesignSystem(appSlug, { ...reviewed, flows: [] });
      await deps.saveAppFlows(appSlug, reviewed.flows);
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
    res.json(searchCatalog({
      images: allowedImages,
      systems: systems.filter(({ app }) => allowed.has(app)),
      flows: flows.filter(({ app }) => allowed.has(app)),
      appCategories,
    }, {
      query: optionalQuery(req.query.q) ?? "",
      kind: requestedKind as CatalogEntityKind | "all",
      theme: optionalQuery(req.query.theme),
      pageType: optionalQuery(req.query.pageType),
      productArea: optionalQuery(req.query.productArea),
      state: optionalQuery(req.query.state),
      layout: optionalQuery(req.query.layout),
      component: optionalQuery(req.query.component),
      viewport: optionalQuery(req.query.viewport),
      appCategory: optionalQuery(req.query.appCategory),
      limit: optionalQuery(req.query.limit) ? Number(req.query.limit) : undefined,
    }));
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
    res.status(201).json(await deps.createCollection(res.locals.user.id, name, description));
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
    else res.status(201).json(item);
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
    else res.json(item);
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
    const selection = parseExportSelection(req.body?.selection);
    if (!isAppSlug(appSlug) || !exportFormats.has(format) || !selection) {
      res.status(400).json({ error: "invalid export request" });
      return;
    }
    if (!(await deps.canAccessApp(res.locals.user, appSlug))) {
      res.status(403).json({ error: "Upgrade required", code: "upgrade_required" });
      return;
    }
    const versioned = res.locals.user.role === "admin" ? undefined : await deps.getVersionDesignSystem(appSlug);
    const snapshot = versioned?.snapshot ?? (res.locals.user.role === "admin" ? await deps.getDesignSystem(appSlug) : undefined);
    if (!snapshot) {
      res.status(404).json({ error: "design system not found" });
      return;
    }
    const [flows, images] = versioned
      ? [versioned.flows, await deps.versionImages(appSlug, versioned.version.version_number)] as const
      : await Promise.all([deps.getAppFlows(appSlug), deps.appImages(appSlug)]);
    const exportImages = images.map((image) => {
      const hash = bulkImageHash(image.image_url);
      const path = hash ? findBulkImage(deps.dataDir, appSlug, hash) : undefined;
      return { ...image, imageData: path ? readFileSync(path).toString("base64") : undefined };
    });
    let artifact;
    try {
      artifact = buildExportArtifact({ ...snapshot, flows }, exportImages, format, selection);
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
    await deps.recordAccessEvent({
      userId: res.locals.user.id,
      ipPrefix: ipPrefix(req.ip ?? "unknown"),
      appSlug,
      action: `export-${format}`,
      outcome: "allowed",
    });
    await deps.recordExport(res.locals.user.id, appSlug, versioned?.version.id, selection, format, artifact.filename);
    res.setHeader("Content-Type", artifact.mime);
    res.setHeader("Content-Disposition", `attachment; filename="${artifact.filename}"`);
    res.setHeader("X-Astryx-Export-Used", String(reservation.used));
    res.send(artifact.content);
  });

  app.post("/apps/:app/exports/reservations", async (req, res) => {
    if (!isAppSlug(req.params.app)) {
      res.status(400).json({ error: "invalid app slug" });
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
      const snapshot = await deps.getDesignSystem(req.params.app);
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
      action: "export-reservation",
      outcome: "allowed",
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

  app.get("/apps/:app", async (req, res) => {
    if (!isAppSlug(req.params.app)) {
      res.status(400).json({ error: "invalid app slug" });
      return;
    }
    if (res.locals.user.role !== "admin") {
      const traversal = traversalLimiter.check(`user:${res.locals.user.id}`, req.params.app);
      if (!traversal.allowed) {
        res.setHeader("Retry-After", String(traversal.retryAfterSeconds));
        await deps.recordAccessEvent({
          userId: res.locals.user.id,
          ipPrefix: ipPrefix(req.ip ?? "unknown"),
          appSlug: req.params.app,
          action: "app-detail",
          outcome: "blocked",
        });
        res.status(429).json({
          error: "Security verification required",
          code: "verification_required",
          retryAfterSeconds: traversal.retryAfterSeconds,
        });
        return;
      }
    }
    if (!(await deps.canAccessApp(res.locals.user, req.params.app))) {
      res.status(403).json({ error: "Upgrade required", code: "upgrade_required" });
      return;
    }
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
    const requestedVersion = optionalQuery(req.query.version) ? Number(req.query.version) : undefined;
    if (requestedVersion !== undefined && (!Number.isInteger(requestedVersion) || requestedVersion < 1)) {
      res.status(400).json({ error: "invalid version" });
      return;
    }
    const versions = await deps.listAppVersions(req.params.app, res.locals.user.role !== "admin");
    const selectedVersion = requestedVersion === undefined
      ? versions.find(({ status }) => status === "published")
      : versions.find(({ version_number }) => version_number === requestedVersion);
    const sourceImages = selectedVersion
      ? await deps.versionImages(req.params.app, selectedVersion.version_number)
      : res.locals.user.role === "admin" ? await deps.allImages() : [];
    const page = buildAppDetailPage(
      sourceImages,
      req.params.app,
      cursor,
      limit,
      (appSlug, source) => protectedMediaUrl(res.locals.user.id, appSlug, source),
    );
    if (!page) res.status(404).json({ error: "app not found" });
    else {
      await deps.recordAccessEvent({
        userId: res.locals.user.id,
        ipPrefix: ipPrefix(req.ip ?? "unknown"),
        appSlug: req.params.app,
        action: "app-detail",
        outcome: "allowed",
      });
      res.json({ ...page, version: selectedVersion ?? null });
    }
  });

  app.get("/apps", requireAdmin, async (_req, res) => {
    res.json(buildGalleryApps(await deps.allImages()));
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

  app.post("/progress/cancel", requireAdmin, (_req, res) => {
    deps.requestCancel();
    res.status(204).end();
  });

  app.post("/jobs", requireAdmin, async (req, res) => {
    const { type, name, url } = req.body ?? {};
    if (!JOB_TYPES.includes(type)) {
      res.status(400).json({ error: `type must be one of: ${JOB_TYPES.join(", ")}` });
      return;
    }
    if (type === "import-app" && (!isAppSlug(name) || !validMobbinScreensUrl(url))) {
      res.status(400).json({
        error: "import-app requires a lowercase app slug and an HTTPS Mobbin screens URL",
      });
      return;
    }
    if ((type === "caption-app" || type === "synthesize-app") && !isAppSlug(name)) {
      res.status(400).json({ error: `${type} requires a lowercase app slug` });
      return;
    }

    const payload = { name, url };
    const id = await deps.createJob(type, payload);
    try {
      await deps.publishJob({ type, name, url, jobId: id } as Job);
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

  app.post("/jobs/:id/cancel", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const job = await deps.getJob(id);
    if (!job) {
      res.status(404).json({ error: "job not found" });
      return;
    }
    if (job.status === "queued" || job.status === "running") {
      if (job.status === "running") deps.requestCancel();
      await deps.setJobStatus(id, "cancelled", "Cancelled by user");
    }
    res.json(await deps.getJob(id));
  });

  app.get("/design-systems/:app", async (req, res) => {
    const appSlug = req.params.app;
    if (!isAppSlug(appSlug)) {
      res.status(400).json({ error: "invalid app slug" });
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
      const published = await deps.listAppVersions(appSlug, true);
      if (!published.some(({ version_number }) => version_number === requestedVersion)) {
        res.status(404).json({ error: "published design system version not found" });
        return;
      }
    }
    const versioned = requestedVersion !== undefined || res.locals.user.role !== "admin"
      ? await deps.getVersionDesignSystem(appSlug, requestedVersion)
      : undefined;
    const snapshot = versioned?.snapshot ?? (res.locals.user.role === "admin" ? await deps.getDesignSystem(appSlug) : undefined);
    if (!snapshot) {
      res.status(404).json({ error: "design system not found" });
      return;
    }
    const flows = versioned?.flows ?? await deps.getAppFlows(appSlug);
    const images = versioned ? await deps.versionImages(appSlug, versioned.version.version_number) : await deps.appImages(appSlug);
    const hydrated = res.locals.user.role === "admin"
      ? hydrateDesignSystem({ ...snapshot, flows }, images)
      : hydrateDesignSystem(
          { ...snapshot, flows },
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
        ? await deps.adminImageObject({ app: req.params.app, hash: req.params.hash })
        : await deps.entitledImageObject({ userId: res.locals.user.id, app: req.params.app, hash: req.params.hash });
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
        hash: req.params.hash,
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
