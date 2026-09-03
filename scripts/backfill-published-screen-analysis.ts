import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { closePool, query } from "../src/db.ts";

type Platform = "web" | "ios" | "android";

export interface BackfillOptions {
  platform: Platform;
  targetCoverage: number;
  batchSize: number;
  concurrency: number;
  maxBatches: number;
  execute: boolean;
}

export interface AnalysisCoverage {
  screens: number;
  analyzed: number;
  ratio: number;
  targetAnalyzed: number;
  remainingToTarget: number;
}

function usage(): never {
  throw new Error(
    "Usage: node --env-file=.env --import tsx scripts/backfill-published-screen-analysis.ts "
    + "--platform <web|ios|android> [--target-coverage 0.8] [--batch-size 500] "
    + "[--concurrency 3] [--max-batches 1] [--execute]",
  );
}

function positiveInteger(value: string | undefined, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`${label} must be positive`);
  return parsed;
}

export function backfillOptions(args: string[]): BackfillOptions {
  const values = new Map<string, string>();
  const valuedFlags = new Set([
    "--platform",
    "--target-coverage",
    "--batch-size",
    "--concurrency",
    "--max-batches",
  ]);
  let execute = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (argument === "--execute") {
      execute = true;
      continue;
    }
    if (!valuedFlags.has(argument) || !args[index + 1]) usage();
    values.set(argument, args[index + 1]!);
    index += 1;
  }
  const platform = values.get("--platform");
  if (!platform || !["web", "ios", "android"].includes(platform)) usage();
  const targetCoverage = Number(values.get("--target-coverage") ?? "0.8");
  if (!Number.isFinite(targetCoverage) || targetCoverage <= 0 || targetCoverage > 1) {
    throw new Error("target-coverage must be greater than 0 and at most 1");
  }
  const batchSize = positiveInteger(values.get("--batch-size") ?? "500", "batch-size");
  const concurrency = positiveInteger(values.get("--concurrency") ?? "3", "concurrency");
  const maxBatches = positiveInteger(values.get("--max-batches") ?? "1", "max-batches");
  if (batchSize > 20_000) throw new Error("batch-size cannot exceed 20000");
  if (concurrency > 8) throw new Error("concurrency cannot exceed 8");
  if (maxBatches > 1_000) throw new Error("max-batches cannot exceed 1000");
  return {
    platform: platform as Platform,
    targetCoverage,
    batchSize,
    concurrency,
    maxBatches,
    execute,
  };
}

export async function analysisCoverage(
  platform: Platform,
  targetCoverage: number,
): Promise<AnalysisCoverage> {
  const result = await query<{ screens: number | string; analyzed: number | string }>(
    `WITH latest AS (
       SELECT DISTINCT ON (app_id) id
       FROM app_versions
       WHERE status = 'published' AND platform = $1
       ORDER BY app_id, version_number DESC, id DESC
     )
     SELECT
       count(*) FILTER (WHERE image.kind = 'screen')::integer AS screens,
       count(*) FILTER (
         WHERE image.kind = 'screen' AND image.analysis IS NOT NULL
       )::integer AS analyzed
     FROM latest
     JOIN version_images version_image ON version_image.version_id = latest.id
     JOIN images image ON image.id = version_image.image_id`,
    [platform],
  );
  const screens = Number(result.rows[0]?.screens ?? 0);
  const analyzed = Number(result.rows[0]?.analyzed ?? 0);
  const targetAnalyzed = Math.ceil(screens * targetCoverage);
  return {
    screens,
    analyzed,
    ratio: screens > 0 ? analyzed / screens : 0,
    targetAnalyzed,
    remainingToTarget: Math.max(0, targetAnalyzed - analyzed),
  };
}

function runAnalyzerBatch(selected: BackfillOptions, dryRun: boolean): Promise<void> {
  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const analyzer = resolve(projectRoot, "scripts/analyze-screens-with-kiro.ts");
  const args = [
    "--env-file=.env",
    "--import", "tsx",
    analyzer,
    "--latest-published",
    "--platform", selected.platform,
    "--limit", String(selected.batchSize),
    "--concurrency", String(selected.concurrency),
    "--allow-empty",
    ...(dryRun ? ["--dry-run"] : []),
  ];
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, args, { cwd: projectRoot, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`screen-analysis batch failed (${signal ?? `exit ${code}`})`));
    });
  });
}

function printCoverage(label: string, coverage: AnalysisCoverage): void {
  console.log(JSON.stringify({
    label,
    ...coverage,
    percent: Number((coverage.ratio * 100).toFixed(2)),
  }, null, 2));
}

export async function run(): Promise<void> {
  const selected = backfillOptions(process.argv.slice(2));
  let coverage = await analysisCoverage(selected.platform, selected.targetCoverage);
  if (coverage.screens === 0) throw new Error(`No latest published ${selected.platform} screens were found`);
  printCoverage("before", coverage);
  console.log(JSON.stringify({
    mode: selected.execute ? "execute" : "dry-run",
    platform: selected.platform,
    targetCoverage: selected.targetCoverage,
    batchSize: selected.batchSize,
    concurrency: selected.concurrency,
    maxBatches: selected.maxBatches,
    plannedCapacity: Math.min(coverage.remainingToTarget, selected.batchSize * selected.maxBatches),
  }, null, 2));

  if (!selected.execute) {
    await runAnalyzerBatch(selected, true);
    return;
  }

  for (let batch = 1; batch <= selected.maxBatches && coverage.remainingToTarget > 0; batch += 1) {
    const before = coverage;
    console.log(`[backfill] starting batch ${batch}/${selected.maxBatches}`);
    await runAnalyzerBatch(selected, false);
    coverage = await analysisCoverage(selected.platform, selected.targetCoverage);
    printCoverage(`after-batch-${batch}`, coverage);
    if (coverage.analyzed <= before.analyzed) {
      throw new Error("Screen-analysis batch made no coverage progress; stopping safely");
    }
  }

  if (coverage.remainingToTarget > 0) {
    console.log(`[backfill] bounded run complete; ${coverage.remainingToTarget} analyses remain to target`);
  } else {
    console.log(`[backfill] ${(selected.targetCoverage * 100).toFixed(1)}% coverage target reached`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await run();
  } finally {
    await closePool();
  }
}
