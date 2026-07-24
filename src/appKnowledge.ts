export type AppKnowledgeClaimKind = "observed" | "inferred" | "proposed" | "unknown";
export type AppKnowledgeReviewStatus = "draft" | "in_review" | "approved" | "superseded";
export type AppKnowledgeJobStatus = "queued" | "running" | "done" | "error" | "cancelled" | "stale";
export type AppKnowledgeJobStage =
  | "preparing"
  | "validating_evidence"
  | "analyzing"
  | "synthesizing"
  | "validating_output"
  | "saving"
  | "complete";
export type AppKnowledgeEvidenceKind = "screen" | "flow_step" | "ui_element";
export type AppKnowledgeEntityReviewStatus = "needs_review" | "reviewed" | "rejected";

export interface AppKnowledgeClaim {
  id: string;
  kind: AppKnowledgeClaimKind;
  text: string;
  evidenceIds: string[];
  confidence: number;
}

export interface AppKnowledgeCoverageKind {
  total: number;
  eligible: number;
  analyzed: number;
  cached: number;
  quarantined: number;
  failed: number;
}

export interface AppKnowledgeCoverage {
  total: number;
  eligible: number;
  analyzed: number;
  cached: number;
  quarantined: number;
  skipped: number;
  failed: number;
  duplicateVisuals: number;
  byKind: Record<AppKnowledgeEvidenceKind, AppKnowledgeCoverageKind>;
  flowReferences: { total: number; resolved: number; uniqueImages: number };
}

export interface AppKnowledgeScreen {
  id: string;
  evidenceId: string;
  pageType: string;
  productArea: string;
  purpose: string;
  viewport: "desktop" | "tablet" | "mobile" | "unknown";
  visibleText: string[];
  theme: "light" | "dark" | "mixed";
  visualHierarchy: string[];
  layoutPatterns: string[];
  contentPatterns: string[];
  imagery: string[];
  icons: string[];
  interactionPatterns: string[];
  visibleStates: string[];
  availableActions: string[];
  systemFeedback: string[];
  accessibilityObservations: string[];
  claims: AppKnowledgeClaim[];
  confidence: number;
  reviewStatus: AppKnowledgeEntityReviewStatus;
}

export interface AppKnowledgeComponentCandidate {
  id: string;
  name: string;
  category: string;
  purpose: string;
  anatomy: string[];
  observedProperties: string[];
  variants: string[];
  states: string[];
  responsiveEvidence: string[];
  evidenceIds: string[];
  visualRegions: string[];
  designLanguageCandidateIds: string[];
  claims: AppKnowledgeClaim[];
  confidence: number;
  status: "candidate" | "reviewed" | "rejected";
}

export interface AppKnowledgeDesignLanguage {
  color: AppKnowledgeClaim[];
  typography: AppKnowledgeClaim[];
  spacing: AppKnowledgeClaim[];
  radius: AppKnowledgeClaim[];
  border: AppKnowledgeClaim[];
  effects: AppKnowledgeClaim[];
  layout: AppKnowledgeClaim[];
  iconography: AppKnowledgeClaim[];
  imagery: AppKnowledgeClaim[];
  responsive: AppKnowledgeClaim[];
  content: AppKnowledgeClaim[];
  interaction: AppKnowledgeClaim[];
}

export interface AppKnowledgeDesignSystemResult {
  componentCandidates: AppKnowledgeComponentCandidate[];
  designLanguage: AppKnowledgeDesignLanguage;
}

export interface AppKnowledgeFlowStep {
  id: string;
  order: number;
  evidenceId: string;
  label: string;
  availableActions: string[];
  systemFeedback: string[];
  friction: string[];
  uncertainStates: string[];
  claims: AppKnowledgeClaim[];
}

export interface AppKnowledgeFlow {
  id: string;
  sourceFlowId: string;
  title: string;
  category?: string;
  userGoal: AppKnowledgeClaim;
  actors: AppKnowledgeClaim[];
  entryPoint: AppKnowledgeClaim;
  completionPoint: AppKnowledgeClaim;
  steps: AppKnowledgeFlowStep[];
  effectivePatterns: AppKnowledgeClaim[];
  risks: AppKnowledgeClaim[];
  inconsistencies: AppKnowledgeClaim[];
  openQuestions: AppKnowledgeClaim[];
}

