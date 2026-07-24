// One-time bulk operation: imports every app in Mobbin's catalog (web + iOS + Android).
// Resumable — progress persists to STATE_PATH after every job, so killing and re-running
// this script picks up where it left off instead of starting over.
//
// Parallel workers: set WORKER_ID (e.g. "1", "2") to run this as one of several concurrent
// workers. Each worker reads/writes its OWN state file (catalog-import-state-<id>.json) and
// uses its OWN browser profile directory — the job list must be pre-partitioned across
// workers' state files before starting them (no shared file, no write-conflict risk). Each
// worker profile is a full copy of the authenticated session; cloning it requires explicit
// user authorization (duplicates live session cookies) — do this once, not per run.
process.env.OBJECT_STORE_BACKEND = "s3";
process.env.OBJECT_STORE_S3_BUCKET = "vitrine-ai-prod";
process.env.OBJECT_STORE_S3_REGION = "ap-southeast-1";
process.env.OBJECT_STORE_S3_PREFIX = "prod";
process.env.AWS_PROFILE = "vitrine-ai-prod";
// Confirmed working against the real authenticated profile: bot detection blocks headless
// LOGIN attempts, not headless browsing/downloads once a session already has valid cookies.
process.env.HEADLESS = "true";

const WORKER_ID = process.env.WORKER_ID?.trim();
process.env.MOBBIN_PROFILE_DIR = WORKER_ID && WORKER_ID !== "1"
  ? `data/browser-profile-mobbin-worker${WORKER_ID}`
  : "data/browser-profile-mobbin";

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import {
  appKnowledgeEvidenceSource,
  createJob,
  getJob,
  insertImage,
  listAppVersions,
  pool,
  query,
  setJobStatus,
} from "../src/db.ts";
import { attachImageObject, attachThumbnailObject } from "../src/objectStoreDb.ts";
import { createObjectStore, objectStoreConfigFromEnvironment } from "../src/objectStoreConfig.ts";
import { crawlBulkDownload, crawlFlowsDownload, type BulkObjectDependencies } from "../src/bulkDownload.ts";
import { disambiguateCatalogSlugs } from "../src/catalogIdentity.ts";
import {
  assertCatalogPersistenceComplete,
  CatalogPersistenceError,
  catalogJobKey,
  emptyCatalogPersistence,
  loadCatalogPersistence,
} from "../src/catalogVerification.ts";
import {
  assertCatalogStageComplete,
  catalogRepairPlan,
  markCatalogPhaseComplete,
  shouldRunCatalogJob,
  type CatalogRepairPhases,
} from "../src/progress.ts";
import { launchMobbinContext } from "../src/crawler.ts";
import { createAppKnowledgeStore } from "../src/appKnowledgeStore.ts";
import { buildAppKnowledgeEvidenceManifest } from "../src/appKnowledgeEvidence.ts";
import {
  automaticAppKnowledgeConfigFromEnvironment,
  completeCatalogCrawlAndHandoff,
  ensureAutomaticAppKnowledgeJob,
} from "../src/appKnowledgeAutomatic.ts";
import { appKnowledgeProviderModelFromEnvironment } from "../src/appKnowledgeProviderConfig.ts";
import { publishJob } from "../src/queue.ts";

const STATE_PATH = WORKER_ID ? `data/catalog-import-state-${WORKER_ID}.json` : "data/catalog-import-state.json";
const LOG_PREFIX = WORKER_ID ? `w${WORKER_ID}:` : "";
const INTER_APP_DELAY_MS = 8_000;

type Platform = "web" | "ios" | "android";
type JobStatus = "pending" | "done" | "failed" | "skipped";
interface Job {
  mobbinId: string;
  platform: Platform;
  appName: string;
  slug: string;
  status: JobStatus;
  error?: string;
  finishedAt?: string;
  repair?: CatalogRepairPhases;
  verification?: Partial<Record<"screens" | "uiElements" | "flows", { discovered: number; captured: number }>>;
}
interface State {
  generatedAt: string;
  jobs: Job[];
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "app";
}

function loadState(): State | undefined {
  if (!existsSync(STATE_PATH)) return undefined;
  try {
    return JSON.parse(readFileSync(STATE_PATH, "utf8"));
  } catch {
    return undefined;
  }
}

