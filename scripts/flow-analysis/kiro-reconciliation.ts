export type ResearchPacket = {
  flow: {
    app: string;
    platform: string;
    flowId: string;
    title: string;
  };
  visualAnalysis: {
    artifact: string;
    unknowns?: string[];
  };
  documentedContext: {
    claims: Array<{
      id: string;
      sourceIds: string[];
    }>;
  };
};

export type VisualArtifact = {
  source: {
    flowId: string;
    evidence: Array<{ evidenceId: string }>;
  };
};

export type KiroReconciliationResult = {
  flowId: string;
  modelAssessment: {
    replicationValue: number;
    summary: string;
  };
  claimReconciliation: Array<{
    claimId: string;
    classification: "supports" | "extends" | "conflicts" | "unrelated";
    reason: string;
    visualEvidenceIds: string[];
    sourceIds: string[];
    unresolved: boolean;
  }>;
  implementationKnowledge: {
    observedMustBuild: string[];
    documentedBackendContext: string[];
    doNotInfer: string[];
  };
  risks: Array<{
    severity: "high" | "medium" | "low";
    text: string;
    basis: "observed" | "documented" | "gap";
  }>;
  qualityChecks: {
    allClaimsClassified: boolean;
    visualAndDocumentedSeparated: boolean;
    unknownsPreserved: boolean;
  };
};

export type PersistedKiroReconciliation = {
  schemaVersion: 1;
  generatedAt: string;
  provider: "kiro-cli";
  model: string;
  effort: string;
  source: {
    researchPacket: string;
    visualArtifact: string;
  };
  usage: {
    credits?: number;
    elapsed?: string;
  };
  reviewRecommendation: {
    solReview: boolean;
    reasons: string[];
  };
  recovery?: {
    source: "kiro-session-store";
    conversationId: string;
  };
  result: KiroReconciliationResult;
};

