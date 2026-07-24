import type {
  AppKnowledgeFlow,
  AppKnowledgeFlowInsights,
} from "./appKnowledge.ts";
import type { AppKnowledgeEvidenceManifestItem } from "./appKnowledgeEvidence.ts";
import type { AppKnowledgeEvidenceAnalysis } from "./appKnowledgeService.ts";

export interface AppKnowledgeOrderedFlowStep {
  id: string;
  order: number;
  evidenceId: string;
  label: string;
  interaction?: string;
  analysis: AppKnowledgeEvidenceAnalysis;
}

export interface AppKnowledgeOrderedFlow {
  id: string;
  title: string;
  category?: string;
  steps: AppKnowledgeOrderedFlowStep[];
}

export interface AppKnowledgeFlowSynthesisStep {
  stepId: string;
  interaction: string;
  visibleStates: string[];
  systemFeedback: string[];
}

export interface AppKnowledgeFlowSynthesisItem {
  flowId: string;
  purpose: string;
  tags: string[];
  feedback: string[];
  openQuestions: string[];
  confidence: number;
  source: "llm_inferred";
  reviewStatus: "needs_review";
  steps: AppKnowledgeFlowSynthesisStep[];
}

export interface AppKnowledgeFlowSynthesisResult {
  flows: AppKnowledgeFlowSynthesisItem[];
}

export interface AppKnowledgeFlowSynthesisChunk {
  ordinal: number;
  flows: AppKnowledgeOrderedFlow[];
  byteSize: number;
}

