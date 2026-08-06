import { pathToFileURL } from "node:url";
import { canonicalMobbinSitesUrl } from "../src/sites.ts";

export interface FailedSiteJobRow {
  id: number;
  url: string | null;
}

export function selectLatestFailedSiteJobs(
  rows: FailedSiteJobRow[],
  readyUrls: ReadonlySet<string> = new Set(),
): Array<{ id: number; url: string }> {
  const latest = new Map<string, number>();
  for (const row of rows) {
    if (!Number.isSafeInteger(row.id) || row.id <= 0 || typeof row.url !== "string") {
      continue;
    }
    let url: string;
    try {
      url = canonicalMobbinSitesUrl(row.url).canonicalUrl;
    } catch {
      continue;
    }
    if (readyUrls.has(url)) continue;
    const current = latest.get(url);
    if (current === undefined || row.id > current) latest.set(url, row.id);
  }
  return [...latest]
    .map(([url, id]) => ({ id, url }))
    .sort((left, right) => left.id - right.id);
}

async function main(): Promise<void> {
  const [
    { pool, query, setJobStatus },
    { closeSitesQueue, publishSitesJob },
  ] = await Promise.all([
    import("../src/db.ts"),
    import("../src/sitesQueue.ts"),
  ]);
  let queued = 0;
  let alreadyReady = 0;
  let publishFailed = 0;
  try {
    const result = await query<FailedSiteJobRow>(
      `SELECT id, payload->>'url' AS url
       FROM jobs
       WHERE type = 'import-site' AND status = 'error'
       ORDER BY id DESC`,
    );
    // selectLatestFailedSiteJobs already skips anything in this set, and it
    // canonicalises both sides — one query instead of a lookup per candidate.
    const readyRows = await query<{ canonical_url: string | null }>(
      `SELECT DISTINCT canonical_url FROM site_versions
       WHERE status = 'ready' AND canonical_url IS NOT NULL`,
    );
    const readyUrls = new Set(
      readyRows.rows.flatMap(({ canonical_url }) => {
        if (!canonical_url) return [];
        try {
          return [canonicalMobbinSitesUrl(canonical_url).canonicalUrl];
        } catch {
          return [canonical_url];
        }
      }),
    );
    const before = selectLatestFailedSiteJobs(result.rows).length;
    const candidates = selectLatestFailedSiteJobs(result.rows, readyUrls);
    alreadyReady = before - candidates.length;
    for (const candidate of candidates) {
      await setJobStatus(candidate.id, "queued", "Queued for Site repair");
      try {
        await publishSitesJob(
          { type: "import-site", url: candidate.url, jobId: candidate.id },
          "repair",
        );
        queued++;
      } catch {
        publishFailed++;
        await setJobStatus(
          candidate.id,
          "error",
          "Sites repair queue publish failed",
        );
      }
    }
    console.log(JSON.stringify({
      failedCandidates: candidates.length,
      queued,
      alreadyReady,
      publishFailed,
    }));
  } finally {
    await closeSitesQueue("repair").catch(() => undefined);
    await pool.end().catch(() => undefined);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
