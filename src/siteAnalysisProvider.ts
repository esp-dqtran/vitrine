import type {
  MultimodalJsonProvider,
  RasterImage,
} from "./evidenceAnalysisProvider.ts";
import type {
  SiteAnalysis,
  SiteAnalysisSynthesis,
  SiteSynthesisClaim,
} from "./siteAnalysis.ts";

const MAXIMUM_EVIDENCE_IDS = 2_000;
const MAXIMUM_EVIDENCE_BYTES = 1_000_000;
const MAXIMUM_IMAGE_BYTES = 20 * 1_024 * 1_024;
const MAXIMUM_ITEMS = 50;
const MAXIMUM_TEXT = 2_048;

const SITE_ANALYSIS_SYSTEM_PROMPT = [
  "Return JSON only.",
  "Use exactly this top-level shape: purpose, category, structure, rendering, motion, technology, responsive, reconstructionPriorities, unknowns, claims.",
  "Keep every array concise and return at most 50 items or claims in each array.",
  "Each claim must contain kind, text, evidenceIds, and confidence.",
  "Claim kind must be observed, inferred, or unknown; keep these categories separate.",
  "Every observed or inferred claim must cite one or more supplied evidence IDs.",
  "Every non-empty purpose, category, structure, rendering, motion, technology, responsive, or reconstruction-priority string must exactly match an observed or inferred claim.",
  "Every unknowns string must exactly match an unknown claim.",
  "Never invent an evidence ID.",
  "Unknown claims may use an empty evidenceIds array.",
  "Do not claim access to original source code, private implementation details, or exact original design tokens without supplied evidence.",
  "Describe reconstruction priorities from rendered evidence, not as assertions about the publisher's private implementation.",
].join(" ");

export interface SiteAnalysisProvider {
  readonly model: string;
  analyze(
    input: {
      evidenceIds: string[];
      evidence: unknown;
      image: RasterImage;
    },
    signal: AbortSignal,
  ): Promise<unknown>;
}

export function siteAnalysisProviderFromMultimodal(
  provider: MultimodalJsonProvider,
): SiteAnalysisProvider {
  return {
    model: provider.model,
    analyze(input, signal) {
      return provider.completeJson({
        system: SITE_ANALYSIS_SYSTEM_PROMPT,
        text: {
          evidenceIds: input.evidenceIds,
          evidence: input.evidence,
        },
        image: input.image,
        signal,
      });
    },
  };
}

export async function analyzeSiteEvidence(
  provider: SiteAnalysisProvider,
  input: {
    evidenceIds: string[];
    evidence: unknown;
    image: RasterImage;
    signal: AbortSignal;
  },
): Promise<NonNullable<SiteAnalysis["synthesis"]>> {
  const evidenceIds = checkedEvidenceIds(input.evidenceIds);
  if (input.image.bytes.byteLength < 1) {
    throw new Error("Site analysis image is empty");
  }
  if (input.image.bytes.byteLength > MAXIMUM_IMAGE_BYTES) {
    throw new Error("Site analysis image is too large");
  }
  let serializedEvidence: string;
  try {
    serializedEvidence = JSON.stringify(input.evidence);
  } catch {
    throw new Error("Site analysis evidence is not serializable");
  }
  if (
    typeof serializedEvidence !== "string" ||
    Buffer.byteLength(serializedEvidence) > MAXIMUM_EVIDENCE_BYTES
  ) {
    throw new Error("Site analysis evidence is too large");
  }
  const output = await provider.analyze({
    evidenceIds,
    evidence: JSON.parse(serializedEvidence) as unknown,
    image: input.image,
  }, input.signal);
  return parseSynthesis(output, new Set(evidenceIds));
}

