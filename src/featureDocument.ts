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
  kind?: FeatureClaimKind;
  given: string;
  when: string;
  then: string;
  evidenceIds: string[];
}

export interface FeatureRequirement extends FeatureClaim {
  userStory: string;
  priority: "must" | "should" | "could" | "later" | "unranked";
  preconditions: string[];
  acceptanceCriteria: FeatureAcceptanceCriterion[];
}

export interface FeatureSourceAssessment {
  captureType: "complete-journey" | "partial-journey" | "static-screen" | "state-gallery" | "content-scroll";
  completeness: "complete" | "partial";
  rationale: string;
  evidenceIds: string[];
}

export interface FeatureUnscopedEvidence {
  evidenceId: string;
  reason: string;
}

export interface FeatureOfficialDocumentationSource {
  id: string;
  title: string;
  url: string;
  retrievedAt: string;
  platform: "ios" | "android" | "web" | "all";
  region: string;
}

export interface FeatureDocumentedClaim {
  id: string;
  text: string;
  sourceIds: string[];
  relationship: "supports" | "extends" | "conflicts" | "unrelated";
  visualEvidenceIds: string[];
  unresolved: boolean;
}

export interface FeatureDocumentedContext {
  status: "researched" | "not-found";
  sources: FeatureOfficialDocumentationSource[];
  claims: FeatureDocumentedClaim[];
}

export interface FeatureDocumentContent {
  sourceAssessment?: FeatureSourceAssessment;
  unscopedEvidence?: FeatureUnscopedEvidence[];
  documentedContext?: FeatureDocumentedContext;
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
export type FeatureDocumentVisibility = "private" | "catalog";
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
  observation?: FeatureStepAnalysis;
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

export interface FeatureDocumentSourceLookup {
  app: string;
  platform: "ios" | "android" | "web";
  sourceVersionId: number;
  flowId: string;
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
  visibility?: FeatureDocumentVisibility;
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
    ...(item.observation ? {
      observation: {
        evidenceId: item.observation.evidenceId,
        visibleUi: item.observation.visibleUi,
        visibleText: item.observation.visibleText,
        likelyIntent: item.observation.likelyIntent,
        availableActions: item.observation.availableActions,
        systemFeedback: item.observation.systemFeedback,
        friction: item.observation.friction,
        missingOrUncertainStates: item.observation.missingOrUncertainStates,
        accessibility: item.observation.accessibility,
        confidence: item.observation.confidence,
      },
    } : {}),
  }));
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export interface FeatureSynthesisPrompt {
  source: FeatureSourceFlow;
  focusInstruction: string;
  evidenceManifest: FeatureEvidenceManifestItem[];
  analyses: FeatureStepAnalysis[];
  allowedEvidenceIds: string[];
  validationError?: string;
}

export interface FeatureFlowPrompt {
  source: FeatureSourceFlow;
  focusInstruction: string;
  evidenceManifest: FeatureEvidenceManifestItem[];
  allowedEvidenceIds: string[];
  validationError?: string;
}

export interface FeatureDocumentValidationOptions {
  evidenceBacked?: boolean;
  evidenceManifest?: FeatureEvidenceManifestItem[];
  analyses?: FeatureStepAnalysis[];
  officialDocumentationRequired?: boolean;
  officialDocumentationDomains?: readonly string[];
}

export function featureDocumentClaimBudget(evidenceCount: number): number {
  if (!Number.isSafeInteger(evidenceCount) || evidenceCount < 1) {
    throw new Error("feature document evidence count must be a positive integer");
  }
  if (evidenceCount <= 2) return 24;
  if (evidenceCount <= 4) return 32;
  if (evidenceCount <= 6) return 38;
  return Math.min(50, 26 + evidenceCount * 2);
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

function officialDocumentationHostAllowed(
  hostname: string,
  domains: readonly string[],
): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return domains.some((domain) =>
    normalized === domain || normalized.endsWith(`.${domain}`)
  );
}

