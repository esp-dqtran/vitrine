export type FeatureClaimKind = "observed" | "inferred" | "proposed" | "unknown";

export interface FeatureClaim {
  id: string;
  kind: FeatureClaimKind;
  text: string;
  evidenceIds: string[];
  confidence?: number;
}

export interface FeatureAcceptanceCriterion {
  id: string;
  given: string;
  when: string;
  then: string;
  evidenceIds: string[];
}

export interface FeatureRequirement extends FeatureClaim {
  userStory: string;
  priority: "must" | "should" | "could" | "later";
  preconditions: string[];
  acceptanceCriteria: FeatureAcceptanceCriterion[];
}

export interface FeatureDocumentContent {
  executiveSummary: {
    purpose: FeatureClaim;
    userValue: FeatureClaim;
    recommendation: FeatureClaim;
  };
  observedFlow: {
    userGoal: FeatureClaim;
    entryPoint: FeatureClaim;
    completionPoint: FeatureClaim;
    journey: FeatureClaim[];
    actors: FeatureClaim[];
    visibleStates: FeatureClaim[];
  };
  flowAnalysis: {
    effectivePatterns: FeatureClaim[];
    friction: FeatureClaim[];
    missingStates: FeatureClaim[];
    inconsistencies: FeatureClaim[];
    risksAndAssumptions: FeatureClaim[];
  };
  proposedFeature: {
    problem: FeatureClaim;
    targetUsers: FeatureClaim[];
    goals: FeatureClaim[];
    nonGoals: FeatureClaim[];
    behavior: FeatureClaim[];
    journey: FeatureClaim[];
  };
  requirements: FeatureRequirement[];
  edgeCases: FeatureClaim[];
  successMetrics: FeatureClaim[];
  guardrailMetrics: FeatureClaim[];
  analyticsEvents: FeatureClaim[];
  dependencies: FeatureClaim[];
  openQuestions: FeatureClaim[];
}

export interface FeatureStepAnalysis {
  evidenceId: string;
  visibleUi: string[];
  visibleText: string[];
  likelyIntent: string;
  availableActions: string[];
  systemFeedback: string[];
  friction: string[];
  missingOrUncertainStates: string[];
  accessibility: string[];
  confidence: number;
}

export type FeatureDocumentReviewStatus = "draft" | "in_review" | "approved" | "superseded";
export type FeatureDocumentJobStatus = "queued" | "running" | "done" | "error" | "cancelled" | "stale";
export type FeatureDocumentJobStage = "preparing" | "analyzing" | "synthesizing" | "validating" | "saving" | "complete";

export interface FeatureEvidenceManifestItem {
  stepIndex: number;
  imageIndex: number;
  imageId: number;
  evidenceId: string;
  stepLabel: string;
  interaction?: string;
  description: string | null;
  capturedAt?: string | null;
}

export interface FeatureSourceFlow {
  app: string;
  platform: "ios" | "android" | "web";
  versionId?: number;
  flowId: string;
  title: string;
  description: string;
  category?: string;
  tags: string[];
}

export interface CreateFeatureGenerationInput {
  transportJobId: number;
  source: FeatureSourceFlow;
  evidenceManifest: FeatureEvidenceManifestItem[];
  evidenceManifestSha256: string;
  focusInstruction: string;
  promptVersion: number;
  providerModel: string;
}

export interface FeatureDocumentJobView {
  id: number;
  documentId: number;
  status: FeatureDocumentJobStatus;
  stage: FeatureDocumentJobStage;
  doneCount: number;
  totalCount: number;
  errorCode?: string;
  errorMessage?: string;
  updatedAt: string;
}

export interface FeatureDocumentRevisionView {
  id: number;
  documentId: number;
  revisionNumber: number;
  authorType: "generated" | "user" | "restored";
  reviewStatus: FeatureDocumentReviewStatus;
  content: FeatureDocumentContent;
  source: FeatureSourceFlow;
  evidenceManifest: FeatureEvidenceManifestItem[];
  focusInstruction: string;
  promptVersion: number;
  providerModel: string;
  createdAt: string;
}

