import { consumeJobs } from "../../../src/queue.ts";
import { insertImage, pool, query } from "../../../src/db.ts";
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
import { createFeatureDocumentStore } from "../../../src/featureDocumentStore.ts";
import { createFeatureDocumentProvider } from "../../../src/featureDocumentProvider.ts";
import { createFeatureDocumentService } from "../../../src/featureDocumentService.ts";
import {
  featureEvidenceManifestSha256,
  type FeatureEvidenceManifestItem,
  type FeatureSourceFlow,
} from "../../../src/featureDocument.ts";
import type { DesignFlow } from "../../../src/designSystem.ts";

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

async function currentFeatureSourceManifest(source: FeatureSourceFlow): Promise<{ sha256: string }> {
  const flowResult = source.versionId === undefined
    ? await query<{ flows: DesignFlow[] }>(
      `SELECT af.flows FROM app_flows af
       JOIN apps a ON a.id = af.app_id
       WHERE a.name = $1 AND af.platform = $2`,
      [source.app, source.platform],
    )
    : await query<{ flows: DesignFlow[] }>(
      `SELECT COALESCE(
         CASE WHEN av.status IN ('draft', 'in_review') THEN af.flows ELSE afv.flows END,
         '[]'::jsonb
       ) AS flows
       FROM app_versions av
       JOIN apps a ON a.id = av.app_id
       LEFT JOIN app_flows af ON af.app_id = av.app_id AND af.platform = av.platform
       LEFT JOIN app_flow_versions afv ON afv.version_id = av.id
       WHERE av.id = $3 AND a.name = $1 AND av.platform = $2`,
      [source.app, source.platform, source.versionId],
    );
  const flow = flowResult.rows[0]?.flows.find(({ id }) => id === source.flowId);
  if (!flow) throw new Error("Feature source Flow is no longer available");
  const imageIds = [...new Set(flow.steps.flatMap(({ evidence }) => evidence))];
  const imageResult = await query<{
    id: number;
    description: string | null;
    captured_at: Date | string | null;
  }>(
    `SELECT i.id, i.description, COALESCE(vi.captured_at, i.created_at) AS captured_at
     FROM images i
     JOIN platforms p ON p.id = i.platform_id
     JOIN apps a ON a.id = p.app_id
     LEFT JOIN version_images vi ON vi.version_id = $4 AND vi.image_id = i.id
     WHERE a.name = $1 AND p.name = $2 AND i.id = ANY($3::integer[])
       AND ($4::integer IS NULL OR vi.image_id IS NOT NULL)`,
    [source.app, source.platform, imageIds, source.versionId ?? null],
  );
  const images = new Map(imageResult.rows.map((row) => [Number(row.id), row]));
  const manifest: FeatureEvidenceManifestItem[] = [];
  for (const [stepIndex, step] of flow.steps.entries()) {
    for (const [imageIndex, imageId] of step.evidence.entries()) {
      const image = images.get(imageId);
      if (!image) throw new Error("Feature source evidence is no longer available");
      manifest.push({
        stepIndex,
        imageIndex,
        imageId,
        evidenceId: `FLOW-STEP-${String(stepIndex + 1).padStart(2, "0")}-IMAGE-${imageId}`,
        stepLabel: step.label,
        ...(step.interaction ? { interaction: step.interaction } : {}),
        description: image.description,
        ...(image.captured_at ? { capturedAt: new Date(image.captured_at).toISOString() } : {}),
      });
    }
  }
  return { sha256: featureEvidenceManifestSha256(manifest) };
}

const featureDocumentProvider = createFeatureDocumentProvider();
const featureDocumentService = featureDocumentProvider ? createFeatureDocumentService({
  store: createFeatureDocumentStore(),
  provider: featureDocumentProvider,
  objectStore,
  imageObjectById,
  currentSourceManifest: currentFeatureSourceManifest,
}) : undefined;

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
      generateFeatureDocument: async (runId) => {
        if (!featureDocumentService) throw new Error("Feature document provider is not configured");
        await featureDocumentService.generate(runId);
      },
    }));
  },
});
