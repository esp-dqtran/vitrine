import type { PublicFacetInput } from '../publicFacetPreview.ts';

export interface FacetPreview {
  kind: 'icon' | 'screen' | 'component' | 'flow';
  app: string;
  label: string;
  iconUrl: string | null;
  media: string[];
}

const previewCache = new Map<string, Promise<FacetPreview | null>>();

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

export function clearFacetPreviewCache() {
  previewCache.clear();
}

export function fetchFacetPreview(
  input: PublicFacetInput,
  fetcher: typeof fetch = fetch,
): Promise<FacetPreview | null> {
  const query = new URLSearchParams({
    group: input.group,
    value: input.value,
    platform: input.platform,
  });
  const url = `/api/catalog/facet-preview?${query}`;
  const key = `${input.platform}:${input.group}:${input.value}`;
  const cached = previewCache.get(key);
  if (cached) return cached;

  const request = fetcher(url)
    .then(async (response) => {
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`Facet preview request failed: ${response.status}`);
      const body: unknown = await response.json();
      return isPreview(body) ? body : null;
    })
    .catch((error) => {
      previewCache.delete(key);
      throw error;
    });
  previewCache.set(key, request);
  return request;
}
