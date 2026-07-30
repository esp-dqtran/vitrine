import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  access,
  mkdir,
  readFile,
  readdir,
  rename,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  buildKiroReconciliationPrompt,
  extractKiroJson,
  reconciliationReviewRecommendation,
  validateKiroReconciliation,
  type PersistedKiroReconciliation,
  type ResearchPacket,
  type VisualArtifact,
} from "./kiro-reconciliation.ts";
import { findKiroSessionResult } from "./kiro-session-store.ts";

type Failure = {
  file: string;
  error: string;
  at: string;
};

type Progress = {
  schemaVersion: 1;
  app: string;
  status: "running" | "done" | "error";
  model: string;
  effort: string;
  workers: number;
  totalPackets: number;
  eligiblePackets: number;
  queued: number;
  completed: number;
  skipped: number;
  failed: number;
  active: string[];
  credits: number;
  startedAt: string;
  updatedAt: string;
  failures: Failure[];
};

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function positiveInteger(value: string | undefined, fallback: number, label: string): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function atomicJson(path: string, value: unknown): Promise<void> {
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

function usage(output: string): { credits?: number; elapsed?: string } {
  const plain = output.replace(
    // eslint-disable-next-line no-control-regex
    /\u001B(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001B\\))/g,
    "",
  );
  const match = plain.match(/Credits:\s*([\d.]+)\s*[•|]\s*Time:\s*([^\r\n]+)/i);
  if (!match) return {};
  return { credits: Number(match[1]), elapsed: match[2].trim() };
}

async function runKiro(
  binary: string,
  model: string,
  effort: string,
  prompt: string,
  cwd: string,
): Promise<{ output: string; code: number }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(binary, [
      "chat",
      "--model",
      model,
      "--effort",
      effort,
      "--no-interactive",
      "--trust-tools=fs_read",
      "--wrap",
      "never",
      prompt,
    ], {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const append = (chunk: Buffer): void => {
      output += chunk.toString("utf8");
      if (output.length > 4_000_000) {
        child.kill("SIGTERM");
        reject(new Error("Kiro output exceeded 4 MB"));
      }
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.on("error", reject);
    child.on("close", (code) => resolvePromise({ output, code: code ?? 1 }));
  });
}

