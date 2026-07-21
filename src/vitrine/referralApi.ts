type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface ReferralSummaryView {
  campaign: { id: string; active: boolean; endsAt: string };
  referralCount: number;
  activatedCount: number;
  earnedCount: number;
  availableMonths: number;
  referrals: Array<{ id: string; state: "joined" | "active" | "rewarded" }>;
}

async function jsonOrError<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Referral request returned ${response.status}`);
  return body as T;
}

export async function validateReferral(
  token: string,
  visitor: string,
  fetcher: Fetcher = fetch,
): Promise<boolean> {
  const query = new URLSearchParams({ token, visitor });
  const result = await fetcher(`/api/referrals/validate?${query}`).then(jsonOrError<{ valid: boolean }>);
  return result.valid;
}

export function createReferralLink(fetcher: Fetcher = fetch): Promise<{ url: string }> {
  return fetcher("/api/referrals/link", { method: "POST" }).then(jsonOrError<{ url: string }>);
}

export function loadReferralSummary(fetcher: Fetcher = fetch): Promise<ReferralSummaryView> {
  return fetcher("/api/referrals/summary").then(jsonOrError<ReferralSummaryView>);
}

export function activateProMonth(fetcher: Fetcher = fetch): Promise<{
  status: "activated";
  expiresAt: string;
  availableMonths: number;
}> {
  return fetcher("/api/referrals/rewards/activate", { method: "POST" }).then(jsonOrError<{
    status: "activated";
    expiresAt: string;
    availableMonths: number;
  }>);
}
