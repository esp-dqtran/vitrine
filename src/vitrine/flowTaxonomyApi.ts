import { apiFetch } from './apiFetch.ts';

export interface FlowTaxonomyType {
  id: number;
  slug: string;
  name: string;
  position: number;
}

export interface FlowTaxonomyCategory {
  id: number;
  slug: string;
  name: string;
  position: number;
  approvedFlowCount: number;
  types: FlowTaxonomyType[];
}

function invalid(): never {
  throw new Error('invalid Flow taxonomy response');
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}

function taxonomyType(value: unknown): FlowTaxonomyType {
  const item = record(value);
  if (Object.keys(item).sort().join('\0') !== ['id', 'name', 'position', 'slug'].join('\0')
    || !Number.isSafeInteger(item.id)
    || !Number.isSafeInteger(item.position)
    || typeof item.slug !== 'string'
    || typeof item.name !== 'string') invalid();
  return { id: Number(item.id), slug: item.slug, name: item.name, position: Number(item.position) };
}

function category(value: unknown): FlowTaxonomyCategory {
  const item = record(value);
  if (Object.keys(item).sort().join('\0')
    !== ['approvedFlowCount', 'id', 'name', 'position', 'slug', 'types'].join('\0')
    || !Number.isSafeInteger(item.id)
    || !Number.isSafeInteger(item.position)
    || !Number.isSafeInteger(item.approvedFlowCount)
    || typeof item.slug !== 'string'
    || typeof item.name !== 'string'
    || !Array.isArray(item.types)) invalid();
  return {
    id: Number(item.id),
    slug: item.slug,
    name: item.name,
    position: Number(item.position),
    approvedFlowCount: Number(item.approvedFlowCount),
    types: item.types.map(taxonomyType),
  };
}

export async function loadFlowTaxonomy(signal?: AbortSignal): Promise<FlowTaxonomyCategory[]> {
  const response = await apiFetch('/api/flow-taxonomy', { signal });
  if (!response.ok) throw new Error(`Flow taxonomy returned ${response.status}`);
  const payload = record(await response.json());
  if (Object.keys(payload).sort().join('\0') !== 'categories' || !Array.isArray(payload.categories)) {
    invalid();
  }
  return payload.categories.map(category);
}
