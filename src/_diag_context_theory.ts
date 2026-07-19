import { crawlBulkDownload, crawlFlowsDownload, type BulkObjectDependencies } from "./bulkDownload.ts";
import { launchMobbinContext } from "./crawler.ts";

process.env.MOBBIN_PROFILE_DIR = "data/browser-profile-mobbin-worker4";

const url = "https://mobbin.com/apps/uniqlo-android-84c3c361-15ac-4379-8656-8960f881af2b/latest/screens";

// In-memory stub — no real DB/storage writes, just lets ingestion "succeed" so screens/
// ui-elements phases fully complete (including their cleanup) before flows runs, exactly
// like production, instead of throwing partway through on a missing storage backend.
let nextId = 1;
const dummyStorage: BulkObjectDependencies = {
  objectStore: { put: async (obj: any) => ({ metadata: obj, created: true }) } as any,
  insertImage: (async () => nextId++) as any,
  attachImage: async () => {},
  attachThumbnail: async () => {},
};

console.log("=== Test A: flows navigation as the 3rd phase in one shared context (mimics real crawl) ===");
const sharedContext = await launchMobbinContext();
try {
  const t0 = Date.now();
  const screens = await crawlBulkDownload(url, "uniqlo-test", "screens", 60_000, dummyStorage, "android", sharedContext).catch((e) => ({ status: "threw", message: String(e) }));
  console.log(`screens phase: ${JSON.stringify(screens)} (${Date.now() - t0}ms)`);
  const t1 = Date.now();
  const ui = await crawlBulkDownload(url, "uniqlo-test", "ui-elements", 20_000, dummyStorage, "android", sharedContext).catch((e) => ({ status: "threw", message: String(e) }));
  console.log(`ui-elements phase: ${JSON.stringify(ui)} (${Date.now() - t1}ms)`);
  const t2 = Date.now();
  const flows = await crawlFlowsDownload(url, "uniqlo-test", 20_000, dummyStorage, "android", sharedContext).catch((e) => ({ status: "threw", message: String(e) }));
  console.log(`flows phase: ${JSON.stringify(flows)} (${Date.now() - t2}ms)`);
} finally {
  await sharedContext.close().catch(() => {});
}
