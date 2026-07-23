import { createHash } from "node:crypto";
import {
  parseAppKnowledgeSnapshot,
  type AppKnowledgeCoverage,
  type AppKnowledgeCoverageKind,
  type AppKnowledgeEvidenceKind,
  type AppKnowledgeJobStatus,
  type AppKnowledgeSnapshot,
} from "./appKnowledge.ts";
import {
  appKnowledgeCacheKey,
  buildAppKnowledgeEvidenceManifest,
  type AppKnowledgeEvidenceManifestItem,
  type AppKnowledgeEvidenceOverride,
} from "./appKnowledgeEvidence.ts";
import type {
  AppKnowledgeEvidencePrompt,
  AppKnowledgeProvider,
} from "./appKnowledgeProvider.ts";
import type {
  AppKnowledgeJobEvidenceRecord,
  AppKnowledgeStore,
  AppKnowledgeTarget,
  AppKnowledgeWorkerJob,
} from "./appKnowledgeStore.ts";
import type { AppKnowledgeEvidenceSource } from "./db.ts";
import {
  EvidenceAnalysisError,
  mapBounded,
  runValidatedProviderCall,
} from "./evidenceAnalysisRuntime.ts";
import type { ObjectMetadata, ObjectStore } from "./objectStore.ts";

export interface AppKnowledgeEvidenceAnalysis extends Record<string, unknown> {
  evidenceId: string;
  pageType: string;
  productArea: string;
  purpose: string;
  viewport: "desktop" | "tablet" | "mobile" | "unknown";
  visibleText: string[];
  theme: "light" | "dark" | "mixed";
  visualHierarchy: string[];
  layoutPatterns: string[];
  contentPatterns: string[];
  imagery: string[];
  icons: string[];
  interactionPatterns: string[];
  visibleStates: string[];
  availableActions: string[];
  systemFeedback: string[];
  accessibilityObservations: string[];
  likelyIntent: string;
  friction: string[];
  uncertainStates: string[];
  confidence: number;
}

const VIEWPORTS = new Set(["desktop", "tablet", "mobile", "unknown"]);
const THEMES = new Set(["light", "dark", "mixed"]);

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, maximum = 4_000): string {
  if (typeof value !== "string" || !value.trim() || value.length > maximum) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function strings(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length > 300) throw new Error(`${label} must be a bounded array`);
  return value.map((item, index) => text(item, `${label}[${index}]`, 2_000));
}

export function parseAppKnowledgeEvidenceAnalysis(
  value: unknown,
  evidenceId: string,
): AppKnowledgeEvidenceAnalysis {
  const raw = object(value, "App Knowledge evidence analysis");
  if (raw.evidenceId !== evidenceId) throw new Error("Evidence analysis identity does not match");
  const viewport = raw.viewport as AppKnowledgeEvidenceAnalysis["viewport"];
  const theme = raw.theme as AppKnowledgeEvidenceAnalysis["theme"];
  if (!VIEWPORTS.has(viewport)) throw new Error("Evidence analysis viewport is invalid");
  if (!THEMES.has(theme)) throw new Error("Evidence analysis theme is invalid");
  const confidence = Number(raw.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error("Evidence analysis confidence must be between 0 and 1");
  }
  return {
    evidenceId,
    pageType: text(raw.pageType, "pageType"),
    productArea: text(raw.productArea, "productArea"),
    purpose: text(raw.purpose, "purpose"),
    viewport,
    visibleText: strings(raw.visibleText, "visibleText"),
    theme,
    visualHierarchy: strings(raw.visualHierarchy, "visualHierarchy"),
    layoutPatterns: strings(raw.layoutPatterns, "layoutPatterns"),
    contentPatterns: strings(raw.contentPatterns, "contentPatterns"),
    imagery: strings(raw.imagery, "imagery"),
    icons: strings(raw.icons, "icons"),
    interactionPatterns: strings(raw.interactionPatterns, "interactionPatterns"),
    visibleStates: strings(raw.visibleStates, "visibleStates"),
    availableActions: strings(raw.availableActions, "availableActions"),
    systemFeedback: strings(raw.systemFeedback, "systemFeedback"),
    accessibilityObservations: strings(raw.accessibilityObservations, "accessibilityObservations"),
    likelyIntent: text(raw.likelyIntent, "likelyIntent"),
    friction: strings(raw.friction, "friction"),
    uncertainStates: strings(raw.uncertainStates, "uncertainStates"),
    confidence,
  };
}

