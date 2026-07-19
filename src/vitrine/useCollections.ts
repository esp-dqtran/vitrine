import { useCallback, useRef, useState } from 'react';
import type { ResearchCollection } from '../db.ts';
import { listCollections } from './researchApi.ts';

export function createCollectionsResource(
  loadCollections: () => Promise<ResearchCollection[]> = listCollections,
) {
  let value: ResearchCollection[] | null = null;
  let pending: Promise<ResearchCollection[]> | null = null;

  return {
    load(): Promise<ResearchCollection[]> {
      if (value !== null) return Promise.resolve(value);
      if (pending) return pending;
      pending = loadCollections()
        .then((items) => {
          value = items;
          return items;
        })
        .finally(() => {
          pending = null;
        });
      return pending;
    },
    replace(items: ResearchCollection[]) {
      value = items;
    },
  };
}

export function useCollections() {
  const resourceRef = useRef<ReturnType<typeof createCollectionsResource> | null>(null);
  if (!resourceRef.current) resourceRef.current = createCollectionsResource();
  const [collections, setCollectionsState] = useState<ResearchCollection[]>([]);
  const [loaded, setLoaded] = useState(false);

  const ensureCollections = useCallback(async () => {
    const items = await resourceRef.current!.load();
    setCollectionsState(items);
    setLoaded(true);
    return items;
  }, []);

  const setCollections = useCallback((items: ResearchCollection[]) => {
    resourceRef.current!.replace(items);
    setCollectionsState(items);
    setLoaded(true);
  }, []);

  return { collections, loaded, ensureCollections, setCollections };
}
