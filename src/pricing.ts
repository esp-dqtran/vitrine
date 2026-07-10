export type Plan = "free" | "pro";
export type BillingInterval = "month" | "year";
export type SubscriptionStatus =
  | "incomplete"
  | "incomplete_expired"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "paused";

export interface SubscriptionRecord {
  user_id: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  billing_interval: BillingInterval | null;
  status: SubscriptionStatus | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  grace_expires_at: string | null;
}

export function effectivePlan(
  subscription: Pick<SubscriptionRecord, "status" | "grace_expires_at"> | undefined,
  now = new Date(),
): Plan {
  if (subscription?.status === "active") return "pro";
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
