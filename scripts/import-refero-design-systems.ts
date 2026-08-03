import { createWriteStream } from "node:fs";
import { once } from "node:events";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createGzip } from "node:zlib";
import { pathToFileURL } from "node:url";
import pg from "pg";
import { databasePoolOptions } from "../src/dbPoolConfig.ts";
import {
  parseReferoSitemap,
  parseReferoStylePage,
  REFERO_STYLES_SITEMAP,
  type ReferoArchiveRecord,
  type ReferoSitemapEntry,
} from "../src/referoDesignSystem.ts";
import { upsertReferoDesignSystem } from "../src/referoDesignSystemStore.ts";

interface ManifestRecord {
  id: string;
  url: string;
  lastModified?: string;
  status: "ready" | "failed";
  file?: string;
  contentHash?: string;
  app?: string;
  fetchedAt?: string;
  error?: string;
}

interface ReferoManifest {
  schemaVersion: 1;
  sitemapUrl: string;
  generatedAt: string;
  expected: number;
  records: Record<string, ManifestRecord>;
}

interface Options {
  archiveDirectory: string;
  sitemapUrl: string;
  concurrency: number;
  retries: number;
  delayMs: number;
  limit?: number;
  force: boolean;
  apply: boolean;
  confirmDatabaseHost?: string;
}

function argument(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function integer(value: string | undefined, fallback: number, label: string, maximum = Number.MAX_SAFE_INTEGER): number {
  if (value == null) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > maximum) throw new Error(`${label} must be an integer from 0 to ${maximum}`);
  return parsed;
}

export function parseReferoImportArgs(args: string[]): Options {
  const limitValue = argument(args, "--limit");
  return {
    archiveDirectory: resolve(argument(args, "--archive-dir") ?? ".codex-artifacts/refero-styles"),
    sitemapUrl: argument(args, "--sitemap") ?? REFERO_STYLES_SITEMAP,
    concurrency: integer(argument(args, "--concurrency"), 4, "--concurrency", 12) || 1,
    retries: integer(argument(args, "--retries"), 3, "--retries", 8),
    delayMs: integer(argument(args, "--delay-ms"), 125, "--delay-ms", 10_000),
    limit: limitValue == null ? undefined : integer(limitValue, 0, "--limit"),
    force: args.includes("--force"),
    apply: args.includes("--apply"),
    confirmDatabaseHost: argument(args, "--confirm-database-host"),
  };
}

function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[redacted-database-url]");
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function atomicJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

async function loadManifest(path: string, sitemapUrl: string): Promise<ReferoManifest> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as ReferoManifest;
    if (parsed.schemaVersion === 1 && parsed.sitemapUrl === sitemapUrl && parsed.records) return parsed;
  } catch {
    // A missing or incompatible manifest starts a fresh resumable run.
  }
  return { schemaVersion: 1, sitemapUrl, generatedAt: new Date(0).toISOString(), expected: 0, records: {} };
}

async function fetchText(url: string, retries: number): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "user-agent": "Vitrines-Refero-Importer/1.0",
        },
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < retries) await new Promise((resolveDelay) => setTimeout(resolveDelay, 400 * 2 ** attempt));
    }
  }
  throw lastError;
}

async function consolidateArchive(
  archiveDirectory: string,
  entries: ReferoSitemapEntry[],
  records: Record<string, ManifestRecord>,
): Promise<string> {
  const output = join(archiveDirectory, "refero-styles.ndjson.gz");
  const temporary = `${output}.${process.pid}.tmp`;
  const gzip = createGzip({ level: 9 });
  const destination = createWriteStream(temporary);
  gzip.pipe(destination);
  for (const entry of entries) {
    const manifestRecord = records[entry.id];
    if (manifestRecord?.status !== "ready" || !manifestRecord.file) continue;
    const record = JSON.parse(await readFile(join(archiveDirectory, manifestRecord.file), "utf8"));
    if (!gzip.write(`${JSON.stringify(record)}\n`)) await once(gzip, "drain");
  }
  gzip.end();
  await new Promise<void>((resolveFinish, rejectFinish) => {
    destination.on("finish", resolveFinish);
    destination.on("error", rejectFinish);
  });
  await rename(temporary, output);
  return output;
}

