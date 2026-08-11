import { pool } from "../../../src/db.ts";
import { resolveAppIcon } from "../../../src/appIconResolver.ts";
import { createMultimodalJsonProvider } from "../../../src/evidenceAnalysisProvider.ts";
import { crawlGenericSite } from "../../../src/genericSiteCrawler.ts";
import { assertMigrationsCurrent } from "../../../src/migrations.ts";
import { createObjectStore, objectStoreConfigFromEnvironment } from "../../../src/objectStoreConfig.ts";
import { verifyObjectStoreReady } from "../../../src/objectStorageReady.ts";
import { createPublicPageBrowser } from "../../../src/publicPageBrowser.ts";
import { siteAnalysisProviderFromMultimodal } from "../../../src/siteAnalysisProvider.ts";
import { classifySiteImportUrl } from "../../../src/sites.ts";
import {
  crawlMobbinSite,
  createMobbinSitesBrowserPorts,
} from "../../../src/sitesCrawler.ts";
import {
  consumeSitesJobs,
  parseSitesQueueScope,
} from "../../../src/sitesQueue.ts";
import { createSitesStore } from "../../../src/sitesStore.ts";
import { typesenseCatalogConfigFromEnv } from "../../../src/typesenseCatalog.ts";
import {
  TYPESENSE_SITE_CATALOG_COLLECTION,
  createTypesenseSiteCatalogClient,
} from "../../../src/typesenseSiteCatalog.ts";
import { publishedSiteCatalogDocument } from "../../../src/typesenseSiteCatalogSource.ts";
import { createWappalyzerTechnologyDetector } from "../../../src/wappalyzerBrowser.ts";
import { createSitesPipelineHandler } from "./pipeline.ts";
import {
  runSitesCrawlWithTimeout,
  sitesCrawlTimeoutMs,
  startSitesImportWorker,
} from "./start.ts";
import { wappalyzerOptionsFromEnvironment } from "./wappalyzerConfig.ts";

const objectStore = createObjectStore(objectStoreConfigFromEnvironment(process.env));
const sitesStore = createSitesStore();
const typesenseConfig = typesenseCatalogConfigFromEnv(process.env);
const typesenseSiteCatalog = typesenseConfig
  ? createTypesenseSiteCatalogClient({ ...typesenseConfig, collection: TYPESENSE_SITE_CATALOG_COLLECTION })
  : undefined;
if (
  !sitesStore.beginGenericImport ||
  !sitesStore.completeGenericImport ||
  !sitesStore.failGenericImport
) {
  throw new Error("Generic Sites persistence is unavailable");
}
const genericSitesStore = {
  beginGenericImport: sitesStore.beginGenericImport.bind(sitesStore),
  completeGenericImport: sitesStore.completeGenericImport.bind(sitesStore),
  failGenericImport: sitesStore.failGenericImport.bind(sitesStore),
};
const multimodalProvider = createMultimodalJsonProvider();
const siteAnalysisProvider = multimodalProvider
  ? siteAnalysisProviderFromMultimodal(multimodalProvider)
  : undefined;
const wappalyzerOptions = wappalyzerOptionsFromEnvironment(process.env);
const technologyDetector = wappalyzerOptions
  ? await createWappalyzerTechnologyDetector(wappalyzerOptions)
  : undefined;
const queueScope = parseSitesQueueScope(process.env.MOBBIN_SITES_QUEUE_SCOPE);
const crawlTimeoutMs = sitesCrawlTimeoutMs(process.env.SITES_CRAWL_TIMEOUT_MS);
const handler = createSitesPipelineHandler({
  syncSite: async (siteId) => {
    if (!typesenseSiteCatalog) return;
    try {
      const document = await publishedSiteCatalogDocument(siteId, sitesStore);
      if (!document) return;
      await typesenseSiteCatalog.upsert(document);
      console.log(`[sites-import-worker] Updated Typesense Site document ${document.id}.`);
    } catch (error) {
      console.warn(`[sites-import-worker] Typesense Site sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
  crawl: async (url, controls) => {
    const identity = classifySiteImportUrl(url);
    if (identity.kind === "public-page") {
      const browser = await createPublicPageBrowser({
        headless: process.env.HEADLESS !== "false",
        // Public marketing pages can leave animated WebGL canvases running
        // indefinitely. DOM/CSS evidence remains available with graphics
        // disabled, which keeps the catalog worker within its crawl budget.
        disableWebGl: true,
      });
      return runSitesCrawlWithTimeout(
        () => crawlGenericSite(identity.canonicalUrl, {
          browser,
          objectStore,
          sitesStore: genericSitesStore,
          ...(siteAnalysisProvider ? { analysisProvider: siteAnalysisProvider } : {}),
          ...(technologyDetector ? { technologyDetector } : {}),
          isCancelled: controls.isCancelled,
          report: controls.report,
        }),
        () => browser.close(),
        crawlTimeoutMs,
      );
    }
    const browser = await createMobbinSitesBrowserPorts({
      profileDir: process.env.MOBBIN_SITES_PROFILE_DIR ?? "data/browser-profile-mobbin-sites",
      storageStatePath: process.env.MOBBIN_SITES_STORAGE_STATE_PATH,
      headless: process.env.HEADLESS === "true",
    });
    return runSitesCrawlWithTimeout(
      () => crawlMobbinSite(url, {
        captureSource: browser.captureSource,
        resolveSiteIcon: async (sourceUrl, name) =>
          (await resolveAppIcon(sourceUrl, name))?.url ?? null,
        download: browser.download,
        objectStore,
        sitesStore,
        isCancelled: controls.isCancelled,
        report: controls.report,
      }),
      () => browser.close(),
      crawlTimeoutMs,
    );
  },
});

await startSitesImportWorker({
  assertMigrations: () => assertMigrationsCurrent(pool),
  assertObjectStorage: () => verifyObjectStoreReady(objectStore),
  consume: async () => {
    console.log(`[sites-import-worker] Waiting for ${queueScope} Sites jobs...`);
    await consumeSitesJobs(handler, queueScope);
  },
});