export interface AppKnowledgeProductKnowledge {
  capabilities: AppKnowledgeClaim[];
  featureRelationships: AppKnowledgeClaim[];
  userJourneys: AppKnowledgeClaim[];
  actorResponsibilities: AppKnowledgeClaim[];
  requirements: AppKnowledgeClaim[];
  acceptanceCriteria: AppKnowledgeClaim[];
  edgeCases: AppKnowledgeClaim[];
  dependencies: AppKnowledgeClaim[];
  risks: AppKnowledgeClaim[];
  successMetrics: AppKnowledgeClaim[];
  guardrails: AppKnowledgeClaim[];
  analyticsEvents: AppKnowledgeClaim[];
  openQuestions: AppKnowledgeClaim[];
}

export interface AppKnowledgeSnapshot {
  identity: {
    app: string;
    platform: "ios" | "android" | "web";
    captureVersionId: number;
    sourceSha256: string;
    providerModel: string;
    promptVersion: number;
    generatedAt: string;
  };
  coverage: AppKnowledgeCoverage;
  screens: AppKnowledgeScreen[];
  componentCandidates: AppKnowledgeComponentCandidate[];
  designLanguage: AppKnowledgeDesignLanguage;
  flows: AppKnowledgeFlow[];
  productKnowledge: AppKnowledgeProductKnowledge;
}

export interface AppKnowledgeRoleProjection {
  role: "designer" | "developer" | "product";
  sections: Array<{
    id: string;
    title: string;
    claims: AppKnowledgeClaim[];
  }>;
  entityIds: {
    screens: string[];
    componentCandidates: string[];
    flows: string[];
  };
}

type JsonObject = Record<string, unknown>;

const CLAIM_KINDS = new Set<AppKnowledgeClaimKind>(["observed", "inferred", "proposed", "unknown"]);
const ENTITY_REVIEW_STATUSES = new Set<AppKnowledgeEntityReviewStatus>(["needs_review", "reviewed", "rejected"]);
const COMPONENT_STATUSES = new Set(["candidate", "reviewed", "rejected"]);
const PLATFORMS = new Set(["ios", "android", "web"]);
const VIEWPORTS = new Set(["desktop", "tablet", "mobile", "unknown"]);
const THEMES = new Set(["light", "dark", "mixed"]);

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonObject;
}

function list(value: unknown, label: string, maximum = 500): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) {
    throw new Error(`${label} must be an array of at most ${maximum} items`);
  }
  return value;
}

function nonEmptyList(value: unknown, label: string, maximum = 500): unknown[] {
  const result = list(value, label, maximum);
  if (result.length === 0) throw new Error(`${label} must contain at least one item`);
  return result;
}

function text(value: unknown, label: string, maximum = 8_000): string {
  if (typeof value !== "string" || !value.trim() || value.length > maximum) {
    throw new Error(`${label} must be a non-empty string of at most ${maximum} characters`);
  }
  return value.trim();
}

function optionalText(value: unknown, label: string, maximum = 8_000): string | undefined {
  if (value === undefined) return undefined;
  return text(value, label, maximum);
}

function strings(value: unknown, label: string, maximum = 200): string[] {
  return list(value, label, maximum).map((item, index) => text(item, `${label}[${index}]`, 2_000));
}

function uniqueStrings(value: unknown, label: string, maximum = 200): string[] {
  const result = strings(value, label, maximum);
  if (new Set(result).size !== result.length) throw new Error(`${label} must not contain duplicates`);
  return result;
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) throw new Error(`${label} must be a positive integer`);
  return Number(value);
}

function count(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error(`${label} must be a non-negative integer`);
  return Number(value);
}