function text(value: unknown, label: string, maximum = 2_000): string {
  if (typeof value !== "string" || !value.trim() || value.length > maximum) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function strings(value: unknown, label: string, maximum = 100): string[] {
  if (!Array.isArray(value) || value.length > maximum) {
    throw new Error(`${label} must be a bounded array`);
  }
  return value.map((item, index) => text(item, `${label}[${index}]`));
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function confidence(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${label} confidence must be between 0 and 1`);
  }
  return value;
}

function clonedAnalysis(
  analysis: AppKnowledgeEvidenceAnalysis,
  evidenceId: string,
): AppKnowledgeEvidenceAnalysis {
  return { ...structuredClone(analysis), evidenceId };
}

export function planOrderedFlows(
  manifest: readonly AppKnowledgeEvidenceManifestItem[],
  analyses: ReadonlyMap<string, AppKnowledgeEvidenceAnalysis>,
): AppKnowledgeOrderedFlow[] {
  const groups = new Map<string, AppKnowledgeEvidenceManifestItem[]>();
  for (const item of manifest) {
    if (item.kind !== "flow_step" || !item.flow) continue;
    const current = groups.get(item.flow.id);
    if (current) current.push(item);
    else groups.set(item.flow.id, [item]);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([flowId, items]) => {
      const ordered = [...items].sort((left, right) =>
        left.flow!.stepIndex - right.flow!.stepIndex);
      const indexes = ordered.map(({ flow }) => flow!.stepIndex);
      if (new Set(indexes).size !== indexes.length) {
        throw new Error(`Flow ${flowId} contains duplicate step indexes`);
      }
      return {
        id: flowId,
        title: ordered[0].flow!.title,
        ...(ordered[0].flow!.category ? { category: ordered[0].flow!.category } : {}),
        steps: ordered.map((item, position) => {
          const sourceEvidenceId = item.duplicateOfEvidenceId ?? item.evidenceId;
          const analysis = analyses.get(item.evidenceId) ?? analyses.get(sourceEvidenceId);
          if (!analysis) {
            throw new Error(`Flow ${flowId} is missing analysis for ${item.evidenceId}`);
          }
          return {
            id: `${flowId}-step-${position + 1}`,
            order: position + 1,
            evidenceId: item.evidenceId,
            label: item.flow!.stepLabel,
            ...(item.flow!.interaction ? { interaction: item.flow!.interaction } : {}),
            analysis: clonedAnalysis(analysis, item.evidenceId),
          };
        }),
      };
    });
}

function serializedFlowBytes(flows: readonly AppKnowledgeOrderedFlow[]): number {
  return Buffer.byteLength(JSON.stringify({ flows }), "utf8");
}

export function planFlowSynthesisChunks(
  input: readonly AppKnowledgeOrderedFlow[],
  maximumBytes: number,
): AppKnowledgeFlowSynthesisChunk[] {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1) {
    throw new Error("Flow synthesis chunk byte ceiling must be positive");
  }
  const flows = [...input].sort((left, right) => left.id.localeCompare(right.id));
  const chunks: AppKnowledgeOrderedFlow[][] = [];
  let current: AppKnowledgeOrderedFlow[] = [];
  for (const flow of flows) {
    if (serializedFlowBytes([flow]) > maximumBytes) {
      throw new Error(`Flow synthesis item exceeds byte ceiling: ${flow.id}`);
    }
    const candidate = [...current, flow];
    if (current.length > 0 && serializedFlowBytes(candidate) > maximumBytes) {
      chunks.push(current);
      current = [flow];
    } else {
      current = candidate;
    }
  }
  if (current.length > 0) chunks.push(current);
  return chunks.map((items, ordinal) => ({
    ordinal,
    flows: items,
    byteSize: serializedFlowBytes(items),
  }));
}

export function parseAppKnowledgeFlowSynthesisResult(
  value: unknown,
  planned: readonly AppKnowledgeOrderedFlow[],
): AppKnowledgeFlowSynthesisResult {
  const root = object(value, "Flow synthesis");
  if (!Array.isArray(root.flows) || root.flows.length !== planned.length) {
    throw new Error("Flow synthesis must return every planned Flow");
  }
  const expected = new Map(planned.map((flow) => [flow.id, flow]));
  const seen = new Set<string>();
  const flows = root.flows.map((raw, index) => {
    const label = `flows[${index}]`;
    const item = object(raw, label);
    const flowId = text(item.flowId, `${label}.flowId`, 240);
    const source = expected.get(flowId);
    if (!source) throw new Error(`Flow synthesis returned unknown Flow: ${flowId}`);
    if (seen.has(flowId)) throw new Error(`Flow synthesis returned duplicate Flow: ${flowId}`);
    seen.add(flowId);
    if (!Array.isArray(item.steps) || item.steps.length !== source.steps.length) {
      throw new Error(`Flow ${flowId} step count changed`);
    }
    const steps = item.steps.map((rawStep, stepIndex) => {
      const stepLabel = `${label}.steps[${stepIndex}]`;
      const step = object(rawStep, stepLabel);
      const stepId = text(step.stepId, `${stepLabel}.stepId`, 300);
      if (stepId !== source.steps[stepIndex].id) {
        throw new Error(`Flow ${flowId} step order or identity changed`);
      }
      return {
        stepId,
        interaction: text(step.interaction, `${stepLabel}.interaction`, 1_000),
        visibleStates: strings(step.visibleStates, `${stepLabel}.visibleStates`),
        systemFeedback: strings(step.systemFeedback, `${stepLabel}.systemFeedback`),
      };
    });
    if (item.source !== "llm_inferred") {
      throw new Error(`${label}.source must be llm_inferred`);
    }
    if (item.reviewStatus !== "needs_review") {
      throw new Error(`${label}.reviewStatus must be needs_review`);
    }
    return {
      flowId,
      purpose: text(item.purpose, `${label}.purpose`),
      tags: strings(item.tags, `${label}.tags`),
      feedback: strings(item.feedback, `${label}.feedback`),
      openQuestions: strings(item.openQuestions, `${label}.openQuestions`),
      confidence: confidence(item.confidence, label),
      source: "llm_inferred" as const,
      reviewStatus: "needs_review" as const,
      steps,
    };
  });
  return { flows };
}

function inferredClaim(
  id: string,
  textValue: string,
  evidenceIds: string[],
  confidenceValue: number,
) {
  return {
    id,
    kind: "inferred" as const,
    text: textValue,
    evidenceIds,
    confidence: confidenceValue,
  };
}

export function enrichOrderedFlows(
  planned: readonly AppKnowledgeOrderedFlow[],
  result: AppKnowledgeFlowSynthesisResult,
): AppKnowledgeFlow[] {
  const byId = new Map(result.flows.map((flow) => [flow.flowId, flow]));
  return planned.map((flow) => {
    const enrichment = byId.get(flow.id);
    if (!enrichment) throw new Error(`Flow synthesis is missing Flow: ${flow.id}`);
    const evidenceIds = flow.steps.map(({ evidenceId }) => evidenceId);
    const insights: AppKnowledgeFlowInsights = {
      purpose: enrichment.purpose,
      feedback: enrichment.feedback,
      openQuestions: enrichment.openQuestions,
      confidence: enrichment.confidence,
      reviewStatus: "needs_review",
      source: "llm_inferred",
      evidenceIds,
    };
    return {
      id: `flow-${flow.id}`,
      sourceFlowId: flow.id,
      title: flow.title,
      ...(flow.category ? { category: flow.category } : {}),
      userGoal: inferredClaim(
        `flow-${flow.id}-purpose`,
        enrichment.purpose,
        evidenceIds,
        enrichment.confidence,
      ),
      actors: [],
      entryPoint: inferredClaim(
        `flow-${flow.id}-entry`,
        `The journey begins with ${flow.steps[0].label}.`,
        [flow.steps[0].evidenceId],
        flow.steps[0].analysis.confidence,
      ),
      completionPoint: {
        id: `flow-${flow.id}-completion`,
        kind: "unknown",
        text: "The final captured step does not prove successful completion.",
        evidenceIds: [],
        confidence: 0.5,
      },
      steps: flow.steps.map((step, index) => {
        const inferred = enrichment.steps[index];
        return {
          id: step.id,
          order: step.order,
          evidenceId: step.evidenceId,
          label: step.label,
          interaction: step.interaction ?? inferred.interaction,
          visibleStates: inferred.visibleStates,
          availableActions: step.analysis.availableActions,
          systemFeedback: [
            ...new Set([...step.analysis.systemFeedback, ...inferred.systemFeedback]),
          ],
          friction: step.analysis.friction,
          uncertainStates: step.analysis.uncertainStates,
          claims: [],
        };
      }),
      effectivePatterns: [],
      risks: [],
      inconsistencies: [],
      openQuestions: enrichment.openQuestions.map((question, index) => ({
        id: `flow-${flow.id}-question-${index + 1}`,
        kind: "unknown" as const,
        text: question,
        evidenceIds: [],
        confidence: enrichment.confidence,
      })),
      insights,
    };
  });
}
