export type ScreenTheme = "light" | "dark" | "mixed";

export interface ScreenAnalysis {
  description: string;
  purpose: string;
  pageType: string;
  productArea: string;
  theme: ScreenTheme;
  visibleStates: string[];
  componentNames: string[];
  visibleText?: string[];
  layoutPatterns?: string[];
  icons?: string[];
  imagery?: string[];
  contentPatterns?: string[];
  interactionPatterns?: string[];
  responsiveViewport?: "desktop" | "tablet" | "mobile" | "unknown";
  confidence?: number;
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} must be a non-empty string`);
  return value.trim();
}

function stringList(value: unknown): string[] {
  return [
    ...new Set(
      (Array.isArray(value) ? value : [])
        .filter((item): item is string => typeof item === "string" && !!item.trim())
        .map((item) => item.trim()),
    ),
  ];
}

export function parseScreenAnalysisValue(value: unknown): ScreenAnalysis {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Screen analysis must be an object");
  }
  const analysis = value as Record<string, unknown>;
  const theme = requiredText(analysis.theme, "theme") as ScreenTheme;
  if (!["light", "dark", "mixed"].includes(theme)) throw new Error(`Unsupported screen theme: ${theme}`);
  const viewport = typeof analysis.responsiveViewport === "string"
    ? analysis.responsiveViewport
    : "unknown";
  if (!["desktop", "tablet", "mobile", "unknown"].includes(viewport)) throw new Error(`Unsupported responsive viewport: ${viewport}`);
  const confidence = typeof analysis.confidence === "number" ? analysis.confidence : 0.5;
  if (confidence < 0 || confidence > 1) throw new Error("confidence must be between 0 and 1");
  return {
    description: requiredText(analysis.description, "description"),
    purpose: requiredText(analysis.purpose, "purpose"),
    pageType: requiredText(analysis.pageType, "pageType"),
    productArea: requiredText(analysis.productArea, "productArea"),
    theme,
    visibleStates: stringList(analysis.visibleStates),
    componentNames: stringList(analysis.componentNames),
    visibleText: stringList(analysis.visibleText),
    layoutPatterns: stringList(analysis.layoutPatterns),
    icons: stringList(analysis.icons),
    imagery: stringList(analysis.imagery),
    contentPatterns: stringList(analysis.contentPatterns),
    interactionPatterns: stringList(analysis.interactionPatterns),
    responsiveViewport: viewport as ScreenAnalysis["responsiveViewport"],
    confidence,
  };
}

export function parseScreenAnalysis(raw: string): ScreenAnalysis {
  try {
    return parseScreenAnalysisValue(
      JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")),
    );
  } catch (error) {
    throw new Error(`Screen analysis did not return valid JSON: ${(error as Error).message}`);
  }
}
