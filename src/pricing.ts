export type Plan = "free" | "pro";
export type BillingInterval = "month" | "year";
export type SubscriptionStatus =
  | "incomplete"
  | "incomplete_expired"
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "paused";

export interface SubscriptionRecord {
  user_id: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  paddle_customer_id?: string | null;
  paddle_subscription_id?: string | null;
  paddle_price_id?: string | null;
  billing_interval: BillingInterval | null;
  status: SubscriptionStatus | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  grace_expires_at: string | null;
}

/** A Team subscription belongs to an organization, never an individual user. */
export interface OrganizationSubscriptionRecord {
  organization_id: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  paddle_customer_id?: string | null;
  paddle_subscription_id?: string | null;
  paddle_price_id?: string | null;
  seat_count: number;
  status: SubscriptionStatus | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  grace_expires_at: string | null;
}

// Paddle sends price IDs, never amounts, so the Pro list price lives here —
// the marketing page and the admin revenue panel must read the same numbers.
export const PRO_PRICE_CENTS: Record<BillingInterval, number> = { month: 899, year: 7999 };

// Team is intentionally annual-only at launch. The price is per editor; every
// current organization member can edit shared work, so each is a billable seat.
export const TEAM_EDITOR_PRICE_CENTS = 2900;
export const TEAM_MINIMUM_EDITORS = 3;

export function teamAnnualPriceCents(editors = TEAM_MINIMUM_EDITORS): number {
  const normalizedEditors = Math.max(TEAM_MINIMUM_EDITORS, Math.floor(editors));
  return TEAM_EDITOR_PRICE_CENTS * normalizedEditors * 12;
}

export interface RevenueSummary {
  mrrCents: number;
  arrCents: number;
  churnRate: number;
}

export function revenueSummary(input: {
  active_monthly: number;
  active_yearly: number;
  canceled_30d: number;
}): RevenueSummary {
  const mrrCents =
    input.active_monthly * PRO_PRICE_CENTS.month +
    Math.round((input.active_yearly * PRO_PRICE_CENTS.year) / 12);
  const churnBase = input.active_monthly + input.active_yearly + input.canceled_30d;
  return {
    mrrCents,
    arrCents: mrrCents * 12,
    churnRate: churnBase ? Math.round((input.canceled_30d / churnBase) * 1000) / 10 : 0,
  };
}

export function effectivePlan(
  subscription: Pick<SubscriptionRecord, "status" | "grace_expires_at"> | undefined,
  now = new Date(),
): Plan {
  if (subscription?.status === "active" || subscription?.status === "trialing") return "pro";
  if (
    subscription?.status === "past_due" &&
    subscription.grace_expires_at &&
    new Date(subscription.grace_expires_at) > now
  ) return "pro";
  return "free";
}

function anniversary(anchor: Date, year: number, month: number): Date {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(
    year,
    month,
    Math.min(anchor.getUTCDate(), lastDay),
    anchor.getUTCHours(),
    anchor.getUTCMinutes(),
    anchor.getUTCSeconds(),
  ));
}

export function exportWindow(anchor: Date, now = new Date()): { start: Date; end: Date } {
  let start = anniversary(anchor, now.getUTCFullYear(), now.getUTCMonth());
  if (start > now) start = anniversary(anchor, now.getUTCFullYear(), now.getUTCMonth() - 1);
  return {
    start,
    end: anniversary(anchor, start.getUTCFullYear(), start.getUTCMonth() + 1),
  };
}
