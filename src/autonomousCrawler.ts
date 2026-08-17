export type MissionMode = "read" | "mutate";
export type MissionStatus = "queued" | "running" | "succeeded" | "blocked" | "failed" | "interrupted" | "cancelled";
export type ResearchSourceKind = "website" | "documentation" | "help_center" | "product_tour" | "changelog" | "search";
export type FlowAccess = "public" | "sign_in_required" | "test_account_required" | "unknown";
export type FlowReadiness = "ready" | "needs_review" | "blocked";
export type AgentTraceStage = "research" | "execution";
export type AgentTraceEventType =
  | "research_started"
  | "research_completed"
  | "flow_proposed"
  | "mission_started"
  | "state_observed"
  | "action_selected"
  | "evidence_captured"
  | "mission_blocked";

export interface DossierSource {
  url: string;
  title: string;
  retrievedAt: string;
  kind?: ResearchSourceKind;
}

export interface DossierClaim {
  text: string;
  sourceUrls: string[];
  confidence: number;
}

export interface CandidateFlow {
  id: string;
  title: string;
  goal: string;
  productArea: string;
  mode: MissionMode;
  prerequisites: string[];
  sourceUrls: string[];
  access?: FlowAccess;
  readiness?: FlowReadiness;
  confidence?: number;
  credentialCapability?: string;
  candidateSteps?: Array<{ title: string; sourceUrls: string[]; evidence: "documented" | "inferred" }>;
}

export interface AppResearchProfile {
  name: string;
  canonicalUrl: string;
  category: string;
  description: string;
  sourceUrls: string[];
  iconUrl?: string;
}

export interface CredentialCapability {
  alias: string;
  purpose: string;
  role: string;
  allowedOrigins: string[];
  flowIds: string[];
  sourceUrls: string[];
}

export interface AgentTraceEvent {
  stage: AgentTraceStage;
  type: AgentTraceEventType;
  rationale: string;
  confidence?: number;
  evidenceId?: string;
  credentialCapability?: string;
}

export interface AppDossier {
  app: string;
  purpose: string;
  sources: DossierSource[];
  claims: DossierClaim[];
  roles: string[];
  capabilities: string[];
  candidateFlows: CandidateFlow[];
  openQuestions: string[];
  profile?: AppResearchProfile;
  credentialCapabilities?: CredentialCapability[];
}

export interface MissionBudget {
  actions: number;
  recoveries: number;
}

export interface AutonomousMission {
  missionKey: string;
  goal: string;
  productArea: string;
  mode: MissionMode;
  prerequisites: string[];
  budget: MissionBudget;
}

export interface StateFingerprint {
  domHash: string;
  screenshotHash: string;
  landmarks: string[];
  title: string;
}

export interface AutonomousState {
  stateKey: string;
  normalizedUrl: string;
  label: string;
  productArea: string;
  accountStateVersion: number;
  fingerprint: StateFingerprint;
}

export interface AgentObservation {
  url: string;
  title: string;
  landmarks: string[];
  controls: Array<{ role: string; name: string }>;
  screenshotHash: string;
  domHash: string;
}

const SECRET_KEY = /password|passwd|pwd|secret|token|api.?key|private.?key|authorization|cookie|session.?id/i;
const SECRET_VALUE = /\bBearer\s+\S+|-----BEGIN [^-]*PRIVATE KEY-----|(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^/\s:@]+:[^@\s]+@|\bAKIA[0-9A-Z]{16}\b|\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/;
const MAX_TEXT_LENGTH = 10_000;
const MAX_ARRAY_LENGTH = 500;

function containsSecretLike(value: unknown): boolean {
  if (typeof value === "string") return SECRET_VALUE.test(value);
  if (Array.isArray(value)) return value.some(containsSecretLike);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, item]) => SECRET_KEY.test(key) || containsSecretLike(item));
}

function nonPublicIpv4(value: string): boolean {
  const [a, b, c] = value.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2))))
    || (a === 198 && (b === 18 || b === 19 || b === 51))
    || (a === 203 && b === 0 && c === 113);
}

