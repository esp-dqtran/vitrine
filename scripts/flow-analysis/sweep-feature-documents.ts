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
  provider: "kiro" | "claude";
  model: string;
  limit: number;
  workers: number;
  timeoutMs: number;
  visibility: string;
  maxEvidence: number;
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
      "--provider", options.provider,
      "--model", options.model,
      "--limit", String(options.limit),
      "--workers", String(options.workers),
      "--timeout-ms", String(options.timeoutMs),
      "--visibility", options.visibility,
      "--any-provider",
      "--max-evidence", String(options.maxEvidence),
      "--skip-incomplete-evidence",
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
  const providerArgument = argument("--provider") ?? "kiro";
  if (providerArgument !== "kiro" && providerArgument !== "claude") {
    throw new Error("--provider must be kiro or claude");
  }
  const provider = providerArgument;
  const model = argument("--model") ?? (provider === "claude" ? "opus" : "claude-opus-5");
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
  const maxEvidence = positiveInteger(argument("--max-evidence"), 12);
  // Smallest apps first: finishing whole apps sooner beats partial progress on huge ones.
  const order = argument("--order") === "asc" ? "ASC" : "DESC";
  const logDirectory = argument("--log-dir") ?? join("data", "feature-descriptions");
  const logPath = join(logDirectory, `sweep-log-${shard}of${shards}.jsonl`);

  const { rows } = await query<Target>(
    `SELECT a.name AS app, av.platform, av.version_number, COUNT(afv.id)::int AS flows
       FROM app_versions av
       JOIN apps a ON a.id = av.app_id
       JOIN app_flow_versions afv ON afv.version_id = av.id
      WHERE av.status = 'published'
      GROUP BY a.name, av.platform, av.version_number
      ORDER BY COUNT(afv.id) ${order}`,
  );

  // The runner exits non-zero when any single Flow fails, so exit code alone would leave
  // a 500-Flow app permanently "failed" over one bad Flow. Ask the database instead.
  async function fullyCovered(target: Target): Promise<{ flows: number; docs: number }> {
    const { rows: [row] } = await query<{ flows: number; docs: number }>(
      `SELECT COUNT(DISTINCT afv.source_flow_id)::int AS flows,
              COUNT(DISTINCT d.source_flow_id) FILTER (WHERE d.visibility = 'catalog')::int AS docs
         FROM app_versions av
         JOIN apps a ON a.id = av.app_id
         JOIN app_flow_versions afv ON afv.version_id = av.id
         LEFT JOIN feature_documents d ON d.source_flow_id = afv.source_flow_id
         LEFT JOIN feature_document_revisions r
           ON r.id = d.current_revision_id AND r.source_version_id = av.id
        WHERE a.name = $1 AND av.platform = $2 AND av.version_number = $3`,
      [target.app, target.platform, target.version_number],
    );
    return row ?? { flows: 0, docs: 0 };
  }

  await mkdir(dirname(logPath), { recursive: true });
  const done = await completedTargets(logDirectory);
  const pending = rows
    .filter((_target, index) => index % shards === shard)
    .filter((target) => !done.has(`${target.app}/${target.platform}/${target.version_number}`))
    .slice(0, maxApps);

  console.log(JSON.stringify({
    event: "sweep-start",
    provider,
    model,
    perApp,
    workers,
    shard,
    shards,
    totalTargets: rows.length,
    alreadyDone: done.size,
    pending: pending.length,
  }));

  // A provider outage (usage limit, expired auth) fails every target in seconds. Without
  // this the sweep burns hours hammering a dead endpoint, so stop after a failure streak.
  const failureStreakLimit = positiveInteger(argument("--failure-streak-limit"), 15);
  let failureStreak = 0;
  let ok = 0;
  let failed = 0;
  const sweepStarted = Date.now();
  for (const [index, target] of pending.entries()) {
    const key = `${target.app}/${target.platform}/${target.version_number}`;
    const started = Date.now();
    const result = await runOne(target, {
      provider,
      model,
      limit: perApp,
      workers,
      timeoutMs,
      visibility,
      maxEvidence,
    });
    const durationMs = Date.now() - started;
    const coverage = await fullyCovered(target);
    const complete = coverage.flows > 0 && coverage.docs >= coverage.flows;
    const status = complete ? "ok" : "failed";
    if (complete) {
      ok += 1;
      failureStreak = 0;
    } else {
      failed += 1;
      // Partial progress still means the provider is alive, so do not trip the breaker.
      if (coverage.docs === 0) failureStreak += 1;
      else failureStreak = 0;
    }
    const entry = {
      key,
      status,
      coverage: `${coverage.docs}/${coverage.flows}`,
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
      coverage: entry.coverage,
      durationLabel: entry.durationLabel,
      ok,
      failed,
      elapsedLabel: `${((Date.now() - sweepStarted) / 60_000).toFixed(1)}m`,
    }));
    if (failureStreak >= failureStreakLimit) {
      console.log(JSON.stringify({
        event: "sweep-aborted",
        reason: `${failureStreak} consecutive failures — provider is likely unavailable`,
        ok,
        failed,
        remaining: pending.length - index - 1,
      }));
      break;
    }
  }

  await closePool();
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
