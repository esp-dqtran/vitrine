import { test } from "node:test";
import assert from "node:assert/strict";
import { createPipelineHandler } from "./pipeline.ts";
import type { Job } from "../../../src/queue.ts";

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
    jobId: 7,
  });
  assert.deepEqual(h.crawls, ["screens"]);
  assert.equal(h.created.length, 0);
  assert.deepEqual(h.statuses.map(([, status]) => status), ["running", "cancelled"]);
});
