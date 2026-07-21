import type {
  AdminUser,
  AdminUsersPage,
  FeatureUsageOverview,
  GrowthStats,
  DailySignupPoint,
  UsageRangeKey,
  UserFeatureUsage,
  UserFilter,
  ReferralCampaignMetrics,
} from './types.ts';

export interface GrowthResponse {
  stats: GrowthStats;
  dailySignups: DailySignupPoint[];
}

async function apiJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const body = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(body.error ?? `${input} returned ${response.status}`);
  return body as T;
}

export function fetchAdminUsersPage(input: {
  limit?: number;
  cursor?: string | null;
  query?: string;
  filter?: UserFilter;
} = {}): Promise<AdminUsersPage> {
  const params = new URLSearchParams();
  params.set('limit', String(input.limit ?? 30));
  if (input.cursor) params.set('cursor', input.cursor);
  if (input.query?.trim()) params.set('q', input.query.trim());
  params.set('filter', input.filter ?? 'all');
  return apiJson(`/api/users?${params}`);
}

export function fetchGrowth(): Promise<GrowthResponse> {
  return apiJson('/api/users/growth');
}

export function fetchFeatureUsage(range: UsageRangeKey): Promise<FeatureUsageOverview> {
  return apiJson(`/api/users/usage?range=${range}`);
}

export function fetchUserFeatureUsage(userId: number, range: UsageRangeKey): Promise<UserFeatureUsage> {
  return apiJson(`/api/users/${userId}/usage?range=${range}`);
}

export function setAdminUserActive(userId: number, active: boolean): Promise<AdminUser> {
  return apiJson(`/api/users/${userId}/active`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ active }),
  });
}

export function fetchReferralCampaignMetrics(): Promise<ReferralCampaignMetrics> {
  return apiJson('/api/admin/referrals/metrics');
}

async function postEmpty(path: string): Promise<void> {
  const response = await fetch(path, { method: 'POST' });
  if (response.ok) return;
  const body = await response.json().catch(() => ({})) as { error?: string };
  throw new Error(body.error ?? `${path} returned ${response.status}`);
}

export function revokeReferral(referralId: number): Promise<void> {
  return postEmpty(`/api/admin/referrals/${referralId}/revoke`);
}

export function revokeReferralReward(rewardId: number): Promise<void> {
  return postEmpty(`/api/admin/referral-rewards/${rewardId}/revoke`);
}

export function revokePromotionalEntitlement(entitlementId: number): Promise<void> {
  return postEmpty(`/api/admin/promotional-entitlements/${entitlementId}/revoke`);
}