function saveState(state: State): void {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

async function fetchCatalog(): Promise<Job[]> {
  const context = await chromium.launchPersistentContext(process.env.MOBBIN_PROFILE_DIR!, { headless: false });
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto("https://mobbin.com/discover/apps/web/latest", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const jobs: Job[] = [];
  for (const platform of ["web", "ios", "android"] as const) {
    const apps = await page.evaluate(async (p) => {
      const res = await fetch(`https://mobbin.com/api/searchable-apps/${p}`);
      const json = await res.json();
      return (json.value ?? []).map((a: { id: string; appName: string }) => ({ id: a.id, appName: a.appName }));
    }, platform);
    for (const app of apps) {
      jobs.push({ mobbinId: app.id, platform, appName: app.appName, slug: toSlug(app.appName), status: "pending" });
    }
  }
  await context.close();
  return disambiguateCatalogSlugs(jobs);
}

async function alreadyImported(slug: string, platform: Platform): Promise<boolean> {
  const res = await query(
    `SELECT 1 FROM images i JOIN platforms p ON p.id = i.platform_id JOIN apps a ON a.id = p.app_id
     WHERE a.name = $1 AND p.name = $2 LIMIT 1`,
    [slug, platform],
  );
  return res.rowCount! > 0;
}

function log(message: string): void {
  console.log(`[${new Date().toISOString()}] ${LOG_PREFIX}${message}`);
}

const objectStore = createObjectStore(objectStoreConfigFromEnvironment(process.env));
const appKnowledgeStore = createAppKnowledgeStore();
const automaticAppKnowledgeConfig =
  automaticAppKnowledgeConfigFromEnvironment(process.env);
async function ensureAutomaticKnowledgeForCapture(
  app: string,
  platform: Platform,
): Promise<void> {
  if (!automaticAppKnowledgeConfig.enabled) return;
  const version = (await listAppVersions(app, platform, false))
    .find(({ status }) => status === "draft" || status === "in_review");
  if (!version) throw new Error("Automatic App Knowledge capture version was not found");
  const source = await appKnowledgeEvidenceSource({
    app,
    platform,
    versionNumber: version.version_number,
  });
  if (!source) throw new Error("Automatic App Knowledge evidence was not found");
  const prepared = await buildAppKnowledgeEvidenceManifest({
    source,
    objectStore,
    overrides: await appKnowledgeStore.evidenceOverrides(version.id),
  });
  await ensureAutomaticAppKnowledgeJob({
    app,
    platform,
    captureVersionId: version.id,
    sourceSha256: prepared.sourceSha256,
    providerModel: appKnowledgeProviderModelFromEnvironment(process.env),
    promptVersion: automaticAppKnowledgeConfig.promptVersion,
  }, {
    environment: process.env,
    allowlist: automaticAppKnowledgeConfig.allowlist,
    store: appKnowledgeStore,
    createTransportJob: () => createJob("generate-app-knowledge", {}),
    getTransportJob: getJob,
    setTransportJobStatus: setJobStatus,
    publishJob,
  });
}

const storage: BulkObjectDependencies = {
  objectStore,
  insertImage,
  attachImage: async (imageId, metadata) => {
    const client = await pool.connect();
    try { await attachImageObject(client, { imageId, metadata }); } finally { client.release(); }
  },
  attachThumbnail: async (imageId, metadata) => {
    const client = await pool.connect();
    try { await attachThumbnailObject(client, { imageId, metadata }); } finally { client.release(); }
  },
};

// The default SIGTERM/SIGINT action kills the process immediately, mid-crawl — which kills
// Chromium mid-write and has corrupted the persistent profile's session cookies (silently
// logging the profile out) more than once. Catch both instead: finish the in-flight job
// (its own Done/FAILED + saveState already happens naturally) and exit before starting the
// next one, so `kill <pid>` is always safe. A second signal still force-exits immediately,
// for when someone genuinely needs the hard stop.
let stopRequested = false;
for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, () => {
    if (stopRequested) { log(`${sig} received again — forcing immediate exit.`); process.exit(1); }
    stopRequested = true;
    log(`${sig} received — finishing the current job, then exiting cleanly.`);
  });
}

