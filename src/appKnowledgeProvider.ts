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

export interface AppKnowledgeDesignSystemChunkPrompt {
  app: string;
  platform: "ios" | "android" | "web";
  signals: unknown[];
  allowedEvidenceIds: string[];
  validationError: string;
}

export interface AppKnowledgeDesignSystemMergePrompt {
  app: string;
  platform: "ios" | "android" | "web";
  fragments: unknown[];
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
  synthesizeDesignSystemChunk(
    prompt: AppKnowledgeDesignSystemChunkPrompt,
    signal: AbortSignal,
  ): Promise<unknown>;
  mergeDesignSystem(
    prompt: AppKnowledgeDesignSystemMergePrompt,
    signal: AbortSignal,
  ): Promise<unknown>;
}

export const APP_KNOWLEDGE_EVIDENCE_INSTRUCTIONS = [
  "Return JSON only.",
  "Analyze only visible evidence in the supplied image and context.",
  "Record exact visible text, visible UI, purpose, page type, product area, theme, viewport, layout, content, imagery, icons, interactions, states, available actions, system feedback, and visible accessibility observations.",
  "Keep visible facts separate from likely intent, friction, and missing or uncertain states.",
  "Treat token values and component geometry as approximate screenshot observations; do not claim original CSS, source design tokens, or Figma values.",
  'Use this TokenCandidate shape: {"kind": "color" | "typography" | "spacing" | "radius" | "border" | "effect", "name": string, "value": string, "role": string, "confidence": number}.',
  'Use this ComponentOccurrence shape: {"family": string, "variant": string, "category": string, "purpose": string, "anatomy": string[], "visibleStates": string[], "observedProperties": string[], "region": {"x": number, "y": number, "width": number, "height": number}, "confidence": number}.',
  "Component regions use normalized top-left coordinates from zero to one and must stay within the supplied image.",
  "Use exactly the supplied evidenceId and a confidence from zero to one.",
  'Use exactly this shape and value casing: {"evidenceId": string, "pageType": string, "productArea": string, "purpose": string, "viewport": "desktop" | "tablet" | "mobile" | "unknown", "visibleText": string[], "theme": "light" | "dark" | "mixed", "visualHierarchy": string[], "layoutPatterns": string[], "contentPatterns": string[], "imagery": string[], "icons": string[], "interactionPatterns": string[], "visibleStates": string[], "availableActions": string[], "systemFeedback": string[], "accessibilityObservations": string[], "likelyIntent": string, "friction": string[], "uncertainStates": string[], "confidence": number, "tokenCandidates": TokenCandidate[], "componentOccurrences": ComponentOccurrence[]}.',
  "Every field is required. Use an empty array when no visible evidence supports an array field.",
  "Keep visibleText to at most 24 distinct high-value strings, at most 24 token candidates, at most 24 component occurrences, and every other array to at most 12 concise items.",
].join(" ");

export const APP_KNOWLEDGE_SYNTHESIS_INSTRUCTIONS = [
  "Return JSON only using the canonical App Knowledge snapshot structure.",
  "Produce one shared model for Designer, Developer, and Product projections.",
  "Each claim has id, kind, text, evidenceIds, and confidence.",
  "Classify claims as observed, inferred, proposed, or unknown.",
  "Every observed or inferred claim must cite one or more supplied evidence IDs.",
  "Never invent an evidence ID.",
  "Full-page screenshots may produce component candidates only, never trusted components.",
].join(" ");

export const APP_KNOWLEDGE_DESIGN_SYSTEM_INSTRUCTIONS = [
  "Return JSON only with componentCandidates and designLanguage.",
  "Extract a reusable design language from only the supplied screen signals.",
  'Use this Claim shape: {"id": string, "kind": "observed" | "inferred" | "proposed" | "unknown", "text": string, "evidenceIds": string[], "confidence": number}.',
  'Use exactly this result shape: {"componentCandidates":[{"id": string, "name": string, "category": string, "purpose": string, "anatomy": string[], "observedProperties": string[], "variants": string[], "states": string[], "responsiveEvidence": string[], "evidenceIds": string[], "visualRegions": string[], "designLanguageCandidateIds": string[], "claims": Claim[], "confidence": number, "status": "candidate"}],"designLanguage":{"color": Claim[], "typography": Claim[], "spacing": Claim[], "radius": Claim[], "border": Claim[], "effects": Claim[], "layout": Claim[], "iconography": Claim[], "imagery": Claim[], "responsive": Claim[], "content": Claim[], "interaction": Claim[]}}.',
  "Every field is required. Use [] when no evidence supports an array field.",
  "At least one designLanguage category must contain one claim.",
  "Every component candidate must cite at least one supplied evidence ID.",
  "Every observed or inferred claim must cite one or more supplied evidence IDs.",
  "Never invent an evidence ID, exact token value, font, measurement, or interaction not supported by evidence.",
  "Full-page screenshots may produce component candidates only with status candidate.",
].join(" ");

export const APP_KNOWLEDGE_DESIGN_SYSTEM_MERGE_INSTRUCTIONS = [
  APP_KNOWLEDGE_DESIGN_SYSTEM_INSTRUCTIONS,
  "Do not use tools, terminal, files, or code execution. Reason over the supplied fragments in the conversation and answer directly.",
  "Merge semantically equivalent claims and component candidates across fragments.",
  "Return at most 16 componentCandidates, prioritizing the most reusable and well-supported patterns.",
  "Return at most 4 claims in each designLanguage category and at most 12 representative evidence IDs on each claim or component candidate.",
  "Keep every other string array to at most 8 concise items and every claim text to at most 180 characters.",
  "Preserve evidence citations, normalize names conservatively, and return one deduplicated design system.",
].join(" ");

export function appKnowledgeBrowserPrompt(
  instructions: string,
  payload:
    | AppKnowledgeEvidencePrompt
    | AppKnowledgeSynthesisPrompt
    | AppKnowledgeDesignSystemChunkPrompt
    | AppKnowledgeDesignSystemMergePrompt,
): string {
  return `${instructions}\n\nReturn one JSON object for this payload:\n${JSON.stringify(payload)}`;
}

export function appKnowledgeProviderFromMultimodalJsonProvider(
  provider: MultimodalJsonProvider,
): AppKnowledgeProvider {
  return {
    model: provider.model,
    analyzeEvidence(prompt, image, signal) {
      return provider.completeJson({
        system: APP_KNOWLEDGE_EVIDENCE_INSTRUCTIONS,
        text: prompt,
        image,
        signal,
      });
    },
    synthesize(prompt, signal) {
      return provider.completeJson({
        system: APP_KNOWLEDGE_SYNTHESIS_INSTRUCTIONS,
        text: prompt,
        signal,
      });
    },
    synthesizeDesignSystemChunk(prompt, signal) {
      return provider.completeJson({
        system: APP_KNOWLEDGE_DESIGN_SYSTEM_INSTRUCTIONS,
        text: prompt,
        signal,
      });
    },
    mergeDesignSystem(prompt, signal) {
      return provider.completeJson({
        system: APP_KNOWLEDGE_DESIGN_SYSTEM_MERGE_INSTRUCTIONS,
        text: prompt,
        signal,
      });
    },
  };
}
