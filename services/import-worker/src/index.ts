import { consumeJobs } from "../../../src/queue.ts";
import { insertImage, pool } from "../../../src/db.ts";
import { assertMigrationsCurrent } from "../../../src/migrations.ts";
import { attachImageObject, imageObjectById } from "../../../src/objectStoreDb.ts";
import { createObjectStore, objectStoreConfigFromEnvironment } from "../../../src/objectStoreConfig.ts";
import { crawlBulkDownload, crawlFlowsDownload, type BulkObjectDependencies } from "../../../src/bulkDownload.ts";
import { caption } from "../../../src/caption.ts";
import { createPipelineHandler } from "./pipeline.ts";
import { startImportWorker } from "./start.ts";

const objectStore = createObjectStore(objectStoreConfigFromEnvironment(process.env));
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
};

await startImportWorker({
  assertMigrations: () => assertMigrationsCurrent(pool),
  consume: async () => {
    console.log("[import-worker] Waiting for jobs...");
    await consumeJobs(createPipelineHandler({
      crawlBulkDownload: (url, name, tab, waitMs) => crawlBulkDownload(url, name, tab, waitMs, bulkStorage),
      crawlFlowsDownload: (url, name, waitMs) => crawlFlowsDownload(url, name, waitMs, bulkStorage),
      caption: (provider, limit, app) => caption(provider, limit, app, {
        objectStore,
        resolveObjectMetadata: (image) => imageObjectById(image.id),
      }),
    }));
  },
});