export interface FeatureDocumentView {
  id: number;
  title: string;
  reviewStatus: FeatureDocumentReviewStatus;
  sourceChanged: boolean;
  currentRevision?: FeatureDocumentRevisionView;
  revisions: FeatureDocumentRevisionView[];
  shares: FeatureDocumentShareView[];
  currentJob?: FeatureDocumentJobView;
}

export interface FeatureDocumentShareView {
  id: number;
  documentId: number;
  revisionId: number;
  url?: string;
  expiresAt: string;
  revokedAt?: string;
}

export interface FeatureStepPrompt {
  source: FeatureSourceFlow;
  stepIndex: number;
  imageIndex: number;
  evidenceId: string;
  stepLabel: string;
  interaction?: string;
  focusInstruction: string;
  previousStepContext?: FeatureStepAnalysis;
  validationError?: string;
}

export function featureEvidenceManifestSha256(manifest: FeatureEvidenceManifestItem[]): string {
  const canonical = manifest.map((item) => ({
    stepIndex: item.stepIndex,
    imageIndex: item.imageIndex,
    imageId: item.imageId,
    evidenceId: item.evidenceId,
    stepLabel: item.stepLabel,
    interaction: item.interaction ?? null,
    description: item.description,
    capturedAt: item.capturedAt ?? null,
  }));
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export interface FeatureSynthesisPrompt {
  source: FeatureSourceFlow;
  focusInstruction: string;
  analyses: FeatureStepAnalysis[];
  allowedEvidenceIds: string[];
  validationError?: string;
}

type JsonObject = Record<string, unknown>;

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as JsonObject;
}

function text(value: unknown, label: string, maximum = 8_000): string {
  if (typeof value !== "string" || !value.trim() || value.length > maximum) {
    throw new Error(`${label} must be a non-empty string of at most ${maximum} characters`);
  }
  return value.trim();
}

function list(value: unknown, label: string, maximum = 200): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) throw new Error(`${label} must be an array of at most ${maximum} items`);
  return value;
}

function strings(value: unknown, label: string, maximum = 100): string[] {
  return list(value, label, maximum).map((item, index) => text(item, `${label}[${index}]`, 2_000));
}

