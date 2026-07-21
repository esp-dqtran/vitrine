import { useCallback, useEffect, useRef, useState } from 'react';
import type { FeatureUsageOverview, ReferralCampaignMetrics, UsageRangeKey } from './types.ts';
import { fetchFeatureUsage, fetchGrowth, fetchReferralCampaignMetrics, type GrowthResponse } from './usersApi.ts';

export function useUsersInsights(range: UsageRangeKey) {
  const [growth, setGrowth] = useState<GrowthResponse | null>(null);
  const [usage, setUsage] = useState<FeatureUsageOverview | null>(null);
  const [referrals, setReferrals] = useState<ReferralCampaignMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    try {
      const [nextGrowth, nextUsage, nextReferrals] = await Promise.all([
        fetchGrowth(),
        fetchFeatureUsage(range),
        fetchReferralCampaignMetrics(),
      ]);
      if (request !== generation.current) return;
      setGrowth(nextGrowth);
      setUsage(nextUsage);
      setReferrals(nextReferrals);
      setError(null);
    } catch (cause) {
      if (request === generation.current) setError((cause as Error).message);
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [range]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { growth, usage, referrals, loading, error, refresh };
}
