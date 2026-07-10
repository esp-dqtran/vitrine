import express from "express";
import { resolve } from "node:path";
import {
  query,
  allImages,
  createJob,
  listJobs,
  getJob,
  setJobStatus,
  getDesignSystem,
  appImages,
  getAppFlows,
} from "../../../src/db.ts";
import {
  authenticateUser,
  createSession,
  deleteSession,
  resolveSession,
} from "../../../src/authStore.ts";
import { publishJob, type Job } from "../../../src/queue.ts";
import { readProgress, requestCancel } from "../../../src/progress.ts";
import { findBulkImage, isAppSlug } from "../../../src/imageSource.ts";
import { hydrateDesignSystem } from "../../../src/designSystem.ts";
import { buildGalleryApps } from "../../../src/gallery.ts";

const JOB_TYPES = ["discover-catalog", "import-app", "caption-app", "synthesize-app"] as const;
export const DEFAULT_API_PORT = 3010;
const defaults = {
  query,
  allImages,
  createJob,
  listJobs,
  getJob,
  setJobStatus,
  getDesignSystem,
  appImages,
  getAppFlows,
  publishJob,
  readProgress,
  requestCancel,
  authenticateUser,
  createSession,
  resolveSession,
  deleteSession,
  dataDir: process.env.DATA_DIR ?? "data",
};
type ApiDeps = typeof defaults;

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

export function createApiApp(overrides: Partial<ApiDeps> = {}) {
  const deps = { ...defaults, ...overrides };
  const app = express();
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

  app.use(async (req, res, next) => {
    const token = cookieValue(req.headers.cookie, SESSION_COOKIE);
    const user = token ? await deps.resolveSession(token) : undefined;
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    res.locals.user = user;
    next();
  });

  const requireAdmin: express.RequestHandler = (_req, res, next) => {
    if (res.locals.user.role !== "admin") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    next();
  };

  app.get("/auth/me", (_req, res) => res.json(res.locals.user));

  app.get("/apps", async (_req, res) => {
    res.json(buildGalleryApps(await deps.allImages()));
  });

  app.get("/images", async (req, res) => {
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

  app.get("/progress", (_req, res) => {
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

  app.get("/jobs", async (_req, res) => {
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
    const snapshot = await deps.getDesignSystem(appSlug);
    if (!snapshot) {
      res.status(404).json({ error: "design system not found" });
      return;
    }
    const flows = await deps.getAppFlows(appSlug);
    res.json(hydrateDesignSystem({ ...snapshot, flows }, await deps.appImages(appSlug)));
  });

  app.get("/media/:app/:hash", (req, res) => {
    if (!isAppSlug(req.params.app) || !/^[0-9a-f]{16}$/.test(req.params.hash)) {
      res.status(400).json({ error: "invalid media reference" });
      return;
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
