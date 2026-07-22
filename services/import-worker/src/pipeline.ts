import { appHasImages, appPlatforms, createJob, getJob, setJobStatus } from "../../../src/db.ts";
import { discoverApps } from "../../../src/discoverApps.ts";
import { crawlBulkDownload, crawlFlowsDownload } from "../../../src/bulkDownload.ts";
import { caption } from "../../../src/caption.ts";
import { synthesize } from "../../../src/synthesize.ts";
import { publishJob, type Job } from "../../../src/queue.ts";
import { isPlatform, platformFromUrl } from "../../../src/platformFromUrl.ts";
import type { StageOutcome } from "../../../src/progress.ts";
import { CrawlRunInterruptedError, type CrawlRunService } from "../../../src/crawlRun.ts";
import { researchAppJob, type ResearchAppJobInput } from "../../../src/crawlJobs.ts";
import type { FeatureDocumentJobStatus } from "../../../src/featureDocument.ts";

const DEFAULT_PROVIDER = "chatgpt";
// Screens establishes login (up to 30 min); UI Elements / Flows then fail fast if the app
// lacks that tab rather than blocking the import for the full login window.
const SUPPLEMENTARY_GRID_WAIT_MS = 20_000;

const defaults = {
  appHasImages,
  appPlatforms,
  createJob,
  getJob,
  setJobStatus,
  discoverApps,
  crawlBulkDownload,
  crawlFlowsDownload,
  caption,
  synthesize,
  publishJob,
  researchAppJob,
  crawlRunService: {
    execute: async () => { throw new Error("Crawl run service is not configured"); },
  } as Pick<CrawlRunService, "execute">,
  autonomousOrchestrator: {
    run: async (_runId: string): Promise<{ runId: string; status: "succeeded" | "interrupted" | "cancelled" | "failed" }> => {
      throw new Error("Autonomous orchestrator is not configured");
    },
  },
  generateFeatureDocument: async (_runId: string): Promise<FeatureDocumentJobStatus | undefined> => {
    throw new Error("Feature document service is not configured");
  },
};
type PipelineDeps = typeof defaults;

export function createPipelineHandler(overrides: Partial<PipelineDeps> = {}) {
  const deps = { ...defaults, ...overrides };

  async function enqueue(job: Job, parentId?: number): Promise<void> {
    const { type, jobId: _ignored, ...payload } = job;
    const jobId = await deps.createJob(type, payload, parentId);
    await deps.publishJob({ ...job, jobId });
  }

  async function handle(job: Exclude<Job, { type: "smart-crawl-app" | "autonomous-crawl-app" | "generate-feature-document" }>): Promise<StageOutcome> {
    if (job.type === "discover-catalog") {
      const apps = await deps.discoverApps();
      for (const target of apps) {
        if (!(await deps.appHasImages(target.name))) {
          await enqueue({ type: "import-app", name: target.name, url: target.url, platform: platformFromUrl(target.url) }, job.jobId);
        }
      }
      return { status: "done" };
    }

    if (job.type === "import-app") {
      // An import crawls all three Mobbin tabs. Screens are required; UI Elements and Flows
      // are supplementary — an empty or failing tab must not fail the whole import, but a
      // user cancel still halts the pipeline. The confirmed platform (chosen at import time)
      // always overrides each crawl's own URL-based guess.
      const screens = await deps.crawlBulkDownload(job.url, job.name, "screens", undefined, undefined, job.platform);
      if (screens.status !== "done") return screens;

      // Login is established now, so give the supplementary tabs a short grid-wait: an app
      // that simply has no UI Elements / Flows tab fails fast instead of hanging.
      const uiElements = await deps.crawlBulkDownload(job.url, job.name, "ui-elements", SUPPLEMENTARY_GRID_WAIT_MS, undefined, job.platform);
      if (uiElements.status === "cancelled") return uiElements;

      const flows = await deps.crawlFlowsDownload(job.url, job.name, SUPPLEMENTARY_GRID_WAIT_MS, undefined, job.platform);
      if (flows.status === "cancelled") return flows;

      await enqueue({ type: "caption-app", name: job.name }, job.jobId);
      return screens;
    }

    if (job.type === "caption-app") {
      const outcome = await deps.caption(DEFAULT_PROVIDER, undefined, job.name);
      if (outcome.status === "done") {
        // Captioning is one app-wide batch (cheap, no reason to split), but each platform's
        // design system is synthesized independently — refresh every platform present.
        const platforms = (await deps.appPlatforms(job.name)).filter(isPlatform);
        for (const platform of platforms) {
          await enqueue({ type: "synthesize-app", name: job.name, platform }, job.jobId);
        }
      }
      return outcome;
    }

    if (job.type === "research-app") {
      const input: ResearchAppJobInput = {
        name: job.name,
        homepageUrl: job.homepageUrl,
        ...(job.provider ? { provider: job.provider } : {}),
      };
      await deps.researchAppJob(input);
      return { status: "done" };
    }

    return deps.synthesize(job.name, job.platform, DEFAULT_PROVIDER);
  }

  return async function trackedHandleJob(job: Job): Promise<void> {
    if (job.jobId != null) {
      const record = await deps.getJob(job.jobId);
      if (record?.status === "cancelled") return;
      await deps.setJobStatus(job.jobId, "running");
    }

    if (job.type === "smart-crawl-app") {
      try {
        const run = await deps.crawlRunService.execute(job.runId);
        if (job.jobId != null) {
          const status = run.status === "succeeded" ? "done" : run.status === "cancelled" ? "cancelled" : "error";
          await deps.setJobStatus(job.jobId, status, status === "error" ? `Crawl run ${run.status}` : undefined);
        }
      } catch (error) {
        if (job.jobId != null) await deps.setJobStatus(job.jobId, "error", (error as Error).message);
        if (error instanceof CrawlRunInterruptedError) throw error;
      }
      return;
    }

    if (job.type === "autonomous-crawl-app") {
      try {
        const run = await deps.autonomousOrchestrator.run(job.runId);
        if (job.jobId != null) {
          const status = run.status === "succeeded" ? "done" : run.status === "cancelled" ? "cancelled" : "error";
          await deps.setJobStatus(job.jobId, status, status === "error" ? `Autonomous crawl run ${run.status}` : undefined);
        }
      } catch (error) {
        if (job.jobId != null) await deps.setJobStatus(job.jobId, "error", (error as Error).message);
        throw error;
      }
      return;
    }

    if (job.type === "generate-feature-document") {
      try {
        const outcome = await deps.generateFeatureDocument(job.runId);
        const transportStatus = outcome === "done" ? "done" : outcome === "cancelled" ? "cancelled" : "error";
        if (job.jobId != null) await deps.setJobStatus(job.jobId, transportStatus, transportStatus === "error" ? `Feature document run ${outcome ?? "unavailable"}` : undefined);
      } catch (error) {
        if (job.jobId != null) await deps.setJobStatus(job.jobId, "error", (error as Error).message);
        throw error;
      }
      return;
    }

    try {
      const outcome = await handle(job);
      if (outcome.status === "error") {
        throw new Error(outcome.message ?? `${job.type} failed`);
      }
      if (job.jobId != null) {
        await deps.setJobStatus(job.jobId, outcome.status, outcome.message);
      }
    } catch (error) {
      if (job.jobId != null) {
        await deps.setJobStatus(job.jobId, "error", (error as Error).message);
      }
      throw error;
    }
  };
}
