import type { Platform } from '../platformFromUrl.ts';
import type { DesignFlow, EvidenceView } from '../designSystem.ts';
import type { DiscoveryFacet } from './discoveryTypes.ts';
import {
  appendFacetSearchParams,
  loadDiscoveryFacets,
} from './discoveryFacetsApi.ts';

export interface FlowCatalogItem {
  category: string;
  title: string;
  count: number;
  preview: {
    appId: string;
    appName: string;
    appIconUrl: string | null;
    version: number;
    sourceFlowId: string;
    screenCount: number;
    flow: DesignFlow<EvidenceView>;
  };
}

export interface FlowCatalogPage {
  items: FlowCatalogItem[];
  nextCursor: string | null;
  totalCount: number;
  facets: DiscoveryFacet[];
}

export function flowCatalogItemKey({
  preview,
  title,
}: FlowCatalogItem): string {
  return `${preview.appId}:${preview.version}:${preview.sourceFlowId}:${title}`;
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

function invalid(field: string): never {
  throw new Error(`invalid Flow catalog response: ${field}`);
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid(field);
  return value as Record<string, unknown>;
}

function exact(
  value: Record<string, unknown>,
  keys: readonly string[],
  field: string,
): void {
  if (Object.keys(value).sort().join('\0') !== [...keys].sort().join('\0')) invalid(field);
}

function text(value: unknown, field: string, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0)) return invalid(field);
  return value;
}

function integer(value: unknown, field: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || Number(value) < minimum) return invalid(field);
  return Number(value);
}

function evidence(value: unknown, field: string): EvidenceView {
  const item = record(value, field);
  exact(item, ['description', 'imageId', 'imageUrl', 'thumbnailUrl'], field);
  if (item.description !== null && typeof item.description !== 'string') invalid(`${field}.description`);
  return {
    imageId: integer(item.imageId, `${field}.imageId`, 1),
    imageUrl: text(item.imageUrl, `${field}.imageUrl`),
    thumbnailUrl: text(item.thumbnailUrl, `${field}.thumbnailUrl`),
    description: item.description as string | null,
  };
}

function step(value: unknown, field: string): DesignFlow<EvidenceView>['steps'][number] {
  const item = record(value, field);
  exact(item, ['evidence', 'label'], field);
  if (!Array.isArray(item.evidence)) invalid(`${field}.evidence`);
  return {
    label: text(item.label, `${field}.label`),
    evidence: item.evidence.map((entry, index) => evidence(entry, `${field}.evidence[${index}]`)),
  };
}

function flow(value: unknown, field: string): DesignFlow<EvidenceView> {
  const item = record(value, field);
  exact(item, ['category', 'description', 'id', 'steps', 'tags', 'title'], field);
  if (!Array.isArray(item.tags)
    || !item.tags.every((tag) => typeof tag === 'string')
    || !Array.isArray(item.steps)) {
    invalid(field);
  }
  return {
    id: text(item.id, `${field}.id`),
    title: text(item.title, `${field}.title`),
    category: text(item.category, `${field}.category`),
    description: text(item.description, `${field}.description`, true),
    tags: item.tags as string[],
    steps: item.steps.map((entry, index) => step(entry, `${field}.steps[${index}]`)),
  };
}

function catalogItem(value: unknown, field: string): FlowCatalogItem {
  const item = record(value, field);
  exact(item, ['category', 'count', 'preview', 'title'], field);
  const preview = record(item.preview, `${field}.preview`);
  exact(preview, [
    'appIconUrl',
    'appId',
    'appName',
    'flow',
    'screenCount',
    'sourceFlowId',
    'version',
  ], `${field}.preview`);
  if (preview.appIconUrl !== null && typeof preview.appIconUrl !== 'string') {
    invalid(`${field}.preview.appIconUrl`);
  }
  return {
    category: text(item.category, `${field}.category`),
    title: text(item.title, `${field}.title`),
    count: integer(item.count, `${field}.count`, 1),
    preview: {
      appId: text(preview.appId, `${field}.preview.appId`),
      appName: text(preview.appName, `${field}.preview.appName`),
      appIconUrl: preview.appIconUrl as string | null,
      version: integer(preview.version, `${field}.preview.version`, 1),
      sourceFlowId: text(preview.sourceFlowId, `${field}.preview.sourceFlowId`),
      screenCount: integer(preview.screenCount, `${field}.preview.screenCount`),
      flow: flow(preview.flow, `${field}.preview.flow`),
    },
  };
}

function facet(value: unknown, field: string): DiscoveryFacet {
  const item = record(value, field);
  exact(item, ['count', 'group', 'value'], field);
  if (item.group !== 'flowGroups') invalid(`${field}.group`);
  return {
    group: 'flowGroups',
    value: text(item.value, `${field}.value`),
    count: integer(item.count, `${field}.count`),
  };
}

export function parseFlowCatalogPage(value: unknown): FlowCatalogPage {
  const page = record(value, 'envelope');
  exact(page, ['facets', 'items', 'nextCursor', 'totalCount'], 'envelope');
  if (!Array.isArray(page.items) || !Array.isArray(page.facets)) invalid('envelope');
  if (page.nextCursor !== null && typeof page.nextCursor !== 'string') {
    invalid('nextCursor');
  }
  return {
    items: page.items.map((entry, index) => catalogItem(entry, `items[${index}]`)),
    nextCursor: page.nextCursor as string | null,
    totalCount: integer(page.totalCount, 'totalCount'),
    facets: page.facets.map((entry, index) => facet(entry, `facets[${index}]`)),
  };
}

export async function loadFlowCatalogPage(
  input: {
    platform: Platform;
    query?: string;
    cursor?: string;
    limit?: number;
    order?: 'grouped' | 'browse';
    flowGroups?: readonly string[];
  },
  signal?: AbortSignal,
  fetcher: Fetcher = fetch,
): Promise<FlowCatalogPage> {
  const params = new URLSearchParams({
    platform: input.platform,
    limit: String(input.limit ?? 80),
    facets: 'summary',
  });
  if (input.query?.trim()) params.set('query', input.query.trim());
  params.set('sort', input.order === 'grouped' ? 'grouped' : 'popular');
  for (const group of input.flowGroups ?? []) {
    params.append('filter', `flowGroups.${group}`);
  }
  if (input.cursor) params.set('cursor', input.cursor);
  const response = await fetcher(`/api/catalog/flows?${params.toString()}`, {
    signal,
  });
  if (!response.ok) throw new Error(`Flow catalog returned ${response.status}`);
  return parseFlowCatalogPage(await response.json());
}

export function loadFlowCatalogFacets(
  input: {
    platform: Platform;
    query?: string;
    flowGroups?: readonly string[];
  },
  query: string,
  selected: readonly string[],
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ platform: input.platform });
  if (input.query?.trim()) params.set('query', input.query.trim());
  for (const group of input.flowGroups ?? []) {
    params.append('filter', `flowGroups.${group}`);
  }
  appendFacetSearchParams(params, {
    group: 'flowGroups',
    query,
    selected,
  });
  return loadDiscoveryFacets(`/api/catalog/flow-groups?${params.toString()}`, signal);
}
