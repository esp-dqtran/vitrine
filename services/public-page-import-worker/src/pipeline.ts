import {
  getJob,
  setJobStatus,
  type JobRow,
  type JobStatus,
} from "../../../src/db.ts";
import {
  PermanentPublicPageImportError,
  PublicPageImportCancelledError,
  type PublicPageCrawlResult,
} from "../../../src/publicPageCrawler.ts";
import type {
  PublicPageAttempt,
  PublicPageJob,
} from "../../../src/publicPageQueue.ts";

export interface PublicPageCrawlControls {
  isCancelled(): Promise<boolean>;
  report(message: string): Promise<void>;
}

interface PublicPagePipelineDependencies {
  getJob(id: number): Promise<JobRow | undefined>;
  setJobStatus(id: number, status: JobStatus, message?: string): Promise<void>;
  crawl(url: string, controls: PublicPageCrawlControls): Promise<PublicPageCrawlResult>;
}

const defaults: PublicPagePipelineDependencies = {
  getJob,
  setJobStatus,
  crawl: async () => { throw new Error("Public-page crawler is not configured"); },
};

export function createPublicPagePipelineHandler(
  overrides: Partial<PublicPagePipelineDependencies> = {},
) {
  const deps = { ...defaults, ...overrides };
  return async function handlePublicPageJob(
    job: PublicPageJob,
    attempt: PublicPageAttempt,
  ): Promise<void> {
    const record = await deps.getJob(job.jobId);
    if (!record || record.status === "cancelled") return;
    if (record.type !== "crawl-public-page") {
      await deps.setJobStatus(job.jobId, "error", "Public-page queue job type mismatch");
      return;
    }

    await deps.setJobStatus(job.jobId, "running", "Rendering page");
    const controls: PublicPageCrawlControls = {
      isCancelled: async () => (await deps.getJob(job.jobId))?.status === "cancelled",
      report: async (message) => {
        await deps.setJobStatus(job.jobId, "running", safeProgressMessage(message));
      },
    };
    try {
      await deps.crawl(job.url, controls);
      await deps.setJobStatus(job.jobId, "done");
    } catch (error) {
      if (error instanceof PublicPageImportCancelledError) return;
      if (error instanceof PermanentPublicPageImportError) {
        await deps.setJobStatus(job.jobId, "error", safePermanentMessage(error.message));
        return;
      }
      if (attempt.attempt >= attempt.maxAttempts) {
        await deps.setJobStatus(
          job.jobId,
          "error",
          `Page crawl failed after ${attempt.maxAttempts} attempts`,
        );
      }
      throw error;
    }
  };
}

function safeProgressMessage(value: string): string {
  const allowed = new Set([
    "Rendering page",
    "Analyzing HTML",
    "Saving page capture",
    "Recording preview",
    "Finalizing page import",
  ]);
  return allowed.has(value) ? value : "Crawling page";
}

function safePermanentMessage(value: string): string {
  const message = typeof value === "string"
    ? value.replace(/https?:\/\/\S+/gi, "[redacted-url]").trim().slice(0, 500)
    : "";
  return message || "Page crawl failed";
}

