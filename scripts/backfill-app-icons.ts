import { resolveAppIcon, type ResolvedAppIcon } from "../src/appIconResolver.ts";
import { closePool, query } from "../src/db.ts";
import { runPool } from "../src/pool.ts";

interface AppIconRow {
  id: number;
  name: string;
  display_name: string | null;
  website_url: string;
  icon_url: string | null;
}

type Result =
  | { id: number; app: string; status: "resolved"; previousUrl: string | null; icon: ResolvedAppIcon }
  | { id: number; app: string; status: "unresolved" | "failed"; reason: string };

const hasFlag = (flag: string): boolean => process.argv.includes(flag);

function positiveArgument(flag: string, fallback: number): number {
  const index = process.argv.indexOf(flag);
  if (index < 0) return fallback;
  const value = Number(process.argv[index + 1]);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${flag} must be a positive integer`);
  return value;
}

const apply = hasFlag("--apply");
const refresh = hasFlag("--refresh");
const concurrency = positiveArgument("--concurrency", 8);
const limit = hasFlag("--limit") ? positiveArgument("--limit", 1) : null;
const source = await query<AppIconRow>(
  `SELECT id, name, display_name, website_url, icon_url
   FROM apps
   WHERE website_url IS NOT NULL
     AND ($1::boolean OR icon_url IS NULL OR lower(icon_url) LIKE '%mobbin%' OR lower(icon_url) LIKE '%bytescale%')
   ORDER BY id
   ${limit === null ? "" : "LIMIT $2"}`,
  limit === null ? [refresh] : [refresh, limit],
);
const results: Result[] = [];
let completed = 0;

try {
  const lanes = Array.from({ length: Math.min(concurrency, Math.max(source.rows.length, 1)) }, (_, index) => index);
  await runPool(source.rows, lanes, async (_lane, row) => {
    const app = row.display_name ?? row.name;
    try {
      const icon = await resolveAppIcon(row.website_url, app);
      if (!icon) {
        results.push({ id: row.id, app, status: "unresolved", reason: "No valid square icon was found" });
      } else {
        results.push({ id: row.id, app, status: "resolved", previousUrl: row.icon_url, icon });
        if (apply) {
          await query(
            `UPDATE apps SET icon_url = $1
             WHERE id = $2
               AND ($3::boolean OR icon_url IS NULL OR lower(icon_url) LIKE '%mobbin%' OR lower(icon_url) LIKE '%bytescale%')`,
            [icon.url, row.id, refresh],
          );
        }
      }
    } catch (error) {
      results.push({
        id: row.id,
        app,
        status: "failed",
        reason: error instanceof Error ? error.message : "Icon resolution failed",
      });
    }
    completed += 1;
    if (completed % 25 === 0 || completed === source.rows.length) {
      console.error(`App icon ${apply ? "backfill" : "audit"} ${completed}/${source.rows.length}`);
    }
  });
} finally {
  await closePool();
}

const resolved = results.filter((result): result is Extract<Result, { status: "resolved" }> => result.status === "resolved");
const unresolved = results.filter((result): result is Exclude<Result, { status: "resolved" }> => result.status !== "resolved");
const sourceCounts = Object.fromEntries([...new Set(resolved.map(({ icon }) => icon.source))].sort().map(
  (sourceName) => [sourceName, resolved.filter(({ icon }) => icon.source === sourceName).length],
));
const measured = resolved.filter(({ icon }) => icon.width && icon.height);

console.log(JSON.stringify({
  mode: apply ? "apply" : "dry-run",
  examined: source.rows.length,
  resolved: resolved.length,
  applied: apply ? resolved.length : 0,
  unresolved: unresolved.length,
  coveragePercent: source.rows.length ? Number((resolved.length / source.rows.length * 100).toFixed(1)) : 100,
  sources: sourceCounts,
  quality: {
    measured: measured.length,
    atLeast128: measured.filter(({ icon }) => Math.min(icon.width!, icon.height!) >= 128).length,
    atLeast256: measured.filter(({ icon }) => Math.min(icon.width!, icon.height!) >= 256).length,
    atLeast512: measured.filter(({ icon }) => Math.min(icon.width!, icon.height!) >= 512).length,
  },
  examples: resolved.slice(0, 20).map(({ id, app, icon }) => ({ id, app, ...icon })),
  unresolvedExamples: unresolved.slice(0, 50),
}, null, 2));
