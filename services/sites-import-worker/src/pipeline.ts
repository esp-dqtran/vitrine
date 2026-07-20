import {
  getJob,
  setJobStatus,
  type JobRow,
  type JobStatus,
} from "../../../src/db.ts";
import {
  PermanentSiteImportError,
  SiteImportCancelledError,
} from "../../../src/sitesCrawler.ts";
import type { SitesAttempt, SitesJob } from "../../../src/sitesQueue.ts";

export interface SitesCrawlControls {
  isCancelled(): Promise<boolean>;
  report(message: string): Promise<void>;
}

export interface SitesCrawlResult {
  siteId: number;
  versionId: number;
  pageCount: number;
  sectionCount: number;
}

interface SitesPipelineDependencies {
  getJob(id: number): Promise<JobRow | undefined>;
  setJobStatus(id: number, status: JobStatus, message?: string): Promise<void>;
  crawl(url: string, controls: SitesCrawlControls): Promise<SitesCrawlResult>;
}

const defaults: SitesPipelineDependencies = {
  getJob,
  setJobStatus,
  crawl: async () => { throw new Error("Sites crawler is not configured"); },
};

export function createSitesPipelineHandler(
  overrides: Partial<SitesPipelineDependencies> = {},
) {
  const deps = { ...defaults, ...overrides };
  return async function handleSitesJob(
    job: SitesJob,
    attempt: SitesAttempt,
  ): Promise<void> {
    const record = await deps.getJob(job.jobId);
    if (!record || record.status === "cancelled") return;
    if (record.type !== "import-site") {
      await deps.setJobStatus(job.jobId, "error", "Sites queue job type mismatch");
      return;
    }

    await deps.setJobStatus(job.jobId, "running", "Inspecting Site");
    const controls: SitesCrawlControls = {
      isCancelled: async () => (await deps.getJob(job.jobId))?.status === "cancelled",
      report: async (message) => {
        await deps.setJobStatus(job.jobId, "running", safeProgressMessage(message));
      },
    };
    try {
      await deps.crawl(job.url, controls);
      await deps.setJobStatus(job.jobId, "done");
    } catch (error) {
      if (error instanceof SiteImportCancelledError) return;
      if (error instanceof PermanentSiteImportError) {
        await deps.setJobStatus(job.jobId, "error", safePermanentMessage(error.message));
        return;
      }
      if (attempt.attempt >= attempt.maxAttempts) {
        await deps.setJobStatus(
          job.jobId,
          "error",
          `Site import failed after ${attempt.maxAttempts} attempts`,
        );
      }
      throw error;
    }
  };
}

function safeProgressMessage(value: string): string {
  const message = typeof value === "string" ? value.trim() : "";
  if (!message || message.length > 200 || /https?:\/\//i.test(message)) return "Importing Site";
  return message;
}

function safePermanentMessage(value: string): string {
  const message = typeof value === "string"
    ? value.replace(/https?:\/\/\S+/gi, "[redacted-url]").trim().slice(0, 500)
    : "";
  return message || "Site import failed";
}
