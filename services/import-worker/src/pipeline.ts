import { appHasImages, createJob, getJob, setJobStatus } from "../../../src/db.ts";
import { discoverApps } from "../../../src/discoverApps.ts";
import { crawlBulkDownload, crawlFlowsDownload } from "../../../src/bulkDownload.ts";
import { caption } from "../../../src/caption.ts";
import { synthesize } from "../../../src/synthesize.ts";
import { publishJob, type Job } from "../../../src/queue.ts";
import type { StageOutcome } from "../../../src/progress.ts";

const DEFAULT_PROVIDER = "chatgpt";
// Screens establishes login (up to 30 min); UI Elements / Flows then fail fast if the app
// lacks that tab rather than blocking the import for the full login window.
const SUPPLEMENTARY_GRID_WAIT_MS = 20_000;

const defaults = {
  appHasImages,
  createJob,
  getJob,
  setJobStatus,
  discoverApps,
  crawlBulkDownload,
  crawlFlowsDownload,
  caption,
  synthesize,
  publishJob,
};
type PipelineDeps = typeof defaults;

export function createPipelineHandler(overrides: Partial<PipelineDeps> = {}) {
  const deps = { ...defaults, ...overrides };

  async function enqueue(job: Job, parentId?: number): Promise<void> {
    const { type, jobId: _ignored, ...payload } = job;
    const jobId = await deps.createJob(type, payload, parentId);
    await deps.publishJob({ ...job, jobId });
  }

  async function handle(job: Job): Promise<StageOutcome> {
    if (job.type === "discover-catalog") {
      const apps = await deps.discoverApps();
      for (const target of apps) {
        if (!(await deps.appHasImages(target.name))) {
          await enqueue({ type: "import-app", name: target.name, url: target.url }, job.jobId);
        }
      }
      return { status: "done" };
    }

    if (job.type === "import-app") {
      // An import crawls all three Mobbin tabs. Screens are required; UI Elements and Flows
      // are supplementary — an empty or failing tab must not fail the whole import, but a
      // user cancel still halts the pipeline.
      const screens = await deps.crawlBulkDownload(job.url, job.name, "screens");
      if (screens.status !== "done") return screens;

      // Login is established now, so give the supplementary tabs a short grid-wait: an app
      // that simply has no UI Elements / Flows tab fails fast instead of hanging.
      const uiElements = await deps.crawlBulkDownload(job.url, job.name, "ui-elements", SUPPLEMENTARY_GRID_WAIT_MS);
      if (uiElements.status === "cancelled") return uiElements;

      const flows = await deps.crawlFlowsDownload(job.url, job.name, SUPPLEMENTARY_GRID_WAIT_MS);
      if (flows.status === "cancelled") return flows;

      await enqueue({ type: "caption-app", name: job.name }, job.jobId);
      return screens;
    }

    if (job.type === "caption-app") {
      const outcome = await deps.caption(DEFAULT_PROVIDER, undefined, job.name);
      if (outcome.status === "done") {
        await enqueue({ type: "synthesize-app", name: job.name }, job.jobId);
      }
      return outcome;
    }

    return deps.synthesize(job.name, DEFAULT_PROVIDER);
  }

  return async function trackedHandleJob(job: Job): Promise<void> {
    if (job.jobId != null) {
      const record = await deps.getJob(job.jobId);
      if (record?.status === "cancelled") return;
      await deps.setJobStatus(job.jobId, "running");
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
