import type { DiscoveryFacet } from "./discoveryTypes.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseFacet(value: unknown): DiscoveryFacet | null {
  if (!isRecord(value)
    || typeof value.group !== "string"
    || typeof value.value !== "string"
    || !Number.isFinite(value.count)) {
    return null;
  }
  return {
    group: value.group,
    value: value.value,
    count: Number(value.count),
    ...(typeof value.section === "string" ? { section: value.section } : {}),
    ...(typeof value.description === "string" ? { description: value.description } : {}),
    ...(Array.isArray(value.aliases) && value.aliases.every((alias) => typeof alias === "string")
      ? { aliases: value.aliases }
      : {}),
    ...(Number.isFinite(value.sectionPosition)
      ? { sectionPosition: Number(value.sectionPosition) }
      : {}),
    ...(Number.isFinite(value.position) ? { position: Number(value.position) } : {}),
  };
}

export async function loadDiscoveryFacets(
  path: string,
  signal?: AbortSignal,
): Promise<DiscoveryFacet[]> {
  const response = await fetch(path, { signal });
  if (!response.ok) throw new Error(`Discovery facets returned ${response.status}`);
  const body: unknown = await response.json();
  if (!isRecord(body) || !Array.isArray(body.facets)) {
    throw new Error("Discovery facets returned an invalid response");
  }
  const facets = body.facets.map(parseFacet);
  if (facets.some((facet) => facet === null)) {
    throw new Error("Discovery facets returned an invalid response");
  }
  return facets as DiscoveryFacet[];
}

export function appendFacetSearchParams(
  params: URLSearchParams,
  input: {
    group: string;
    query?: string;
    selected?: readonly string[];
  },
): void {
  params.set("group", input.group);
  if (input.query?.trim()) params.set("facet_query", input.query.trim());
  for (const selected of input.selected ?? []) params.append("selected", selected);
}