const classifications = new Set(["supports", "extends", "conflicts", "unrelated"]);
const riskSeverities = new Set(["high", "medium", "low"]);
const riskBases = new Set(["observed", "documented", "gap"]);

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function strings(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${label} must be a string array`);
  }
  return value as string[];
}

function sameMembers(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length
    && new Set(left).size === left.length
    && left.every((value) => right.includes(value));
}

export function validateKiroReconciliation(
  value: unknown,
  packet: ResearchPacket,
  visual: VisualArtifact,
): KiroReconciliationResult {
  const result = record(value, "result");
  if (string(result.flowId, "flowId") !== packet.flow.flowId) {
    throw new Error("flowId does not match the research packet");
  }
  if (packet.flow.flowId !== visual.source.flowId) {
    throw new Error("research packet and visual artifact flowId differ");
  }

  const assessment = record(result.modelAssessment, "modelAssessment");
  const replicationValue = assessment.replicationValue;
  if (
    typeof replicationValue !== "number"
    || !Number.isInteger(replicationValue)
    || replicationValue < 1
    || replicationValue > 10
  ) {
    throw new Error("modelAssessment.replicationValue must be an integer from 1 to 10");
  }
  string(assessment.summary, "modelAssessment.summary");

  if (!Array.isArray(result.claimReconciliation)) {
    throw new Error("claimReconciliation must be an array");
  }
  const expectedClaims = new Map(
    packet.documentedContext.claims.map((claim) => [claim.id, claim]),
  );
  const seenClaims = new Set<string>();
  const validEvidenceIds = new Set(
    visual.source.evidence.map((evidence) => evidence.evidenceId),
  );
  for (const [index, rawClaim] of result.claimReconciliation.entries()) {
    const claim = record(rawClaim, `claimReconciliation[${index}]`);
    const claimId = string(claim.claimId, `claimReconciliation[${index}].claimId`);
    const expected = expectedClaims.get(claimId);
    if (!expected) throw new Error(`Unknown claimId ${claimId}`);
    if (seenClaims.has(claimId)) throw new Error(`Duplicate claimId ${claimId}`);
    seenClaims.add(claimId);
    if (!classifications.has(String(claim.classification))) {
      throw new Error(`Invalid classification for ${claimId}`);
    }
    string(claim.reason, `${claimId}.reason`);
    const evidenceIds = strings(claim.visualEvidenceIds, `${claimId}.visualEvidenceIds`);
    for (const evidenceId of evidenceIds) {
      if (!validEvidenceIds.has(evidenceId)) {
        throw new Error(`Unknown visual evidence ID ${evidenceId} for ${claimId}`);
      }
    }
    const sourceIds = strings(claim.sourceIds, `${claimId}.sourceIds`);
    if (!sameMembers(sourceIds, expected.sourceIds)) {
      throw new Error(`sourceIds do not match documented claim ${claimId}`);
    }
    if (typeof claim.unresolved !== "boolean") {
      throw new Error(`${claimId}.unresolved must be boolean`);
    }
  }
  if (!sameMembers([...seenClaims], [...expectedClaims.keys()])) {
    throw new Error("Every documented claim must be classified exactly once");
  }

  const knowledge = record(result.implementationKnowledge, "implementationKnowledge");
  strings(knowledge.observedMustBuild, "implementationKnowledge.observedMustBuild");
  strings(
    knowledge.documentedBackendContext,
    "implementationKnowledge.documentedBackendContext",
  );
  strings(knowledge.doNotInfer, "implementationKnowledge.doNotInfer");

  if (!Array.isArray(result.risks)) throw new Error("risks must be an array");
  for (const [index, rawRisk] of result.risks.entries()) {
    const risk = record(rawRisk, `risks[${index}]`);
    if (!riskSeverities.has(String(risk.severity))) {
      throw new Error(`Invalid severity for risks[${index}]`);
    }
    string(risk.text, `risks[${index}].text`);
    if (!riskBases.has(String(risk.basis))) {
      throw new Error(`Invalid basis for risks[${index}]`);
    }
  }

  const checks = record(result.qualityChecks, "qualityChecks");
  for (const key of [
    "allClaimsClassified",
    "visualAndDocumentedSeparated",
    "unknownsPreserved",
  ]) {
    if (checks[key] !== true) throw new Error(`qualityChecks.${key} must be true`);
  }

  return value as KiroReconciliationResult;
}

function stripAnsi(value: string): string {
  return value.replace(
    // Covers CSI color, cursor, erase, and private-mode sequences emitted by Kiro CLI.
    // eslint-disable-next-line no-control-regex
    /\u001B(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001B\\))/g,
    "",
  );
}

function repairTrailingContainers(value: string): unknown | undefined {
  const marker = value.indexOf("\n[Tool uses:");
  const candidate = (marker >= 0 ? value.slice(0, marker) : value).trim();
  const stack: string[] = [];
  let quoted = false;
  let escaped = false;
  for (const character of candidate) {
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === "\"") quoted = false;
      continue;
    }
    if (character === "\"") quoted = true;
    else if (character === "{" || character === "[") stack.push(character);
    else if (character === "}" || character === "]") {
      const expected = character === "}" ? "{" : "[";
      if (stack.pop() !== expected) return undefined;
    }
  }
  if (quoted || stack.length === 0 || stack.length > 4) return undefined;
  const repaired = candidate
    + stack.reverse().map((opening) => opening === "{" ? "}" : "]").join("");
  try {
    return JSON.parse(repaired) as unknown;
  } catch {
    return undefined;
  }
}

function normalizeKnownKiroShape(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const result = value as Record<string, unknown>;
  if (result.risks !== undefined || result.qualityChecks !== undefined) return value;
  if (
    !result.implementationKnowledge
    || typeof result.implementationKnowledge !== "object"
    || Array.isArray(result.implementationKnowledge)
  ) return value;
  const knowledge = result.implementationKnowledge as Record<string, unknown>;
  if (!Array.isArray(knowledge.risks)) return value;
  if (
    !knowledge.qualityChecks
    || typeof knowledge.qualityChecks !== "object"
    || Array.isArray(knowledge.qualityChecks)
  ) return value;
  const { risks, qualityChecks, ...implementationKnowledge } = knowledge;
  return {
    ...result,
    implementationKnowledge,
    risks,
    qualityChecks,
  };
}

export function extractKiroJson(output: string): unknown {
  const text = stripAnsi(output);
  const candidates: unknown[] = [];
  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== "{") continue;
    let depth = 0;
    let quoted = false;
    let escaped = false;
    for (let end = start; end < text.length; end += 1) {
      const character = text[end];
      if (quoted) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === "\"") quoted = false;
        continue;
      }
      if (character === "\"") quoted = true;
      else if (character === "{") depth += 1;
      else if (character === "}") {
        depth -= 1;
        if (depth !== 0) continue;
        try {
          candidates.push(JSON.parse(text.slice(start, end + 1)) as unknown);
        } catch {
          // The output can include JSON-like progress text before the final answer.
        }
        break;
      }
    }
  }
  const result = candidates.findLast((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
    const object = candidate as Record<string, unknown>;
    return typeof object.flowId === "string" && Array.isArray(object.claimReconciliation);
  });
  if (result) return normalizeKnownKiroShape(result);
  for (let start = text.lastIndexOf("{"); start >= 0; start = text.lastIndexOf("{", start - 1)) {
    const repaired = repairTrailingContainers(text.slice(start));
    if (!repaired || typeof repaired !== "object" || Array.isArray(repaired)) continue;
    const object = repaired as Record<string, unknown>;
    if (typeof object.flowId === "string" && Array.isArray(object.claimReconciliation)) {
      return normalizeKnownKiroShape(repaired);
    }
  }
  throw new Error("Kiro output did not contain a reconciliation JSON object");
}

export function buildKiroReconciliationPrompt(
  packetPath: string,
  visualPath: string,
): string {
  return [
    `Analyze the research packet at ${packetPath} together with the visual flow analysis at ${visualPath}.`,
    "This is a read-only evidence reconciliation. Do not modify files and do not run shell commands.",
    "Preserve screenshot observations as authoritative only for visible captured UI.",
    "For every item in documentedContext.claims, classify it as supports, extends, conflicts, or unrelated relative to this captured flow.",
    "Do not claim that external documentation proves captured UI behavior.",
    "Return only valid JSON with this exact top-level shape:",
    "{\"flowId\":string,\"modelAssessment\":{\"replicationValue\":number,\"summary\":string},\"claimReconciliation\":[{\"claimId\":string,\"classification\":\"supports\"|\"extends\"|\"conflicts\"|\"unrelated\",\"reason\":string,\"visualEvidenceIds\":string[],\"sourceIds\":string[],\"unresolved\":boolean}],\"implementationKnowledge\":{\"observedMustBuild\":string[],\"documentedBackendContext\":string[],\"doNotInfer\":string[]},\"risks\":[{\"severity\":\"high\"|\"medium\"|\"low\",\"text\":string,\"basis\":\"observed\"|\"documented\"|\"gap\"}],\"qualityChecks\":{\"allClaimsClassified\":boolean,\"visualAndDocumentedSeparated\":boolean,\"unknownsPreserved\":boolean}}.",
    "replicationValue must be an integer from 1 to 10.",
    "Every claimId must exactly match a documentedContext.claims id.",
    "For each claim, sourceIds must exactly match that documented claim sourceIds.",
    "visualEvidenceIds may contain only evidence IDs present in the visual flow source.",
    "Include all documented claims exactly once.",
  ].join(" ");
}

export function reconciliationReviewRecommendation(
  packet: ResearchPacket,
  result: KiroReconciliationResult,
): PersistedKiroReconciliation["reviewRecommendation"] {
  const reasons: string[] = [];
  if (result.claimReconciliation.some((claim) => claim.classification === "conflicts")) {
    reasons.push("documented-conflict");
  }
  if (result.modelAssessment.replicationValue <= 5) reasons.push("low-replication-value");
  if (result.risks.filter((risk) => risk.severity === "high").length >= 2) {
    reasons.push("multiple-high-risks");
  }
  if (/(account|auth|cancel|checkout|login|order|pay|purchase|refund|security)/i.test(
    packet.flow.title,
  )) {
    reasons.push("critical-journey");
  }
  return { solReview: reasons.length > 0, reasons };
}
