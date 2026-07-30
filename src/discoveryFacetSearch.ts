import type { DiscoveryFacet } from "./vitrine/discoveryTypes.ts";

export interface DiscoveryFacetSearchInput {
  group: string;
  query?: string;
  selected?: readonly string[];
  limit?: number;
}

export function searchDiscoveryFacets(
  facets: readonly DiscoveryFacet[],
  input: DiscoveryFacetSearchInput,
): DiscoveryFacet[] {
  const query = input.query?.trim().toLocaleLowerCase() ?? "";
  const selected = new Set(input.selected ?? []);
  const limit = Math.max(1, Math.min(200, Math.trunc(input.limit ?? 200)));
  const matches = facets
    .filter((facet) => facet.group === input.group)
    .filter((facet) => !query || [
      facet.value,
      facet.section,
      facet.description,
      ...(facet.aliases ?? []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase()
      .includes(query))
    .sort((left, right) =>
      Number(selected.has(right.value)) - Number(selected.has(left.value))
      || right.count - left.count
      || left.value.localeCompare(right.value));
  const visible = matches.slice(0, limit);
  const visibleValues = new Set(visible.map(({ value }) => value));
  for (const facet of facets) {
    if (
      facet.group === input.group
      && selected.has(facet.value)
      && !visibleValues.has(facet.value)
    ) {
      visible.push(facet);
      visibleValues.add(facet.value);
    }
  }
  return visible;
}
