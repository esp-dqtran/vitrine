import { consumeJobs } from "../../../src/queue.ts";
import { insertImage, pool } from "../../../src/db.ts";
import { assertMigrationsCurrent } from "../../../src/migrations.ts";
import { attachImageObject, attachThumbnailObject, imageObjectById } from "../../../src/objectStoreDb.ts";
import { createObjectStore, objectStoreConfigFromEnvironment } from "../../../src/objectStoreConfig.ts";
import { verifyObjectStoreReady } from "../../../src/objectStorageReady.ts";
import { crawlBulkDownload, crawlFlowsDownload, type BulkObjectDependencies } from "../../../src/bulkDownload.ts";
import { caption } from "../../../src/caption.ts";
import { createPipelineHandler } from "./pipeline.ts";
import { startImportWorker } from "./start.ts";
import { createCrawlRunService } from "../../../src/crawlRun.ts";
import { researchAppJob } from "../../../src/crawlJobs.ts";
import { hostname } from "node:os";

const workerId = process.env.CRAWL_WORKER_ID?.trim() || `${hostname()}-${process.pid}`;
const objectStore = createObjectStore(objectStoreConfigFromEnvironment(process.env));
const crawlRunService = createCrawlRunService({ workerId, objectStore });
const staleRunThresholdMs = Number(process.env.CRAWL_STALE_RUN_THRESHOLD_MS ?? 5 * 60_000);

const bulkStorage: BulkObjectDependencies = {
  objectStore,
  insertImage,
  attachImage: async (imageId, metadata) => {
    const client = await pool.connect();
    try {
      await attachImageObject(client, { imageId, metadata });
    } finally {
      client.release();
    }
  },
  attachThumbnail: async (imageId, metadata) => {
    const client = await pool.connect();
    try {
      await attachThumbnailObject(client, { imageId, metadata });
    } finally {
      client.release();
    }
  },
};

await startImportWorker({
  assertMigrations: () => assertMigrationsCurrent(pool),
  assertObjectStorage: () => verifyObjectStoreReady(objectStore),
  staleRunThresholdMs,
  recoverStaleRuns: async (staleBefore) => {
    const recovered = await crawlRunService.recoverStaleRuns(staleBefore);
    if (recovered.length > 0) console.log(`[import-worker] Recovered ${recovered.length} stale crawl run(s).`);
  },
  consume: async () => {
    console.log("[import-worker] Waiting for jobs...");
    await consumeJobs(createPipelineHandler({
      crawlBulkDownload: (url, name, tab, waitMs, _storage, platform) => crawlBulkDownload(url, name, tab, waitMs, bulkStorage, platform),
      crawlFlowsDownload: (url, name, waitMs, _storage, platform) => crawlFlowsDownload(url, name, waitMs, bulkStorage, platform),
      caption: (provider, limit, app) => caption(provider, limit, app, {
        objectStore,
        resolveObjectMetadata: (image) => imageObjectById(image.id),
      }),
      researchAppJob,
      crawlRunService,
    }));
  },
});
