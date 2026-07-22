import { createHash } from "node:crypto";
import {
  parseFeatureDocumentContent,
  parseFeatureStepAnalysis,
  type FeatureDocumentContent,
  type FeatureStepAnalysis,
  type FeatureStepPrompt,
} from "./featureDocument.ts";
import type { FeatureDocumentProvider } from "./featureDocumentProvider.ts";
import type { FeatureDocumentStore, FeatureDocumentWorkerJob } from "./featureDocumentStore.ts";
import type { ObjectMetadata, ObjectStore } from "./objectStore.ts";

type FailureCode =
  | "image_missing"
  | "image_metadata_mismatch"
  | "image_type_unsupported"
  | "provider_unavailable"
  | "provider_timeout"
  | "provider_refused"
  | "step_invalid"
  | "document_invalid";

const RASTER_TYPES = new Set<ObjectMetadata["contentType"]>(["image/png", "image/jpeg", "image/webp"]);

const SAFE_MESSAGES: Record<FailureCode, string> = {
  image_missing: "A Flow image is unavailable",
  image_metadata_mismatch: "A Flow image failed integrity verification",
  image_type_unsupported: "A Flow image has an unsupported format",
  provider_unavailable: "Feature analysis is temporarily unavailable",
  provider_timeout: "Feature analysis timed out",
  provider_refused: "Feature analysis could not process this evidence",
  step_invalid: "Feature analysis returned an invalid step result",
  document_invalid: "Feature analysis returned an invalid document",
};

class FeatureGenerationError extends Error {
  readonly code: FailureCode;

  constructor(code: FailureCode) {
    super(SAFE_MESSAGES[code]);
    this.code = code;
  }
}

function positiveJobId(value: string): number {
  if (!/^[1-9][0-9]*$/.test(value)) throw new Error("Invalid feature document job identifier");
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new Error("Invalid feature document job identifier");
  return result;
}

function sameMetadata(left: ObjectMetadata, right: ObjectMetadata): boolean {
  return left.key === right.key
    && left.sha256 === right.sha256
    && left.byteSize === right.byteSize
    && left.contentType === right.contentType
    && left.accessClass === right.accessClass;
}

function checkedImage(
  expected: ObjectMetadata,
  object: Awaited<ReturnType<ObjectStore["get"]>>,
): { bytes: Buffer; contentType: "image/png" | "image/jpeg" | "image/webp" } {
  if (!RASTER_TYPES.has(expected.contentType)) throw new FeatureGenerationError("image_type_unsupported");
  if (
    !sameMetadata(expected, object.metadata)
    || object.body.byteLength !== expected.byteSize
    || createHash("sha256").update(object.body).digest("hex") !== expected.sha256
  ) throw new FeatureGenerationError("image_metadata_mismatch");
  return {
    bytes: object.body,
    contentType: expected.contentType as "image/png" | "image/jpeg" | "image/webp",
  };
}

function providerFailure(error: unknown, invalidCode: "step_invalid" | "document_invalid"): FeatureGenerationError {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : "";
  if (name === "TimeoutError" || /timed? ?out|timeout/i.test(message)) return new FeatureGenerationError("provider_timeout");
  if (/\((400|401|403|422)\)/.test(message)) return new FeatureGenerationError("provider_refused");
  if (/invalid JSON|invalid response|returned no content/i.test(message)) return new FeatureGenerationError(invalidCode);
  return new FeatureGenerationError("provider_unavailable");
}

function orderedManifest(job: FeatureDocumentWorkerJob) {
  return [...job.evidenceManifest].sort((left, right) =>
    left.stepIndex - right.stepIndex || left.imageIndex - right.imageIndex,
  );
}

async function cancellationRequested(store: FeatureDocumentStore, jobId: number): Promise<boolean> {
  const current = await store.workerJob(jobId);
  if (!current) return true;
  if (current.cancelRequested) {
    await store.claimJob(jobId);
    return true;
  }
  return current.status !== "running" && current.status !== "queued";
}

async function analyzeStep(input: {
  provider: FeatureDocumentProvider;
  prompt: FeatureStepPrompt;
  image: { bytes: Buffer; contentType: "image/png" | "image/jpeg" | "image/webp" };
  timeoutMs: number;
}): Promise<{ result: FeatureStepAnalysis; attemptCount: number }> {
  let validationError = "";
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    let raw: unknown;
    try {
      raw = await input.provider.analyzeImage(
        { ...input.prompt, ...(validationError ? { validationError } : {}) },
        input.image,
        AbortSignal.timeout(input.timeoutMs),
      );
    } catch (error) {
      throw providerFailure(error, "step_invalid");
    }
    try {
      return { result: parseFeatureStepAnalysis(raw, input.prompt.evidenceId), attemptCount: attempt };
    } catch (error) {
      validationError = error instanceof Error ? error.message : "Invalid step analysis";
      if (attempt === 2) throw new FeatureGenerationError("step_invalid");
    }
  }
  throw new FeatureGenerationError("step_invalid");
}

async function synthesizeDocument(input: {
  job: FeatureDocumentWorkerJob;
  analyses: FeatureStepAnalysis[];
  provider: FeatureDocumentProvider;
  timeoutMs: number;
  onValidation(): Promise<void>;
}): Promise<FeatureDocumentContent> {
  const allowedEvidenceIds = input.job.evidenceManifest.map(({ evidenceId }) => evidenceId);
  let validationError = "";
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    let raw: unknown;
    try {
      raw = await input.provider.synthesize({
        source: input.job.source,
        focusInstruction: input.job.focusInstruction,
        analyses: input.analyses,
        allowedEvidenceIds,
        ...(validationError ? { validationError } : {}),
      }, AbortSignal.timeout(input.timeoutMs));
    } catch (error) {
      throw providerFailure(error, "document_invalid");
    }
    await input.onValidation();
    try {
      return parseFeatureDocumentContent(raw, new Set(allowedEvidenceIds));
    } catch (error) {
      validationError = error instanceof Error ? error.message : "Invalid feature document";
      if (attempt === 2) throw new FeatureGenerationError("document_invalid");
    }
  }
  throw new FeatureGenerationError("document_invalid");
}

