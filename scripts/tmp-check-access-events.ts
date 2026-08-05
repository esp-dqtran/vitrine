import { query, closePool } from "../src/db.ts";

async function main() {
  const total = await query(`SELECT COUNT(*)::int AS n FROM access_events`);
  console.log("total access_events rows:", total.rows[0].n);

  const byAction = await query(`
    SELECT action, COUNT(*)::int AS n, COUNT(DISTINCT app_slug)::int AS distinct_apps
    FROM access_events
    GROUP BY action
    ORDER BY n DESC
  `);
  console.log("by action:");
  for (const r of byAction.rows) console.log(" ", r.action, "count:", r.n, "distinct apps:", r.distinct_apps);

  const dateRange = await query(`SELECT MIN(created_at) AS earliest, MAX(created_at) AS latest FROM access_events`);
  console.log("date range:", dateRange.rows[0]);

  const topApps = await query(`
    SELECT app_slug, COUNT(*)::int AS n
    FROM access_events
    WHERE app_slug IS NOT NULL AND action IN ('preview_viewed', 'app-detail')
    GROUP BY app_slug
    ORDER BY n DESC
    LIMIT 10
  `);
  console.log("top apps by view events:", topApps.rows.length);
  for (const r of topApps.rows) console.log(" ", r.app_slug, r.n);

  await closePool();
}
main();
