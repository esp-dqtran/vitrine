import type { AppKnowledgeCoverage, AppKnowledgeEvidenceKind } from "./appKnowledge.ts";
import type {
  MultimodalJsonProvider,
  RasterImage,
} from "./evidenceAnalysisProvider.ts";

export interface AppKnowledgeEvidencePrompt {
  evidenceId: string;
  app: string;
  platform: "ios" | "android" | "web";
  kind: AppKnowledgeEvidenceKind;
  flowContext: Record<string, unknown> | null;
  previousStepContext: Record<string, unknown> | null;
  validationError: string;
}

export interface AppKnowledgeSynthesisPrompt {
  app: string;
  platform: "ios" | "android" | "web";
  captureVersionId: number;
  analyses: unknown[];
  flows: unknown[];
  coverage: AppKnowledgeCoverage | Record<string, never>;
  allowedEvidenceIds: string[];
  validationError: string;
}

export interface AppKnowledgeProvider {
  readonly model: string;
  analyzeEvidence(
    prompt: AppKnowledgeEvidencePrompt,
    image: RasterImage,
    signal: AbortSignal,
  ): Promise<unknown>;
  synthesize(
    prompt: AppKnowledgeSynthesisPrompt,
    signal: AbortSignal,
  ): Promise<unknown>;
}

const EVIDENCE_SYSTEM_PROMPT = [
  "Return JSON only.",
  "Analyze only visible evidence in the supplied image and context.",
  "Record exact visible text, visible UI, purpose, page type, product area, theme, viewport, layout, content, imagery, icons, interactions, states, available actions, system feedback, and visible accessibility observations.",
  "Keep visible facts separate from likely intent, friction, and missing or uncertain states.",
  "Use exactly the supplied evidenceId and a confidence from zero to one.",
].join(" ");

const SYNTHESIS_SYSTEM_PROMPT = [
  "Return JSON only using the canonical App Knowledge snapshot structure.",
  "Produce one shared model for Designer, Developer, and Product projections.",
  "Each claim has id, kind, text, evidenceIds, and confidence.",
  "Classify claims as observed, inferred, proposed, or unknown.",
  "Every observed or inferred claim must cite one or more supplied evidence IDs.",
  "Never invent an evidence ID.",
  "Full-page screenshots may produce component candidates only, never trusted components.",
].join(" ");

export function appKnowledgeProviderFromMultimodalJsonProvider(
  provider: MultimodalJsonProvider,
): AppKnowledgeProvider {
  return {
    model: provider.model,
    analyzeEvidence(prompt, image, signal) {
      return provider.completeJson({
        system: EVIDENCE_SYSTEM_PROMPT,
        text: prompt,
        image,
        signal,
      });
    },
    synthesize(prompt, signal) {
      return provider.completeJson({
        system: SYNTHESIS_SYSTEM_PROMPT,
        text: prompt,
        signal,
      });
    },
  };
}
