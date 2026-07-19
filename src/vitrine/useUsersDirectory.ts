import { useCallback, useEffect, useRef, useState } from 'react';
import type { AdminUser, UserFilter } from './types.ts';
import { fetchAdminUsersPage } from './usersApi.ts';
import { mergeUserPages } from './usersDirectoryModel.ts';

export function useUsersDirectory(query: string, filter: UserFilter) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);

  const loadFirstPage = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const page = await fetchAdminUsersPage({ query, filter });
      if (request !== generation.current) return;
      setUsers(page.users);
      setTotal(page.total);
      setNextCursor(page.nextCursor);
    } catch (cause) {
      if (request === generation.current) setError((cause as Error).message);
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [filter, query]);

  useEffect(() => {
    generation.current += 1;
    const timer = window.setTimeout(() => { void loadFirstPage(); }, 250);
    return () => window.clearTimeout(timer);
  }, [loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    const request = generation.current;
    setLoadingMore(true);
    try {
      const page = await fetchAdminUsersPage({ cursor: nextCursor, query, filter });
      if (request !== generation.current) return;
      setUsers((current) => mergeUserPages(current, page.users));
      setTotal(page.total);
      setNextCursor(page.nextCursor);
    } catch (cause) {
      if (request === generation.current) setError((cause as Error).message);
    } finally {
      if (request === generation.current) setLoadingMore(false);
    }
  }, [filter, loadingMore, nextCursor, query]);

  const updateUser = useCallback((updated: AdminUser) => {
    setUsers((current) => current.map((user) => user.id === updated.id ? updated : user));
  }, []);

  return {
    users,
    total,
    hasMore: Boolean(nextCursor),
    loading,
    loadingMore,
    error,
    loadMore,
    refresh: loadFirstPage,
    updateUser,
  };
}
