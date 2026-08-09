import { spawn } from "node:child_process";
import { closePool, pool } from "../src/db.ts";
import { googlePlayListing } from "../src/googlePlayImport.ts";

interface Candidate {
  app: string;
  versionId: number;
  listing: string;
  complete: boolean;
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

function positiveInteger(value: string | undefined, name: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

async function runImporter(candidate: Candidate, apply: boolean): Promise<void> {
  const args = [
    "--env-file=.env",
    "--import", "tsx",
    "scripts/import-google-play-screenshots.ts",
    "--app", candidate.app,
    "--version-id", String(candidate.versionId),
    "--listing", candidate.listing,
    ...(apply ? ["--apply"] : []),
  ];
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(), env: process.env, stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stdout.on("data", (chunk) => process.stdout.write(chunk));
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.once("error", reject);
    child.once("close", (code) => code === 0
      ? resolve()
      : reject(new Error(stderr.trim() || `Google Play importer exited ${code}`)));
  });
}

async function removeReplacedSources(candidate: Candidate, packageId: string): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const removed = await client.query(
      `DELETE FROM version_images vi USING images i
       WHERE vi.version_id = $1 AND i.id = vi.image_id
         AND i.image_url LIKE 'google-play:%'
         AND i.image_url NOT LIKE $2
       RETURNING vi.image_id`,
      [candidate.versionId, `google-play:${packageId}:%`],
    );
    await client.query(
      `UPDATE app_versions SET screen_count = (
         SELECT COUNT(*)::int FROM version_images vi JOIN images i ON i.id = vi.image_id
         WHERE vi.version_id = app_versions.id AND i.kind = 'screen'
       ) WHERE id = $1`,
      [candidate.versionId],
    );
    await client.query("SELECT refresh_screen_pattern_previews($1)", [candidate.versionId]);
    await client.query("COMMIT");
    return removed.rowCount ?? 0;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

const apply = process.argv.includes("--apply");
const force = process.argv.includes("--force");
const limit = option("--limit") === undefined ? Infinity : positiveInteger(option("--limit"), "--limit");
const startAfter = option("--start-after")?.trim();
const startAt = option("--start-at")?.trim();
const endBefore = option("--end-before")?.trim();

const candidates = await pool.query<Candidate>(
  `WITH latest AS (
     SELECT DISTINCT ON (av.app_id)
       av.id AS version_id, av.app_id, av.source_url
     FROM app_versions av
     WHERE av.status = 'published' AND av.platform = 'android'
     ORDER BY av.app_id, av.version_number DESC
   ), listings AS (
     SELECT latest.version_id, latest.app_id,
       COALESCE(
         CASE WHEN latest.source_url ~ '^https://play\\.google\\.com/store/apps/details\\?[^#]*id='
           THEN latest.source_url END,
         CASE WHEN a.website_url ~ '^https://play\\.google\\.com/store/apps/details\\?[^#]*id='
           THEN a.website_url END
       ) AS listing
     FROM latest JOIN apps a ON a.id = latest.app_id
   )
   SELECT a.name AS app, listings.version_id AS "versionId", listings.listing,
     (
       listings.listing IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM version_images vi JOIN images i ON i.id = vi.image_id
         WHERE vi.version_id = listings.version_id
           AND i.image_url LIKE 'google-play:%'
           AND i.object_key IS NOT NULL AND i.thumbnail_object_key IS NOT NULL
       )
       AND (SELECT COUNT(*) FROM app_preview_images preview
            WHERE preview.version_id = listings.version_id) = 3
     ) AS complete
   FROM listings JOIN apps a ON a.id = listings.app_id
   WHERE listings.listing IS NOT NULL
   ORDER BY a.name`,
);

const eligible = candidates.rows
  .filter((candidate) => !startAfter || candidate.app > startAfter)
  .filter((candidate) => !startAt || candidate.app >= startAt)
  .filter((candidate) => !endBefore || candidate.app < endBefore)
  .filter((candidate) => force || !candidate.complete);
const queue = eligible.slice(0, limit).map((candidate) => ({
  ...candidate,
  ...googlePlayListing(candidate.listing),
}));
console.log(JSON.stringify({
  status: "queued", candidates: candidates.rows.length, alreadyComplete: candidates.rows.length - eligible.length,
  processing: queue.length, apply, force, startAfter: startAfter ?? null,
  startAt: startAt ?? null, endBefore: endBefore ?? null,
}));

let imported = 0;
let removed = 0;
let failed = 0;
try {
  for (const [index, candidate] of queue.entries()) {
    try {
      console.log(JSON.stringify({
        status: "processing", index: index + 1, total: queue.length,
        app: candidate.app, packageId: candidate.packageId,
      }));
      await runImporter(candidate, apply);
      if (apply) removed += await removeReplacedSources(candidate, candidate.packageId);
      imported += 1;
    } catch (error) {
      failed += 1;
      console.error(JSON.stringify({
        status: "failed", index: index + 1, total: queue.length, app: candidate.app,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }
} finally {
  await closePool();
}
console.log(JSON.stringify({ status: "complete", processed: queue.length, imported, removed, failed, apply }));
