import { query } from "./db.ts";

export const FEATURE_LABELS = {
  library: "App library",
  search: "Search",
  collections: "Collections",
  exports: "Exports",
  research: "Research projects",
  design_systems: "Design systems",
  flows: "Flows",
  ai_analysis: "AI analysis",
  feature_documents: "Feature documents",
} as const;

export type FeatureKey = keyof typeof FEATURE_LABELS;
export type UsageRangeKey = "7d" | "30d" | "90d";

export function isFeatureKey(value: unknown): value is FeatureKey {
  return typeof value === "string" && Object.hasOwn(FEATURE_LABELS, value);
}

export function parseUsageRange(value: unknown): { key: UsageRangeKey; days: number } | undefined {
  if (value === "7d") return { key: value, days: 7 };
  if (value === "30d" || value === undefined) return { key: "30d", days: 30 };
  if (value === "90d") return { key: value, days: 90 };
  return undefined;
}

export function featureKeyForLegacyAction(action: string): FeatureKey | undefined {
  if (action.startsWith("export-")) return "exports";
  if (action === "app-detail") return "library";
  if (action.startsWith("research_project_")) return "research";
  return undefined;
}

export interface FeatureUsageRow {
  key: FeatureKey;
  label: string;
  uses: number;
  uniqueUsers: number;
  share: number;
}

export interface FeatureUsageOverview {
  summary: { totalEvents: number; uniqueUsers: number; usedFeatures: number };
  features: FeatureUsageRow[];
  daily: Array<{ day: string; uses: number }>;
}

export interface UserFeatureUsage {
  summary: { totalEvents: number; lastActiveAt: string | null };
  features: FeatureUsageRow[];
  recentEvents: Array<{
    id: number;
    featureKey: FeatureKey;
    featureLabel: string;
    action: string;
    outcome: string;
    appSlug: string | null;
    createdAt: string;
  }>;
}

type UsageRange = { key: UsageRangeKey; days: number };

const normalizedFeatureSql = `COALESCE(
  ae.feature_key,
  CASE
    WHEN ae.action LIKE 'export-%' THEN 'exports'
    WHEN ae.action = 'app-detail' THEN 'library'
    WHEN ae.action LIKE 'research_project_%' THEN 'research'
    ELSE NULL
  END
)`;

const countedOutcomesSql = "('success', 'created', 'accepted', 'completed', 'allowed')";

function share(uses: number, total: number): number {
  return total > 0 ? Number(((uses / total) * 100).toFixed(1)) : 0;
}