function positiveJobId(value: string): number {
  if (!/^[1-9][0-9]*$/.test(value)) throw new Error("Invalid App Knowledge job identifier");
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new Error("Invalid App Knowledge job identifier");
  return result;
}

function sameObject(left: AppKnowledgeEvidenceManifestItem["object"], right: ObjectMetadata): boolean {
  return left.sha256 === right.sha256
    && left.byteSize === right.byteSize
    && left.contentType === right.contentType;
}

async function rasterFor(
  item: AppKnowledgeEvidenceManifestItem,
  deps: {
    objectStore: ObjectStore;
    imageObjectById(imageId: number): Promise<ObjectMetadata | undefined>;
  },
): Promise<{ bytes: Buffer; contentType: "image/png" | "image/jpeg" | "image/webp" }> {
  const metadata = await deps.imageObjectById(item.imageId);
  if (!metadata || !sameObject(item.object, metadata)) throw new Error("Evidence object failed verification");
  const stored = await deps.objectStore.get(metadata.key);
  if (
    stored.body.byteLength !== metadata.byteSize
    || createHash("sha256").update(stored.body).digest("hex") !== metadata.sha256
    || stored.metadata.key !== metadata.key
    || !sameObject(item.object, stored.metadata)
  ) throw new Error("Evidence object failed verification");
  return {
    bytes: stored.body,
    contentType: metadata.contentType as "image/png" | "image/jpeg" | "image/webp",
  };
}

function emptyCoverageKind(): AppKnowledgeCoverageKind {
  return { total: 0, eligible: 0, analyzed: 0, cached: 0, quarantined: 0, failed: 0 };
}

function coverageFrom(
  manifest: AppKnowledgeEvidenceManifestItem[],
  records: ReadonlyMap<string, AppKnowledgeJobEvidenceRecord>,
  successfulEvidenceIds: ReadonlySet<string>,
): AppKnowledgeCoverage {
  const byKind: Record<AppKnowledgeEvidenceKind, AppKnowledgeCoverageKind> = {
    screen: emptyCoverageKind(),
    flow_step: emptyCoverageKind(),
    ui_element: emptyCoverageKind(),
  };
  for (const item of manifest) {
    const current = byKind[item.kind];
    current.total += 1;
    if (item.eligibility === "eligible") current.eligible += 1;
    if (item.eligibility === "quarantined") current.quarantined += 1;
    if (item.eligibility === "eligible" && successfulEvidenceIds.has(item.evidenceId)) {
      current.analyzed += 1;
    }
    const record = records.get(item.evidenceId);
    if (record?.status === "cached") current.cached += 1;
    if (record?.status === "failed") current.failed += 1;
  }
  const flowItems = manifest.filter(({ kind }) => kind === "flow_step");
  return {
    total: manifest.length,
    eligible: manifest.filter(({ eligibility }) => eligibility === "eligible").length,
    analyzed: manifest.filter(({ evidenceId, eligibility }) =>
      eligibility === "eligible" && successfulEvidenceIds.has(evidenceId)).length,
    cached: [...records.values()].filter(({ status }) => status === "cached").length,
    quarantined: manifest.filter(({ eligibility }) => eligibility === "quarantined").length,
    skipped: manifest.filter(({ eligibility }) => eligibility === "duplicate").length,
    failed: [...records.values()].filter(({ status }) => status === "failed").length,
    duplicateVisuals: manifest.filter(({ eligibility }) => eligibility === "duplicate").length,
    byKind,
    flowReferences: {
      total: flowItems.length,
      resolved: flowItems.length,
      uniqueImages: new Set(flowItems.map(({ imageId }) => imageId)).size,
    },
  };
}

function failureCode(error: unknown): string {
  return error instanceof EvidenceAnalysisError ? error.code : "provider_unavailable";
}

async function stopped(store: AppKnowledgeStore, jobId: number): Promise<AppKnowledgeJobStatus | undefined> {
  const current = await store.workerJob(jobId);
  if (!current) return undefined;
  if (current.cancelRequested) {
    return (await store.claimJob(jobId))?.status;
  }
  return current.status === "running" || current.status === "queued" ? undefined : current.status;
}

