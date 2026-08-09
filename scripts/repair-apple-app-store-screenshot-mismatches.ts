import { spawn } from "node:child_process";
import { closePool, pool } from "../src/db.ts";

interface Candidate {
  app: string;
  versionId: number;
  listing: string;
  appStoreId: string;
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

function canonicalAppleListing(value: string): string {
  const listing = new URL(value);
  if (!["apps.apple.com", "itunes.apple.com"].includes(listing.hostname)) {
    throw new Error("listing is not an Apple App Store URL");
  }
  const appStoreId = listing.pathname.match(/\/id(\d+)$/)?.[1];
  if (!appStoreId) throw new Error("listing does not end with an Apple App Store id");
  listing.hostname = "apps.apple.com";
  listing.search = "";
  listing.hash = "";
  return listing.toString();
}

async function runImporter(candidate: Candidate, apply: boolean, maxScreens: number): Promise<void> {
  const args = [
    "--env-file=.env",
    "--import", "tsx",
    "scripts/import-apple-app-store-screenshots.ts",
    "--app", candidate.app,
    "--version-id", String(candidate.versionId),
    "--listing", candidate.listing,
    "--max-screens", String(maxScreens),
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

async function removeWrongScreens(candidate: Candidate): Promise<number> {
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
      [candidate.versionId, `apple-store:${candidate.appStoreId}:%`],
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
const maxScreens = positiveInteger(option("--max-screens") ?? "5", "--max-screens");

const candidates = await pool.query<Candidate>(
  `WITH latest AS (
     SELECT DISTINCT ON (av.app_id, av.platform)
       av.id AS version_id, av.app_id, av.platform
     FROM app_versions av
     WHERE av.status = 'published'
     ORDER BY av.app_id, av.platform, av.version_number DESC
   ), imported AS (
     SELECT a.name, a.website_url, latest.version_id,
       regexp_replace(i.image_url, '^apple-store:([0-9]+):[0-9]+$', '\\1') AS imported_id
     FROM latest
     JOIN apps a ON a.id = latest.app_id
     JOIN version_images vi ON vi.version_id = latest.version_id
     JOIN images i ON i.id = vi.image_id
     WHERE latest.platform = 'ios'
       AND i.image_url ~ '^apple-store:[0-9]+:[0-9]+$'
     GROUP BY a.name, a.website_url, latest.version_id,
       regexp_replace(i.image_url, '^apple-store:([0-9]+):[0-9]+$', '\\1')
   )
   SELECT DISTINCT ON (name)
     name AS app, version_id AS "versionId", website_url AS listing,
     substring(website_url FROM '/id([0-9]+)') AS "appStoreId"
   FROM imported
   WHERE substring(website_url FROM '/id([0-9]+)') IS NOT NULL
     AND imported_id <> substring(website_url FROM '/id([0-9]+)')
   ORDER BY name`,
);

const queue = candidates.rows.slice(0, limit).map((candidate) => ({
  ...candidate,
  listing: canonicalAppleListing(candidate.listing),
}));
console.log(JSON.stringify({ status: "queued", candidates: candidates.rows.length, processing: queue.length, apply, maxScreens }));

let imported = 0;
let removed = 0;
let failed = 0;
try {
  for (const [index, candidate] of queue.entries()) {
    try {
      console.log(JSON.stringify({ status: "processing", index: index + 1, app: candidate.app, appStoreId: candidate.appStoreId }));
      await runImporter(candidate, apply, maxScreens);
      if (apply) removed += await removeWrongScreens(candidate);
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