function timestamp(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

export async function getFeatureUsageOverview(range: UsageRange): Promise<FeatureUsageOverview> {
  const memberEvents = `
    SELECT ae.user_id, ae.created_at, ae.volume, ${normalizedFeatureSql} AS feature_key
    FROM access_events ae
    JOIN users u ON u.id = ae.user_id
    WHERE u.role = 'user'
      AND ae.outcome IN ${countedOutcomesSql}
      AND ae.created_at >= now() - ($1::int * interval '1 day')`;
  const [summaryResult, featureResult, dailyResult] = await Promise.all([
    query<{ total_events: number; unique_users: number; used_features: number }>(
      `WITH normalized AS (${memberEvents})
       SELECT coalesce(sum(volume), 0)::int AS total_events,
              count(DISTINCT user_id)::int AS unique_users,
              count(DISTINCT feature_key)::int AS used_features
       FROM normalized WHERE feature_key IS NOT NULL`,
      [range.days],
    ),
    query<{ key: string; uses: number; unique_users: number }>(
      `WITH normalized AS (${memberEvents})
       SELECT feature_key AS key, sum(volume)::int AS uses,
              count(DISTINCT user_id)::int AS unique_users
       FROM normalized WHERE feature_key IS NOT NULL
       GROUP BY feature_key ORDER BY uses DESC, feature_key`,
      [range.days],
    ),
    query<{ day: string; uses: number }>(
      `WITH normalized AS (${memberEvents}),
       days AS (
         SELECT generate_series(
           date_trunc('day', now()) - (($1::int - 1) * interval '1 day'),
           date_trunc('day', now()), interval '1 day'
         ) AS day
       )
       SELECT to_char(days.day, 'YYYY-MM-DD') AS day,
              coalesce(sum(normalized.volume), 0)::int AS uses
       FROM days
       LEFT JOIN normalized ON date_trunc('day', normalized.created_at) = days.day
         AND normalized.feature_key IS NOT NULL
       GROUP BY days.day ORDER BY days.day`,
      [range.days],
    ),
  ]);
  const summaryRow = summaryResult.rows[0] ?? { total_events: 0, unique_users: 0, used_features: 0 };
  const total = summaryRow.total_events;
  const features = featureResult.rows.flatMap((row): FeatureUsageRow[] => {
    if (!isFeatureKey(row.key)) return [];
    return [{
      key: row.key,
      label: FEATURE_LABELS[row.key],
      uses: row.uses,
      uniqueUsers: row.unique_users,
      share: share(row.uses, total),
    }];
  });
  return {
    summary: {
      totalEvents: total,
      uniqueUsers: summaryRow.unique_users,
      usedFeatures: summaryRow.used_features,
    },
    features,
    daily: dailyResult.rows,
  };
}

export async function getUserFeatureUsage(userId: number, range: UsageRange): Promise<UserFeatureUsage | undefined> {
  const exists = await query("SELECT 1 FROM users WHERE id = $1", [userId]);
  if (!exists.rowCount) return undefined;
  const userEvents = `
    SELECT ae.id, ae.user_id, ae.created_at, ae.volume, ae.action, ae.outcome,
           ae.app_slug, ${normalizedFeatureSql} AS feature_key
    FROM access_events ae
    WHERE ae.user_id = $2
      AND ae.outcome IN ${countedOutcomesSql}
      AND ae.created_at >= now() - ($1::int * interval '1 day')`;
  const [summaryResult, featureResult, recentResult] = await Promise.all([
    query<{ total_events: number; last_active_at: unknown }>(
      `WITH normalized AS (${userEvents})
       SELECT coalesce(sum(volume), 0)::int AS total_events,
              max(created_at) AS last_active_at
       FROM normalized WHERE feature_key IS NOT NULL`,
      [range.days, userId],
    ),
    query<{ key: string; uses: number; unique_users: number }>(
      `WITH normalized AS (${userEvents})
       SELECT feature_key AS key, sum(volume)::int AS uses,
              count(DISTINCT user_id)::int AS unique_users
       FROM normalized WHERE feature_key IS NOT NULL
       GROUP BY feature_key ORDER BY uses DESC, feature_key`,
      [range.days, userId],
    ),
    query<{ id: string | number; feature_key: string; action: string; outcome: string; app_slug: string | null; created_at: unknown }>(
      `WITH normalized AS (${userEvents})
       SELECT id, feature_key, action, outcome, app_slug, created_at
       FROM normalized WHERE feature_key IS NOT NULL
       ORDER BY created_at DESC, id DESC LIMIT 20`,
      [range.days, userId],
    ),
  ]);
  const summaryRow = summaryResult.rows[0] ?? { total_events: 0, last_active_at: null };
  const total = summaryRow.total_events;
  const features = featureResult.rows.flatMap((row): FeatureUsageRow[] => {
    if (!isFeatureKey(row.key)) return [];
    return [{
      key: row.key,
      label: FEATURE_LABELS[row.key],
      uses: row.uses,
      uniqueUsers: row.unique_users,
      share: share(row.uses, total),
    }];
  });
  const recentEvents = recentResult.rows.flatMap((row): UserFeatureUsage["recentEvents"] => {
    if (!isFeatureKey(row.feature_key)) return [];
    return [{
      id: Number(row.id),
      featureKey: row.feature_key,
      featureLabel: FEATURE_LABELS[row.feature_key],
      action: row.action,
      outcome: row.outcome,
      appSlug: row.app_slug,
      createdAt: timestamp(row.created_at) ?? "",
    }];
  });
  return {
    summary: { totalEvents: total, lastActiveAt: timestamp(summaryRow.last_active_at) },
    features,
    recentEvents,
  };
}
