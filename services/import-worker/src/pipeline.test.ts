import { test } from "node:test";
import assert from "node:assert/strict";
import { createPipelineHandler } from "./pipeline.ts";
import type { Job } from "../../../src/queue.ts";
import { CrawlRunInterruptedError } from "../../../src/crawlRun.ts";

function harness(crawlStatus: "done" | "cancelled" | "error") {
  const created: Array<{ type: string; parentId?: number }> = [];
  const published: Job[] = [];
  const statuses: Array<[number, string, string | undefined]> = [];
  const crawls: string[] = [];
  const handler = createPipelineHandler({
    discoverApps: async () => [],
    appHasImages: async () => false,
    crawlBulkDownload: async (_url, _name, tab = "screens") => {
      crawls.push(tab);
      return { status: crawlStatus, message: crawlStatus === "done" ? undefined : crawlStatus };
    },
    crawlFlowsDownload: async () => {
      crawls.push("flows");
      return { status: "done" };
    },
    caption: async () => ({ status: "done" }),
    synthesize: async () => ({ status: "done" }),
    createJob: async (type, _payload, parentId) => {
      created.push({ type, parentId });
      return 100 + created.length;
    },
    publishJob: async (job) => {
      published.push(job);
    },
    getJob: async () => ({ status: "queued" }) as never,
    setJobStatus: async (id, status, message) => {
      statuses.push([id, status, message]);
    },
  });
  return { handler, created, published, statuses, crawls };
}

test("successful import creates a caption child linked to the import", async () => {
  const h = harness("done");
  await h.handler({
    type: "import-app",
    name: "linear",
    url: "https://mobbin.com/apps/a/b/screens",
    platform: "web",
    jobId: 7,
  });
  assert.deepEqual(h.crawls, ["screens", "ui-elements", "flows"]);
  assert.deepEqual(h.created, [{ type: "caption-app", parentId: 7 }]);
  assert.deepEqual(h.published, [{ type: "caption-app", name: "linear", jobId: 101 }]);
  assert.deepEqual(h.statuses.map(([, status]) => status), ["running", "done"]);
});

test("failed import does not create a caption child and remains retryable", async () => {
  const h = harness("error");
  await assert.rejects(
    h.handler({
      type: "import-app",
      name: "linear",
      url: "https://mobbin.com/apps/a/b/screens",
      platform: "web",
      jobId: 7,
    }),
    /error/
  );
  assert.deepEqual(h.crawls, ["screens"]);
  assert.equal(h.created.length, 0);
  assert.equal(h.published.length, 0);
  assert.deepEqual(h.statuses.map(([, status]) => status), ["running", "error"]);
});

test("cancelled import does not advance or retry", async () => {
  const h = harness("cancelled");
  await h.handler({
    type: "import-app",
    name: "linear",
    url: "https://mobbin.com/apps/a/b/screens",
    platform: "web",
    jobId: 7,
  });
  assert.deepEqual(h.crawls, ["screens"]);
  assert.equal(h.created.length, 0);
  assert.deepEqual(h.statuses.map(([, status]) => status), ["running", "cancelled"]);
});

function durableHandler(options: {
  execute?: () => Promise<{ status: string }>;
  research?: (input: { name: string; homepageUrl: string; provider?: string }) => Promise<void>;
  currentJobStatus?: string;
}) {
  const statuses: Array<[number, string, string | undefined]> = [];
  let executions = 0;
  const research: Array<{ name: string; homepageUrl: string; provider?: string }> = [];
  const handler = createPipelineHandler({
    getJob: async () => ({ status: options.currentJobStatus ?? "queued" }) as never,
    setJobStatus: async (id, status, message) => { statuses.push([id, status, message]); },
    researchAppJob: async (input) => {
      research.push(input);
      await options.research?.(input);
    },
    crawlRunService: {
      execute: async () => {
        executions++;
        return (await options.execute?.() ?? { status: "succeeded" }) as never;
      },
    },
  });
  return { handler, statuses, research, executions: () => executions };
}

