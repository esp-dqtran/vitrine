import { resolveAppIcon, type ResolvedAppIcon } from "../src/appIconResolver.ts";
import { storeSiteIcon } from "../src/appIconStore.ts";
import { closePool, query } from "../src/db.ts";
import { createObjectStore, objectStoreConfigFromEnvironment } from "../src/objectStoreConfig.ts";
import { runPool } from "../src/pool.ts";

interface SiteIconRow {
  id: string;
  name: string;
  source_url: string;
  logo_url: string | null;
}

type Result =
  | { id: string; site: string; status: "resolved"; previousUrl: string | null; icon: ResolvedAppIcon }
  | { id: string; site: string; status: "unresolved" | "failed"; reason: string };

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
// Anything without an icon_object_key is still hotlinking a third party.
const source = await query<SiteIconRow>(
  `SELECT id::text, name, source_url, logo_url
   FROM sites
   WHERE source_url IS NOT NULL
     AND ($1::boolean OR icon_object_key IS NULL)
   ORDER BY id
   ${limit === null ? "" : "LIMIT $2"}`,
  limit === null ? [refresh] : [refresh, limit],
);
const objectStore = createObjectStore(objectStoreConfigFromEnvironment(process.env));
const results: Result[] = [];
let completed = 0;

try {
  const lanes = Array.from({ length: Math.min(concurrency, Math.max(source.rows.length, 1)) }, (_, index) => index);
  await runPool(source.rows, lanes, async (_lane, row) => {
    try {
      const icon = await resolveAppIcon(row.source_url, row.name);
      if (!icon) {
        results.push({ id: row.id, site: row.name, status: "unresolved", reason: "No valid square icon was found" });
      } else {
        // Store the bytes rather than the source URL: these hotlinks 404, serve
        // undecodable formats, and are sized for whatever the site felt like.
        const storedPath = apply
          ? await storeSiteIcon({ objectStore }, Number(row.id), icon.url)
          : null;
        results.push({
          id: row.id,
          site: row.name,
          status: "resolved",
          previousUrl: row.logo_url,
          icon: storedPath ? { ...icon, url: storedPath } : icon,
        });
      }
    } catch (error) {
      results.push({
        id: row.id,
        site: row.name,
        status: "failed",
        reason: error instanceof Error ? error.message : "Icon resolution failed",
      });
    }
    completed += 1;
    if (completed % 25 === 0 || completed === source.rows.length) {
      console.error(`Site icon ${apply ? "backfill" : "audit"} ${completed}/${source.rows.length}`);
    }
  });
} finally {
  await closePool();
}

const resolved = results.filter((result): result is Extract<Result, { status: "resolved" }> => result.status === "resolved");
const unresolved = results.filter((result): result is Exclude<Result, { status: "resolved" }> => result.status !== "resolved");
const measured = resolved.filter(({ icon }) => icon.width && icon.height);
const sourceCounts = Object.fromEntries([...new Set(resolved.map(({ icon }) => icon.source))].sort().map(
  (sourceName) => [sourceName, resolved.filter(({ icon }) => icon.source === sourceName).length],
));

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
  examples: resolved.slice(0, 20).map(({ id, site, icon }) => ({ id, site, ...icon })),
  unresolvedExamples: unresolved.slice(0, 50),
}, null, 2));