function score(value: unknown, label: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${label} must be between 0 and 1`);
  }
  return value;
}

function evidenceIds(value: unknown, allowed: ReadonlySet<string>, label: string): string[] {
  const ids = [...new Set(strings(value, `${label} evidenceIds`, 100))];
  const unknown = ids.find((id) => !allowed.has(id));
  if (unknown) throw new Error(`${label} cites unknown evidence: ${unknown}`);
  return ids;
}

function claim(
  value: unknown,
  allowed: ReadonlySet<string>,
  label: string,
  identities: Set<string>,
): FeatureClaim {
  const item = object(value, label);
  const id = text(item.id, `${label}.id`, 160);
  if (identities.has(id)) throw new Error(`duplicate feature document id: ${id}`);
  identities.add(id);
  const kind = item.kind;
  if (kind !== "observed" && kind !== "inferred" && kind !== "proposed" && kind !== "unknown") {
    throw new Error(`${label}.kind is invalid`);
  }
  const citations = evidenceIds(item.evidenceIds, allowed, label);
  if ((kind === "observed" || kind === "inferred") && citations.length === 0) {
    throw new Error(`${label} requires evidence`);
  }
  return {
    id,
    kind,
    text: text(item.text, `${label}.text`),
    evidenceIds: citations,
    ...(item.confidence === undefined ? {} : { confidence: score(item.confidence, `${label}.confidence`) }),
  };
}

function claimList(
  value: unknown,
  allowed: ReadonlySet<string>,
  label: string,
  identities: Set<string>,
): FeatureClaim[] {
  return list(value, label).map((item, index) => claim(item, allowed, `${label}[${index}]`, identities));
}

function criterion(
  value: unknown,
  allowed: ReadonlySet<string>,
  label: string,
  identities: Set<string>,
): FeatureAcceptanceCriterion {
  const item = object(value, label);
  const id = text(item.id, `${label}.id`, 160);
  if (identities.has(id)) throw new Error(`duplicate feature document id: ${id}`);
  identities.add(id);
  return {
    id,
    given: text(item.given, `${label}.given`, 4_000),
    when: text(item.when, `${label}.when`, 4_000),
    then: text(item.then, `${label}.then`, 4_000),
    evidenceIds: evidenceIds(item.evidenceIds, allowed, label),
  };
}

function requirement(
  value: unknown,
  allowed: ReadonlySet<string>,
  label: string,
  identities: Set<string>,
): FeatureRequirement {
  const item = object(value, label);
  const base = claim(item, allowed, label, identities);
  const priority = item.priority;
  if (priority !== "must" && priority !== "should" && priority !== "could" && priority !== "later") {
    throw new Error(`${label}.priority is invalid`);
  }
  const acceptanceCriteria = list(item.acceptanceCriteria, `${label}.acceptanceCriteria`, 50)
    .map((entry, index) => criterion(entry, allowed, `${label}.acceptanceCriteria[${index}]`, identities));
  if (priority === "must" && acceptanceCriteria.length === 0) {
    throw new Error(`${label} requires acceptance criteria`);
  }
  return {
    ...base,
    userStory: text(item.userStory, `${label}.userStory`, 4_000),
    priority,
    preconditions: strings(item.preconditions, `${label}.preconditions`, 50),
    acceptanceCriteria,
  };
}

export function parseFeatureStepAnalysis(value: unknown, evidenceId: string): FeatureStepAnalysis {
  const item = object(value, "feature step analysis");
  if (text(item.evidenceId, "feature step analysis.evidenceId", 240) !== evidenceId) {
    throw new Error("feature step analysis evidence ID does not match");
  }
  const confidence = score(item.confidence, "feature step analysis.confidence");
  if (confidence === undefined) throw new Error("feature step analysis.confidence is required");
  return {
    evidenceId,
    visibleUi: strings(item.visibleUi, "feature step analysis.visibleUi"),
    visibleText: strings(item.visibleText, "feature step analysis.visibleText"),
    likelyIntent: text(item.likelyIntent, "feature step analysis.likelyIntent", 4_000),
    availableActions: strings(item.availableActions, "feature step analysis.availableActions"),
    systemFeedback: strings(item.systemFeedback, "feature step analysis.systemFeedback"),
    friction: strings(item.friction, "feature step analysis.friction"),
    missingOrUncertainStates: strings(item.missingOrUncertainStates, "feature step analysis.missingOrUncertainStates"),
    accessibility: strings(item.accessibility, "feature step analysis.accessibility"),
    confidence,
  };
}

export function parseFeatureDocumentContent(
  value: unknown,
  allowedEvidenceIds: ReadonlySet<string>,
): FeatureDocumentContent {
  const root = object(value, "feature document");
  const identities = new Set<string>();
  const executiveSummary = object(root.executiveSummary, "executiveSummary");
  const observedFlow = object(root.observedFlow, "observedFlow");
  const flowAnalysis = object(root.flowAnalysis, "flowAnalysis");
  const proposedFeature = object(root.proposedFeature, "proposedFeature");
  const requirements = list(root.requirements, "requirements", 100)
    .map((item, index) => requirement(item, allowedEvidenceIds, `requirements[${index}]`, identities));
  if (requirements.length === 0) throw new Error("feature document requires at least one requirement");
  return {
    executiveSummary: {
      purpose: claim(executiveSummary.purpose, allowedEvidenceIds, "executiveSummary.purpose", identities),
      userValue: claim(executiveSummary.userValue, allowedEvidenceIds, "executiveSummary.userValue", identities),
      recommendation: claim(executiveSummary.recommendation, allowedEvidenceIds, "executiveSummary.recommendation", identities),
    },
    observedFlow: {
      userGoal: claim(observedFlow.userGoal, allowedEvidenceIds, "observedFlow.userGoal", identities),
      entryPoint: claim(observedFlow.entryPoint, allowedEvidenceIds, "observedFlow.entryPoint", identities),
      completionPoint: claim(observedFlow.completionPoint, allowedEvidenceIds, "observedFlow.completionPoint", identities),
      journey: claimList(observedFlow.journey, allowedEvidenceIds, "observedFlow.journey", identities),
      actors: claimList(observedFlow.actors, allowedEvidenceIds, "observedFlow.actors", identities),
      visibleStates: claimList(observedFlow.visibleStates, allowedEvidenceIds, "observedFlow.visibleStates", identities),
    },
    flowAnalysis: {
      effectivePatterns: claimList(flowAnalysis.effectivePatterns, allowedEvidenceIds, "flowAnalysis.effectivePatterns", identities),
      friction: claimList(flowAnalysis.friction, allowedEvidenceIds, "flowAnalysis.friction", identities),
      missingStates: claimList(flowAnalysis.missingStates, allowedEvidenceIds, "flowAnalysis.missingStates", identities),
      inconsistencies: claimList(flowAnalysis.inconsistencies, allowedEvidenceIds, "flowAnalysis.inconsistencies", identities),
      risksAndAssumptions: claimList(flowAnalysis.risksAndAssumptions, allowedEvidenceIds, "flowAnalysis.risksAndAssumptions", identities),
    },
    proposedFeature: {
      problem: claim(proposedFeature.problem, allowedEvidenceIds, "proposedFeature.problem", identities),
      targetUsers: claimList(proposedFeature.targetUsers, allowedEvidenceIds, "proposedFeature.targetUsers", identities),
      goals: claimList(proposedFeature.goals, allowedEvidenceIds, "proposedFeature.goals", identities),
      nonGoals: claimList(proposedFeature.nonGoals, allowedEvidenceIds, "proposedFeature.nonGoals", identities),
      behavior: claimList(proposedFeature.behavior, allowedEvidenceIds, "proposedFeature.behavior", identities),
      journey: claimList(proposedFeature.journey, allowedEvidenceIds, "proposedFeature.journey", identities),
    },
    requirements,
    edgeCases: claimList(root.edgeCases, allowedEvidenceIds, "edgeCases", identities),
    successMetrics: claimList(root.successMetrics, allowedEvidenceIds, "successMetrics", identities),
    guardrailMetrics: claimList(root.guardrailMetrics, allowedEvidenceIds, "guardrailMetrics", identities),
    analyticsEvents: claimList(root.analyticsEvents, allowedEvidenceIds, "analyticsEvents", identities),
    dependencies: claimList(root.dependencies, allowedEvidenceIds, "dependencies", identities),
    openQuestions: claimList(root.openQuestions, allowedEvidenceIds, "openQuestions", identities),
  };
}

function heading(value: string): string {
  return value.replace(/[\r\n#]+/g, " ").trim();
}

function cited(item: FeatureClaim | FeatureAcceptanceCriterion): string {
  return item.evidenceIds.length ? ` [${item.evidenceIds.join(", ")}]` : "";
}

function claimLines(title: string, items: FeatureClaim[]): string[] {
  return [`### ${title}`, "", ...(items.length
    ? items.map((item) => `- **${item.kind}:** ${item.text}${cited(item)}`)
    : ["- None observed."]), ""];
}

