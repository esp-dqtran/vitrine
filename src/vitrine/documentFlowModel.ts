import type { DesignFlow, EvidenceView } from '../designSystem.ts';
import type {
  FeatureClaim,
  FeatureClaimKind,
  FeatureDocumentRevisionView,
} from '../featureDocument.ts';

export interface DocumentFlowEvidenceLink {
  evidenceId: string;
  label: string;
  stepNumber?: number;
  stepLabel?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  description?: string;
}

export interface DocumentFlowScenario {
  id: string;
  given: string;
  when: string;
  then: string;
}

export interface DocumentFlowRequirementCard {
  id: string;
  priority: 'must' | 'should' | 'could' | 'later' | 'unranked';
  kind: FeatureClaimKind;
  text: string;
  userStory: string;
  businessRules: string[];
  evidence: DocumentFlowEvidenceLink[];
  scenarios: DocumentFlowScenario[];
}

export interface DocumentFlowPresentation {
  summary: {
    goal: string;
    entryPoint: string;
    completionPoint: string;
    reviewStatus: FeatureDocumentRevisionView['reviewStatus'];
    requirementCount: number;
    acceptanceCriteriaCount: number;
    supportedRequirementCount: number;
    openQuestionCount: number;
    captureType?: NonNullable<FeatureDocumentRevisionView['content']['sourceAssessment']>['captureType'];
    completeness?: NonNullable<FeatureDocumentRevisionView['content']['sourceAssessment']>['completeness'];
    captureRationale?: string;
  };
  requirements: DocumentFlowRequirementCard[];
  openQuestions: FeatureClaim[];
}

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function evidenceLinks(
  evidenceIds: string[],
  revision: FeatureDocumentRevisionView,
  flow: DesignFlow<EvidenceView>,
): DocumentFlowEvidenceLink[] {
  const wanted = unique(evidenceIds);
  const resolved = revision.evidenceManifest
    .filter(({ evidenceId }) => wanted.includes(evidenceId))
    .map((item) => {
      const stepEvidence = flow.steps[item.stepIndex]?.evidence[item.imageIndex];
      return {
        evidenceId: item.evidenceId,
        label: item.evidenceId,
        stepNumber: item.stepIndex + 1,
        stepLabel: item.stepLabel,
        imageUrl: stepEvidence?.imageUrl,
        thumbnailUrl: stepEvidence?.thumbnailUrl,
        description: stepEvidence?.description ?? item.description ?? undefined,
      };
    });
  const resolvedIds = new Set(resolved.map(({ evidenceId }) => evidenceId));
  return [
    ...resolved,
    ...wanted
      .filter((evidenceId) => !resolvedIds.has(evidenceId))
      .map((evidenceId) => ({ evidenceId, label: evidenceId })),
  ];
}

function deduplicateClaims(claims: FeatureClaim[]): FeatureClaim[] {
  const seen = new Set<string>();
  return claims.flatMap((claim) => {
    const text = claim.text.trim().replace(/\s+/g, ' ');
    const key = normalize(text);
    if (!key || seen.has(key)) return [];
    seen.add(key);
    return [{ ...claim, text }];
  });
}

export function buildDocumentFlowPresentation(
  flow: DesignFlow<EvidenceView>,
  revision: FeatureDocumentRevisionView,
): DocumentFlowPresentation {
  const { content } = revision;
  const requirements = content.requirements.map((requirement) => ({
    id: requirement.id,
    priority: requirement.priority,
    kind: requirement.kind,
    text: requirement.text,
    userStory: requirement.userStory,
    businessRules: requirement.preconditions,
    evidence: evidenceLinks([
      ...requirement.evidenceIds,
      ...requirement.acceptanceCriteria.flatMap(({ evidenceIds }) => evidenceIds),
    ], revision, flow),
    scenarios: requirement.acceptanceCriteria.map(({ id, given, when, then }) => ({
      id,
      given,
      when,
      then,
    })),
  }));
  const openQuestions = deduplicateClaims([
    ...content.flowAnalysis.missingStates,
    ...content.openQuestions,
  ]);
  return {
    summary: {
      goal: content.observedFlow.userGoal.text,
      entryPoint: content.observedFlow.entryPoint.text,
      completionPoint: content.observedFlow.completionPoint.text,
      reviewStatus: revision.reviewStatus,
      requirementCount: requirements.length,
      acceptanceCriteriaCount: requirements.reduce(
        (total, requirement) => total + requirement.scenarios.length,
        0,
      ),
      supportedRequirementCount: requirements.filter(
        ({ evidence }) => evidence.length > 0,
      ).length,
      openQuestionCount: openQuestions.length,
      ...(content.sourceAssessment
        ? {
            captureType: content.sourceAssessment.captureType,
            completeness: content.sourceAssessment.completeness,
            captureRationale: content.sourceAssessment.rationale,
          }
        : {}),
    },
    requirements,
    openQuestions,
  };
}
