import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAppCatalogPage } from "../data/appCatalogApi";
import { catalogAppsToItems } from "../data/apps";

function appendUnique(current, next) {
  const seen = new Set(current.map((item) => item.id));
  return [...current, ...next.filter((item) => !seen.has(item.id))];
}

export function useAppCatalog({ catalogSessionKey = "guest", onGuestLimitReached } = {}) {
  const [initialItems, setInitialItems] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [canAutoLoadMore, setCanAutoLoadMore] = useState(false);
  const cursor = useRef(null);
  const requestGeneration = useRef(0);
  const loadingMore = useRef(false);
  const guestLimitBlocked = useRef(false);
  const guestLimitHandler = useRef(onGuestLimitReached);
  guestLimitHandler.current = onGuestLimitReached;

  useEffect(() => {
    const controller = new AbortController();
    const generation = ++requestGeneration.current;
    setLoading(true);
    setError(null);
    void fetchAppCatalogPage(null, controller.signal)
      .then((page) => {
        if (generation !== requestGeneration.current) return;
        const items = catalogAppsToItems(page.apps);
        cursor.current = page.nextCursor;
        guestLimitBlocked.current = !page.nextCursor && page.totalCount > items.length;
        setInitialItems(items);
        setAllItems(items);
        setCanAutoLoadMore(Boolean(page.nextCursor));
        setHasMore(Boolean(page.nextCursor) || Boolean(
          guestLimitBlocked.current && guestLimitHandler.current,
        ));
      })
      .catch((reason) => {
        if (reason.name !== "AbortError" && generation === requestGeneration.current) {
          setError(reason.message);
        }
      })
      .finally(() => {
        if (generation === requestGeneration.current) setLoading(false);
      });
    return () => {
      controller.abort();
      requestGeneration.current += 1;
    };
  }, [catalogSessionKey]);

  const loadNextPage = useCallback(async () => {
    if (loadingMore.current) return [];
    if (!cursor.current) {
      if (guestLimitBlocked.current) guestLimitHandler.current?.();
      return [];
    }
    loadingMore.current = true;
    try {
      const page = await fetchAppCatalogPage(cursor.current);
      const items = catalogAppsToItems(page.apps);
      cursor.current = page.nextCursor;
      guestLimitBlocked.current = false;
      setCanAutoLoadMore(Boolean(page.nextCursor));
      setHasMore(Boolean(page.nextCursor));
      setAllItems((current) => appendUnique(current, items));
      return items;
    } finally {
      loadingMore.current = false;
    }
  }, []);

  return {
    initialItems,
    allItems,
    loading,
    error,
    hasMore,
    canAutoLoadMore,
    loadNextPage,
  };
}