function parseSynthesis(
  value: unknown,
  allowedEvidenceIds: Set<string>,
): SiteAnalysisSynthesis {
  const input = exactRecord(value, [
    "purpose",
    "category",
    "structure",
    "rendering",
    "motion",
    "technology",
    "responsive",
    "reconstructionPriorities",
    "unknowns",
    "claims",
  ]);
  const claims = checkedArray(input.claims, "Site analysis claims")
    .map((claim) => parseClaim(claim, allowedEvidenceIds));
  const cited = new Set(claims
    .filter((claim) => claim.kind !== "unknown" && claim.evidenceIds.length > 0)
    .map((claim) => claim.text));
  const unknown = new Set(claims
    .filter((claim) => claim.kind === "unknown")
    .map((claim) => claim.text));
  const purpose = checkedText(input.purpose, MAXIMUM_TEXT, false);
  const category = checkedText(input.category, 200, false);
  const structure = textArray(input.structure);
  const rendering = textArray(input.rendering);
  const motion = textArray(input.motion);
  const technology = textArray(input.technology);
  const responsive = textArray(input.responsive);
  const reconstructionPriorities = textArray(input.reconstructionPriorities);
  const unknowns = textArray(input.unknowns);
  requireClaimCoverage([
    ...(purpose ? [purpose] : []),
    ...(category ? [category] : []),
    ...structure,
    ...rendering,
    ...motion,
    ...technology,
    ...responsive,
    ...reconstructionPriorities,
  ], cited, "cited");
  requireClaimCoverage(unknowns, unknown, "unknown");
  return {
    purpose,
    category,
    structure,
    rendering,
    motion,
    technology,
    responsive,
    reconstructionPriorities,
    unknowns,
    claims,
  };
}

function requireClaimCoverage(
  values: string[],
  claims: Set<string>,
  kind: "cited" | "unknown",
): void {
  if (values.some((value) => !claims.has(value))) {
    throw new Error(`Site analysis summary requires a matching ${kind} claim citation`);
  }
}

function parseClaim(
  value: unknown,
  allowedEvidenceIds: Set<string>,
): SiteSynthesisClaim {
  const input = exactRecord(value, [
    "kind",
    "text",
    "evidenceIds",
    "confidence",
  ]);
  const kind = enumValue(input.kind, ["observed", "inferred", "unknown"] as const);
  const evidenceIds = checkedArray(input.evidenceIds, "Site claim evidence")
    .map((id) => checkedText(id, 200));
  for (const id of evidenceIds) {
    if (!allowedEvidenceIds.has(id)) {
      throw new Error(`Site analysis claim references unknown evidence: ${id}`);
    }
  }
  const uniqueEvidenceIds = [...new Set(evidenceIds)];
  if (kind !== "unknown" && uniqueEvidenceIds.length === 0) {
    throw new Error("Site analysis observed or inferred claim requires evidence");
  }
  if (
    typeof input.confidence !== "number" ||
    !Number.isFinite(input.confidence) ||
    input.confidence < 0 ||
    input.confidence > 1
  ) {
    throw new Error("Invalid Site analysis claim confidence");
  }
  return {
    kind,
    text: checkedText(input.text, MAXIMUM_TEXT),
    evidenceIds: uniqueEvidenceIds,
    confidence: input.confidence,
  };
}

function checkedEvidenceIds(value: string[]): string[] {
  if (!Array.isArray(value) || value.length > MAXIMUM_EVIDENCE_IDS) {
    throw new Error("Site analysis evidence IDs are too large");
  }
  const ids = value.map((id) => checkedText(id, 200));
  if (new Set(ids).size !== ids.length) {
    throw new Error("Site analysis evidence IDs must be unique");
  }
  return ids;
}

function textArray(value: unknown): string[] {
  return checkedArray(value, "Site analysis synthesis strings")
    .map((item) => checkedText(item, MAXIMUM_TEXT, false));
}

function checkedArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value) || value.length > MAXIMUM_ITEMS) {
    throw new Error(`${label} are invalid or too large`);
  }
  return value;
}

function exactRecord(
  value: unknown,
  keys: string[],
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid Site analysis synthesis");
  }
  const record = value as Record<string, unknown>;
  const actualKeys = Object.keys(record).sort();
  const expectedKeys = [...keys].sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new Error("Invalid Site analysis synthesis shape");
  }
  return record;
}

function checkedText(
  value: unknown,
  maximum: number,
  required = true,
): string {
  if (typeof value !== "string") throw new Error("Invalid Site analysis text");
  const result = value.trim();
  if ((required && result.length === 0) || result.length > maximum) {
    throw new Error("Invalid Site analysis text");
  }
  return result;
}

function enumValue<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
): T[number] {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new Error("Invalid Site analysis claim kind");
  }
  return value as T[number];
}
