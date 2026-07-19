import { useCallback, useEffect, useRef, useState } from 'react';
import type { FeatureUsageOverview, UsageRangeKey } from './types.ts';
import { fetchFeatureUsage, fetchGrowth, type GrowthResponse } from './usersApi.ts';

export function useUsersInsights(range: UsageRangeKey) {
  const [growth, setGrowth] = useState<GrowthResponse | null>(null);
  const [usage, setUsage] = useState<FeatureUsageOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    try {
      const [nextGrowth, nextUsage] = await Promise.all([fetchGrowth(), fetchFeatureUsage(range)]);
      if (request !== generation.current) return;
      setGrowth(nextGrowth);
      setUsage(nextUsage);
      setError(null);
    } catch (cause) {
      if (request === generation.current) setError((cause as Error).message);
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [range]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { growth, usage, loading, error, refresh };
}
