import { useEffect, useState } from 'react';
import type { CatalogSearchResult } from '../catalogResearch.ts';
import type { Platform } from '../platformFromUrl.ts';
import { searchCatalog } from './researchApi.ts';

interface FlowSearchInput {
  enabled: boolean;
  query: string;
  platform: Platform;
  appCategory?: string;
  flowTag?: string;
}

/**
 * The Flow palette keeps browsing available to everyone, while rich content
 * search uses the existing Pro Typesense route. Abort and debounce on every
 * filter change so stale result sets can never replace the current query.
 */
export function useFlowSearch({
  enabled,
  query,
  platform,
  appCategory,
  flowTag,
}: FlowSearchInput) {
  const [result, setResult] = useState<CatalogSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setResult(null);
    setError('');
    if (!enabled) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      void searchCatalog(query, {
        kind: 'flow',
        platform,
        ...(appCategory ? { appCategory } : {}),
        ...(flowTag ? { flowTag } : {}),
      }, controller.signal)
        .then((next) => {
          if (!controller.signal.aborted) setResult(next);
        })
        .catch((caught: Error) => {
          if (!controller.signal.aborted && caught.name !== 'AbortError') setError(caught.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, query.trim() ? 160 : 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [appCategory, enabled, flowTag, platform, query]);

  return { result, loading, error };
}
