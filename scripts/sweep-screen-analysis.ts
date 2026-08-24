import { spawn, type ChildProcess } from "node:child_process";
import { appendFile, createWriteStream } from "node:fs";
import { mkdir as mkdirAsync } from "node:fs/promises";
import { join, resolve } from "node:path";
import { closePool, query } from "../src/db.ts";
import { UI_ELEMENT_PROMPT_VERSION } from "../src/uiElementExtraction.ts";

interface Target {
  version_id: number;
  app: string;
  platform: "ios" | "android" | "web";
  version_number: number;
  screens: number;
  remaining: number;
}

function argument(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function positiveInteger(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`${name} must be positive`);
  return parsed;
}

function safeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/^-+|-+$/g, "") || "app";
}

function commaSeparated(value: string): string[] {
  return [...new Set(value.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean))];
}

function event(path: string, value: Record<string, unknown>): void {
  appendFile(path, `${JSON.stringify({ ...value, at: new Date().toISOString() })}\n`, (error) => {
    if (error) console.error(`Could not append sweep event: ${error.message}`);
  });
  console.log(JSON.stringify(value));
}

async function targets(providerModel: string): Promise<Target[]> {
  const { rows } = await query<Target>(
    `SELECT av.id AS version_id, a.name AS app, av.platform, av.version_number,
            COUNT(*)::int AS screens,
            COUNT(*) FILTER (WHERE complete.source_image_id IS NULL)::int AS remaining
       FROM app_versions av
       JOIN apps a ON a.id = av.app_id
       JOIN version_images membership ON membership.version_id = av.id
       JOIN images screen ON screen.id = membership.image_id AND screen.kind = 'screen'
       JOIN stored_objects object ON object.object_key = screen.object_key
       LEFT JOIN ui_element_extractions complete
         ON complete.version_id = av.id
        AND complete.source_image_id = screen.id
        AND complete.provider_model = $1
        AND complete.prompt_version = $2
        AND complete.status = 'complete'
      GROUP BY av.id, a.name, av.platform, av.version_number
     HAVING COUNT(*) FILTER (WHERE complete.source_image_id IS NULL) > 0
      ORDER BY COUNT(*) FILTER (WHERE complete.source_image_id IS NULL),
               lower(a.name), av.platform, av.version_number`,
    [providerModel, UI_ELEMENT_PROMPT_VERSION],
  );
  return rows;
}

async function remaining(target: Target, providerModel: string): Promise<number> {
  const { rows: [row] } = await query<{ remaining: number }>(
    `SELECT COUNT(*) FILTER (WHERE complete.source_image_id IS NULL)::int AS remaining
       FROM version_images membership
       JOIN images screen ON screen.id = membership.image_id AND screen.kind = 'screen'
       JOIN stored_objects object ON object.object_key = screen.object_key
       LEFT JOIN ui_element_extractions complete
         ON complete.version_id = membership.version_id
        AND complete.source_image_id = screen.id
        AND complete.provider_model = $2
        AND complete.prompt_version = $3
        AND complete.status = 'complete'
      WHERE membership.version_id = $1`,
    [target.version_id, providerModel, UI_ELEMENT_PROMPT_VERSION],
  );
  return row?.remaining ?? target.remaining;
}

