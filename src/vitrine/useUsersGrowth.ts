import { useCallback, useEffect, useState } from 'react';
import type { AdminUser, DailySignupPoint, GrowthStats } from './types';

interface GrowthResponse {
  stats: GrowthStats;
  dailySignups: DailySignupPoint[];
}

export function useUsersGrowth() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [growth, setGrowth] = useState<GrowthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [usersRes, growthRes] = await Promise.all([fetch('/api/users'), fetch('/api/users/growth')]);
    if (!usersRes.ok) throw new Error(`/api/users returned ${usersRes.status}`);
    if (!growthRes.ok) throw new Error(`/api/users/growth returned ${growthRes.status}`);
    setUsers(await usersRes.json());
    setGrowth(await growthRes.json());
    setError(null);
  }, []);

  useEffect(() => {
    refresh().catch((cause: Error) => setError(cause.message));
  }, [refresh]);

  return { users, growth, loading: users === null && !error, error, refresh };
}
