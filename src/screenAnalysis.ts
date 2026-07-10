export type ScreenTheme = "light" | "dark" | "mixed";

export interface ScreenAnalysis {
  description: string;
  purpose: string;
  pageType: string;
  productArea: string;
  theme: ScreenTheme;
  visibleStates: string[];
  componentNames: string[];
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
  return {
    description: requiredText(value.description, "description"),
    purpose: requiredText(value.purpose, "purpose"),
    pageType: requiredText(value.pageType, "pageType"),
    productArea: requiredText(value.productArea, "productArea"),
    theme,
    visibleStates: stringList(value.visibleStates),
    componentNames: stringList(value.componentNames),
  };
}
