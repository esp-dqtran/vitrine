import type {
  FeatureEvidenceManifestItem,
  FeatureFlowPrompt,
  FeatureStepPrompt,
  FeatureSynthesisPrompt,
} from "./featureDocument.ts";
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
  readonly officialDocumentationEnabled?: boolean;
  readonly officialDocumentationDomains?: readonly string[];
  analyzeFlow?(
    prompt: FeatureFlowPrompt,
    images: Array<{ evidence: FeatureEvidenceManifestItem; image: RasterImage }>,
    signal: AbortSignal,
  ): Promise<unknown>;
  analyzeImage(
    prompt: FeatureStepPrompt,
    image: RasterImage,
    signal: AbortSignal,
  ): Promise<unknown>;
  synthesize(prompt: FeatureSynthesisPrompt, signal: AbortSignal): Promise<unknown>;
}

export const FEATURE_STEP_SYSTEM_PROMPT = [
  "Return JSON only.",
  "Analyze only what is visible in the supplied image and the supplied Flow context.",
  "Keep visible observations separate from likely intent and uncertainty.",
  "A visible control proves only that the control exists; it does not prove its destination, state change, persistence, or failure behavior.",
  "List system feedback only when feedback is visibly rendered in this screenshot.",
  "Describe friction without proposing a redesign.",
  "Use exactly the supplied evidenceId.",
].join(" ");

export const FEATURE_SYNTHESIS_SYSTEM_PROMPT = [
  "Return JSON only using this exact top-level structure: sourceAssessment, unscopedEvidence, executiveSummary, observedFlow, flowAnalysis, proposedFeature, requirements, edgeCases, successMetrics, guardrailMetrics, analyticsEvents, dependencies, openQuestions.",
  "Each claim has id, kind, text, evidenceIds, and optional confidence.",
  "The requirements array is exclusively for evidence-backed replication behavior; never put recommendations, imagined behavior, analytics, accessibility redesigns, or missing states in requirements.",
  "Each replication requirement is an observed or inferred claim plus userStory, priority, preconditions, and acceptanceCriteria, and must cite evidence.",
  "Each acceptance criterion is one observed or inferred BDD scenario with id, kind, given, when, then, and evidenceIds.",
  "A visible control proves existence only. Classify its result as inferred unless later evidence visibly demonstrates the result.",
  "Classify an action and its postcondition as observed only when before/after evidence or visible system feedback demonstrates the transition.",
  "Do not mention loading completion unless a loading indicator or loading feedback is visibly evidenced.",
  "Put suggested changes only in proposedFeature and classify them proposed. Put unresolved behavior in openQuestions and classify it unknown.",
  "Requirement text must describe one capability-level replica behavior in product language, not an implementation task.",
  "Write complete Given, When, and Then clauses and group related happy-path, alternate-path, and error scenarios under the same requirement.",
  "Normally create 1 to 3 acceptance criteria per requirement and never invent alternate, validation, recovery, API, persistence, analytics, or accessibility behavior merely to fill a section.",
  "Do not create one requirement per screen, screenshot, step, or UI control.",
  "Classify every claim as observed, inferred, proposed, or unknown.",
  "Every observed or inferred claim must cite one or more supplied evidence IDs.",
  "Every requirement must include the union of all evidence IDs cited by its acceptance criteria.",
  "Every supplied screenshot must be cited by a requirement or acceptance criterion. If a screenshot cannot support implementation behavior, put it in unscopedEvidence with a specific reason.",
  "Never cite the same screenshot in both requirements and unscopedEvidence.",
  "Use objective acceptance language; avoid subjective terms such as intuitive, discoverable, easy, clear, or enough context.",
  "Use CLM-001 style IDs for claims, REQ-001 for requirements, and AC-001 for acceptance criteria, with global numbering and no duplicates.",
  "Use priority unranked unless the focus instruction explicitly includes product-owner priority.",
  "When priority is unranked, requirement text must not use must, should, could, required, or other priority language.",
  "An observed requirement may describe only visible presentation unless its cited evidence includes explicit interaction metadata; action capabilities such as submission, saving, selection, navigation, editing, or persistence must otherwise be inferred.",
  "Do not include the words Given, When, or Then inside their corresponding acceptance-criterion values.",
  "If the evidence lacks explicit interactions or a demonstrated result, mark sourceAssessment completeness partial and do not present the capture as a complete journey.",
  "Arrays for metrics, analytics, dependencies, recommendations, risks, or edge cases may and should be empty when evidence does not support them.",
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
        system: FEATURE_STEP_SYSTEM_PROMPT,
        text: prompt,
        image,
        signal,
      }));
    },
    synthesize(prompt, signal) {
      return legacyErrors(() => provider.completeJson({
        system: FEATURE_SYNTHESIS_SYSTEM_PROMPT,
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