function publicHttpUrl(value: unknown, label: string): string {
  const textValue = text(value, label);
  let url: URL;
  try {
    url = new URL(textValue);
  } catch {
    throw new Error(`${label} must be a public HTTP(S) URL`);
  }
  const host = url.hostname.toLowerCase();
  const ipHost = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  const ip = isIP(ipHost);
  const blockedIpv6 = ip === 6 && (ipHost === "::" || ipHost === "::1" || /^(?:fc|fd|fe[89ab]|ff)/i.test(ipHost));
  if (
    !["http:", "https:"].includes(url.protocol)
    || url.username || url.password || url.hash
    || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")
    || (ip === 4 && nonPublicIpv4(ipHost)) || blockedIpv6
  ) {
    throw new Error(`${label} must be a public HTTP(S) URL`);
  }
  return textValue;
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const keys = new Set(allowed);
  const unexpected = Object.keys(value).find((key) => !keys.has(key));
  if (unexpected) throw new Error(`${label} contains unexpected field ${unexpected}`);
}

function boundedArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  if (value.length > MAX_ARRAY_LENGTH) throw new Error(`${label} has too many items`);
  return value;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  if (value.length > MAX_TEXT_LENGTH) throw new Error(`${label} is too long`);
  return value.trim();
}

function textArray(value: unknown, label: string): string[] {
  return boundedArray(value, label).map((item, index) => text(item, `${label}[${index}]`));
}

function optionalText(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined;
  return text(value, label);
}

