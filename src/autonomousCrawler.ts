export type MissionMode = "read" | "mutate";
export type MissionStatus = "queued" | "running" | "succeeded" | "blocked" | "failed" | "interrupted" | "cancelled";

export interface DossierSource {
  url: string;
  title: string;
  retrievedAt: string;
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

export function parseAppDossier(value: unknown): AppDossier {
  if (containsSecretLike(value)) throw new Error("Dossier must not contain secret-like keys or values");
  const raw = object(value, "Dossier");
  exactKeys(raw, ["app", "purpose", "sources", "claims", "roles", "capabilities", "candidateFlows", "openQuestions"], "Dossier");
  const sources = boundedArray(raw.sources, "Dossier sources").map((value, index) => {
    const source = object(value, `Dossier source ${index + 1}`);
    exactKeys(source, ["url", "title", "retrievedAt"], `Dossier source ${index + 1}`);
    return {
      url: publicHttpUrl(source.url, `Dossier source ${index + 1} URL`),
      title: text(source.title, `Dossier source ${index + 1} title`),
      retrievedAt: text(source.retrievedAt, `Dossier source ${index + 1} retrieval time`),
    };
  });
  const sourceUrls = new Set(sources.map(({ url }) => url));
  if (sourceUrls.size !== sources.length) throw new Error("Dossier source URLs must be unique");
  const claims = boundedArray(raw.claims, "Dossier claims").map((value, index) => {
    const claim = object(value, `Dossier claim ${index + 1}`);
    exactKeys(claim, ["text", "sourceUrls", "confidence"], `Dossier claim ${index + 1}`);
    const citations = textArray(claim.sourceUrls, `Dossier claim ${index + 1} sources`);
    if (citations.some((url) => !sourceUrls.has(url))) throw new Error("Dossier claim source is not in the source list");
    if (typeof claim.confidence !== "number" || !Number.isFinite(claim.confidence) || claim.confidence < 0 || claim.confidence > 1) {
      throw new Error("Dossier claim confidence must be between 0 and 1");
    }
    return {
      text: text(claim.text, `Dossier claim ${index + 1} text`),
      sourceUrls: citations,
      confidence: claim.confidence,
    };
  });
  const candidateFlows = boundedArray(raw.candidateFlows, "Dossier candidate flows").map((value, index) => {
    const flow = object(value, `Dossier candidate flow ${index + 1}`);
    exactKeys(flow, ["id", "title", "goal", "productArea", "mode", "prerequisites", "sourceUrls"], `Dossier candidate flow ${index + 1}`);
    const modeValue = text(flow.mode, `Dossier candidate flow ${index + 1} mode`);
    if (modeValue !== "read" && modeValue !== "mutate") throw new Error("Dossier candidate flow mode must be read or mutate");
    const mode: MissionMode = modeValue;
    const citations = textArray(flow.sourceUrls, `Dossier candidate flow ${index + 1} sources`);
    if (citations.some((url) => !sourceUrls.has(url))) throw new Error("Dossier candidate flow source is not in the source list");
    return {
      id: text(flow.id, `Dossier candidate flow ${index + 1} ID`),
      title: text(flow.title, `Dossier candidate flow ${index + 1} title`),
      goal: text(flow.goal, `Dossier candidate flow ${index + 1} goal`),
      productArea: text(flow.productArea, `Dossier candidate flow ${index + 1} product area`),
      mode,
      prerequisites: textArray(flow.prerequisites, `Dossier candidate flow ${index + 1} prerequisites`),
      sourceUrls: citations,
    };
  });
  return {
    app: text(raw.app, "Dossier app"),
    purpose: text(raw.purpose, "Dossier purpose"),
    sources,
    claims,
    roles: textArray(raw.roles, "Dossier roles"),
    capabilities: textArray(raw.capabilities, "Dossier capabilities"),
    candidateFlows,
    openQuestions: textArray(raw.openQuestions, "Dossier open questions"),
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