function confidence(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${label} confidence must be between 0 and 1`);
  }
  return value;
}

function identity(
  value: unknown,
  label: string,
  identities: Set<string>,
  duplicateLabel = "app knowledge",
): string {
  const result = text(value, label, 200);
  if (identities.has(result)) throw new Error(`duplicate ${duplicateLabel} id: ${result}`);
  identities.add(result);
  return result;
}

function citations(value: unknown, allowed: ReadonlySet<string>, label: string): string[] {
  const result = uniqueStrings(value, `${label}.evidenceIds`, 200);
  const unknown = result.find((evidenceId) => !allowed.has(evidenceId));
  if (unknown) throw new Error(`${label} cites unknown evidence: ${unknown}`);
  return result;
}

function parseClaim(
  value: unknown,
  allowed: ReadonlySet<string>,
  identities: Set<string>,
  label: string,
): AppKnowledgeClaim {
  const item = object(value, label);
  const id = identity(item.id, `${label}.id`, identities);
  const kind = item.kind as AppKnowledgeClaimKind;
  if (!CLAIM_KINDS.has(kind)) throw new Error(`${label}.kind is invalid`);
  const evidenceIds = citations(item.evidenceIds, allowed, label);
  if ((kind === "observed" || kind === "inferred") && evidenceIds.length === 0) {
    throw new Error(`${label} requires evidence`);
  }
  return {
    id,
    kind,
    text: text(item.text, `${label}.text`),
    evidenceIds,
    confidence: confidence(item.confidence, label),
  };
}

function parseClaims(
  value: unknown,
  allowed: ReadonlySet<string>,
  identities: Set<string>,
  label: string,
): AppKnowledgeClaim[] {
  return list(value, label).map((item, index) =>
    parseClaim(item, allowed, identities, `${label}[${index}]`));
}

function parseCoverageKind(value: unknown, label: string): AppKnowledgeCoverageKind {
  const item = object(value, label);
  const result = {
    total: count(item.total, `${label}.total`),
    eligible: count(item.eligible, `${label}.eligible`),
    analyzed: count(item.analyzed, `${label}.analyzed`),
    cached: count(item.cached, `${label}.cached`),
    quarantined: count(item.quarantined, `${label}.quarantined`),
    failed: count(item.failed, `${label}.failed`),
  };
  if (result.eligible + result.quarantined > result.total) {
    throw new Error(`${label} exceeds its total`);
  }
  if (result.analyzed + result.cached + result.failed > result.eligible) {
    throw new Error(`${label} eligible outcomes exceed eligible evidence`);
  }
  return result;
}

function parseCoverage(value: unknown): AppKnowledgeCoverage {
  const item = object(value, "coverage");
  const byKind = object(item.byKind, "coverage.byKind");
  const flowReferences = object(item.flowReferences, "coverage.flowReferences");
  const result: AppKnowledgeCoverage = {
    total: count(item.total, "coverage.total"),
    eligible: count(item.eligible, "coverage.eligible"),
    analyzed: count(item.analyzed, "coverage.analyzed"),
    cached: count(item.cached, "coverage.cached"),
    quarantined: count(item.quarantined, "coverage.quarantined"),
    skipped: count(item.skipped, "coverage.skipped"),
    failed: count(item.failed, "coverage.failed"),
    duplicateVisuals: count(item.duplicateVisuals, "coverage.duplicateVisuals"),
    byKind: {
      screen: parseCoverageKind(byKind.screen, "coverage.byKind.screen"),
      flow_step: parseCoverageKind(byKind.flow_step, "coverage.byKind.flow_step"),
      ui_element: parseCoverageKind(byKind.ui_element, "coverage.byKind.ui_element"),
    },
    flowReferences: {
      total: count(flowReferences.total, "coverage.flowReferences.total"),
      resolved: count(flowReferences.resolved, "coverage.flowReferences.resolved"),
      uniqueImages: count(flowReferences.uniqueImages, "coverage.flowReferences.uniqueImages"),
    },
  };
  if (result.eligible + result.quarantined + result.skipped > result.total) {
    throw new Error("coverage outcomes exceed total evidence");
  }
  if (result.analyzed + result.cached + result.failed > result.eligible) {
    throw new Error("coverage eligible outcomes exceed eligible evidence");
  }
  if (result.flowReferences.resolved > result.flowReferences.total) {
    throw new Error("coverage resolved Flow references exceed total references");
  }
  return result;
}

function parseScreen(
  value: unknown,
  allowed: ReadonlySet<string>,
  claims: Set<string>,
  ids: Set<string>,
  index: number,
): AppKnowledgeScreen {
  const label = `screens[${index}]`;
  const item = object(value, label);
  const evidenceId = text(item.evidenceId, `${label}.evidenceId`, 240);
  if (!allowed.has(evidenceId)) throw new Error(`${label} cites unknown evidence: ${evidenceId}`);
  const viewport = item.viewport as AppKnowledgeScreen["viewport"];
  const theme = item.theme as AppKnowledgeScreen["theme"];
  const reviewStatus = item.reviewStatus as AppKnowledgeEntityReviewStatus;
  if (!VIEWPORTS.has(viewport)) throw new Error(`${label}.viewport is invalid`);
  if (!THEMES.has(theme)) throw new Error(`${label}.theme is invalid`);
  if (!ENTITY_REVIEW_STATUSES.has(reviewStatus)) throw new Error(`${label}.reviewStatus is invalid`);
  return {
    id: identity(item.id, `${label}.id`, ids, "screen"),
    evidenceId,
    pageType: text(item.pageType, `${label}.pageType`),
    productArea: text(item.productArea, `${label}.productArea`),
    purpose: text(item.purpose, `${label}.purpose`),
    viewport,
    visibleText: strings(item.visibleText, `${label}.visibleText`),
    theme,
    visualHierarchy: strings(item.visualHierarchy, `${label}.visualHierarchy`),
    layoutPatterns: strings(item.layoutPatterns, `${label}.layoutPatterns`),
    contentPatterns: strings(item.contentPatterns, `${label}.contentPatterns`),
    imagery: strings(item.imagery, `${label}.imagery`),
    icons: strings(item.icons, `${label}.icons`),
    interactionPatterns: strings(item.interactionPatterns, `${label}.interactionPatterns`),
    visibleStates: strings(item.visibleStates, `${label}.visibleStates`),
    availableActions: strings(item.availableActions, `${label}.availableActions`),
    systemFeedback: strings(item.systemFeedback, `${label}.systemFeedback`),
    accessibilityObservations: strings(item.accessibilityObservations, `${label}.accessibilityObservations`),
    claims: parseClaims(item.claims, allowed, claims, `${label}.claims`),
    confidence: confidence(item.confidence, label),
    reviewStatus,
  };
}

function parseComponent(
  value: unknown,
  allowed: ReadonlySet<string>,
  claims: Set<string>,
  ids: Set<string>,
  index: number,
): AppKnowledgeComponentCandidate {
  const label = `componentCandidates[${index}]`;
  const item = object(value, label);
  const status = item.status as AppKnowledgeComponentCandidate["status"];
  if (!COMPONENT_STATUSES.has(status)) throw new Error("component candidate status is invalid");
  const evidenceIds = citations(item.evidenceIds, allowed, label);
  if (evidenceIds.length === 0) throw new Error(`${label} requires evidence`);
  return {
    id: identity(item.id, `${label}.id`, ids, "component candidate"),
    name: text(item.name, `${label}.name`),
    category: text(item.category, `${label}.category`),
    purpose: text(item.purpose, `${label}.purpose`),
    anatomy: strings(item.anatomy, `${label}.anatomy`),
    observedProperties: strings(item.observedProperties, `${label}.observedProperties`),
    variants: strings(item.variants, `${label}.variants`),
    states: strings(item.states, `${label}.states`),
    responsiveEvidence: strings(item.responsiveEvidence, `${label}.responsiveEvidence`),
    evidenceIds,
    visualRegions: strings(item.visualRegions, `${label}.visualRegions`),
    designLanguageCandidateIds: strings(item.designLanguageCandidateIds, `${label}.designLanguageCandidateIds`),
    claims: parseClaims(item.claims, allowed, claims, `${label}.claims`),
    confidence: confidence(item.confidence, label),
    status,
  };
}

const DESIGN_LANGUAGE_KEYS = [
  "color",
  "typography",
  "spacing",
  "radius",
  "border",
  "effects",
  "layout",
  "iconography",
  "imagery",
  "responsive",
  "content",
  "interaction",
] as const;

function parseDesignLanguage(
  value: unknown,
  allowed: ReadonlySet<string>,
  claims: Set<string>,
): AppKnowledgeDesignLanguage {
  const item = object(value, "designLanguage");
  return Object.fromEntries(DESIGN_LANGUAGE_KEYS.map((key) => [
    key,
    parseClaims(item[key], allowed, claims, `designLanguage.${key}`),
  ])) as unknown as AppKnowledgeDesignLanguage;
}

export function parseAppKnowledgeDesignSystemResult(
  value: unknown,
  allowedEvidenceIds: ReadonlySet<string>,
): AppKnowledgeDesignSystemResult {
  const root = object(value, "App Knowledge design system");
  const claims = new Set<string>();
  const componentIds = new Set<string>();
  const result = {
    componentCandidates: list(root.componentCandidates, "componentCandidates").map((item, index) =>
      parseComponent(item, allowedEvidenceIds, claims, componentIds, index)),
    designLanguage: parseDesignLanguage(root.designLanguage, allowedEvidenceIds, claims),
  };
  if (Object.values(result.designLanguage).every((items) => items.length === 0)) {
    throw new Error("designLanguage must contain at least one claim");
  }
  return result;
}

function parseFlow(
  value: unknown,
  allowed: ReadonlySet<string>,
  claims: Set<string>,
  flowIds: Set<string>,
  stepIds: Set<string>,
  index: number,
): AppKnowledgeFlow {
  const label = `flows[${index}]`;
  const item = object(value, label);
  const steps = nonEmptyList(item.steps, `${label}.steps`).map((raw, stepIndex) => {
    const stepLabel = `${label}.steps[${stepIndex}]`;
    const step = object(raw, stepLabel);
    const evidenceId = text(step.evidenceId, `${stepLabel}.evidenceId`, 240);
    if (!allowed.has(evidenceId)) throw new Error(`${stepLabel} cites unknown evidence: ${evidenceId}`);
    return {
      id: identity(step.id, `${stepLabel}.id`, stepIds, "Flow step"),
      order: positiveInteger(step.order, `${stepLabel}.order`),
      evidenceId,
      label: text(step.label, `${stepLabel}.label`),
      availableActions: strings(step.availableActions, `${stepLabel}.availableActions`),
      systemFeedback: strings(step.systemFeedback, `${stepLabel}.systemFeedback`),
      friction: strings(step.friction, `${stepLabel}.friction`),
      uncertainStates: strings(step.uncertainStates, `${stepLabel}.uncertainStates`),
      claims: parseClaims(step.claims, allowed, claims, `${stepLabel}.claims`),
    };
  });
  const orders = steps.map(({ order }) => order);
  if (new Set(orders).size !== orders.length || orders.some((order, position) => order !== position + 1)) {
    throw new Error(`${label}.steps must use contiguous order`);
  }
  return {
    id: identity(item.id, `${label}.id`, flowIds, "Flow"),
    sourceFlowId: text(item.sourceFlowId, `${label}.sourceFlowId`, 240),
    title: text(item.title, `${label}.title`),
    ...(optionalText(item.category, `${label}.category`) ? {
      category: optionalText(item.category, `${label}.category`),
    } : {}),
    userGoal: parseClaim(item.userGoal, allowed, claims, `${label}.userGoal`),
    actors: parseClaims(item.actors, allowed, claims, `${label}.actors`),
    entryPoint: parseClaim(item.entryPoint, allowed, claims, `${label}.entryPoint`),
    completionPoint: parseClaim(item.completionPoint, allowed, claims, `${label}.completionPoint`),
    steps,
    effectivePatterns: parseClaims(item.effectivePatterns, allowed, claims, `${label}.effectivePatterns`),
    risks: parseClaims(item.risks, allowed, claims, `${label}.risks`),
    inconsistencies: parseClaims(item.inconsistencies, allowed, claims, `${label}.inconsistencies`),
    openQuestions: parseClaims(item.openQuestions, allowed, claims, `${label}.openQuestions`),
  };
}

const PRODUCT_KEYS = [
  "capabilities",
  "featureRelationships",
  "userJourneys",
  "actorResponsibilities",
  "requirements",
  "acceptanceCriteria",
  "edgeCases",
  "dependencies",
  "risks",
  "successMetrics",
  "guardrails",
  "analyticsEvents",
  "openQuestions",
] as const;

function parseProductKnowledge(
  value: unknown,
  allowed: ReadonlySet<string>,
  claims: Set<string>,
): AppKnowledgeProductKnowledge {
  const item = object(value, "productKnowledge");
  const result = Object.fromEntries(PRODUCT_KEYS.map((key) => [
    key,
    parseClaims(item[key], allowed, claims, `productKnowledge.${key}`),
  ])) as unknown as AppKnowledgeProductKnowledge;
  if (result.capabilities.length === 0) {
    throw new Error("productKnowledge.capabilities must contain at least one item");
  }
  return result;
}

export function parseAppKnowledgeSnapshot(
  value: unknown,
  allowedEvidenceIds: ReadonlySet<string>,
): AppKnowledgeSnapshot {
  const root = object(value, "App Knowledge snapshot");
  const rawIdentity = object(root.identity, "identity");
  const platform = rawIdentity.platform as AppKnowledgeSnapshot["identity"]["platform"];
  if (!PLATFORMS.has(platform)) throw new Error("identity.platform is invalid");
  const sourceSha256 = text(rawIdentity.sourceSha256, "identity.sourceSha256", 64);
  if (!/^[0-9a-f]{64}$/.test(sourceSha256)) throw new Error("identity.sourceSha256 is invalid");
  const generatedAt = text(rawIdentity.generatedAt, "identity.generatedAt", 80);
  if (Number.isNaN(Date.parse(generatedAt))) throw new Error("identity.generatedAt is invalid");

  const claimIds = new Set<string>();
  const screenIds = new Set<string>();
  const componentIds = new Set<string>();
  const flowIds = new Set<string>();
  const stepIds = new Set<string>();

  return {
    identity: {
      app: text(rawIdentity.app, "identity.app", 160),
      platform,
      captureVersionId: positiveInteger(rawIdentity.captureVersionId, "identity.captureVersionId"),
      sourceSha256,
      providerModel: text(rawIdentity.providerModel, "identity.providerModel", 160),
      promptVersion: positiveInteger(rawIdentity.promptVersion, "identity.promptVersion"),
      generatedAt: new Date(generatedAt).toISOString(),
    },
    coverage: parseCoverage(root.coverage),
    screens: nonEmptyList(root.screens, "screens", 2_000).map((item, index) =>
      parseScreen(item, allowedEvidenceIds, claimIds, screenIds, index)),
    componentCandidates: list(root.componentCandidates, "componentCandidates").map((item, index) =>
      parseComponent(item, allowedEvidenceIds, claimIds, componentIds, index)),
    designLanguage: parseDesignLanguage(root.designLanguage, allowedEvidenceIds, claimIds),
    flows: list(root.flows, "flows").map((item, index) =>
      parseFlow(item, allowedEvidenceIds, claimIds, flowIds, stepIds, index)),
    productKnowledge: parseProductKnowledge(root.productKnowledge, allowedEvidenceIds, claimIds),
  };
}

function flattenDesignLanguage(value: AppKnowledgeDesignLanguage): AppKnowledgeClaim[] {
  return DESIGN_LANGUAGE_KEYS.flatMap((key) => value[key]);
}

function flowClaims(flow: AppKnowledgeFlow): AppKnowledgeClaim[] {
  return [
    flow.userGoal,
    ...flow.actors,
    flow.entryPoint,
    flow.completionPoint,
    ...flow.steps.flatMap(({ claims }) => claims),
    ...flow.effectivePatterns,
    ...flow.risks,
    ...flow.inconsistencies,
    ...flow.openQuestions,
  ];
}

export function projectAppKnowledge(
  snapshot: AppKnowledgeSnapshot,
  role: AppKnowledgeRoleProjection["role"],
): AppKnowledgeRoleProjection {
  const screenClaims = snapshot.screens.flatMap(({ claims }) => claims);
  const componentClaims = snapshot.componentCandidates.flatMap(({ claims }) => claims);
  const designClaims = flattenDesignLanguage(snapshot.designLanguage);
  const flows = snapshot.flows.flatMap(flowClaims);
  const product = snapshot.productKnowledge;
  const sections = role === "designer"
    ? [
        { id: "screens", title: "Screen taxonomy", claims: screenClaims },
        { id: "components", title: "Component candidates", claims: componentClaims },
        { id: "design-language", title: "Design language", claims: designClaims },
        { id: "journeys", title: "Observed journeys", claims: flows },
      ]
    : role === "developer"
      ? [
          { id: "components", title: "Component structure", claims: componentClaims },
          { id: "design-language", title: "Implementation candidates", claims: designClaims },
          { id: "screens", title: "Screen dependencies", claims: screenClaims },
          { id: "dependencies", title: "Dependencies and risks", claims: [...product.dependencies, ...product.risks] },
        ]
      : [
          { id: "capabilities", title: "Capability map", claims: [...product.capabilities, ...product.featureRelationships] },
          { id: "journeys", title: "Actors and journeys", claims: [...product.userJourneys, ...product.actorResponsibilities, ...flows] },
          { id: "requirements", title: "Requirements", claims: [...product.requirements, ...product.acceptanceCriteria] },
          { id: "risks", title: "Risks and open questions", claims: [...product.risks, ...product.openQuestions] },
        ];
  return {
    role,
    sections,
    entityIds: {
      screens: snapshot.screens.map(({ id }) => id),
      componentCandidates: snapshot.componentCandidates.map(({ id }) => id),
      flows: snapshot.flows.map(({ id }) => id),
    },
  };
}
