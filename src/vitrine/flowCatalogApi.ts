import type { Platform } from '../platformFromUrl.ts';
import type { DesignFlow, EvidenceView } from '../designSystem.ts';

export interface FlowCatalogItem {
  category: string;
  title: string;
  count: number;
  preview: {
    appId: string;
    appName: string;
    appIconUrl: string | null;
    screenCount: number;
    flow: DesignFlow<EvidenceView>;
  };
}

export interface FlowCatalogPage {
  items: FlowCatalogItem[];
  nextCursor: string | null;
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export async function loadFlowCatalogPage(
  input: {
    platform: Platform;
    query?: string;
    cursor?: string;
    limit?: number;
    order?: 'grouped' | 'browse';
  },
  signal?: AbortSignal,
  fetcher: Fetcher = fetch,
): Promise<FlowCatalogPage> {
  const params = new URLSearchParams({
    platform: input.platform,
    limit: String(input.limit ?? 80),
  });
  if (input.query?.trim()) params.set('query', input.query.trim());
  if (input.cursor) params.set('cursor', input.cursor);
  if (input.order === 'browse') params.set('view', 'browse');
  const response = await fetcher(`/api/catalog/flows?${params.toString()}`, {
    signal,
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Flow catalog returned ${response.status}`);
  return response.json() as Promise<FlowCatalogPage>;
}
