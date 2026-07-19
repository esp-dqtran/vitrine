import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import pg from "pg";
import {
  catalogJobKey,
  catalogPersistenceRepair,
  emptyCatalogPersistence,
  loadCatalogPersistence,
} from "../src/catalogVerification.ts";
import {
  parseCatalogLogCounts,
  summarizeCatalogIntegrityState,
  type CatalogArtifactCounts,
  type CatalogRepairPhases,
} from "../src/progress.ts";

interface VerificationCounts {
  screens?: { discovered: number; captured: number };
  uiElements?: { discovered: number; captured: number };
  flows?: { discovered: number; captured: number };
}

interface Job {
  mobbinId: string;
  platform: string;
  appName: string;
  slug: string;
  status: string;
  error?: string;
  finishedAt?: string;
  repair?: CatalogRepairPhases;
  verification?: VerificationCounts;
}

interface State { generatedAt: string; jobs: Job[] }

const statePath = (worker: string) => `data/catalog-import-state-${worker}.json`;
const logPath = (worker: string) => `data/logs/catalog-import-${worker}.log`;

function logSegments(lines: readonly string[], worker: string, job: Job): string[] {
  const marker = `w${worker}:Importing "${job.appName}" (${job.platform})`;
  const result: string[] = [];
  for (let start = 0; start < lines.length; start++) {
    if (!lines[start]?.includes(marker)) continue;
    let end = lines.length;
    for (let index = start + 1; index < lines.length; index++) {
      if (/w\d:(Importing|Batch run complete)/.test(lines[index] ?? "")) { end = index; break; }
    }
    result.push(...lines.slice(start, end));
  }
  return result;
}

function expectedCounts(lines: readonly string[], worker: string, job: Job): CatalogArtifactCounts {
  const logged = parseCatalogLogCounts(logSegments(lines, worker, job));
  return {
    screens: job.verification?.screens?.discovered ?? logged.screens,
    uiElements: job.verification?.uiElements?.discovered ?? logged.uiElements,
    flows: job.verification?.flows?.discovered ?? logged.flows,
  };
}

async function globalInvalidFlowReferenceCount(pool: pg.Pool): Promise<number> {
  const result = await pool.query<{ invalid_flow_references: number }>(`
    SELECT count(*) FILTER (
      WHERE i.id IS NULL OR evidence_platform.app_id <> a.id OR evidence_platform.name <> af.platform
    )::int AS invalid_flow_references
    FROM app_flows af
    JOIN apps a ON a.id = af.app_id
    CROSS JOIN LATERAL jsonb_array_elements(af.flows) f
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(f->'steps', '[]'::jsonb)) s
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s->'evidence', '[]'::jsonb)) e
    LEFT JOIN images i ON i.id = (e #>> '{}')::bigint
    LEFT JOIN platforms evidence_platform ON evidence_platform.id = i.platform_id`);
  return Number(result.rows[0]?.invalid_flow_references ?? 0);
}

function writeStateAtomically(path: string, state: State): void {
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`);
  renameSync(temporary, path);
}

export async function main(): Promise<void> {
  const writeQueue = process.argv.includes("--write-queue");
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  const workers = (process.env.CATALOG_WORKERS ?? "1,2,3,4").split(",").map((worker) => worker.trim()).filter(Boolean);
  const states = new Map<string, State>();
  const logs = new Map<string, string[]>();
  for (const worker of workers) {
    states.set(worker, JSON.parse(readFileSync(statePath(worker), "utf8")) as State);
    logs.set(worker, existsSync(logPath(worker)) ? readFileSync(logPath(worker), "utf8").split("\n") : []);
  }

  const allJobs = workers.flatMap((worker) =>
    (states.get(worker)?.jobs ?? []).map((job) => ({ worker, job })),
  );
  const candidates = allJobs.filter(({ job }) => job.status !== "pending" || job.repair !== undefined);
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
  try {
    const persisted = await loadCatalogPersistence(pool, candidates.map(({ job }) => ({ app: job.slug, platform: job.platform })));
    const queued = candidates.flatMap(({ worker, job }) => {
      const actual = persisted.get(catalogJobKey(job.slug, job.platform))
        ?? emptyCatalogPersistence(job.slug, job.platform);
      const expected = expectedCounts(logs.get(worker) ?? [], worker, job);
      const repair = catalogPersistenceRepair(expected, actual);
      if (!repair.screens && !repair.uiElements && !repair.flows) return [];
      return [{
        worker,
        appName: job.appName,
        slug: job.slug,
        platform: job.platform,
        expected,
        persisted: {
          screens: actual.screens,
          uiElements: actual.uiElements,
          flows: actual.flows,
          invalidFlowReferences: actual.invalidFlowReferences,
          missingScreenObjects: actual.missingScreenObjects,
          missingUiElementObjects: actual.missingUiElementObjects,
          missingFlowObjects: actual.missingFlowObjects,
        },
        repair,
        job,
      }];
    });

    let backupDir: string | undefined;
    if (writeQueue && queued.length > 0) {
      backupDir = `data/backups/catalog-integrity-${new Date().toISOString().replace(/[:.]/g, "-")}`;
      mkdirSync(`${backupDir}/logs`, { recursive: true });
      for (const worker of workers) {
        copyFileSync(statePath(worker), `${backupDir}/catalog-import-state-${worker}.json`);
        if (existsSync(logPath(worker))) copyFileSync(logPath(worker), `${backupDir}/logs/catalog-import-${worker}.log`);
      }
      for (const item of queued) {
        item.job.status = "pending";
        item.job.repair = item.repair;
        delete item.job.error;
        delete item.job.finishedAt;
      }
      for (const worker of workers) writeStateAtomically(statePath(worker), states.get(worker)!);
    }

    const phaseCounts = queued.reduce((counts, item) => ({
      screens: counts.screens + Number(item.repair.screens),
      uiElements: counts.uiElements + Number(item.repair.uiElements),
      flows: counts.flows + Number(item.repair.flows),
    }), { screens: 0, uiElements: 0, flows: 0 });
    const globalInvalidFlowReferences = await globalInvalidFlowReferenceCount(pool);
    const integrity = summarizeCatalogIntegrityState(
      allJobs.map(({ job }) => job),
      queued.length,
      globalInvalidFlowReferences,
    );
    const untouchedPendingJobs = allJobs.filter(({ job }) => job.status === "pending" && job.repair === undefined).length;
    console.log(JSON.stringify({
      mode: writeQueue ? "write-queue" : "audit",
      auditedJobs: candidates.length,
      queuedJobs: queued.length,
      ...integrity,
      globalInvalidFlowReferences,
      untouchedPendingJobs,
      phaseCounts,
      backupDir,
      jobs: queued.map(({ job: _job, ...item }) => item),
    }, null, 2));
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
