import { spawn } from "node:child_process";
import { closePool, pool } from "../src/db.ts";

interface Candidate {
  app: string;
  displayName: string;
  versionId: number;
}

interface AppleSearchResult {
  trackName?: string;
  trackViewUrl?: string;
}

function positiveInteger(value: string | undefined, name: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

const apply = process.argv.includes("--apply");
const limit = option("--limit") === undefined ? Infinity : positiveInteger(option("--limit"), "--limit");
const maxScreens = positiveInteger(option("--max-screens") ?? "5", "--max-screens");

const words = (value: string) => value
  .normalize("NFKD")
  .toLocaleLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim()
  .split(/\s+/)
  .filter(Boolean);

function isAppleMatch(appName: string, trackName: string): boolean {
  const expected = words(appName);
  const actual = words(trackName);
  if (expected.length === 0 || actual.length < expected.length) return false;
  if (!expected.every((word, index) => actual[index] === word)) return false;
  // A US-only branded variant is a different listing than an app named only
  // "Binance", so leave it for manual resolution instead of guessing.
  return !(actual[expected.length] === "us" && !expected.includes("us"));
}

async function findAppleListing(candidate: Candidate): Promise<{ trackName: string; url: string } | null> {
  const endpoint = new URL("https://itunes.apple.com/search");
  endpoint.search = new URLSearchParams({
    term: candidate.displayName,
    country: "us",
    media: "software",
    entity: "software",
    limit: "10",
  }).toString();
  const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Apple search failed (${response.status})`);
  const payload = await response.json() as { results?: AppleSearchResult[] };
  const match = payload.results?.find((result) => result.trackName && result.trackViewUrl
    && isAppleMatch(candidate.displayName, result.trackName));
  return match?.trackName && match.trackViewUrl
    ? { trackName: match.trackName, url: match.trackViewUrl }
    : null;
}

async function importListing(candidate: Candidate, listing: string): Promise<void> {
  const args = [
    "--env-file=.env",
    "--import", "tsx",
    "scripts/import-apple-app-store-screenshots.ts",
    "--app", candidate.app,
    "--version-id", String(candidate.versionId),
    "--listing", listing,
    "--max-screens", String(maxScreens),
    ...(apply ? ["--apply"] : []),
  ];
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
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

const candidates = await pool.query<Candidate>(
  `SELECT DISTINCT ON (a.id)
     a.name AS app,
     COALESCE(a.display_name, a.name) AS "displayName",
     av.id AS "versionId"
   FROM apps a
   JOIN app_versions av
     ON av.app_id = a.id
    AND av.platform = 'ios'
    AND av.status = 'published'
   WHERE NOT EXISTS (
     SELECT 1
     FROM version_images vi
     JOIN images i ON i.id = vi.image_id
     WHERE vi.version_id = av.id
       AND i.image_url LIKE 'apple-store:%'
   )
   ORDER BY a.id, av.version_number DESC`,
);

const queue = candidates.rows.slice(0, limit);
console.log(JSON.stringify({ status: "queued", candidates: candidates.rows.length, processing: queue.length, apply }));
let imported = 0;
let skipped = 0;
let failed = 0;
try {
  for (const [index, candidate] of queue.entries()) {
    try {
      const listing = await findAppleListing(candidate);
      if (!listing) {
        skipped += 1;
        console.log(JSON.stringify({ status: "skipped", index: index + 1, app: candidate.app, reason: "no exact Apple match" }));
        continue;
      }
      console.log(JSON.stringify({ status: "matched", index: index + 1, app: candidate.app, trackName: listing.trackName }));
      await importListing(candidate, listing.url);
      imported += 1;
    } catch (error) {
      failed += 1;
      console.error(JSON.stringify({
        status: "failed",
        index: index + 1,
        app: candidate.app,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }
} finally {
  await closePool();
}
console.log(JSON.stringify({ status: "complete", processed: queue.length, imported, skipped, failed, apply }));