async function main(): Promise<void> {
  const options = parseReferoImportArgs(process.argv.slice(2));
  await mkdir(join(options.archiveDirectory, "records"), { recursive: true });
  const sitemapXml = await fetchText(options.sitemapUrl, options.retries);
  const allEntries = parseReferoSitemap(sitemapXml);
  if (!allEntries.length) throw new Error("Refero sitemap contains no style URLs");
  const entries = options.limit == null ? allEntries : allEntries.slice(0, options.limit);
  const manifestPath = join(options.archiveDirectory, "manifest.json");
  const manifest = await loadManifest(manifestPath, options.sitemapUrl);
  manifest.expected = entries.length;

  let pool: pg.Pool | undefined;
  if (options.apply) {
    const databaseUrl = process.env.DATABASE_URL?.trim();
    if (!databaseUrl) throw new Error("DATABASE_URL is required with --apply");
    const host = new URL(databaseUrl).hostname;
    if (!options.confirmDatabaseHost || options.confirmDatabaseHost !== host) {
      throw new Error(`--apply requires --confirm-database-host ${host}`);
    }
    pool = new pg.Pool({ connectionString: databaseUrl, ...databasePoolOptions(process.env), max: 2 });
  }

  let nextIndex = 0;
  let fetched = 0;
  let cached = 0;
  let failed = 0;
  let applied = 0;
  let completed = 0;
  let manifestWrite = Promise.resolve();
  const persistManifest = () => {
    manifest.generatedAt = new Date().toISOString();
    manifestWrite = manifestWrite.then(() => atomicJson(manifestPath, manifest));
    return manifestWrite;
  };

  const processEntry = async (entry: ReferoSitemapEntry): Promise<void> => {
    const relativeFile = `records/${entry.id}.json`;
    const recordPath = join(options.archiveDirectory, relativeFile);
    const prior = manifest.records[entry.id];
    const reusable = !options.force
      && prior?.status === "ready"
      && prior.lastModified === entry.lastModified
      && await exists(recordPath);
    let archiveRecord: ReferoArchiveRecord;
    try {
      if (reusable) {
        archiveRecord = JSON.parse(await readFile(recordPath, "utf8")) as ReferoArchiveRecord;
        cached += 1;
      } else {
        const html = await fetchText(entry.url, options.retries);
        archiveRecord = parseReferoStylePage(html, entry.url, new Date().toISOString(), entry.lastModified);
        await atomicJson(recordPath, archiveRecord);
        fetched += 1;
      }
      if (pool) {
        await upsertReferoDesignSystem(pool, archiveRecord);
        applied += 1;
      }
      manifest.records[entry.id] = {
        id: entry.id,
        url: entry.url,
        lastModified: entry.lastModified,
        status: "ready",
        file: relativeFile,
        contentHash: archiveRecord.contentHash,
        app: archiveRecord.snapshot.app,
        fetchedAt: archiveRecord.fetchedAt,
      };
    } catch (error) {
      failed += 1;
      manifest.records[entry.id] = {
        id: entry.id,
        url: entry.url,
        lastModified: entry.lastModified,
        status: "failed",
        error: safeError(error),
      };
    }
    completed += 1;
    if (completed % 25 === 0 || completed === entries.length) {
      const checkpoint = { completed, fetched, cached, failed, applied };
      await persistManifest();
      console.log(JSON.stringify({ ...checkpoint, expected: entries.length }));
    }
    if (options.delayMs) await new Promise((resolveDelay) => setTimeout(resolveDelay, options.delayMs));
  };

  const worker = async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= entries.length) return;
      await processEntry(entries[index]);
    }
  };

  try {
    await Promise.all(Array.from({ length: Math.min(options.concurrency, Math.max(entries.length, 1)) }, worker));
    await persistManifest();
    const ready = entries.filter(({ id }) => manifest.records[id]?.status === "ready").length;
    const archive = failed === 0 ? await consolidateArchive(options.archiveDirectory, entries, manifest.records) : undefined;
    const report = {
      sitemapUrl: options.sitemapUrl,
      archiveDirectory: options.archiveDirectory,
      archive,
      expected: entries.length,
      ready,
      fetched,
      cached,
      failed,
      applied,
    };
    console.log(JSON.stringify(report, null, 2));
    if (ready !== entries.length || failed) process.exitCode = 1;
  } finally {
    await manifestWrite;
    await pool?.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(safeError(error));
    process.exitCode = 1;
  });
}
