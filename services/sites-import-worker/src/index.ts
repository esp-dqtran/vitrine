import { pool } from "../../../src/db.ts";
import { assertMigrationsCurrent } from "../../../src/migrations.ts";
import { createObjectStore, objectStoreConfigFromEnvironment } from "../../../src/objectStoreConfig.ts";
import { verifyObjectStoreReady } from "../../../src/objectStorageReady.ts";
import {
  crawlMobbinSite,
  createMobbinSitesBrowserPorts,
} from "../../../src/sitesCrawler.ts";
import { consumeSitesJobs } from "../../../src/sitesQueue.ts";
import { createSitesStore } from "../../../src/sitesStore.ts";
import { createSitesPipelineHandler } from "./pipeline.ts";
import { startSitesImportWorker } from "./start.ts";

const objectStore = createObjectStore(objectStoreConfigFromEnvironment(process.env));
const sitesStore = createSitesStore();
const handler = createSitesPipelineHandler({
  crawl: async (url, controls) => {
    const browser = await createMobbinSitesBrowserPorts({
      profileDir: process.env.MOBBIN_SITES_PROFILE_DIR ?? "data/browser-profile-mobbin-sites",
      storageStatePath: process.env.MOBBIN_SITES_STORAGE_STATE_PATH,
      headless: process.env.HEADLESS === "true",
    });
    try {
      return await crawlMobbinSite(url, {
        captureSource: browser.captureSource,
        download: browser.download,
        objectStore,
        sitesStore,
        isCancelled: controls.isCancelled,
        report: controls.report,
      });
    } finally {
      await browser.close();
    }
  },
});

await startSitesImportWorker({
  assertMigrations: () => assertMigrationsCurrent(pool),
  assertObjectStorage: () => verifyObjectStoreReady(objectStore),
  consume: async () => {
    console.log("[sites-import-worker] Waiting for Sites jobs...");
    await consumeSitesJobs(handler);
  },
});
