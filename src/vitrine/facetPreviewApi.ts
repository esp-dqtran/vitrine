import type { PublicFacetInput } from '../publicFacetPreview.ts';

export interface FacetPreview {
  kind: 'icon' | 'screen' | 'component' | 'flow';
  app: string;
  label: string;
  iconUrl: string | null;
  media: string[];
}

const previewPoolCache = new Map<string, Promise<FacetPreview[]>>();
const previousApp = new Map<string, string>();

const facetKey = (input: PublicFacetInput) =>
  `${input.platform}:${input.group}:${input.value}`;

const isPreview = (value: unknown): value is FacetPreview => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<FacetPreview>;
  const kind = candidate.kind;
  if (kind !== 'icon' && kind !== 'screen' && kind !== 'component' && kind !== 'flow') return false;
  if (typeof candidate.app !== 'string' || typeof candidate.label !== 'string') return false;
  if (candidate.iconUrl !== null && typeof candidate.iconUrl !== 'string') return false;
  if (!Array.isArray(candidate.media) || candidate.media.some((url) => typeof url !== 'string')) return false;
  return kind === 'icon' ? typeof candidate.iconUrl === 'string' : candidate.media.length > 0;
};

const parsePool = (value: unknown): FacetPreview[] => {
  if (!value || typeof value !== 'object') return [];
  const previews = (value as { previews?: unknown }).previews;
  if (
    !Array.isArray(previews)
    || previews.length > 6
    || previews.some((preview) => !isPreview(preview))
  ) return [];
  return previews;
};

export function clearFacetPreviewCache() {
  previewPoolCache.clear();
  previousApp.clear();
}

function fetchFacetPreviewPool(
  input: PublicFacetInput,
  fetcher: typeof fetch,
): Promise<FacetPreview[]> {
  const key = facetKey(input);
  const cached = previewPoolCache.get(key);
  if (cached) return cached;
  const query = new URLSearchParams({
    group: input.group,
    value: input.value,
    platform: input.platform,
  });
  const request = fetcher(`/api/apps/facet-preview?${query}`)
    .then(async (response) => {
      if (response.status === 404) return [];
      if (!response.ok) throw new Error(`Facet preview request failed: ${response.status}`);
      return parsePool(await response.json());
    })
    .catch((error) => {
      previewPoolCache.delete(key);
      throw error;
    });
  previewPoolCache.set(key, request);
  return request;
}

export async function fetchRandomFacetPreview(
  input: PublicFacetInput,
  fetcher: typeof fetch = fetch,
  random: () => number = Math.random,
): Promise<FacetPreview | null> {
  const key = facetKey(input);
  const pool = await fetchFacetPreviewPool(input, fetcher);
  if (pool.length === 0) return null;
  const previous = previousApp.get(key);
  const eligible = pool.length > 1
    ? pool.filter(({ app }) => app !== previous)
    : pool;
  const index = Math.min(
    eligible.length - 1,
    Math.max(0, Math.floor(random() * eligible.length)),
  );
  const selected = eligible[index] ?? null;
  if (selected) previousApp.set(key, selected.app);
  return selected;
}

export function fetchFacetPreview(
  input: PublicFacetInput,
  fetcher: typeof fetch = fetch,
): Promise<FacetPreview | null> {
  return fetchRandomFacetPreview(input, fetcher);
}
