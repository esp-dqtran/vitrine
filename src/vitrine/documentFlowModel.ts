import type { DesignFlow, EvidenceView } from '../designSystem.ts';
import type {
  FeatureClaim,
  FeatureClaimKind,
  FeatureDocumentRevisionView,
} from '../featureDocument.ts';

export interface DocumentFlowStep {
  number: number;
  label: string;
  text: string;
  kind: FeatureClaimKind;
  evidenceIds: string[];
}

export interface DocumentFlowNarrative {
  overview: {
    purpose: FeatureClaim;
    userValue: FeatureClaim;
  };
  trigger: FeatureClaim;
  steps: DocumentFlowStep[];
  outcome: FeatureClaim;
  alternates: FeatureClaim[];
}

export function buildDocumentFlowNarrative(
  flow: DesignFlow<EvidenceView>,
  revision: FeatureDocumentRevisionView,
): DocumentFlowNarrative {
  const journey = revision.content.observedFlow.journey;
  const steps = flow.steps.map((step, stepIndex) => {
    const evidenceIds = revision.evidenceManifest
      .filter((item) => item.stepIndex === stepIndex)
      .map((item) => item.evidenceId);
    const claim = journey.find((item) =>
      item.evidenceIds.some((evidenceId) => evidenceIds.includes(evidenceId)));
    return {
      number: stepIndex + 1,
      label: step.label,
      text: claim?.text
        ?? step.analysis?.interaction
        ?? step.interaction
        ?? 'No documented description.',
      kind: claim?.kind ?? (step.analysis || step.interaction ? 'observed' : 'unknown'),
      evidenceIds: claim?.evidenceIds.length ? claim.evidenceIds : evidenceIds,
    };
  });
  return {
    overview: {
      purpose: revision.content.executiveSummary.purpose,
      userValue: revision.content.executiveSummary.userValue,
    },
    trigger: revision.content.observedFlow.entryPoint,
    steps,
    outcome: revision.content.observedFlow.completionPoint,
    alternates: [
      ...revision.content.edgeCases,
      ...revision.content.flowAnalysis.friction,
      ...revision.content.flowAnalysis.missingStates,
      ...revision.content.flowAnalysis.risksAndAssumptions,
    ],
  };
}