function documentedContext(
  value: unknown,
  allowedEvidenceIds: ReadonlySet<string>,
  identities: Set<string>,
  allowedDomains: readonly string[],
): FeatureDocumentedContext {
  const root = object(value, "documentedContext");
  const status = root.status;
  if (status !== "researched" && status !== "not-found") {
    throw new Error("documentedContext.status is invalid");
  }
  const sourceIdentities = new Set<string>();
  const sources = list(root.sources, "documentedContext.sources", 12).map(
    (value, index): FeatureOfficialDocumentationSource => {
      const source = object(value, `documentedContext.sources[${index}]`);
      const id = text(source.id, `documentedContext.sources[${index}].id`, 160);
      if (sourceIdentities.has(id)) throw new Error(`duplicate documented source: ${id}`);
      sourceIdentities.add(id);
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(text(source.url, `documentedContext.sources[${index}].url`, 2_000));
      } catch {
        throw new Error("documentedContext source URL is invalid");
      }
      if (parsedUrl.protocol !== "https:") {
        throw new Error("documentedContext source URL must use HTTPS");
      }
      if (
        allowedDomains.length > 0
        && !officialDocumentationHostAllowed(parsedUrl.hostname, allowedDomains)
      ) {
        throw new Error("documentedContext source domain is not allowed");
      }
      const retrievedAt = text(
        source.retrievedAt,
        `documentedContext.sources[${index}].retrievedAt`,
        80,
      );
      if (Number.isNaN(Date.parse(retrievedAt))) {
        throw new Error("documentedContext source retrieval date is invalid");
      }
      const platform = source.platform;
      if (
        platform !== "ios"
        && platform !== "android"
        && platform !== "web"
        && platform !== "all"
      ) {
        throw new Error("documentedContext source platform is invalid");
      }
      return {
        id,
        title: text(source.title, `documentedContext.sources[${index}].title`, 1_000),
        url: parsedUrl.toString(),
        retrievedAt: new Date(retrievedAt).toISOString(),
        platform,
        region: text(source.region, `documentedContext.sources[${index}].region`, 160),
      };
    },
  );
  const claims = list(root.claims, "documentedContext.claims", 20).map(
    (value, index): FeatureDocumentedClaim => {
      const claim = object(value, `documentedContext.claims[${index}]`);
      const id = text(claim.id, `documentedContext.claims[${index}].id`, 160);
      if (identities.has(id)) throw new Error(`duplicate feature document id: ${id}`);
      identities.add(id);
      const relationship = claim.relationship;
      if (
        relationship !== "supports"
        && relationship !== "extends"
        && relationship !== "conflicts"
        && relationship !== "unrelated"
      ) {
        throw new Error("documentedContext claim relationship is invalid");
      }
      const sourceIds = [...new Set(strings(
        claim.sourceIds,
        `documentedContext.claims[${index}].sourceIds`,
        12,
      ))];
      if (sourceIds.length === 0) {
        throw new Error("documentedContext claim requires a source");
      }
      const unknownSource = sourceIds.find((sourceId) => !sourceIdentities.has(sourceId));
      if (unknownSource) throw new Error(`unknown documented source: ${unknownSource}`);
      const visualEvidenceIds = evidenceIds(
        claim.visualEvidenceIds,
        allowedEvidenceIds,
        `documentedContext.claims[${index}].visualEvidenceIds`,
      );
      if (
        (relationship === "supports" || relationship === "conflicts")
        && visualEvidenceIds.length === 0
      ) {
        throw new Error(`documentedContext ${relationship} claim requires visual evidence`);
      }
      if (typeof claim.unresolved !== "boolean") {
        throw new Error("documentedContext claim unresolved must be boolean");
      }
      return {
        id,
        text: text(claim.text, `documentedContext.claims[${index}].text`, 4_000),
        sourceIds,
        relationship,
        visualEvidenceIds,
        unresolved: claim.unresolved,
      };
    },
  );
  if (status === "not-found" && (sources.length > 0 || claims.length > 0)) {
    throw new Error("documentedContext not-found result must be empty");
  }
  if (status === "researched" && sources.length === 0) {
    throw new Error("documentedContext researched result requires a source");
  }
  return { status, sources, claims };
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
  options: FeatureDocumentValidationOptions,
): FeatureAcceptanceCriterion {
  const item = object(value, label);
  const id = text(item.id, `${label}.id`, 160);
  if (identities.has(id)) throw new Error(`duplicate feature document id: ${id}`);
  if (options.evidenceBacked && !/^AC-\d{3}$/.test(id)) {
    throw new Error(`${label}.id must use the AC-001 format`);
  }
  identities.add(id);
  const kind = item.kind;
  if (
    kind !== undefined
    && kind !== "observed"
    && kind !== "inferred"
    && kind !== "proposed"
    && kind !== "unknown"
  ) {
    throw new Error(`${label}.kind is invalid`);
  }
  if (options.evidenceBacked && kind !== "observed" && kind !== "inferred") {
    throw new Error(`${label}.kind must be observed or inferred`);
  }
  const citations = evidenceIds(item.evidenceIds, allowed, label);
  if (options.evidenceBacked && citations.length === 0) {
    throw new Error(`${label} requires evidence`);
  }
  const given = text(item.given, `${label}.given`, 4_000);
  const when = text(item.when, `${label}.when`, 4_000);
  const then = text(item.then, `${label}.then`, 4_000);
  if (
    options.evidenceBacked
    && /\b(clear and discoverable|clearly understandable|easy to (?:find|use|understand)|enough context|intuitive|user-friendly|visually understandable)\b/i.test(
      `${given} ${when} ${then}`,
    )
  ) {
    throw new Error(`${label} must use objectively testable language`);
  }
  const visibleFeedbackEvidence = new Set(
    (options.analyses ?? [])
      .filter(({ systemFeedback }) => systemFeedback.length > 0)
      .map(({ evidenceId }) => evidenceId),
  );
  const citedAnalyses = (options.analyses ?? []).filter(({ evidenceId }) =>
    citations.includes(evidenceId)
  );
  const hasLoadingEvidence = citedAnalyses.some((analysis) =>
    [
      ...analysis.visibleUi,
      ...analysis.visibleText,
      ...analysis.systemFeedback,
    ].some((entry) => /\b(loading|spinner|progress|skeleton|shimmer)\b/i.test(entry))
  );
  if (
    options.evidenceBacked
    && /\b(?:finish(?:es|ed)? loading|loading (?:completes?|finishes?)|has loaded)\b/i.test(
      `${given} ${when} ${then}`,
    )
    && !hasLoadingEvidence
  ) {
    throw new Error(`${label} cannot claim loading completion without visible loading evidence`);
  }
  if (
    options.evidenceBacked
    && kind === "observed"
    && /\b(tap|select|choose|save|apply|submit|confirm|add|remove|update|clear|filter|sort|toggle|change|enter|type)\b/i.test(when)
    && citations.length < 2
    && !citations.some((evidenceId) => visibleFeedbackEvidence.has(evidenceId))
  ) {
    throw new Error(`${label} needs before/after or visible-feedback evidence for an observed transition`);
  }
  return {
    id,
    ...(kind === undefined ? {} : { kind }),
    given,
    when,
    then,
    evidenceIds: citations,
  };
}

