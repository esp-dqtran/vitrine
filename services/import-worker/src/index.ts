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
import { createAutonomousStore } from "../../../src/autonomousStore.ts";
import { decryptStorageState, encryptStorageState } from "../../../src/crawlSession.ts";
import { createProductionAutonomousOrchestrator } from "../../../src/autonomousWorker.ts";

const workerId = process.env.CRAWL_WORKER_ID?.trim() || `${hostname()}-${process.pid}`;
const objectStore = createObjectStore(objectStoreConfigFromEnvironment(process.env));
const autonomousStore = createAutonomousStore();
const sessionEncryptionKey = process.env.CRAWL_SESSION_ENCRYPTION_KEY;
const crawlRunService = createCrawlRunService({
  workerId,
  objectStore,
  loadStorageState: async (run) => {
    if (!run.parent_run_id || !sessionEncryptionKey) return undefined;
    const session = await autonomousStore.accountSession(run.app);
    return session ? decryptStorageState(session.encrypted_storage_state, sessionEncryptionKey) : undefined;
  },
  saveStorageState: async (run, state) => {
    if (!run.parent_run_id || !sessionEncryptionKey) throw new Error("Autonomous session encryption is not configured");
    const parent = await autonomousStore.autonomousRunDetail(run.parent_run_id);
    if (!parent) throw new Error("Autonomous parent run not found while refreshing its session");
    const createdBy = Number((parent.run.environment as unknown as Record<string, unknown>).createdBy);
    if (!Number.isSafeInteger(createdBy) || createdBy < 1) throw new Error("Autonomous parent has no session owner");
    await autonomousStore.saveAccountSession(run.app, encryptStorageState(state, sessionEncryptionKey), createdBy);
  },
});
const autonomousOrchestrator = createProductionAutonomousOrchestrator({
  workerId,
  objectStore,
  crawlRunService,
  sessionEncryptionKey,
});
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
      autonomousOrchestrator,
    }));
  },
});