test("research-app dispatches through the research service and acknowledges the saved draft", async () => {
  const h = durableHandler({});
  await h.handler({
    type: "research-app",
    name: "atlassian",
    homepageUrl: "https://www.atlassian.com/",
    provider: "claude",
    jobId: 21,
  });
  assert.deepEqual(h.research, [{
    name: "atlassian",
    homepageUrl: "https://www.atlassian.com/",
    provider: "claude",
  }]);
  assert.deepEqual(h.statuses.map(([, status]) => status), ["running", "done"]);
});

test("smart-crawl acknowledges succeeded, semantic failed, and cancelled durable runs", async () => {
  for (const [runStatus, jobStatus] of [["succeeded", "done"], ["failed", "error"], ["cancelled", "cancelled"]] as const) {
    const h = durableHandler({ execute: async () => ({ status: runStatus }) });
    await h.handler({ type: "smart-crawl-app", name: "atlassian", runId: "42", jobId: 22 });
    assert.equal(h.executions(), 1);
    assert.deepEqual(h.statuses.map(([, status]) => status), ["running", jobStatus]);
  }
});

test("smart-crawl redelivery does not execute a transport job already cancelled", async () => {
  const h = durableHandler({ currentJobStatus: "cancelled" });
  await h.handler({ type: "smart-crawl-app", name: "atlassian", runId: "42", jobId: 22 });
  assert.equal(h.executions(), 0);
  assert.deepEqual(h.statuses, []);
});

test("only CrawlRunInterruptedError escapes smart-crawl for bounded queue retry", async () => {
  const interrupted = durableHandler({ execute: async () => { throw new CrawlRunInterruptedError(new Error("browser lost")); } });
  await assert.rejects(
    () => interrupted.handler({ type: "smart-crawl-app", name: "atlassian", runId: "42", jobId: 22 }),
    CrawlRunInterruptedError,
  );
  assert.deepEqual(interrupted.statuses.map(([, status]) => status), ["running", "error"]);

  const nonRetryable = durableHandler({ execute: async () => { throw new Error("run not found"); } });
  await nonRetryable.handler({ type: "smart-crawl-app", name: "atlassian", runId: "404", jobId: 23 });
  assert.deepEqual(nonRetryable.statuses.map(([, status]) => status), ["running", "error"]);
});

test("dispatches autonomous work through the durable orchestrator", async () => {
  const calls: string[] = [];
  const statuses: string[] = [];
  const handler = createPipelineHandler({
    getJob: async () => ({ status: "queued" }) as never,
    setJobStatus: async (_id, status) => { statuses.push(status); },
    autonomousOrchestrator: {
      run: async (runId) => {
        calls.push(runId);
        return { runId, status: "succeeded" as const };
      },
    },
  });
  await handler({ type: "autonomous-crawl-app", name: "linear", runId: "42", jobId: 24 });
  assert.deepEqual(calls, ["42"]);
  assert.deepEqual(statuses, ["running", "done"]);
});

test("pipeline dispatches feature document generation and tracks transport status", async () => {
  const events: string[] = [];
  const handler = createPipelineHandler({
    getJob: async () => ({ status: "queued" }) as never,
    setJobStatus: async (id, status) => { events.push(`job:${id}:${status}`); },
    generateFeatureDocument: async (runId) => { events.push(`feature:${runId}`); return "done"; },
  });

  await handler({ type: "generate-feature-document", runId: "27", jobId: 9 });
  assert.deepEqual(events, ["job:9:running", "feature:27", "job:9:done"]);
});

test("autonomous infrastructure interruptions remain retryable with the same run id", async () => {
  const interruption = new Error("discovery browser lost");
  const statuses: string[] = [];
  const handler = createPipelineHandler({
    getJob: async () => ({ status: "queued" }) as never,
    setJobStatus: async (_id, status) => { statuses.push(status); },
    autonomousOrchestrator: { run: async () => { throw interruption; } },
  });
  await assert.rejects(
    () => handler({ type: "autonomous-crawl-app", name: "linear", runId: "42", jobId: 25 }),
    (error) => error === interruption,
  );
  assert.deepEqual(statuses, ["running", "error"]);
});