function confidence(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${label} must be between 0 and 1`);
  }
  return value;
}

function citedUrls(value: unknown, label: string, sources: ReadonlySet<string>): string[] {
  const citations = textArray(value, label);
  if (citations.length === 0 || citations.some((url) => !sources.has(url))) {
    throw new Error(`${label} must reference dossier sources`);
  }
  return citations;
}

function origin(value: unknown, label: string): string {
  const parsed = new URL(publicHttpUrl(value, label));
  return parsed.origin;
}

export function parseAgentTraceEvent(value: unknown): AgentTraceEvent {
  if (containsSecretLike(value)) throw new Error("Agent trace event must not contain secret-like keys or values");
  const raw = object(value, "Agent trace event");
  exactKeys(raw, ["stage", "type", "rationale", "confidence", "evidenceId", "credentialCapability"], "Agent trace event");
  const stage = text(raw.stage, "Agent trace event stage");
  if (stage !== "research" && stage !== "execution") throw new Error("Agent trace event stage is invalid");
  const type = text(raw.type, "Agent trace event type");
  if (![
    "research_started", "research_completed", "flow_proposed", "mission_started",
    "state_observed", "action_selected", "evidence_captured", "mission_blocked",
  ].includes(type)) throw new Error("Agent trace event type is invalid");
  const rationale = text(raw.rationale, "Agent trace event rationale");
  if (rationale.length > 2_000) throw new Error("Agent trace event rationale is too long");
  return {
    stage: stage as AgentTraceStage,
    type: type as AgentTraceEventType,
    rationale,
    ...(raw.confidence === undefined ? {} : { confidence: confidence(raw.confidence, "Agent trace event confidence") }),
    ...(raw.evidenceId === undefined ? {} : { evidenceId: text(raw.evidenceId, "Agent trace event evidence ID") }),
    ...(raw.credentialCapability === undefined ? {} : { credentialCapability: text(raw.credentialCapability, "Agent trace event credential capability") }),
  };
}

export function parseAppDossier(value: unknown): AppDossier {
  if (containsSecretLike(value)) throw new Error("Dossier must not contain secret-like keys or values");
  const raw = object(value, "Dossier");
  exactKeys(raw, ["app", "purpose", "sources", "claims", "roles", "capabilities", "candidateFlows", "openQuestions", "profile", "credentialCapabilities"], "Dossier");
  const sources = boundedArray(raw.sources, "Dossier sources").map((value, index) => {
    const source = object(value, `Dossier source ${index + 1}`);
    exactKeys(source, ["url", "title", "retrievedAt", "kind"], `Dossier source ${index + 1}`);
    const kind = source.kind === undefined ? undefined : text(source.kind, `Dossier source ${index + 1} kind`);
    if (kind !== undefined && !["website", "documentation", "help_center", "product_tour", "changelog", "search"].includes(kind)) {
      throw new Error(`Dossier source ${index + 1} kind is invalid`);
    }
    return {
      url: publicHttpUrl(source.url, `Dossier source ${index + 1} URL`),
      title: text(source.title, `Dossier source ${index + 1} title`),
      retrievedAt: text(source.retrievedAt, `Dossier source ${index + 1} retrieval time`),
      ...(kind ? { kind: kind as ResearchSourceKind } : {}),
    };
  });
  const sourceUrls = new Set(sources.map(({ url }) => url));
  if (sourceUrls.size !== sources.length) throw new Error("Dossier source URLs must be unique");
  const claims = boundedArray(raw.claims, "Dossier claims").map((value, index) => {
    const claim = object(value, `Dossier claim ${index + 1}`);
    exactKeys(claim, ["text", "sourceUrls", "confidence"], `Dossier claim ${index + 1}`);
    const citations = citedUrls(claim.sourceUrls, `Dossier claim ${index + 1} sources`, sourceUrls);
    return {
      text: text(claim.text, `Dossier claim ${index + 1} text`),
      sourceUrls: citations,
      confidence: confidence(claim.confidence, `Dossier claim ${index + 1} confidence`),
    };
  });
  const candidateFlows = boundedArray(raw.candidateFlows, "Dossier candidate flows").map((value, index) => {
    const flow = object(value, `Dossier candidate flow ${index + 1}`);
    exactKeys(flow, ["id", "title", "goal", "productArea", "mode", "prerequisites", "sourceUrls", "access", "readiness", "confidence", "credentialCapability", "candidateSteps"], `Dossier candidate flow ${index + 1}`);
    const modeValue = text(flow.mode, `Dossier candidate flow ${index + 1} mode`);
    if (modeValue !== "read" && modeValue !== "mutate") throw new Error("Dossier candidate flow mode must be read or mutate");
    const mode: MissionMode = modeValue;
    const citations = citedUrls(flow.sourceUrls, `Dossier candidate flow ${index + 1} sources`, sourceUrls);
    const access = flow.access === undefined ? undefined : text(flow.access, `Dossier candidate flow ${index + 1} access`);
    if (access !== undefined && !["public", "sign_in_required", "test_account_required", "unknown"].includes(access)) {
      throw new Error(`Dossier candidate flow ${index + 1} access is invalid`);
    }
    const readiness = flow.readiness === undefined ? undefined : text(flow.readiness, `Dossier candidate flow ${index + 1} readiness`);
    if (readiness !== undefined && !["ready", "needs_review", "blocked"].includes(readiness)) {
      throw new Error(`Dossier candidate flow ${index + 1} readiness is invalid`);
    }
    const candidateSteps = flow.candidateSteps === undefined ? undefined : boundedArray(flow.candidateSteps, `Dossier candidate flow ${index + 1} steps`).map((value, stepIndex) => {
      const step = object(value, `Dossier candidate flow ${index + 1} step ${stepIndex + 1}`);
      exactKeys(step, ["title", "sourceUrls", "evidence"], `Dossier candidate flow ${index + 1} step ${stepIndex + 1}`);
      const evidence = text(step.evidence, `Dossier candidate flow ${index + 1} step ${stepIndex + 1} evidence`);
      if (evidence !== "documented" && evidence !== "inferred") throw new Error(`Dossier candidate flow ${index + 1} step ${stepIndex + 1} evidence is invalid`);
      return {
        title: text(step.title, `Dossier candidate flow ${index + 1} step ${stepIndex + 1} title`),
        sourceUrls: citedUrls(step.sourceUrls, `Dossier candidate flow ${index + 1} step ${stepIndex + 1} sources`, sourceUrls),
        evidence: evidence as "documented" | "inferred",
      };
    });
    const credentialCapability = optionalText(flow.credentialCapability, `Dossier candidate flow ${index + 1} credential capability`);
    return {
      id: text(flow.id, `Dossier candidate flow ${index + 1} ID`),
      title: text(flow.title, `Dossier candidate flow ${index + 1} title`),
      goal: text(flow.goal, `Dossier candidate flow ${index + 1} goal`),
      productArea: text(flow.productArea, `Dossier candidate flow ${index + 1} product area`),
      mode,
      prerequisites: textArray(flow.prerequisites, `Dossier candidate flow ${index + 1} prerequisites`),
      sourceUrls: citations,
      ...(access ? { access: access as FlowAccess } : {}),
      ...(readiness ? { readiness: readiness as FlowReadiness } : {}),
      ...(flow.confidence === undefined ? {} : { confidence: confidence(flow.confidence, `Dossier candidate flow ${index + 1} confidence`) }),
      ...(credentialCapability ? { credentialCapability } : {}),
      ...(candidateSteps ? { candidateSteps } : {}),
    };
  });
  const flowIds = new Set(candidateFlows.map(({ id }) => id));
  if (flowIds.size !== candidateFlows.length) throw new Error("Dossier candidate flow IDs must be unique");
  const profile = raw.profile === undefined ? undefined : (() => {
    const value = object(raw.profile, "Dossier profile");
    exactKeys(value, ["name", "canonicalUrl", "category", "description", "sourceUrls", "iconUrl"], "Dossier profile");
    return {
      name: text(value.name, "Dossier profile name"),
      canonicalUrl: publicHttpUrl(value.canonicalUrl, "Dossier profile canonical URL"),
      category: text(value.category, "Dossier profile category"),
      description: text(value.description, "Dossier profile description"),
      sourceUrls: citedUrls(value.sourceUrls, "Dossier profile sources", sourceUrls),
      ...(value.iconUrl === undefined ? {} : { iconUrl: publicHttpUrl(value.iconUrl, "Dossier profile icon URL") }),
    };
  })();
  const credentialCapabilities = raw.credentialCapabilities === undefined ? undefined : boundedArray(raw.credentialCapabilities, "Dossier credential capabilities").map((value, index) => {
    const capability = object(value, `Dossier credential capability ${index + 1}`);
    exactKeys(capability, ["alias", "purpose", "role", "allowedOrigins", "flowIds", "sourceUrls"], `Dossier credential capability ${index + 1}`);
    const flowIdsForCapability = textArray(capability.flowIds, `Dossier credential capability ${index + 1} flow IDs`);
    if (flowIdsForCapability.some((id) => !flowIds.has(id))) throw new Error(`Dossier credential capability ${index + 1} references an unknown flow`);
    return {
      alias: text(capability.alias, `Dossier credential capability ${index + 1} alias`),
      purpose: text(capability.purpose, `Dossier credential capability ${index + 1} purpose`),
      role: text(capability.role, `Dossier credential capability ${index + 1} role`),
      allowedOrigins: textArray(capability.allowedOrigins, `Dossier credential capability ${index + 1} allowed origins`).map((value, originIndex) => origin(value, `Dossier credential capability ${index + 1} allowed origin ${originIndex + 1}`)),
      flowIds: flowIdsForCapability,
      sourceUrls: citedUrls(capability.sourceUrls, `Dossier credential capability ${index + 1} sources`, sourceUrls),
    };
  });
  if (credentialCapabilities && new Set(credentialCapabilities.map(({ alias }) => alias)).size !== credentialCapabilities.length) {
    throw new Error("Dossier credential capability aliases must be unique");
  }
  for (const flow of candidateFlows) {
    if (flow.credentialCapability && !credentialCapabilities?.some(({ alias }) => alias === flow.credentialCapability)) {
      throw new Error(`Dossier candidate flow ${flow.id} references an unknown credential capability`);
    }
  }
  return {
    app: text(raw.app, "Dossier app"),
    purpose: text(raw.purpose, "Dossier purpose"),
    sources,
    claims,
    roles: textArray(raw.roles, "Dossier roles"),
    capabilities: textArray(raw.capabilities, "Dossier capabilities"),
    candidateFlows,
    openQuestions: textArray(raw.openQuestions, "Dossier open questions"),
    ...(profile ? { profile } : {}),
    ...(credentialCapabilities ? { credentialCapabilities } : {}),
  };
}

export function parseMission(value: AutonomousMission, allowAll: boolean): AutonomousMission {
  const mission = structuredClone(value);
  if (
    typeof mission.missionKey !== "string" || !mission.missionKey.trim()
    || typeof mission.goal !== "string" || !mission.goal.trim()
    || typeof mission.productArea !== "string" || !mission.productArea.trim()
  ) throw new Error("Mission identity is required");
  if (mission.mode !== "read" && mission.mode !== "mutate") throw new Error("Mission mode must be read or mutate");
  if (mission.mode === "mutate" && !allowAll) throw new Error("Mutating missions require allow_all");
  if (!Number.isInteger(mission.budget?.actions) || mission.budget.actions < 1 || mission.budget.actions > 500) {
    throw new Error("Mission action budget is invalid");
  }
  if (!Number.isInteger(mission.budget.recoveries) || mission.budget.recoveries < 0 || mission.budget.recoveries > 20) {
    throw new Error("Mission recovery budget is invalid");
  }
  return mission;
}
import { isIP } from "node:net";
