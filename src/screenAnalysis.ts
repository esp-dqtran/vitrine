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

export function parseScreenAnalysis(raw: string): ScreenAnalysis {
  let value: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("root must be an object");
    value = parsed as Record<string, unknown>;
  } catch (error) {
    throw new Error(`Screen analysis did not return valid JSON: ${(error as Error).message}`);
  }

  const theme = requiredText(value.theme, "theme") as ScreenTheme;
  if (!["light", "dark", "mixed"].includes(theme)) throw new Error(`Unsupported screen theme: ${theme}`);
  const viewport = typeof value.responsiveViewport === "string" ? value.responsiveViewport : "unknown";
  if (!["desktop", "tablet", "mobile", "unknown"].includes(viewport)) throw new Error(`Unsupported responsive viewport: ${viewport}`);
  const confidence = typeof value.confidence === "number" ? value.confidence : 0.5;
  if (confidence < 0 || confidence > 1) throw new Error("confidence must be between 0 and 1");
  return {
    description: requiredText(value.description, "description"),
    purpose: requiredText(value.purpose, "purpose"),
    pageType: requiredText(value.pageType, "pageType"),
    productArea: requiredText(value.productArea, "productArea"),
    theme,
    visibleStates: stringList(value.visibleStates),
    componentNames: stringList(value.componentNames),
    visibleText: stringList(value.visibleText),
    layoutPatterns: stringList(value.layoutPatterns),
    icons: stringList(value.icons),
    imagery: stringList(value.imagery),
    contentPatterns: stringList(value.contentPatterns),
    interactionPatterns: stringList(value.interactionPatterns),
    responsiveViewport: viewport as ScreenAnalysis["responsiveViewport"],
    confidence,
  };
}