let state = loadState();
if (!state) {
  log("No existing state found — fetching full Mobbin catalog...");
  state = { generatedAt: new Date().toISOString(), jobs: await fetchCatalog() };
  // Only checked once, at first-time state generation — this catches apps imported
  // manually outside this script (e.g. cleo-ai, lang-chain) before the batch run started.
  // It must NOT run again on every resume: a job interrupted mid-run (screens done,
  // ui-elements/flows not yet) already has *some* images, and re-checking "any images
  // exist" on resume would wrongly mark it "skipped" and permanently strand it incomplete.
  // Once a job is in the state file, its own status is authoritative — pending means retry.
  for (const job of state.jobs) {
    if (await alreadyImported(job.slug, job.platform)) {
      job.status = "skipped";
      job.finishedAt = new Date().toISOString();
    }
  }
  saveState(state);
  log(`Fetched ${state.jobs.length} apps across web/ios/android.`);
} else {
  log(`Resuming from existing state: ${state.jobs.length} jobs, ` +
    `${state.jobs.filter((j) => j.status === "done").length} done, ` +
    `${state.jobs.filter((j) => j.status === "failed").length} failed, ` +
    `${state.jobs.filter((j) => j.status === "skipped").length} skipped.`);
}

const repairOnly = process.env.CATALOG_REPAIR_ONLY === "1";
for (const job of state.jobs) {
  if (!shouldRunCatalogJob(repairOnly, job)) continue;
  if (stopRequested) {
    log("Stopping: shutdown requested, current job finished cleanly.");
    break;
  }

  const url = `https://mobbin.com/apps/${job.slug}-${job.platform}-${job.mobbinId}/latest/screens`;
  log(`Importing "${job.appName}" (${job.platform}) -> ${job.slug}`);
  // One browser context reused across all 3 phases instead of a fresh Chromium launch
  // per phase — same session, just skips paying cold-start cost 3x per app.
  const jobContext = await launchMobbinContext();
  try {
    job.repair = catalogRepairPlan(job.repair);
    job.verification ??= {};
    saveState(state);
    if (job.repair.screens) {
      const screens = await crawlBulkDownload(url, job.slug, "screens", 60_000, storage, job.platform, jobContext);
      assertCatalogStageComplete("screens", screens);
      job.verification.screens = { discovered: screens.discovered, captured: screens.captured };
      job.repair = markCatalogPhaseComplete(job.repair, "screens");
      saveState(state);
    }
    if (job.repair.uiElements) {
      const uiElements = await crawlBulkDownload(url, job.slug, "ui-elements", 20_000, storage, job.platform, jobContext);
      assertCatalogStageComplete("ui-elements", uiElements);
      job.verification.uiElements = { discovered: uiElements.discovered, captured: uiElements.captured };
      job.repair = markCatalogPhaseComplete(job.repair, "uiElements");
      saveState(state);
    }
    if (job.repair.flows) {
      const flows = await crawlFlowsDownload(url, job.slug, 20_000, storage, job.platform, jobContext);
      assertCatalogStageComplete("flows", flows);
      job.verification.flows = { discovered: flows.discovered, captured: flows.captured };
      job.repair = markCatalogPhaseComplete(job.repair, "flows");
      saveState(state);
    }
    const expected = {
      screens: job.verification.screens?.discovered,
      uiElements: job.verification.uiElements?.discovered,
      flows: job.verification.flows?.discovered,
    };
    const persistedByJob = await loadCatalogPersistence(pool, [{ app: job.slug, platform: job.platform }]);
    const persisted = persistedByJob.get(catalogJobKey(job.slug, job.platform))
      ?? emptyCatalogPersistence(job.slug, job.platform);
    try {
      assertCatalogPersistenceComplete(expected, persisted);
    } catch (error) {
      if (error instanceof CatalogPersistenceError) job.repair = error.repair;
      throw error;
    }
    await completeCatalogCrawlAndHandoff({
      job,
      saveState: () => saveState(state),
      log,
      handoff: () => ensureAutomaticKnowledgeForCapture(job.slug, job.platform),
    });
  } catch (error) {
    job.status = "failed";
    job.error = String((error as Error)?.message ?? error);
    log(`FAILED: ${job.slug} (${job.platform}) — ${job.error}`);
  } finally {
    await jobContext.close().catch(() => {});
  }
  job.finishedAt = new Date().toISOString();
  saveState(state);

  await new Promise((r) => setTimeout(r, INTER_APP_DELAY_MS));
}

const summary = {
  done: state.jobs.filter((j) => j.status === "done").length,
  failed: state.jobs.filter((j) => j.status === "failed").length,
  skipped: state.jobs.filter((j) => j.status === "skipped").length,
  pending: state.jobs.filter((j) => j.status === "pending").length,
};
log(`Batch run complete: ${JSON.stringify(summary)}`);
await pool.end();