export function createFeatureDocumentService(deps: {
  store: FeatureDocumentStore;
  provider: FeatureDocumentProvider;
  objectStore: ObjectStore;
  imageObjectById(imageId: number): Promise<ObjectMetadata | undefined>;
  currentSourceManifest(input: FeatureDocumentWorkerJob["source"]): Promise<{ sha256: string }>;
  timeoutMs?: number;
}): { generate(jobId: string): Promise<void> } {
  const timeoutMs = deps.timeoutMs ?? 60_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) throw new Error("Invalid feature analysis timeout");

  return {
    async generate(rawJobId) {
      const jobId = positiveJobId(rawJobId);
      const job = await deps.store.claimJob(jobId);
      if (!job || job.status === "cancelled") return;
      if (job.status !== "running") return;
      if (job.providerModel !== deps.provider.model) {
        await deps.store.failJob(jobId, "provider_unavailable", SAFE_MESSAGES.provider_unavailable);
        return;
      }

      let activeEvidence: typeof job.evidenceManifest[number] | undefined;
      let attemptCount = 1;
      try {
        await deps.store.updateProgress(jobId, "preparing", 0);
        const manifest = orderedManifest(job);
        const completed = await deps.store.completedStepAnalyses(jobId);
        const persisted = new Map(completed.map((record) => [record.evidenceId, record]));
        const analyses: FeatureStepAnalysis[] = [];

        await deps.store.updateProgress(jobId, "analyzing", 0);
        for (let index = 0; index < manifest.length; index += 1) {
          const evidence = manifest[index];
          activeEvidence = evidence;
          if (await cancellationRequested(deps.store, jobId)) return;
          const existing = persisted.get(evidence.evidenceId);
          if (
            existing
            && existing.jobId === jobId
            && existing.stepIndex === evidence.stepIndex
            && existing.imageIndex === evidence.imageIndex
            && existing.imageId === evidence.imageId
          ) {
            analyses.push(existing.result);
            await deps.store.updateProgress(jobId, "analyzing", index + 1);
            continue;
          }

          const metadata = await deps.imageObjectById(evidence.imageId);
          if (!metadata) throw new FeatureGenerationError("image_missing");
          if (!RASTER_TYPES.has(metadata.contentType)) throw new FeatureGenerationError("image_type_unsupported");
          let object: Awaited<ReturnType<ObjectStore["get"]>>;
          try {
            object = await deps.objectStore.get(metadata.key);
          } catch {
            throw new FeatureGenerationError("image_missing");
          }
          const image = checkedImage(metadata, object);
          const analyzed = await analyzeStep({
            provider: deps.provider,
            prompt: {
              source: job.source,
              stepIndex: evidence.stepIndex,
              imageIndex: evidence.imageIndex,
              evidenceId: evidence.evidenceId,
              stepLabel: evidence.stepLabel,
              ...(evidence.interaction ? { interaction: evidence.interaction } : {}),
              focusInstruction: job.focusInstruction,
              ...(analyses.length ? { previousStepContext: analyses[analyses.length - 1] } : {}),
            },
            image,
            timeoutMs,
          });
          attemptCount = analyzed.attemptCount;
          await deps.store.recordStepAnalysis(jobId, {
            stepIndex: evidence.stepIndex,
            imageIndex: evidence.imageIndex,
            imageId: evidence.imageId,
            evidenceId: evidence.evidenceId,
            result: analyzed.result,
            attemptCount: analyzed.attemptCount,
          });
          analyses.push(analyzed.result);
          await deps.store.updateProgress(jobId, "analyzing", index + 1);
        }

        activeEvidence = undefined;
        if (await cancellationRequested(deps.store, jobId)) return;
        await deps.store.updateProgress(jobId, "synthesizing", manifest.length);
        const content = await synthesizeDocument({
          job,
          analyses,
          provider: deps.provider,
          timeoutMs,
          onValidation: () => deps.store.updateProgress(jobId, "validating", manifest.length),
        });

        if (await cancellationRequested(deps.store, jobId)) return;
        const current = await deps.currentSourceManifest(job.source);
        if (current.sha256 !== job.evidenceManifestSha256) {
          await deps.store.markStale(jobId);
          return;
        }
        await deps.store.updateProgress(jobId, "saving", manifest.length);
        await deps.store.completeGeneration(jobId, {
          content,
          source: job.source,
          evidenceManifest: job.evidenceManifest,
          evidenceManifestSha256: job.evidenceManifestSha256,
          focusInstruction: job.focusInstruction,
          promptVersion: job.promptVersion,
          providerModel: job.providerModel,
        });
      } catch (error) {
        const failure = error instanceof FeatureGenerationError
          ? error
          : new FeatureGenerationError("provider_unavailable");
        if (activeEvidence) {
          await deps.store.recordStepFailure(jobId, {
            stepIndex: activeEvidence.stepIndex,
            imageIndex: activeEvidence.imageIndex,
            imageId: activeEvidence.imageId,
            evidenceId: activeEvidence.evidenceId,
            errorCode: failure.code,
            attemptCount,
          });
        }
        await deps.store.failJob(jobId, failure.code, failure.message);
      }
    },
  };
}
