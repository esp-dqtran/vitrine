import { query } from "./db.ts";

export interface GrowthStats {
  total_users: number;
  new_users_7d: number;
  active_subscribers: number;
  dau: number;
  wau: number;
  total_free_unlocks: number;
  active_monthly: number;
  active_yearly: number;
  canceled_30d: number;
}

// Every count excludes role='admin' — the one or two seeded admin accounts would
// otherwise skew "total users" and conversion rate at this early stage.
export async function getGrowthStats(): Promise<GrowthStats> {
  const result = await query<GrowthStats>(
    `SELECT
       (SELECT count(*)::int FROM users WHERE role = 'user') AS total_users,
       (SELECT count(*)::int FROM users
          WHERE role = 'user' AND created_at >= now() - interval '7 days') AS new_users_7d,
       (SELECT count(*)::int FROM subscriptions s JOIN users u ON u.id = s.user_id
          WHERE u.role = 'user' AND s.status = 'active') AS active_subscribers,
       (SELECT count(DISTINCT ae.user_id)::int FROM access_events ae JOIN users u ON u.id = ae.user_id
          WHERE u.role = 'user' AND ae.created_at >= now() - interval '1 day') AS dau,
       (SELECT count(DISTINCT ae.user_id)::int FROM access_events ae JOIN users u ON u.id = ae.user_id
          WHERE u.role = 'user' AND ae.created_at >= now() - interval '7 days') AS wau,
       (SELECT count(*)::int FROM free_app_unlocks f JOIN users u ON u.id = f.user_id
          WHERE u.role = 'user') AS total_free_unlocks,
       (SELECT count(*)::int FROM subscriptions s JOIN users u ON u.id = s.user_id
          WHERE u.role = 'user' AND s.status = 'active' AND s.billing_interval = 'month') AS active_monthly,
       (SELECT count(*)::int FROM subscriptions s JOIN users u ON u.id = s.user_id
          WHERE u.role = 'user' AND s.status = 'active' AND s.billing_interval = 'year') AS active_yearly,
       -- ponytail: subscriptions keeps one row per user, overwritten in place, so this is
       -- "cancellations still on record from the last 30d" off updated_at — not cohort churn.
       -- Add a subscription_events history table if real cohort/net-revenue churn is needed.
       (SELECT count(*)::int FROM subscriptions s JOIN users u ON u.id = s.user_id
          WHERE u.role = 'user' AND s.status = 'canceled'
            AND s.updated_at >= now() - interval '30 days') AS canceled_30d`
  );
  return result.rows[0];
}

export interface DailySignupPoint {
  day: string;
  signups: number;
}

export async function getDailySignups(): Promise<DailySignupPoint[]> {
  const result = await query<DailySignupPoint>(
    `SELECT to_char(d, 'YYYY-MM-DD') AS day, coalesce(c.count, 0)::int AS signups
     FROM generate_series(
       date_trunc('day', now()) - interval '29 days',
       date_trunc('day', now()),
       interval '1 day'
     ) AS d
     LEFT JOIN (
       SELECT date_trunc('day', created_at) AS day, count(*)::int AS count
       FROM users
       WHERE role = 'user' AND created_at >= date_trunc('day', now()) - interval '29 days'
       GROUP BY 1
     ) c ON c.day = d
     ORDER BY d`
  );
  return result.rows;
}
