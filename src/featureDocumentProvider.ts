import type { FeatureStepPrompt, FeatureSynthesisPrompt } from "./featureDocument.ts";
import {
  createMultimodalJsonProvider,
  type MultimodalJsonProvider,
  type ProviderEnvironment,
  type RasterImage,
} from "./evidenceAnalysisProvider.ts";
import { EvidenceAnalysisError } from "./evidenceAnalysisRuntime.ts";

export type { ProviderEnvironment };

export interface FeatureDocumentProvider {
  readonly model: string;
  analyzeImage(
    prompt: FeatureStepPrompt,
    image: RasterImage,
    signal: AbortSignal,
  ): Promise<unknown>;
  synthesize(prompt: FeatureSynthesisPrompt, signal: AbortSignal): Promise<unknown>;
}

const STEP_SYSTEM_PROMPT = [
  "Return JSON only.",
  "Analyze only what is visible in the supplied image and the supplied Flow context.",
  "Keep observations separate from likely intent and uncertainty.",
  "Use exactly the supplied evidenceId.",
].join(" ");

const SYNTHESIS_SYSTEM_PROMPT = [
  "Return JSON only using this exact top-level structure: executiveSummary, observedFlow, flowAnalysis, proposedFeature, requirements, edgeCases, successMetrics, guardrailMetrics, analyticsEvents, dependencies, openQuestions.",
  "Each claim has id, kind, text, evidenceIds, and optional confidence.",
  "Each requirement is a claim plus userStory, priority, preconditions, and acceptanceCriteria.",
  "Requirement text must describe one capability-level behavior in product language, not an implementation task.",
  "Each acceptance criterion is one BDD scenario with id, given, when, then, and evidenceIds.",
  "Write complete Given, When, and Then clauses and group related happy-path, alternate-path, and error scenarios under the same requirement.",
  "Normally create 2 to 5 acceptance criteria per requirement, covering distinct happy-path, alternate, validation, or recovery outcomes supported by the supplied evidence; never invent unsupported scenarios merely to reach a count.",
  "Do not create one requirement per screen, screenshot, step, or UI control.",
  "Classify every claim as observed, inferred, proposed, or unknown.",
  "Every observed or inferred claim must cite one or more supplied evidence IDs.",
  "Never invent an evidence ID.",
].join(" ");

async function legacyErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!(error instanceof EvidenceAnalysisError)) throw error;
    const message = error.message.replace(/^Analysis provider/, "Feature analysis provider");
    throw new Error(message);
  }
}

export function featureDocumentProviderFromMultimodalJsonProvider(
  provider: MultimodalJsonProvider,
): FeatureDocumentProvider {
  return {
    model: provider.model,
    analyzeImage(prompt, image, signal) {
      if (image.bytes.byteLength < 1) {
        throw new Error("Feature analysis image is empty");
      }
      return legacyErrors(() => provider.completeJson({
        system: STEP_SYSTEM_PROMPT,
        text: prompt,
        image,
        signal,
      }));
    },
    synthesize(prompt, signal) {
      return legacyErrors(() => provider.completeJson({
        system: SYNTHESIS_SYSTEM_PROMPT,
        text: prompt,
        signal,
      }));
    },
  };
}

export function createFeatureDocumentProvider(
  environment: ProviderEnvironment = process.env,
  request: typeof fetch = fetch,
): FeatureDocumentProvider | undefined {
  const provider = createMultimodalJsonProvider(environment, request);
  return provider ? featureDocumentProviderFromMultimodalJsonProvider(provider) : undefined;
}
