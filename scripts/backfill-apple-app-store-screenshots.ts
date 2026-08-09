import { spawn } from "node:child_process";
import { closePool, pool } from "../src/db.ts";

interface Candidate {
  app: string;
  versionId: number;
  listing: string;
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

function canonicalAppleListing(value: string): { listing: string; appStoreId: string } {
  const listing = new URL(value);
  if (!["apps.apple.com", "itunes.apple.com"].includes(listing.hostname)) {
    throw new Error("listing is not an Apple App Store URL");
  }
  const appStoreId = listing.pathname.match(/\/id(\d+)\/?$/)?.[1];
  if (!appStoreId) throw new Error("listing does not end with an Apple App Store id");
  listing.hostname = "apps.apple.com";
  const locale = listing.searchParams.get("l");
  listing.search = "";
  if (locale) listing.searchParams.set("l", locale);
  listing.hash = "";
  return { listing: listing.toString(), appStoreId };
}

async function runImporter(candidate: Candidate, apply: boolean): Promise<void> {
  const args = [
    "--env-file=.env",
    "--import", "tsx",
    "scripts/import-apple-app-store-screenshots.ts",
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
      : reject(new Error(stderr.trim() || `Apple importer exited ${code}`)));
  });
}

async function removeReplacedSources(candidate: Candidate, appStoreId: string): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const removed = await client.query(
      `DELETE FROM version_images vi
       USING images i
       WHERE vi.version_id = $1
         AND i.id = vi.image_id
         AND i.image_url LIKE 'apple-store:%'
         AND i.image_url NOT LIKE $2
       RETURNING vi.image_id`,
      [candidate.versionId, `apple-store:${appStoreId}:%`],
    );
    await client.query(
      `UPDATE app_versions
       SET screen_count = (
         SELECT COUNT(*)::int
         FROM version_images vi JOIN images i ON i.id = vi.image_id
         WHERE vi.version_id = app_versions.id AND i.kind = 'screen'
       )
       WHERE id = $1`,
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
const limit = option("--limit") === undefined ? Infinity : positiveInteger(option("--limit"), "--limit");
const startAt = option("--start-at")?.trim();

const candidates = await pool.query<Candidate>(
  `WITH latest AS (
     SELECT DISTINCT ON (av.app_id, av.platform)
       av.id AS version_id, av.app_id
     FROM app_versions av
     WHERE av.status = 'published' AND av.platform = 'ios'
     ORDER BY av.app_id, av.platform, av.version_number DESC
   )
   SELECT a.name AS app, latest.version_id AS "versionId",
     COALESCE(
       CASE WHEN av.source_url ~ '^https?://(apps|itunes)\\.apple\\.com/.*/id[0-9]+(?:[/?].*)?$'
         THEN av.source_url END,
       CASE WHEN a.website_url ~ '^https?://(apps|itunes)\\.apple\\.com/.*/id[0-9]+(?:[/?].*)?$'
         THEN a.website_url END,
       'https://apps.apple.com/us/app/id' || provenance.app_store_id
     ) AS listing
   FROM latest
   JOIN app_versions av ON av.id = latest.version_id
   JOIN apps a ON a.id = latest.app_id
   LEFT JOIN LATERAL (
     SELECT substring(i.image_url FROM '^apple-store:([0-9]+):') AS app_store_id
     FROM version_images vi
     JOIN images i ON i.id = vi.image_id
     WHERE vi.version_id = latest.version_id
       AND i.image_url ~ '^apple-store:[0-9]+:[0-9]+$'
     ORDER BY i.id
     LIMIT 1
   ) provenance ON true
   WHERE COALESCE(
     CASE WHEN av.source_url ~ '^https?://(apps|itunes)\\.apple\\.com/.*/id[0-9]+(?:[/?].*)?$'
       THEN av.source_url END,
     CASE WHEN a.website_url ~ '^https?://(apps|itunes)\\.apple\\.com/.*/id[0-9]+(?:[/?].*)?$'
       THEN a.website_url END,
     CASE WHEN provenance.app_store_id IS NOT NULL
       THEN 'https://apps.apple.com/us/app/id' || provenance.app_store_id END
   ) IS NOT NULL
   ORDER BY a.name`,
);

const queue = candidates.rows
  .filter((candidate) => !startAt || candidate.app >= startAt)
  .slice(0, limit).map((candidate) => ({
  ...candidate,
  ...canonicalAppleListing(candidate.listing),
}));
console.log(JSON.stringify({
  status: "queued", candidates: candidates.rows.length, processing: queue.length,
  apply, startAt: startAt ?? null,
}));

let imported = 0;
let removed = 0;
let failed = 0;
try {
  for (const [index, candidate] of queue.entries()) {
    try {
      console.log(JSON.stringify({ status: "processing", index: index + 1, app: candidate.app, appStoreId: candidate.appStoreId }));
      await runImporter(candidate, apply);
      if (apply) removed += await removeReplacedSources(candidate, candidate.appStoreId);
      imported += 1;
    } catch (error) {
      failed += 1;
      console.error(JSON.stringify({
        status: "failed", index: index + 1, app: candidate.app,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }
} finally {
  await closePool();
}
console.log(JSON.stringify({ status: "complete", processed: queue.length, imported, removed, failed, apply }));
