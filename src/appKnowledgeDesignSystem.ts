import { createHash } from "node:crypto";
import {
  parseAppKnowledgeSnapshot,
  type AppKnowledgeCoverage,
  type AppKnowledgeDesignSystemResult,
  type AppKnowledgeFlow,
  type AppKnowledgeSnapshot,
} from "./appKnowledge.ts";
import type { AppKnowledgeEvidenceAnalysis } from "./appKnowledgeService.ts";

export interface AppKnowledgeDesignSignal {
  evidenceId: string;
  productArea: string;
  pageType: string;
  viewport: AppKnowledgeEvidenceAnalysis["viewport"];
  theme: AppKnowledgeEvidenceAnalysis["theme"];
  visualHierarchy: string[];
  layoutPatterns: string[];
  contentPatterns: string[];
  imagery: string[];
  icons: string[];
  interactionPatterns: string[];
  visibleStates: string[];
  accessibilityObservations: string[];
  tokenCandidates: AppKnowledgeEvidenceAnalysis["tokenCandidates"];
  componentOccurrences: AppKnowledgeEvidenceAnalysis["componentOccurrences"];
}

export interface AppKnowledgeDesignSystemChunk {
  key: string;
  ordinal: number;
  signals: AppKnowledgeDesignSignal[];
  evidenceIds: string[];
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function stableId(prefix: string, value: string): string {
  return `${prefix}-${digest(value).slice(0, 20)}`;
}

export function compactDesignSignal(
  analysis: AppKnowledgeEvidenceAnalysis,
): AppKnowledgeDesignSignal {
  return {
    evidenceId: analysis.evidenceId,
    productArea: analysis.productArea,
    pageType: analysis.pageType,
    viewport: analysis.viewport,
    theme: analysis.theme,
    visualHierarchy: analysis.visualHierarchy,
    layoutPatterns: analysis.layoutPatterns,
    contentPatterns: analysis.contentPatterns,
    imagery: analysis.imagery,
    icons: analysis.icons,
    interactionPatterns: analysis.interactionPatterns,
    visibleStates: analysis.visibleStates,
    accessibilityObservations: analysis.accessibilityObservations,
    tokenCandidates: analysis.tokenCandidates,
    componentOccurrences: analysis.componentOccurrences,
  };
}

function serializedSignalsBytes(signals: AppKnowledgeDesignSignal[]): number {
  return Buffer.byteLength(JSON.stringify({ signals }), "utf8");
}

export function serializedDesignSystemChunkBytes(
  chunk: AppKnowledgeDesignSystemChunk,
): number {
  return serializedSignalsBytes(chunk.signals);
}

export function planDesignSystemChunks(
  analyses: readonly AppKnowledgeEvidenceAnalysis[],
  maximumBytes: number,
): AppKnowledgeDesignSystemChunk[] {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1) {
    throw new Error("Design-system chunk byte ceiling must be positive");
  }
  const signals = analyses.map(compactDesignSignal).sort((left, right) => {
    const leftKey = [
      normalized(left.productArea),
      normalized(left.pageType),
      left.theme,
      left.evidenceId,
    ].join("\0");
    const rightKey = [
      normalized(right.productArea),
      normalized(right.pageType),
      right.theme,
      right.evidenceId,
    ].join("\0");
    return leftKey.localeCompare(rightKey);
  });
  const groups: AppKnowledgeDesignSignal[][] = [];
  let current: AppKnowledgeDesignSignal[] = [];
  for (const signal of signals) {
    if (serializedSignalsBytes([signal]) > maximumBytes) {
      throw new Error(`Design-system signal exceeds byte ceiling: ${signal.evidenceId}`);
    }
    const candidate = [...current, signal];
    if (current.length > 0 && serializedSignalsBytes(candidate) > maximumBytes) {
      groups.push(current);
      current = [signal];
    } else {
      current = candidate;
    }
  }
  if (current.length > 0) groups.push(current);
  return groups.map((items, ordinal) => ({
    key: digest(JSON.stringify(items)),
    ordinal,
    signals: items,
    evidenceIds: items.map(({ evidenceId }) => evidenceId),
  }));
}

export function assembleDesignSystemSnapshot(input: {
  identity: Omit<AppKnowledgeSnapshot["identity"], "generatedAt">;
  coverage: AppKnowledgeCoverage;
  analyses: readonly AppKnowledgeEvidenceAnalysis[];
  allowedEvidenceIds?: readonly string[];
  result: AppKnowledgeDesignSystemResult;
  flows?: readonly AppKnowledgeFlow[];
  generatedAt: string;
}): AppKnowledgeSnapshot {
  const analyses = [...input.analyses].sort((left, right) =>
    left.evidenceId.localeCompare(right.evidenceId));
  const productAreas = new Map<string, AppKnowledgeEvidenceAnalysis>();
  for (const analysis of analyses) {
    const key = normalized(analysis.productArea) || "unknown";
    if (!productAreas.has(key)) productAreas.set(key, analysis);
  }
  const snapshot: AppKnowledgeSnapshot = {
    identity: {
      ...input.identity,
      generatedAt: new Date(input.generatedAt).toISOString(),
    },
    coverage: input.coverage,
    screens: analyses.map((analysis) => ({
      id: stableId("screen", analysis.evidenceId),
      evidenceId: analysis.evidenceId,
      pageType: analysis.pageType,
      productArea: analysis.productArea,
      purpose: analysis.purpose,
      viewport: analysis.viewport,
      visibleText: analysis.visibleText,
      theme: analysis.theme,
      visualHierarchy: analysis.visualHierarchy,
      layoutPatterns: analysis.layoutPatterns,
      contentPatterns: analysis.contentPatterns,
      imagery: analysis.imagery,
      icons: analysis.icons,
      interactionPatterns: analysis.interactionPatterns,
      visibleStates: analysis.visibleStates,
      availableActions: analysis.availableActions,
      systemFeedback: analysis.systemFeedback,
      accessibilityObservations: analysis.accessibilityObservations,
      claims: [],
      confidence: analysis.confidence,
      reviewStatus: "needs_review",
    })),
    componentCandidates: input.result.componentCandidates,
    designLanguage: input.result.designLanguage,
    tokenCandidates: input.result.tokenCandidates,
    designRules: input.result.rules,
    designConflicts: input.result.unresolvedConflicts,
    flows: input.flows ? structuredClone([...input.flows]) : [],
    productKnowledge: {
      capabilities: [...productAreas.entries()].map(([key, analysis]) => ({
        id: stableId("capability", key),
        kind: "observed",
        text: `Captured interfaces include the ${analysis.productArea} product area.`,
        evidenceIds: [analysis.evidenceId],
        confidence: analysis.confidence,
      })),
      featureRelationships: [],
      userJourneys: [],
      actorResponsibilities: [],
      requirements: [],
      acceptanceCriteria: [],
      edgeCases: [],
      dependencies: [],
      risks: [],
      successMetrics: [],
      guardrails: [],
      analyticsEvents: [],
      openQuestions: [],
    },
  };
  return parseAppKnowledgeSnapshot(
    snapshot,
    new Set(input.allowedEvidenceIds ?? analyses.map(({ evidenceId }) => evidenceId)),
  );
}
