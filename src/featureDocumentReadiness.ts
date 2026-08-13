import type {
  FeatureDocumentRevisionView,
  FeatureDocumentView,
} from "./featureDocument.ts";

export type FeatureDocumentReadinessSeverity = "blocker" | "warning";

export interface FeatureDocumentReadinessIssue {
  id:
    | "source-changed"
    | "requirements-missing"
    | "acceptance-criteria-missing"
    | "evidence-missing"
    | "open-questions"
    | "success-metrics-missing";
  label: string;
  severity: FeatureDocumentReadinessSeverity;
}

export interface FeatureDocumentReadiness {
  blockers: FeatureDocumentReadinessIssue[];
  warnings: FeatureDocumentReadinessIssue[];
  canApprove: boolean;
  requirementCount: number;
  acceptanceCriteriaCount: number;
  supportedRequirementCount: number;
}

const plural = (count: number, singular: string, pluralLabel = `${singular}s`) =>
  `${count} ${count === 1 ? singular : pluralLabel}`;

export function assessFeatureDocumentReadiness(
  document: Pick<FeatureDocumentView, "sourceChanged">,
  revision: Pick<FeatureDocumentRevisionView, "content">,
): FeatureDocumentReadiness {
  const { requirements, openQuestions, successMetrics } = revision.content;
  const acceptanceCriteriaCount = requirements.reduce(
    (total, requirement) => total + requirement.acceptanceCriteria.length,
    0,
  );
  const requirementsWithoutCriteria = requirements.filter(
    ({ acceptanceCriteria }) => acceptanceCriteria.length === 0,
  );
  const supportedRequirementCount = requirements.filter((requirement) =>
    requirement.evidenceIds.length > 0
    || requirement.acceptanceCriteria.some(({ evidenceIds }) => evidenceIds.length > 0),
  ).length;
  const unsupportedRequirementCount = requirements.length - supportedRequirementCount;

  const blockers: FeatureDocumentReadinessIssue[] = [];
  const warnings: FeatureDocumentReadinessIssue[] = [];

  if (document.sourceChanged) {
    blockers.push({
      id: "source-changed",
      label: "The source Flow changed after this revision was created.",
      severity: "blocker",
    });
  }
  if (requirements.length === 0) {
    blockers.push({
      id: "requirements-missing",
      label: "Add at least one requirement before approval.",
      severity: "blocker",
    });
  }
  if (requirementsWithoutCriteria.length > 0) {
    blockers.push({
      id: "acceptance-criteria-missing",
      label: `${plural(requirementsWithoutCriteria.length, "requirement")} missing acceptance criteria.`,
      severity: "blocker",
    });
  }
  if (unsupportedRequirementCount > 0) {
    warnings.push({
      id: "evidence-missing",
      label: `${plural(unsupportedRequirementCount, "requirement")} not linked to captured evidence.`,
      severity: "warning",
    });
  }
  if (openQuestions.length > 0) {
    warnings.push({
      id: "open-questions",
      label: `${plural(openQuestions.length, "open question")} still unresolved.`,
      severity: "warning",
    });
  }
  if (successMetrics.length === 0) {
    warnings.push({
      id: "success-metrics-missing",
      label: "No success metric is defined.",
      severity: "warning",
    });
  }

  return {
    blockers,
    warnings,
    canApprove: blockers.length === 0,
    requirementCount: requirements.length,
    acceptanceCriteriaCount,
    supportedRequirementCount,
  };
}