async function run(): Promise<void> {
  const model = argument("--model", "gpt-5.6-luna");
  const effort = argument("--effort", "high");
  const workers = positiveInteger(argument("--workers", "4"), "--workers");
  const attempts = positiveInteger(argument("--attempts", "2"), "--attempts");
  const failureStreakLimit = positiveInteger(
    argument("--failure-streak-limit", "3"),
    "--failure-streak-limit",
  );
  const priorityApps = commaSeparated(argument(
    "--priority-apps",
    process.env.SCREEN_ANALYSIS_PRIORITY_APPS ?? "",
  ));
  const priorityRank = new Map(priorityApps.map((app, index) => [app, index]));
  const dryRun = process.argv.includes("--dry-run");
  const providerModel = `kiro-cli:${model}-ui-elements`;
  const outputDirectory = resolve(argument(
    "--output-dir",
    join("data", "ui-element-extraction", `full-catalog-v${UI_ELEMENT_PROMPT_VERSION}`),
  ));
  await mkdirAsync(outputDirectory, { recursive: true, mode: 0o700 });
  const eventPath = join(outputDirectory, "sweep-events.jsonl");
  const allTargets = await targets(providerModel);
  const screenCount = allTargets.reduce((sum, target) => sum + target.remaining, 0);

  console.log(JSON.stringify({
    event: "sweep-start",
    providerModel,
    promptVersion: UI_ELEMENT_PROMPT_VERSION,
    workers,
    targets: allTargets.length,
    remainingScreens: screenCount,
    priorityApps,
    dryRun,
  }));
  const grouped = new Map<string, Target[]>();
  for (const target of allTargets) {
    const list = grouped.get(target.app) ?? [];
    list.push(target);
    grouped.set(target.app, list);
  }
  const appGroups = [...grouped.entries()].sort((left, right) =>
    (priorityRank.get(left[0].toLowerCase()) ?? Number.MAX_SAFE_INTEGER)
      - (priorityRank.get(right[0].toLowerCase()) ?? Number.MAX_SAFE_INTEGER)
    || Math.min(...left[1].map(({ remaining }) => remaining))
      - Math.min(...right[1].map(({ remaining }) => remaining))
    || left[0].localeCompare(right[0]));
  if (dryRun) {
    console.log(JSON.stringify({
      sample: appGroups.slice(0, 10).flatMap(([, appTargets]) => appTargets),
    }, null, 2));
    return;
  }

  const activeChildren = new Set<ChildProcess>();
  let stopping = false;
  const stop = (signal: NodeJS.Signals): void => {
    if (stopping) return;
    stopping = true;
    console.warn(`Received ${signal}; stopping active screen-analysis children`);
    for (const child of activeChildren) child.kill("SIGTERM");
  };
  process.once("SIGINT", () => stop("SIGINT"));
  process.once("SIGTERM", () => stop("SIGTERM"));

  let nextGroup = 0;
  let completedTargets = 0;
  let partialTargets = 0;
  const worker = async (workerNumber: number): Promise<void> => {
    let infrastructureFailureStreak = 0;
    while (!stopping) {
      const groupIndex = nextGroup;
      nextGroup += 1;
      if (groupIndex >= appGroups.length) return;
      const [, appTargets] = appGroups[groupIndex];
      for (const target of appTargets) {
        if (stopping) return;
        let targetRemaining = target.remaining;
        let lastCode = 0;
        for (let attempt = 1; attempt <= attempts && targetRemaining > 0; attempt += 1) {
          const key = `${safeName(target.app)}-${target.platform}-v${target.version_number}`;
          const reportPath = join(outputDirectory, `${key}-attempt-${attempt}.json`);
          const logPath = join(outputDirectory, `${key}.log`);
          await mkdirAsync(outputDirectory, { recursive: true, mode: 0o700 });
          const log = createWriteStream(logPath, { flags: "a", mode: 0o600 });
          log.write(`\n${new Date().toISOString()} worker=${workerNumber} attempt=${attempt}\n`);
          const child = spawn(process.execPath, [
            "--env-file=.env",
            "--import", "tsx",
            "scripts/extract-ui-elements.ts",
            "--app", target.app,
            "--platform", target.platform,
            "--version", String(target.version_number),
            "--provider", "kiro",
            "--concurrency", "1",
            "--limit", "5000",
            "--allow-empty",
            "--output", reportPath,
          ], {
            cwd: process.cwd(),
            env: {
              ...process.env,
              KIRO_CLI_UI_ELEMENT_MODEL: model,
              KIRO_CLI_UI_ELEMENT_EFFORT: effort,
            },
            stdio: ["ignore", "pipe", "pipe"],
          });
          activeChildren.add(child);
          child.stdout?.pipe(log, { end: false });
          child.stderr?.pipe(log, { end: false });
          lastCode = await new Promise<number>((resolveCode) => {
            child.once("error", () => resolveCode(1));
            child.once("close", (code) => resolveCode(code ?? 1));
          });
          activeChildren.delete(child);
          log.end();
          if (stopping) return;
          targetRemaining = await remaining(target, providerModel);
          event(eventPath, {
            event: "target-attempt",
            worker: workerNumber,
            app: target.app,
            platform: target.platform,
            version: target.version_number,
            attempt,
            exitCode: lastCode,
            screens: target.screens,
            remaining: targetRemaining,
          });
          if (lastCode === 0) infrastructureFailureStreak = 0;
          else infrastructureFailureStreak += 1;
          if (infrastructureFailureStreak >= failureStreakLimit) {
            stopping = true;
            event(eventPath, {
              event: "circuit-breaker",
              worker: workerNumber,
              failureStreak: infrastructureFailureStreak,
            });
            for (const active of activeChildren) active.kill("SIGTERM");
            return;
          }
        }
        if (targetRemaining === 0) completedTargets += 1;
        else partialTargets += 1;
        event(eventPath, {
          event: "target-done",
          worker: workerNumber,
          app: target.app,
          platform: target.platform,
          version: target.version_number,
          status: targetRemaining === 0 ? "complete" : "partial",
          remaining: targetRemaining,
          completedTargets,
          partialTargets,
        });
      }
    }
  };

  await Promise.all(Array.from({ length: workers }, (_, index) => worker(index + 1)));
  if (stopping) {
    event(eventPath, {
      event: "sweep-done",
      stopped: true,
      completedTargets,
      partialTargets,
    });
    return;
  }
  const unfinished = await targets(providerModel);
  event(eventPath, {
    event: "sweep-done",
    stopped: stopping,
    completedTargets,
    partialTargets,
    remainingTargets: unfinished.length,
    remainingScreens: unfinished.reduce((sum, target) => sum + target.remaining, 0),
  });
}

try {
  await run();
} finally {
  await closePool();
}
