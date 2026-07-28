export const PUBLIC_APP_STATIC_FACETS = [
  { group: "screens", label: "Screens", values: ["Filter & Sort", "Chat Bot", "Signup", "Settings & Preferences", "Charts"] },
  { group: "elements", label: "UI Elements", values: ["Navigation Menu", "Dialog", "Card", "Dropdown Menu", "Text Field"] },
  { group: "flows", label: "Flows", values: ["Setting Up", "Searching & Finding", "Filtering & Sorting", "Resetting Password", "Reporting"] },
] as const;

export type PublicFacetGroup = "categories" | "screens" | "elements" | "flows";
export type PublicFacetPlatform = "ios" | "web";
export type PublicCatalogFacetPlatform = PublicFacetPlatform | "android";

export interface PublicFacetInput {
  group: PublicFacetGroup;
  value: string;
  platform: PublicFacetPlatform;
}

export interface PublicCatalogFacetInput {
  group: PublicFacetGroup;
  value: string;
  platform: PublicCatalogFacetPlatform;
}

export interface PublicFacetPreview {
  kind: "icon" | "screen" | "component" | "flow";
  app: string;
  label: string;
  iconUrl: string | null;
  mediaCount: number;
}

export function parsePublicFacet(input: {
  group?: unknown;
  value?: unknown;
  platform?: unknown;
}): PublicFacetInput | null {
  const facet = parsePublicCatalogFacet(input);
  if (!facet || facet.platform === "android") return null;
  if (facet.group !== "categories") {
    const definition = PUBLIC_APP_STATIC_FACETS.find(
      ({ group }) => group === facet.group,
    );
    if (!definition || !(definition.values as readonly string[]).includes(facet.value)) {
      return null;
    }
  }
  return facet;
}

export function parsePublicCatalogFacet(input: {
  group?: unknown;
  value?: unknown;
  platform?: unknown;
}): PublicCatalogFacetInput | null {
  if (typeof input.group !== "string" || typeof input.value !== "string") return null;
  if (input.platform !== "ios" && input.platform !== "web" && input.platform !== "android") return null;
  if (input.group === "categories" || input.group === "flows") {
    const value = input.value.trim();
    if (!value || value.length > 120) return null;
    return { group: input.group, value, platform: input.platform };
  }
  const definition = PUBLIC_APP_STATIC_FACETS.find(({ group }) => group === input.group);
  if (!definition || !(definition.values as readonly string[]).includes(input.value)) return null;
  return {
    group: definition.group,
    value: input.value,
    platform: input.platform,
  };
}
