export const PUBLIC_APP_FACETS = [
  { group: "categories", label: "Categories", values: ["Productivity", "Business", "Finance", "Health & Fitness", "Developer Tools"] },
  { group: "screens", label: "Screens", values: ["Filter & Sort", "Chat Bot", "Signup", "Settings & Preferences", "Charts"] },
  { group: "elements", label: "UI Elements", values: ["Navigation Menu", "Dialog", "Card", "Dropdown Menu", "Text Field"] },
  { group: "flows", label: "Flows", values: ["Setting Up", "Searching & Finding", "Filtering & Sorting", "Resetting Password", "Reporting"] },
] as const;

export type PublicFacetGroup = (typeof PUBLIC_APP_FACETS)[number]["group"];
export type PublicFacetPlatform = "ios" | "web";

export interface PublicFacetInput {
  group: PublicFacetGroup;
  value: string;
  platform: PublicFacetPlatform;
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
  if (typeof input.group !== "string" || typeof input.value !== "string") return null;
  if (input.platform !== "ios" && input.platform !== "web") return null;
  const definition = PUBLIC_APP_FACETS.find(({ group }) => group === input.group);
  if (!definition || !(definition.values as readonly string[]).includes(input.value)) return null;
  return {
    group: definition.group,
    value: input.value,
    platform: input.platform,
  };
}