async function main(): Promise<void> {
  const app = argument("--app") ?? "amazon-shopping";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(app)) throw new Error("Invalid --app");
  const workers = positiveInteger(argument("--workers"), 3, "--workers");
  const limit = positiveInteger(argument("--limit"), Number.MAX_SAFE_INTEGER, "--limit");
  const model = argument("--model") ?? "gpt-5.6-terra";
  const effort = argument("--effort") ?? "high";
  const binary = argument("--kiro-bin") ?? "kiro-cli";
  const repositoryRoot = process.cwd();
  const appRoot = resolve(
    argument("--root") ?? join(repositoryRoot, "data", "feature-descriptions", app),
  );
  const packetRoot = join(appRoot, "research-context");
  const outputRoot = join(appRoot, "research-reconciliation");
  const progressPath = join(outputRoot, "progress.json");
  const startedAt = new Date().toISOString();
  const allFiles = (await readdir(packetRoot))
    .filter((file) => file.endsWith(".json") && file !== "index.json")
    .sort();
  const packets = await Promise.all(allFiles.map(async (file) => ({
    file,
    packet: JSON.parse(await readFile(join(packetRoot, file), "utf8")) as ResearchPacket,
  })));
  const eligible = packets.filter(({ packet }) => packet.documentedContext.claims.length > 0);
  const skippedNoContext = packets.length - eligible.length;
  const pending: typeof eligible = [];
  let skippedExisting = 0;

  for (const item of eligible) {
    const outputPath = join(outputRoot, item.file);
    if (!await exists(outputPath)) {
      pending.push(item);
      continue;
    }
    try {
      const saved = JSON.parse(await readFile(outputPath, "utf8")) as PersistedKiroReconciliation;
      const visualPath = resolve(packetRoot, item.packet.visualAnalysis.artifact);
      const visual = JSON.parse(await readFile(visualPath, "utf8")) as VisualArtifact;
      validateKiroReconciliation(saved.result, item.packet, visual);
      skippedExisting += 1;
    } catch {
      pending.push(item);
    }
  }

  const queue = pending.slice(0, limit);
  const progress: Progress = {
    schemaVersion: 1,
    app,
    status: "running",
    model,
    effort,
    workers,
    totalPackets: packets.length,
    eligiblePackets: eligible.length,
    queued: queue.length,
    completed: 0,
    skipped: skippedNoContext + skippedExisting,
    failed: 0,
    active: [],
    credits: 0,
    startedAt,
    updatedAt: startedAt,
    failures: [],
  };
  await atomicJson(progressPath, progress);
  console.log(JSON.stringify({
    event: "start",
    app,
    model,
    effort,
    workers,
    totalPackets: packets.length,
    eligiblePackets: eligible.length,
    queued: queue.length,
    skipped: progress.skipped,
  }));

  let cursor = 0;
  let progressWrite = Promise.resolve();
  const updateProgress = async (): Promise<void> => {
    progress.updatedAt = new Date().toISOString();
    const snapshot = structuredClone(progress);
    progressWrite = progressWrite.then(() => atomicJson(progressPath, snapshot));
    await progressWrite;
  };

  const worker = async (workerId: number): Promise<void> => {
    while (cursor < queue.length) {
      const item = queue[cursor];
      cursor += 1;
      progress.active.push(item.file);
      await updateProgress();
      const packetPath = join(packetRoot, item.file);
      const visualPath = resolve(packetRoot, item.packet.visualAnalysis.artifact);
      try {
        const visual = JSON.parse(await readFile(visualPath, "utf8")) as VisualArtifact;
        const requestStartedAt = Date.now();
        const response = await runKiro(
          binary,
          model,
          effort,
          buildKiroReconciliationPrompt(packetPath, visualPath),
          repositoryRoot,
        );
        if (response.code !== 0) {
          throw new Error(`Kiro exited ${response.code}: ${response.output.slice(-800)}`);
        }
        let extracted: unknown;
        let recovered: Awaited<ReturnType<typeof findKiroSessionResult>>;
        try {
          extracted = extractKiroJson(response.output);
        } catch (error) {
          recovered = await findKiroSessionResult({
            cwd: repositoryRoot,
            marker: item.file,
            startedAfter: requestStartedAt,
          });
          if (!recovered) throw error;
          extracted = extractKiroJson(recovered.finalResponse);
        }
        const result = validateKiroReconciliation(
          extracted,
          item.packet,
          visual,
        );
        const measuredUsage = {
          ...recovered?.usage,
          ...usage(response.output),
        };
        const saved: PersistedKiroReconciliation = {
          schemaVersion: 1,
          generatedAt: new Date().toISOString(),
          provider: "kiro-cli",
          model,
          effort,
          source: {
            researchPacket: `../research-context/${item.file}`,
            visualArtifact: item.packet.visualAnalysis.artifact,
          },
          usage: measuredUsage,
          reviewRecommendation: reconciliationReviewRecommendation(item.packet, result),
          ...(recovered
            ? {
                recovery: {
                  source: "kiro-session-store",
                  conversationId: recovered.conversationId,
                },
              }
            : {}),
          result,
        };
        await atomicJson(join(outputRoot, item.file), saved);
        progress.completed += 1;
        progress.credits += measuredUsage.credits ?? 0;
        console.log(JSON.stringify({
          event: "completed",
          worker: workerId,
          file: item.file,
          credits: measuredUsage.credits,
          elapsed: measuredUsage.elapsed,
          replicationValue: result.modelAssessment.replicationValue,
          solReview: saved.reviewRecommendation.solReview,
        }));
      } catch (error) {
        const failure = {
          file: item.file,
          error: error instanceof Error ? error.message.slice(0, 1200) : String(error),
          at: new Date().toISOString(),
        };
        progress.failed += 1;
        progress.failures.push(failure);
        console.error(JSON.stringify({ event: "failed", worker: workerId, ...failure }));
      } finally {
        progress.active = progress.active.filter((file) => file !== item.file);
        await updateProgress();
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(workers, queue.length) }, (_, index) => worker(index + 1)),
  );
  progress.status = progress.failed > 0 ? "error" : "done";
  await updateProgress();

  const completedFiles = (await readdir(outputRoot))
    .filter((file) => file.endsWith(".json") && file !== "progress.json")
    .sort();
  const solReview: Array<{ file: string; reasons: string[] }> = [];
  for (const file of completedFiles) {
    const saved = JSON.parse(
      await readFile(join(outputRoot, file), "utf8"),
    ) as PersistedKiroReconciliation;
    if (saved.reviewRecommendation?.solReview) {
      solReview.push({ file, reasons: saved.reviewRecommendation.reasons });
    }
  }
  await atomicJson(join(outputRoot, "sol-review-queue.json"), {
    schemaVersion: 1,
    app,
    generatedAt: new Date().toISOString(),
    entries: solReview,
  });
  console.log(JSON.stringify({
    event: "done",
    status: progress.status,
    completed: progress.completed,
    failed: progress.failed,
    skipped: progress.skipped,
    credits: progress.credits,
    solReview: solReview.length,
  }));
  if (progress.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
