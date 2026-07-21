import { pool } from "../../../src/db.ts";
import { assertMigrationsCurrent } from "../../../src/migrations.ts";
import { createObjectStore, objectStoreConfigFromEnvironment } from "../../../src/objectStoreConfig.ts";
import { verifyObjectStoreReady } from "../../../src/objectStorageReady.ts";
import { createPublicPageBrowser } from "../../../src/publicPageBrowser.ts";
import { crawlPublicPage } from "../../../src/publicPageCrawler.ts";
import { consumePublicPageJobs } from "../../../src/publicPageQueue.ts";
import { createPublicPageStore } from "../../../src/publicPageStore.ts";
import { createPublicPagePipelineHandler } from "./pipeline.ts";
import { startPublicPageImportWorker } from "./start.ts";

const objectStore = createObjectStore(objectStoreConfigFromEnvironment(process.env));
const pageStore = createPublicPageStore();

await startPublicPageImportWorker({
  assertMigrations: () => assertMigrationsCurrent(pool),
  assertObjectStorage: () => verifyObjectStoreReady(objectStore),
  consume: async () => {
    const browser = await createPublicPageBrowser({
      headless: process.env.HEADLESS !== "false",
      scrollPixelsPerSecond: 200,
    });
    const handler = createPublicPagePipelineHandler({
      crawl: (url, controls) => crawlPublicPage(url, {
        browser,
        objectStore,
        pageStore,
        isCancelled: controls.isCancelled,
        report: controls.report,
      }),
    });
    console.log("[public-page-import-worker] Waiting for public page jobs...");
    await consumePublicPageJobs(handler);
  },
});