export function createAppKnowledgeService(deps: {
  store: AppKnowledgeStore;
  provider: AppKnowledgeProvider;
  objectStore: ObjectStore;
  evidenceSource(target: AppKnowledgeTarget): Promise<AppKnowledgeEvidenceSource | undefined>;
  evidenceOverrides(versionId: number): Promise<AppKnowledgeEvidenceOverride[]>;
  imageObjectById(imageId: number): Promise<ObjectMetadata | undefined>;
  currentSourceSha256(target: AppKnowledgeTarget): Promise<string | undefined>;
  screenConcurrency?: number;
  flowConcurrency?: number;
  timeoutMs?: number;
  retryDelayMs?: number;
  maxImageBytes?: number;
}): { generate(jobId: string): Promise<AppKnowledgeJobStatus | undefined> } {
  const screenConcurrency = deps.screenConcurrency ?? 3;
  const flowConcurrency = deps.flowConcurrency ?? 2;
  const timeoutMs = deps.timeoutMs ?? 60_000;
  const retryDelayMs = deps.retryDelayMs ?? 250;

  return {
    async generate(rawJobId) {
      const jobId = positiveJobId(rawJobId);
      let job = await deps.store.claimJob(jobId);
      if (!job || job.status === "cancelled") return job?.status;
      if (job.status !== "running") return job.status;
      try {
        const source = await deps.evidenceSource(job.target);
        if (!source) {
          await deps.store.failJob(jobId, "source_missing", "The App capture version is unavailable");
          return "error";
        }
        if (!job.manifest) {
          await deps.store.updateProgress(jobId, "validating_evidence", 0);
          const hydrated: AppKnowledgeEvidenceSource = {
            ...source,
            images: await Promise.all(source.images.map(async (image) => ({
              ...image,
              object: image.object ?? await deps.imageObjectById(image.id),
            }))),
          };
          const prepared = await buildAppKnowledgeEvidenceManifest({
            source: hydrated,
            objectStore: deps.objectStore,
            overrides: await deps.evidenceOverrides(job.target.captureVersionId),
            maxImageBytes: deps.maxImageBytes,
          });
          job = await deps.store.freezeManifest(jobId, prepared.items, prepared.sourceSha256);
        }
        const manifest = job.manifest!;
        const records = new Map(
          (await deps.store.evidenceRecords(jobId)).map((record) => [record.evidenceId, record]),
        );
        const analyses = new Map<string, AppKnowledgeEvidenceAnalysis>();
        for (const record of records.values()) {
          if ((record.status === "complete" || record.status === "cached") && record.analysis) {
            analyses.set(
              record.evidenceId,
              parseAppKnowledgeEvidenceAnalysis(record.analysis, record.evidenceId),
            );
          }
        }
        await deps.store.updateProgress(jobId, "analyzing", analyses.size);
        let processed = [...records.values()].filter(({ status }) =>
          status === "complete" || status === "cached" || status === "failed").length;

        const analyze = async (
          item: AppKnowledgeEvidenceManifestItem,
          previous: AppKnowledgeEvidenceAnalysis | null,
        ): Promise<AppKnowledgeEvidenceAnalysis | undefined> => {
          if (analyses.has(item.evidenceId)) return analyses.get(item.evidenceId);
          if (await stopped(deps.store, jobId)) return undefined;
          const key = appKnowledgeCacheKey({
            normalizedVisualSha256: item.normalizedVisualSha256!,
            platform: job!.target.platform,
            promptVersion: job!.promptVersion,
            providerModel: job!.providerModel,
          });
          try {
            const cached = await deps.store.cachedAnalysis(key);
            let result: AppKnowledgeEvidenceAnalysis;
            let status: "complete" | "cached" = "cached";
            let attemptCount = 1;
            if (cached) {
              result = parseAppKnowledgeEvidenceAnalysis(
                { ...cached.analysis, evidenceId: item.evidenceId },
                item.evidenceId,
              );
            } else {
              status = "complete";
              const image = await rasterFor(item, deps);
              const analyzed = await runValidatedProviderCall({
                call: (validationError, signal) => deps.provider.analyzeEvidence({
                  evidenceId: item.evidenceId,
                  app: job!.target.app,
                  platform: job!.target.platform,
                  kind: item.kind,
                  flowContext: item.flow ?? null,
                  previousStepContext: previous,
                  validationError,
                } satisfies AppKnowledgeEvidencePrompt, image, signal),
                parse: (raw) => parseAppKnowledgeEvidenceAnalysis(raw, item.evidenceId),
                timeoutMs,
                retryDelayMs,
              });
              result = analyzed.value;
              attemptCount = analyzed.attemptCount;
              await deps.store.saveCachedAnalysis({
                cacheKey: key,
                normalizedVisualSha256: item.normalizedVisualSha256!,
                platform: job!.target.platform,
                promptVersion: job!.promptVersion,
                providerModel: job!.providerModel,
                analysis: result,
              });
            }
            await deps.store.recordEvidenceResult(jobId, {
              evidenceId: item.evidenceId,
              status,
              cacheKey: key,
              analysis: result,
              attemptCount,
            });
            const record: AppKnowledgeJobEvidenceRecord = {
              evidenceId: item.evidenceId,
              status,
              cacheKey: key,
              analysis: result,
              attemptCount,
            };
            records.set(item.evidenceId, record);
            analyses.set(item.evidenceId, result);
            return result;
          } catch (error) {
            await deps.store.recordEvidenceFailure(jobId, {
              evidenceId: item.evidenceId,
              errorCode: failureCode(error),
              attemptCount: 3,
            });
            records.set(item.evidenceId, {
              evidenceId: item.evidenceId,
              status: "failed",
              attemptCount: 3,
              errorCode: failureCode(error),
            });
            return undefined;
          } finally {
            processed += 1;
            await deps.store.updateProgress(jobId, "analyzing", Math.min(processed, job!.totalCount));
          }
        };

        const eligible = manifest.filter(({ eligibility }) => eligibility === "eligible");
        await mapBounded(
          eligible.filter(({ kind }) => kind === "screen"),
          screenConcurrency,
          (item) => analyze(item, null),
        );
        const flowGroups = new Map<string, AppKnowledgeEvidenceManifestItem[]>();
        for (const item of eligible.filter(({ kind }) => kind === "flow_step")) {
          const id = item.flow!.id;
          const group = flowGroups.get(id);
          if (group) group.push(item);
          else flowGroups.set(id, [item]);
        }
        await mapBounded([...flowGroups.values()], flowConcurrency, async (flow) => {
          let previous: AppKnowledgeEvidenceAnalysis | null = null;
          for (const item of flow) {
            const result = await analyze(item, previous);
            if (result) previous = result;
          }
        });

        for (const item of manifest.filter(({ eligibility }) => eligibility === "duplicate")) {
          const original = item.duplicateOfEvidenceId && analyses.get(item.duplicateOfEvidenceId);
          if (original) analyses.set(item.evidenceId, { ...original, evidenceId: item.evidenceId });
        }
        const interrupted = await stopped(deps.store, jobId);
        if (interrupted) return interrupted;
        const allowedEvidenceIds = [...analyses.keys()];
        const coverage = coverageFrom(manifest, records, new Set(allowedEvidenceIds));
        await deps.store.updateProgress(jobId, "synthesizing", Math.min(processed, job.totalCount));
        const synthesized = await runValidatedProviderCall({
          call: (validationError, signal) => deps.provider.synthesize({
            app: job!.target.app,
            platform: job!.target.platform,
            captureVersionId: job!.target.captureVersionId,
            analyses: allowedEvidenceIds.map((id) => analyses.get(id)),
            flows: source.flows,
            coverage,
            allowedEvidenceIds,
            validationError,
          }, signal),
          parse: (raw) => {
            const candidate = object(raw, "App Knowledge snapshot");
            return parseAppKnowledgeSnapshot({
              ...candidate,
              identity: {
                app: job!.target.app,
                platform: job!.target.platform,
                captureVersionId: job!.target.captureVersionId,
                sourceSha256: job!.sourceSha256,
                providerModel: job!.providerModel,
                promptVersion: job!.promptVersion,
                generatedAt: new Date().toISOString(),
              },
              coverage,
            }, new Set(allowedEvidenceIds));
          },
          timeoutMs,
          retryDelayMs,
        });
        if (await stopped(deps.store, jobId)) return (await deps.store.workerJob(jobId))?.status;
        const currentSha = await deps.currentSourceSha256(job.target);
        if (!currentSha || currentSha !== job.sourceSha256) {
          await deps.store.markStale(jobId);
          return "stale";
        }
        await deps.store.updateProgress(jobId, "saving", job.totalCount);
        const saved = await deps.store.completeGeneration(jobId, synthesized.value);
        return saved.reviewStatus === "draft" ? "done" : "error";
      } catch (error) {
        if (error instanceof EvidenceAnalysisError) {
          await deps.store.failJob(jobId, error.code, error.message);
        } else {
          await deps.store.failJob(
            jobId,
            "generation_failed",
            "App Knowledge generation failed",
          );
        }
        return "error";
      }
    },
  };
}