export function renderFeatureDocumentMarkdown(
  title: string,
  content: FeatureDocumentContent,
  metadata: { sourceFlowTitle: string; generatedAt: string; evidenceManifest: FeatureEvidenceManifestItem[] },
): string {
  const lines = [
    `# ${heading(title)}`,
    "",
    `**Source Flow:** ${heading(metadata.sourceFlowTitle)}`,
    `**Generated:** ${metadata.generatedAt}`,
    "",
    "## Executive summary",
    "",
    `- **Purpose:** ${content.executiveSummary.purpose.text}${cited(content.executiveSummary.purpose)}`,
    `- **User value:** ${content.executiveSummary.userValue.text}${cited(content.executiveSummary.userValue)}`,
    `- **Recommendation:** ${content.executiveSummary.recommendation.text}${cited(content.executiveSummary.recommendation)}`,
    "",
    "## Observed current Flow",
    "",
    `- **User goal:** ${content.observedFlow.userGoal.text}${cited(content.observedFlow.userGoal)}`,
    `- **Entry point:** ${content.observedFlow.entryPoint.text}${cited(content.observedFlow.entryPoint)}`,
    `- **Completion point:** ${content.observedFlow.completionPoint.text}${cited(content.observedFlow.completionPoint)}`,
    "",
    ...claimLines("Journey", content.observedFlow.journey),
    ...claimLines("Actors", content.observedFlow.actors),
    ...claimLines("Visible states", content.observedFlow.visibleStates),
    "## Flow analysis",
    "",
    ...claimLines("Effective patterns", content.flowAnalysis.effectivePatterns),
    ...claimLines("Friction", content.flowAnalysis.friction),
    ...claimLines("Missing states", content.flowAnalysis.missingStates),
    ...claimLines("Inconsistencies", content.flowAnalysis.inconsistencies),
    ...claimLines("Risks and assumptions", content.flowAnalysis.risksAndAssumptions),
    "## Proposed feature",
    "",
    `- **Problem:** ${content.proposedFeature.problem.text}${cited(content.proposedFeature.problem)}`,
    "",
    ...claimLines("Target users", content.proposedFeature.targetUsers),
    ...claimLines("Goals", content.proposedFeature.goals),
    ...claimLines("Non-goals", content.proposedFeature.nonGoals),
    ...claimLines("Proposed behavior", content.proposedFeature.behavior),
    ...claimLines("Recommended journey", content.proposedFeature.journey),
    "## Requirements",
    "",
  ];
  for (const requirement of content.requirements) {
    lines.push(
      `### ${requirement.id} · ${requirement.priority.toUpperCase()}`,
      "",
      `${requirement.text}${cited(requirement)}`,
      "",
      `**User story:** ${requirement.userStory}`,
      "",
      "**Preconditions:**",
      "",
      ...(requirement.preconditions.length ? requirement.preconditions.map((item) => `- ${item}`) : ["- None."]),
      "",
      "#### Acceptance criteria",
      "",
    );
    for (const criterion of requirement.acceptanceCriteria) {
      lines.push(`- **${criterion.id}:** Given ${criterion.given}; when ${criterion.when}; then ${criterion.then}.${cited(criterion)}`);
    }
    lines.push("");
  }
  lines.push(
    ...claimLines("Edge cases", content.edgeCases),
    "## Success measurement", "",
    ...claimLines("Product metrics", content.successMetrics),
    ...claimLines("Guardrail metrics", content.guardrailMetrics),
    ...claimLines("Analytics events", content.analyticsEvents),
    "## Dependencies and open questions", "",
    ...claimLines("Dependencies", content.dependencies),
    ...claimLines("Open questions", content.openQuestions),
  );
  const evidence = new Set<string>();
  const collect = (items: Array<FeatureClaim | FeatureAcceptanceCriterion>) => {
    for (const item of items) for (const id of item.evidenceIds) evidence.add(id);
  };
  collect([
    content.executiveSummary.purpose,
    content.executiveSummary.userValue,
    content.executiveSummary.recommendation,
    content.observedFlow.userGoal,
    content.observedFlow.entryPoint,
    content.observedFlow.completionPoint,
    ...content.observedFlow.journey,
    ...content.observedFlow.actors,
    ...content.observedFlow.visibleStates,
    ...content.flowAnalysis.effectivePatterns,
    ...content.flowAnalysis.friction,
    ...content.flowAnalysis.missingStates,
    ...content.flowAnalysis.inconsistencies,
    ...content.flowAnalysis.risksAndAssumptions,
    content.proposedFeature.problem,
    ...content.proposedFeature.targetUsers,
    ...content.proposedFeature.goals,
    ...content.proposedFeature.nonGoals,
    ...content.proposedFeature.behavior,
    ...content.proposedFeature.journey,
    ...content.requirements,
    ...content.requirements.flatMap((item) => item.acceptanceCriteria),
    ...content.edgeCases,
    ...content.successMetrics,
    ...content.guardrailMetrics,
    ...content.analyticsEvents,
    ...content.dependencies,
    ...content.openQuestions,
  ]);
  const manifestById = new Map(metadata.evidenceManifest.map((item) => [item.evidenceId, item]));
  lines.push("## Evidence appendix", "", ...[...evidence].sort().map((id) => {
    const item = manifestById.get(id);
    return item
      ? `- **${id}:** Step ${item.stepIndex + 1} (${heading(item.stepLabel)}), image ${item.imageIndex + 1} (image ID ${item.imageId})${item.description ? ` — ${heading(item.description)}` : ""}`
      : `- **${id}:** Source mapping unavailable`;
  }), "");
  return `${lines.join("\n").trim()}\n`;
}
import { createHash } from "node:crypto";