function requirement(
  value: unknown,
  allowed: ReadonlySet<string>,
  label: string,
  identities: Set<string>,
  options: FeatureDocumentValidationOptions,
): FeatureRequirement {
  const item = object(value, label);
  const base = claim(item, allowed, label, identities);
  if (options.evidenceBacked && !/^REQ-\d{3}$/.test(base.id)) {
    throw new Error(`${label}.id must use the REQ-001 format`);
  }
  if (options.evidenceBacked && base.kind !== "observed" && base.kind !== "inferred") {
    throw new Error(`${label}.kind must be observed or inferred`);
  }
  if (options.evidenceBacked && base.evidenceIds.length === 0) {
    throw new Error(`${label} requires evidence`);
  }
  const priority = item.priority;
  if (
    priority !== "must"
    && priority !== "should"
    && priority !== "could"
    && priority !== "later"
    && priority !== "unranked"
  ) {
    throw new Error(`${label}.priority is invalid`);
  }
  if (options.evidenceBacked && priority !== "unranked") {
    throw new Error(`${label}.priority must be unranked without product-owner input`);
  }
  if (
    options.evidenceBacked
    && priority === "unranked"
    && /\b(must|should|could|required|priority)\b/i.test(base.text)
  ) {
    throw new Error(`${label}.text cannot use priority language when priority is unranked`);
  }
  const hasExplicitInteraction = (options.evidenceManifest ?? []).some(
    ({ evidenceId, interaction }) =>
      base.evidenceIds.includes(evidenceId) && Boolean(interaction?.trim()),
  );
  if (
    options.evidenceBacked
    && base.kind === "observed"
    && (
      /\b(?:supports?|allows?|enables?)\s+(?:the user to\s+)?(?:submit|submission|save|saving|select|selection|navigate|navigation|edit|editing|apply|application|update|updating|persist|persistence)\b/i.test(base.text)
      || /\b(?:can|will)\s+(?:submit|save|select|navigate|edit|apply|update|persist)\b/i.test(base.text)
    )
    && !hasExplicitInteraction
  ) {
    throw new Error(`${label}.text cannot claim an observed interaction without interaction metadata`);
  }
  const acceptanceCriteria = list(item.acceptanceCriteria, `${label}.acceptanceCriteria`, 50)
    .map((entry, index) => criterion(
      entry,
      allowed,
      `${label}.acceptanceCriteria[${index}]`,
      identities,
      options,
    ));
  if ((priority === "must" || options.evidenceBacked) && acceptanceCriteria.length === 0) {
    throw new Error(`${label} requires acceptance criteria`);
  }
  if (
    options.evidenceBacked
    && (options.evidenceManifest?.length ?? allowed.size) >= 2
    && acceptanceCriteria.length < 2
  ) {
    throw new Error(`${label} requires at least two acceptance criteria for multi-state evidence`);
  }
  if (options.evidenceBacked && acceptanceCriteria.length > 4) {
    throw new Error(`${label} has too many acceptance criteria for an evidence-backed draft`);
  }
  if (
    options.evidenceBacked
    && acceptanceCriteria.some((entry) =>
      entry.evidenceIds.some((evidenceId) => !base.evidenceIds.includes(evidenceId))
    )
  ) {
    throw new Error(`${label}.evidenceIds must include all acceptance-criterion evidence`);
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
  options: FeatureDocumentValidationOptions = {},
): FeatureDocumentContent {
  const root = object(value, "feature document");
  const identities = new Set<string>();
  const officialDocumentationDomains = options.officialDocumentationDomains ?? [];
  let officialDocumentation: FeatureDocumentedContext | undefined;
  if (
    root.documentedContext !== undefined
    || options.officialDocumentationRequired
    || officialDocumentationDomains.length > 0
  ) {
    if (root.documentedContext === undefined) {
      throw new Error("feature document requires documentedContext");
    }
    officialDocumentation = documentedContext(
      root.documentedContext,
      allowedEvidenceIds,
      identities,
      officialDocumentationDomains,
    );
  }
  let sourceAssessment: FeatureSourceAssessment | undefined;
  if (root.sourceAssessment !== undefined || options.evidenceBacked) {
    const assessment = object(root.sourceAssessment, "sourceAssessment");
    const captureType = assessment.captureType;
    if (
      captureType !== "complete-journey"
      && captureType !== "partial-journey"
      && captureType !== "static-screen"
      && captureType !== "state-gallery"
      && captureType !== "content-scroll"
    ) {
      throw new Error("sourceAssessment.captureType is invalid");
    }
    const completeness = assessment.completeness;
    if (completeness !== "complete" && completeness !== "partial") {
      throw new Error("sourceAssessment.completeness is invalid");
    }
    const citations = evidenceIds(
      assessment.evidenceIds,
      allowedEvidenceIds,
      "sourceAssessment",
    );
    if (options.evidenceBacked && citations.length === 0) {
      throw new Error("sourceAssessment requires evidence");
    }
    if (
      options.evidenceBacked
      && completeness === "complete"
      && (
        citations.length < 2
        || !(options.evidenceManifest ?? []).some(({ interaction }) => Boolean(interaction?.trim()))
      )
    ) {
      throw new Error("sourceAssessment cannot claim completeness without explicit transition evidence");
    }
    sourceAssessment = {
      captureType,
      completeness,
      rationale: text(assessment.rationale, "sourceAssessment.rationale", 2_000),
      evidenceIds: citations,
    };
  }
  const executiveSummary = object(root.executiveSummary, "executiveSummary");
  const observedFlow = object(root.observedFlow, "observedFlow");
  const flowAnalysis = object(root.flowAnalysis, "flowAnalysis");
  const proposedFeature = object(root.proposedFeature, "proposedFeature");
  const unscopedEvidence = root.unscopedEvidence === undefined
    ? []
    : list(root.unscopedEvidence, "unscopedEvidence", 100).map((entry, index) => {
      const item = object(entry, `unscopedEvidence[${index}]`);
      const [evidenceId] = evidenceIds(
        [item.evidenceId],
        allowedEvidenceIds,
        `unscopedEvidence[${index}]`,
      );
      return {
        evidenceId,
        reason: text(item.reason, `unscopedEvidence[${index}].reason`, 2_000),
      };
    });
  if (options.evidenceBacked && root.unscopedEvidence === undefined) {
    throw new Error("feature document requires unscopedEvidence");
  }
  if (new Set(unscopedEvidence.map(({ evidenceId }) => evidenceId)).size !== unscopedEvidence.length) {
    throw new Error("unscopedEvidence contains duplicate evidence IDs");
  }
  const requirements = list(root.requirements, "requirements", 100)
    .map((item, index) => requirement(
      item,
      allowedEvidenceIds,
      `requirements[${index}]`,
      identities,
      options,
    ));
  if (requirements.length === 0) throw new Error("feature document requires at least one requirement");
  const maximumRequirements = Math.max(1, Math.min(6, Math.floor(allowedEvidenceIds.size / 2)));
  if (options.evidenceBacked && requirements.length > maximumRequirements) {
    throw new Error(`feature document has too many requirements for ${allowedEvidenceIds.size} evidence items`);
  }
  const result: FeatureDocumentContent = {
    ...(sourceAssessment ? { sourceAssessment } : {}),
    ...(officialDocumentation ? { documentedContext: officialDocumentation } : {}),
    unscopedEvidence,
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
  if (options.evidenceBacked) {
    const scopedEvidence = new Set(
      result.requirements.flatMap((entry) => [
        ...entry.evidenceIds,
        ...entry.acceptanceCriteria.flatMap(({ evidenceIds: citations }) => citations),
      ]),
    );
    const explicitlyUnscoped = new Set(unscopedEvidence.map(({ evidenceId }) => evidenceId));
    const duplicatedScope = [...explicitlyUnscoped].find((evidenceId) => scopedEvidence.has(evidenceId));
    if (duplicatedScope) {
      throw new Error(`evidence cannot be both scoped and unscoped: ${duplicatedScope}`);
    }
    const uncovered = [...allowedEvidenceIds].find(
      (evidenceId) => !scopedEvidence.has(evidenceId) && !explicitlyUnscoped.has(evidenceId),
    );
    if (uncovered) {
      throw new Error(`evidence is not covered by requirements or unscopedEvidence: ${uncovered}`);
    }
    const observedClaims = [
      result.observedFlow.userGoal,
      result.observedFlow.entryPoint,
      result.observedFlow.completionPoint,
      ...result.observedFlow.journey,
      ...result.observedFlow.actors,
      ...result.observedFlow.visibleStates,
    ];
    if (observedClaims.some(({ kind }) => kind === "proposed")) {
      throw new Error("observedFlow cannot contain proposed behavior");
    }
    const proposedClaims = [
      result.executiveSummary.recommendation,
      ...result.proposedFeature.goals,
      ...result.proposedFeature.nonGoals,
      ...result.proposedFeature.behavior,
      ...result.proposedFeature.journey,
    ];
    if (proposedClaims.some(({ kind }) => kind !== "proposed" && kind !== "unknown")) {
      throw new Error("proposedFeature recommendations must be proposed or unknown");
    }
    if (result.openQuestions.some(({ kind }) => kind !== "unknown")) {
      throw new Error("openQuestions must be classified as unknown");
    }
    const claims = [
      result.executiveSummary.purpose,
      result.executiveSummary.userValue,
      result.executiveSummary.recommendation,
      result.observedFlow.userGoal,
      result.observedFlow.entryPoint,
      result.observedFlow.completionPoint,
      ...result.observedFlow.journey,
      ...result.observedFlow.actors,
      ...result.observedFlow.visibleStates,
      ...result.flowAnalysis.effectivePatterns,
      ...result.flowAnalysis.friction,
      ...result.flowAnalysis.missingStates,
      ...result.flowAnalysis.inconsistencies,
      ...result.flowAnalysis.risksAndAssumptions,
      result.proposedFeature.problem,
      ...result.proposedFeature.targetUsers,
      ...result.proposedFeature.goals,
      ...result.proposedFeature.nonGoals,
      ...result.proposedFeature.behavior,
      ...result.proposedFeature.journey,
      ...result.requirements,
      ...result.edgeCases,
      ...result.successMetrics,
      ...result.guardrailMetrics,
      ...result.analyticsEvents,
      ...result.dependencies,
      ...result.openQuestions,
    ];
    const claimBudget = featureDocumentClaimBudget(allowedEvidenceIds.size);
    if (claims.length > claimBudget) {
      throw new Error(`feature document exceeds the ${claimBudget}-claim budget`);
    }
  }
  return result;
}

function heading(value: string): string {
  return value.replace(/[\r\n#]+/g, " ").trim();
}

function cited(item: { evidenceIds: string[] }): string {
  return item.evidenceIds.length ? ` [${item.evidenceIds.join(", ")}]` : "";
}

function claimStatus(kind: FeatureClaimKind, hasEvidence: boolean): string {
  const label = `${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;
  return hasEvidence ? label : `${label} — missing evidence`;
}

export function renderFeatureDocumentMarkdown(
  title: string,
  content: FeatureDocumentContent,
  metadata: { sourceFlowTitle: string; generatedAt: string; evidenceManifest: FeatureEvidenceManifestItem[] },
): string {
  const missingEvidence = [
    ...content.flowAnalysis.missingStates,
    ...content.openQuestions,
  ].filter((item, index, items) => {
    const normalized = item.text.trim().toLocaleLowerCase();
    return normalized.length > 0 && items.findIndex(
      (candidate) => candidate.text.trim().toLocaleLowerCase() === normalized,
    ) === index;
  });

  const lines = [
    `# ${heading(title)}`,
    "",
    `**Source Flow:** ${heading(metadata.sourceFlowTitle)}`,
    `**Generated:** ${metadata.generatedAt}`,
    ...(content.sourceAssessment
      ? [
        `**Capture:** ${content.sourceAssessment.captureType} · ${content.sourceAssessment.completeness}`,
        `**Capture assessment:** ${content.sourceAssessment.rationale}${cited(content.sourceAssessment)}`,
      ]
      : []),
    "",
    "## Summary",
    "",
    `- **Goal:** ${content.observedFlow.userGoal.text}${cited(content.observedFlow.userGoal)}`,
    `- **Starts:** ${content.observedFlow.entryPoint.text}${cited(content.observedFlow.entryPoint)}`,
    `- **Ends:** ${content.observedFlow.completionPoint.text}${cited(content.observedFlow.completionPoint)}`,
    "",
    "## Observed steps",
    "",
    ...(content.observedFlow.journey.length
      ? content.observedFlow.journey.map(
        (step, index) => `${index + 1}. ${step.text}${cited(step)}`,
      )
      : ["No observed steps documented."]),
    "",
    "## Behavior requirements",
    "",
  ];
  for (const requirement of content.requirements) {
    const requirementEvidenceIds = [...new Set([
      ...requirement.evidenceIds,
      ...requirement.acceptanceCriteria.flatMap((criterion) => criterion.evidenceIds),
    ])];
    lines.push(
      `### ${requirement.id} · ${requirement.priority.toUpperCase()}`,
      "",
      `**Behavior:** ${requirement.text}`,
      `**Status:** ${claimStatus(requirement.kind, requirementEvidenceIds.length > 0)}`,
      `**Evidence:** ${requirementEvidenceIds.length > 0 ? requirementEvidenceIds.join(", ") : "Missing evidence"}`,
      "",
    );
    for (const criterion of requirement.acceptanceCriteria) {
      lines.push(
        `#### Scenario ${criterion.id}`,
        "",
        `**Given** ${criterion.given}`,
        "",
        `**When** ${criterion.when}`,
        "",
        `**Then** ${criterion.then}`,
        "",
      );
    }
    lines.push("");
  }
  if (content.documentedContext) {
    lines.push(
      "## Official documentation",
      "",
      ...(content.documentedContext.status === "not-found"
        ? ["No matching official documentation was found."]
        : content.documentedContext.sources.map(
          (source) =>
            `- [${source.title}](${source.url}) · ${source.platform} · ${source.region} · retrieved ${source.retrievedAt}`,
        )),
      "",
      ...content.documentedContext.claims.map(
        (item) =>
          `- **${item.relationship}:** ${item.text} [${item.sourceIds.join(", ")}]`,
      ),
      "",
    );
  }
  lines.push(
    "## Missing evidence",
    "",
    ...(missingEvidence.length
      ? missingEvidence.map((item) => `- ${item.text}${cited(item)}`)
      : ["- None identified."]),
    "",
  );
  return `${lines.join("\n").trim()}\n`;
}
import { createHash } from "node:crypto";
