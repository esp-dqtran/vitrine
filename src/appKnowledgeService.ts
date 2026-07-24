import { createHash } from "node:crypto";
import {
  parseAppKnowledgeDesignSystemResult,
  type AppKnowledgeCoverage,
  type AppKnowledgeCoverageKind,
  type AppKnowledgeEvidenceKind,
  type AppKnowledgeJobStatus,
  type AppKnowledgeSnapshot,
} from "./appKnowledge.ts";
import {
  assembleDesignSystemSnapshot,
  planDesignSystemChunks,
} from "./appKnowledgeDesignSystem.ts";
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

export type AppKnowledgeTokenKind =
  | "color"
  | "typography"
  | "spacing"
  | "radius"
  | "border"
  | "effect";

export interface AppKnowledgeTokenCandidate {
  kind: AppKnowledgeTokenKind;
  name: string;
  value: string;
  role: string;
  confidence: number;
}

export interface AppKnowledgeNormalizedRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AppKnowledgeComponentOccurrence {
  family: string;
  variant: string;
  category: string;
  purpose: string;
  anatomy: string[];
  visibleStates: string[];
  observedProperties: string[];
  region: AppKnowledgeNormalizedRegion;
  confidence: number;
}

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
  tokenCandidates: AppKnowledgeTokenCandidate[];
  componentOccurrences: AppKnowledgeComponentOccurrence[];
}

const VIEWPORTS = new Set(["desktop", "tablet", "mobile", "unknown"]);
const THEMES = new Set(["light", "dark", "mixed"]);
const TOKEN_KINDS = new Set<AppKnowledgeTokenKind>([
  "color",
  "typography",
  "spacing",
  "radius",
  "border",
  "effect",
]);

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

function confidence(value: unknown, label: string): number {
  const result = Number(value);
  if (!Number.isFinite(result) || result < 0 || result > 1) {
    throw new Error(`${label} must be between 0 and 1`);
  }
  return result;
}

function candidates(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value) || value.length > 24) {
    throw new Error(`${label} must be a bounded array`);
  }
  return value;
}

function tokenCandidates(value: unknown): AppKnowledgeTokenCandidate[] {
  return candidates(value, "tokenCandidates").map((item, index) => {
    const raw = object(item, `tokenCandidates[${index}]`);
    const kind = raw.kind as AppKnowledgeTokenKind;
    if (!TOKEN_KINDS.has(kind)) throw new Error("Evidence analysis token kind is invalid");
    return {
      kind,
      name: text(raw.name, `tokenCandidates[${index}].name`, 160),
      value: text(raw.value, `tokenCandidates[${index}].value`, 500),
      role: text(raw.role, `tokenCandidates[${index}].role`, 1_000),
      confidence: confidence(raw.confidence, `tokenCandidates[${index}].confidence`),
    };
  });
}

function normalizedRegion(value: unknown, label: string): AppKnowledgeNormalizedRegion {
  const raw = object(value, label);
  const x = Number(raw.x);
  const y = Number(raw.y);
  const width = Number(raw.width);
  const height = Number(raw.height);
  if (
    !Number.isFinite(x)
    || !Number.isFinite(y)
    || !Number.isFinite(width)
    || !Number.isFinite(height)
    || x < 0
    || y < 0
    || x > 1
    || y > 1
    || width <= 0
    || height <= 0
    || width > 1
    || height > 1
  ) throw new Error("Evidence analysis normalized region is invalid");
  if (x + width > 1 || y + height > 1) {
    throw new Error("Evidence analysis normalized region exceeds source bounds");
  }
  return { x, y, width, height };
}

