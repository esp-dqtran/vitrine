import assert from "node:assert/strict";
import test from "node:test";
import {
  PermanentSiteImportError,
  SiteImportCancelledError,
} from "../../../src/sitesCrawler.ts";
import { createSitesPipelineHandler } from "./pipeline.ts";

const job = {
  type: "import-site" as const,
  url: "https://mobbin.com/sites/v-7-1fbe80df-2586-4a09-aa5c-29aeeb716a09/f4e176f7-aeb6-4f9a-9689-e4379fc357b1/preview",
  jobId: 42,
};

test("successful Sites import transitions running to done", async () => {
  const statuses: Array<[number, string, string | undefined]> = [];
  const handler = createSitesPipelineHandler({
    getJob: async () => ({ id: 42, type: "import-site", status: "queued" }) as never,
    setJobStatus: async (id, status, message) => { statuses.push([id, status, message]); },
    crawl: async (_url, controls) => {
      assert.equal(await controls.isCancelled(), false);
      return { siteId: 1, versionId: 2, pageCount: 16, sectionCount: 46 };
    },
  });

  await handler(job, { attempt: 1, maxAttempts: 3 });

  assert.deepEqual(statuses, [
    [42, "running", "Inspecting Site"],
    [42, "done", undefined],
  ]);
});

test("pre-cancelled Sites job is an acknowledged no-op", async () => {
  let crawled = false;
  const statuses: unknown[] = [];
  const handler = createSitesPipelineHandler({
    getJob: async () => ({ id: 42, type: "import-site", status: "cancelled" }) as never,
    setJobStatus: async (...args) => { statuses.push(args); },
    crawl: async () => { crawled = true; throw new Error("must not crawl"); },
  });

  await handler(job, { attempt: 1, maxAttempts: 3 });

  assert.equal(crawled, false);
  assert.deepEqual(statuses, []);
});

test("permanent authentication failure becomes terminal without queue retry", async () => {
  const statuses: Array<[number, string, string | undefined]> = [];
  const handler = createSitesPipelineHandler({
    getJob: async () => ({ id: 42, type: "import-site", status: "queued" }) as never,
    setJobStatus: async (id, status, message) => { statuses.push([id, status, message]); },
    crawl: async () => { throw new PermanentSiteImportError("Mobbin authentication required"); },
  });

  await handler(job, { attempt: 1, maxAttempts: 3 });

  assert.deepEqual(statuses, [
    [42, "running", "Inspecting Site"],
    [42, "error", "Mobbin authentication required"],
  ]);
});

test("transient failures rethrow and become terminal only on the final attempt", async () => {
  for (const attempt of [1, 2, 3]) {
    const statuses: Array<[number, string, string | undefined]> = [];
    const handler = createSitesPipelineHandler({
      getJob: async () => ({ id: 42, type: "import-site", status: "queued" }) as never,
      setJobStatus: async (id, status, message) => { statuses.push([id, status, message]); },
      crawl: async () => { throw new Error("upstream included https://secret.example/token"); },
    });

    await assert.rejects(
      handler(job, { attempt, maxAttempts: 3 }),
      /upstream included/,
    );

    assert.deepEqual(statuses, attempt < 3
      ? [[42, "running", "Inspecting Site"]]
      : [
          [42, "running", "Inspecting Site"],
          [42, "error", "Site import failed after 3 attempts"],
        ]);
  }
});

test("crawler cancellation never becomes a worker error", async () => {
  const statuses: Array<[number, string, string | undefined]> = [];
  const handler = createSitesPipelineHandler({
    getJob: async () => ({ id: 42, type: "import-site", status: "running" }) as never,
    setJobStatus: async (id, status, message) => { statuses.push([id, status, message]); },
    crawl: async () => { throw new SiteImportCancelledError(); },
  });

  await handler(job, { attempt: 1, maxAttempts: 3 });

  assert.deepEqual(statuses, [[42, "running", "Inspecting Site"]]);
});
