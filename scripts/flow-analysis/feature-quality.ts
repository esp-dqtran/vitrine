export interface FeatureQualityResult {
  value: Record<string, unknown>;
  score: number;
  warnings: string[];
}

function normalizeConfidence(
  value: unknown,
  label: string,
  warnings: string[],
): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid ${label}`);
  }
  if (value <= 1) return value;
  if (value <= 100) {
    const warning = "confidence values normalized from percent to decimal";
    if (!warnings.includes(warning)) warnings.push(warning);
    return value / 100;
  }
  throw new Error(`Invalid ${label}`);
}

function validateEvidenceIds(
  value: unknown,
  allowed: ReadonlySet<string>,
  label: string,
): void {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Invalid ${label}`);
  }
  for (const evidenceId of value) {
    if (!allowed.has(evidenceId)) throw new Error(`Unknown evidence ID ${evidenceId}`);
  }
}

export function qualityGateFeature(
  input: Record<string, unknown>,
  evidenceIds: readonly string[],
): FeatureQualityResult {
  const value = structuredClone(input);
  const warnings: string[] = [];
  const allowed = new Set(evidenceIds);
  const ordered = value.orderedSteps;
  if (!Array.isArray(ordered) || ordered.length !== evidenceIds.length) {
    throw new Error(`Expected ${evidenceIds.length} ordered steps`);
  }
  for (const [index, item] of ordered.entries()) {
    if (!item || typeof item !== "object") throw new Error(`Invalid ordered step ${index + 1}`);
    const step = item as Record<string, unknown>;
    if (step.evidenceId !== evidenceIds[index]) {
      throw new Error("Ordered evidence IDs do not match the complete flow");
    }
    step.confidence = normalizeConfidence(
      step.confidence,
      `orderedSteps[${index}].confidence`,
      warnings,
    );
  }

  const evidenceGroups = [
    "observedBehavior",
    "inferredRules",
    "requirements",
    "edgeCases",
    "acceptanceCriteria",
  ] as const;
  for (const group of evidenceGroups) {
    const items = value[group];
    if (!Array.isArray(items)) throw new Error(`Invalid ${group}`);
    for (const [index, item] of items.entries()) {
      if (!item || typeof item !== "object") throw new Error(`Invalid ${group}[${index}]`);
      const record = item as Record<string, unknown>;
      validateEvidenceIds(record.evidenceIds, allowed, `${group}[${index}].evidenceIds`);
      if (group === "inferredRules") {
        record.confidence = normalizeConfidence(
          record.confidence,
          `${group}[${index}].confidence`,
          warnings,
        );
      }
    }
  }

  if (typeof value.featureDescription === "string" && /\.(?:jpe?g|png|webp)\b/i.test(value.featureDescription)) {
    warnings.push("featureDescription mentions the uploaded filename");
  }
  if ((value.requirements as unknown[]).length === 0) warnings.push("no requirements returned");
  if ((value.acceptanceCriteria as unknown[]).length === 0) {
    warnings.push("no acceptance criteria returned");
  }

  return {
    value,
    score: Math.max(0, 100 - warnings.length * 5),
    warnings,
  };
}
