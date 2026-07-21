import assert from "node:assert/strict";
import test from "node:test";
import {
  PermanentPublicPageImportError,
  PublicPageImportCancelledError,
} from "../../../src/publicPageCrawler.ts";
import { createPublicPagePipelineHandler } from "./pipeline.ts";

const job = {
  type: "crawl-public-page" as const,
  url: "https://example.com/pricing",
  jobId: 42,
};

test("successful public-page crawl transitions running to done", async () => {
  const statuses: Array<[number, string, string | undefined]> = [];
  const handler = createPublicPagePipelineHandler({
    getJob: async () => ({ id: 42, type: "crawl-public-page", status: "queued" }) as never,
    setJobStatus: async (id, status, message) => { statuses.push([id, status, message]); },
    crawl: async (_url, controls) => {
      assert.equal(await controls.isCancelled(), false);
      await controls.report("Analyzing HTML");
      return { app: "example-com", pageId: 1, versionId: 2, sectionCount: 5, reused: false };
    },
  });

  await handler(job, { attempt: 1, maxAttempts: 3 });

  assert.deepEqual(statuses, [
    [42, "running", "Rendering page"],
    [42, "running", "Analyzing HTML"],
    [42, "done", undefined],
  ]);
});

test("pre-cancelled public-page job is an acknowledged no-op", async () => {
  let crawled = false;
  const statuses: unknown[] = [];
  const handler = createPublicPagePipelineHandler({
    getJob: async () => ({ id: 42, type: "crawl-public-page", status: "cancelled" }) as never,
    setJobStatus: async (...args) => { statuses.push(args); },
    crawl: async () => { crawled = true; throw new Error("must not crawl"); },
  });

  await handler(job, { attempt: 1, maxAttempts: 3 });

  assert.equal(crawled, false);
  assert.deepEqual(statuses, []);
});

test("permanent public-page failure becomes terminal without retry", async () => {
  const statuses: Array<[number, string, string | undefined]> = [];
  const handler = createPublicPagePipelineHandler({
    getJob: async () => ({ id: 42, type: "crawl-public-page", status: "queued" }) as never,
    setJobStatus: async (id, status, message) => { statuses.push([id, status, message]); },
    crawl: async () => { throw new PermanentPublicPageImportError("Page is not renderable"); },
  });

  await handler(job, { attempt: 1, maxAttempts: 3 });

  assert.deepEqual(statuses, [
    [42, "running", "Rendering page"],
    [42, "error", "Page is not renderable"],
  ]);
});

test("transient failures retry and become terminal on final attempt", async () => {
  for (const attempt of [1, 2, 3]) {
    const statuses: Array<[number, string, string | undefined]> = [];
    const handler = createPublicPagePipelineHandler({
      getJob: async () => ({ id: 42, type: "crawl-public-page", status: "queued" }) as never,
      setJobStatus: async (id, status, message) => { statuses.push([id, status, message]); },
      crawl: async () => { throw new Error("upstream included https://secret.example/token"); },
    });

    await assert.rejects(handler(job, { attempt, maxAttempts: 3 }), /upstream included/);
    assert.deepEqual(statuses, attempt < 3
      ? [[42, "running", "Rendering page"]]
      : [
          [42, "running", "Rendering page"],
          [42, "error", "Page crawl failed after 3 attempts"],
        ]);
  }
});

test("crawler cancellation never becomes a worker error", async () => {
  const statuses: Array<[number, string, string | undefined]> = [];
  const handler = createPublicPagePipelineHandler({
    getJob: async () => ({ id: 42, type: "crawl-public-page", status: "running" }) as never,
    setJobStatus: async (id, status, message) => { statuses.push([id, status, message]); },
    crawl: async () => { throw new PublicPageImportCancelledError(); },
  });

  await handler(job, { attempt: 1, maxAttempts: 3 });
  assert.deepEqual(statuses, [[42, "running", "Rendering page"]]);
});