function componentOccurrences(value: unknown): AppKnowledgeComponentOccurrence[] {
  return candidates(value, "componentOccurrences").map((item, index) => {
    const raw = object(item, `componentOccurrences[${index}]`);
    return {
      family: text(raw.family, `componentOccurrences[${index}].family`, 160),
      variant: text(raw.variant, `componentOccurrences[${index}].variant`, 160),
      category: text(raw.category, `componentOccurrences[${index}].category`, 160),
      purpose: text(raw.purpose, `componentOccurrences[${index}].purpose`, 1_000),
      anatomy: strings(raw.anatomy, `componentOccurrences[${index}].anatomy`),
      visibleStates: strings(raw.visibleStates, `componentOccurrences[${index}].visibleStates`),
      observedProperties: strings(
        raw.observedProperties,
        `componentOccurrences[${index}].observedProperties`,
      ),
      region: normalizedRegion(raw.region, `componentOccurrences[${index}].region`),
      confidence: confidence(raw.confidence, `componentOccurrences[${index}].confidence`),
    };
  });
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
  const analysisConfidence = confidence(raw.confidence, "Evidence analysis confidence");
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
    confidence: analysisConfidence,
    tokenCandidates: tokenCandidates(raw.tokenCandidates),
    componentOccurrences: componentOccurrences(raw.componentOccurrences),
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
  cancelCheckIntervalMs?: number;
  designSystemChunkBytes?: number;
  designSystemChunkConcurrency?: number;
}): { generate(jobId: string): Promise<AppKnowledgeJobStatus | undefined> } {
  const screenConcurrency = deps.screenConcurrency ?? 3;
  const flowConcurrency = deps.flowConcurrency ?? 2;
  const timeoutMs = deps.timeoutMs ?? 60_000;
  const retryDelayMs = deps.retryDelayMs ?? 250;
  const designSystemChunkBytes = deps.designSystemChunkBytes ?? 120_000;
  const designSystemChunkConcurrency = deps.designSystemChunkConcurrency ?? 1;

  return {
    async generate(rawJobId) {
      const jobId = positiveJobId(rawJobId);
      let job = await deps.store.claimJob(jobId);
      if (!job || job.status === "cancelled") return job?.status;
      if (job.status !== "running") return job.status;
      const cancellation = new AbortController();
      const monitorStop = new AbortController();
      const waitForCheck = () => new Promise<void>((resolve) => {
        let timer: ReturnType<typeof setTimeout>;
        const complete = () => {
          clearTimeout(timer);
          monitorStop.signal.removeEventListener("abort", complete);
          resolve();
        };
        timer = setTimeout(complete, deps.cancelCheckIntervalMs ?? 1_000);
        monitorStop.signal.addEventListener("abort", complete, { once: true });
      });
      const monitor = (async () => {
        while (!monitorStop.signal.aborted && !cancellation.signal.aborted) {
          await waitForCheck();
          if (monitorStop.signal.aborted) return;
          const current = await deps.store.workerJob(jobId);
          if (current?.cancelRequested) {
            cancellation.abort(new DOMException("cancelled", "AbortError"));
          }
        }
      })();
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
        let processed = analyses.size;

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
                signal: cancellation.signal,
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
            if (
              error instanceof EvidenceAnalysisError
              && error.code === "provider_rate_limited"
            ) {
              if (!cancellation.signal.aborted) cancellation.abort(error);
              throw error;
            }
            if (cancellation.signal.aborted) return undefined;
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

        const interrupted = await stopped(deps.store, jobId);
        if (interrupted) return interrupted;
        const successfulEvidenceIds = new Set(analyses.keys());
        const coverage = coverageFrom(manifest, records, successfulEvidenceIds);
        const screenAnalyses = manifest
          .filter(({ kind, eligibility }) => kind === "screen" && eligibility === "eligible")
          .flatMap(({ evidenceId }) => {
            const analysis = analyses.get(evidenceId);
            return analysis ? [analysis] : [];
          });
        if (screenAnalyses.length === 0) {
          throw new EvidenceAnalysisError("output_invalid", "No completed screen evidence is available");
        }
        const chunks = planDesignSystemChunks(screenAnalyses, designSystemChunkBytes);
        const persisted = new Map(
          (await deps.store.prepareDesignSystemChunks(
            jobId,
            chunks.map(({ key, ordinal }) => ({ key, ordinal })),
          )).map((record) => [record.key, record]),
        );
        await deps.store.updateProgress(jobId, "synthesizing", Math.min(processed, job.totalCount));
        const fragments = new Map<string, ReturnType<typeof parseAppKnowledgeDesignSystemResult>>();
        await mapBounded(chunks, designSystemChunkConcurrency, async (chunk) => {
          const current = persisted.get(chunk.key);
          if (current?.status === "complete" && current.fragment) {
            fragments.set(
              chunk.key,
              parseAppKnowledgeDesignSystemResult(
                current.fragment,
                new Set(chunk.evidenceIds),
              ),
            );
            return;
          }
          try {
            const synthesized = await runValidatedProviderCall({
              call: (validationError, signal) =>
                deps.provider.synthesizeDesignSystemChunk({
                  app: job!.target.app,
                  platform: job!.target.platform,
                  signals: chunk.signals,
                  allowedEvidenceIds: chunk.evidenceIds,
                  validationError,
                }, signal),
              parse: (raw) => parseAppKnowledgeDesignSystemResult(
                raw,
                new Set(chunk.evidenceIds),
              ),
              timeoutMs,
              retryDelayMs,
              signal: cancellation.signal,
            });
            const fragment = synthesized.value;
            await deps.store.recordDesignSystemChunkResult(jobId, {
              key: chunk.key,
              fragment: structuredClone(fragment) as unknown as Record<string, unknown>,
              attemptCount: synthesized.attemptCount,
            });
            fragments.set(chunk.key, fragment);
          } catch (error) {
            if (
              error instanceof EvidenceAnalysisError
              && error.code === "provider_rate_limited"
              && !cancellation.signal.aborted
            ) cancellation.abort(error);
            if (!cancellation.signal.aborted) {
              await deps.store.recordDesignSystemChunkFailure(jobId, {
                key: chunk.key,
                errorCode: failureCode(error),
                attemptCount: 3,
              });
            }
            throw error;
          }
        });
        const allowedEvidenceIds = screenAnalyses.map(({ evidenceId }) => evidenceId);
        const orderedFragments = chunks.map(({ key }) => {
          const fragment = fragments.get(key);
          if (!fragment) throw new Error("Design-system synthesis chunk is missing");
          return fragment;
        });
        const merged = await runValidatedProviderCall({
          call: (validationError, signal) => deps.provider.mergeDesignSystem({
            app: job!.target.app,
            platform: job!.target.platform,
            fragments: orderedFragments,
            allowedEvidenceIds,
            validationError,
          }, signal),
          parse: (raw) => parseAppKnowledgeDesignSystemResult(
            raw,
            new Set(allowedEvidenceIds),
          ),
          timeoutMs,
          retryDelayMs,
          signal: cancellation.signal,
        });
        const snapshot = assembleDesignSystemSnapshot({
          identity: {
            app: job.target.app,
            platform: job.target.platform,
            captureVersionId: job.target.captureVersionId,
            sourceSha256: job.sourceSha256!,
            providerModel: job.providerModel,
            promptVersion: job.promptVersion,
          },
          coverage,
          analyses: screenAnalyses,
          result: merged.value,
          generatedAt: new Date().toISOString(),
        });
        if (await stopped(deps.store, jobId)) return (await deps.store.workerJob(jobId))?.status;
        const currentSha = await deps.currentSourceSha256(job.target);
        if (!currentSha || currentSha !== job.sourceSha256) {
          await deps.store.markStale(jobId);
          return "stale";
        }
        await deps.store.updateProgress(jobId, "saving", job.totalCount);
        const saved = await deps.store.completeGeneration(jobId, snapshot);
        return saved.reviewStatus === "draft" ? "done" : "error";
      } catch (error) {
        const cancellationReason = cancellation.signal.reason;
        const rateLimited = cancellationReason instanceof EvidenceAnalysisError
          && cancellationReason.code === "provider_rate_limited";
        if (cancellation.signal.aborted && !rateLimited) {
          return (await deps.store.claimJob(jobId))?.status;
        }
        const failure = rateLimited ? cancellationReason : error;
        if (failure instanceof EvidenceAnalysisError) {
          await deps.store.failJob(jobId, failure.code, failure.message);
        } else {
          await deps.store.failJob(
            jobId,
            "generation_failed",
            "App Knowledge generation failed",
          );
        }
        return "error";
      } finally {
        monitorStop.abort();
        await monitor;
      }
    },
  };
}
