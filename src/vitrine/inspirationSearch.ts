import type { CatalogEntityKind, CatalogSearchResultItem } from "../catalogResearch";

export const INSPIRATION_PROMPTS = [
  { label: "Onboarding", query: "Onboarding" },
  { label: "Checkout", query: "Checkout" },
  { label: "AI assistant", query: "AI assistant" },
  { label: "Empty states", query: "Empty states" },
  { label: "Pricing", query: "Pricing" },
  { label: "Profile", query: "Profile" },
] as const;

const GROUPS: Array<{ label: string; kinds: CatalogEntityKind[] }> = [
  { label: "Screens", kinds: ["screen"] },
  { label: "Flows", kinds: ["flow"] },
  { label: "Patterns", kinds: ["pattern", "component"] },
  { label: "Apps", kinds: ["app"] },
];

export function groupInspirationResults(items: CatalogSearchResultItem[]) {
  return GROUPS.map((group) => ({
    label: group.label,
    items: items.filter((item) => group.kinds.includes(item.kind)),
  })).filter((group) => group.items.length > 0);
}

export function relatedSearchQuery(item: CatalogSearchResultItem): string {
  return [...new Set([
    item.pageType,
    item.productArea,
    item.layoutPatterns[0],
    item.componentNames[0],
    item.title,
  ].filter((value): value is string => Boolean(value?.trim())))]
    .slice(0, 3)
    .join(" ");
}

export function moveSelection(index: number, delta: number, count: number): number {
  if (count === 0) return -1;
  return (index + delta + count) % count;
}
