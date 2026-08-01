import { spawn } from "node:child_process";
import { appendFile, mkdir, readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { closePool, query } from "../../src/db.ts";

// ponytail: thin driver over run-kiro-feature-documents.ts — it already handles
// flow selection, dedup, workers, and resumability per app/version.

interface Target {
  app: string;
  platform: string;
  version_number: number;
  flows: number;
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`Invalid ${value}`);
  return parsed;
}

// Every shard keeps its own log, so resuming reads them all and stays correct even
// when the shard count changes between runs.
async function completedTargets(logDirectory: string): Promise<Set<string>> {
  const done = new Set<string>();
  let files: string[] = [];
  try {
    files = (await readdir(logDirectory)).filter((name) =>
      name.startsWith("sweep-log") && name.endsWith(".jsonl")
    );
  } catch {
    return done;
  }
  for (const file of files) {
    try {
      const text = await readFile(join(logDirectory, file), "utf8");
      for (const line of text.split("\n")) {
        if (!line.trim()) continue;
        const entry = JSON.parse(line) as { key?: string; status?: string };
        if (entry.key && entry.status === "ok") done.add(entry.key);
      }
    } catch {
      // Ignore a partially written line from a shard that is still running.
    }
  }
  return done;
}

function runOne(target: Target, options: {
  model: string;
  limit: number;
  workers: number;
  timeoutMs: number;
  visibility: string;
}): Promise<{ code: number; tail: string }> {
  return new Promise((resolve) => {
    const child = spawn("node", [
      "--env-file=.env",
      "--import",
      "tsx",
      "scripts/flow-analysis/run-kiro-feature-documents.ts",
      "--app", target.app,
      "--platform", target.platform,
      "--version", String(target.version_number),
      "--provider", "claude",
      "--model", options.model,
      "--limit", String(options.limit),
      "--workers", String(options.workers),
      "--timeout-ms", String(options.timeoutMs),
      "--visibility", options.visibility,
      "--any-provider",
    ], { cwd: process.cwd(), env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    const append = (chunk: Buffer): void => {
      output += chunk.toString("utf8");
      if (output.length > 200_000) output = output.slice(-100_000);
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.on("error", () => resolve({ code: 1, tail: output.slice(-600) }));
    child.on("close", (code) => resolve({ code: code ?? 1, tail: output.slice(-600) }));
  });
}

async function main(): Promise<void> {
  const model = argument("--model") ?? "claude-opus-5";
  const perApp = positiveInteger(argument("--per-app"), 2);
  const workers = positiveInteger(argument("--workers"), 2);
  const timeoutMs = positiveInteger(argument("--timeout-ms"), 900_000);
  const maxApps = positiveInteger(argument("--max-apps"), 100_000);
  const visibility = argument("--visibility") ?? "catalog";
  const shards = positiveInteger(argument("--shards"), 1);
  const shard = Number(argument("--shard") ?? "0");
  if (!Number.isSafeInteger(shard) || shard < 0 || shard >= shards) {
    throw new Error("--shard must be between 0 and --shards minus one");
  }
  const logDirectory = argument("--log-dir") ?? join("data", "feature-descriptions");
  const logPath = join(logDirectory, `sweep-log-${shard}of${shards}.jsonl`);

  const { rows } = await query<Target>(
    `SELECT a.name AS app, av.platform, av.version_number, COUNT(afv.id)::int AS flows
       FROM app_versions av
       JOIN apps a ON a.id = av.app_id
       JOIN app_flow_versions afv ON afv.version_id = av.id
      WHERE av.status = 'published'
      GROUP BY a.name, av.platform, av.version_number
      ORDER BY COUNT(afv.id) DESC`,
  );
  await closePool();

  await mkdir(dirname(logPath), { recursive: true });
  const done = await completedTargets(logDirectory);
  const pending = rows
    .filter((_target, index) => index % shards === shard)
    .filter((target) => !done.has(`${target.app}/${target.platform}/${target.version_number}`))
    .slice(0, maxApps);

  console.log(JSON.stringify({
    event: "sweep-start",
    model,
    perApp,
    workers,
    shard,
    shards,
    totalTargets: rows.length,
    alreadyDone: done.size,
    pending: pending.length,
  }));

  let ok = 0;
  let failed = 0;
  const sweepStarted = Date.now();
  for (const [index, target] of pending.entries()) {
    const key = `${target.app}/${target.platform}/${target.version_number}`;
    const started = Date.now();
    const result = await runOne(target, { model, limit: perApp, workers, timeoutMs, visibility });
    const durationMs = Date.now() - started;
    const status = result.code === 0 ? "ok" : "failed";
    if (result.code === 0) ok += 1;
    else failed += 1;
    const entry = {
      key,
      status,
      durationMs,
      durationLabel: `${(durationMs / 1000).toFixed(1)}s`,
      flows: target.flows,
      at: new Date().toISOString(),
      ...(result.code === 0 ? {} : { tail: result.tail }),
    };
    await appendFile(logPath, `${JSON.stringify(entry)}\n`, "utf8");
    console.log(JSON.stringify({
      event: "target-done",
      index: index + 1,
      of: pending.length,
      key,
      status,
      durationLabel: entry.durationLabel,
      ok,
      failed,
      elapsedLabel: `${((Date.now() - sweepStarted) / 60_000).toFixed(1)}m`,
    }));
  }

  console.log(JSON.stringify({
    event: "sweep-done",
    ok,
    failed,
    totalDurationLabel: `${((Date.now() - sweepStarted) / 60_000).toFixed(1)}m`,
    logPath,
  }));
}

main().catch((error) => {
  console.error(JSON.stringify({ event: "sweep-error", message: String(error) }));
  process.exitCode = 1;
});
