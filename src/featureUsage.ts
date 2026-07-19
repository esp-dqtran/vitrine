export const FEATURE_LABELS = {
  library: "App library",
  search: "Search",
  collections: "Collections",
  exports: "Exports",
  research: "Research projects",
  design_systems: "Design systems",
  flows: "Flows",
  ai_analysis: "AI analysis",
} as const;

export type FeatureKey = keyof typeof FEATURE_LABELS;
export type UsageRangeKey = "7d" | "30d" | "90d";

export function isFeatureKey(value: unknown): value is FeatureKey {
  return typeof value === "string" && Object.hasOwn(FEATURE_LABELS, value);
}

export function parseUsageRange(value: unknown): { key: UsageRangeKey; days: number } | undefined {
  if (value === "7d") return { key: value, days: 7 };
  if (value === "30d" || value === undefined) return { key: "30d", days: 30 };
  if (value === "90d") return { key: value, days: 90 };
  return undefined;
}

export function featureKeyForLegacyAction(action: string): FeatureKey | undefined {
  if (action.startsWith("export-")) return "exports";
  if (action === "app-detail") return "library";
  if (action.startsWith("research_project_")) return "research";
  return undefined;
}
