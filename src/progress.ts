import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

const CANCEL_PATH = "data/cancel-requested";

export interface ProgressState {
  stage: "crawl" | "caption" | "synthesize" | "smart-crawl";
  app: string;
  done: number;
  total: number;
  status: "running" | "done" | "error" | "cancelled" | "idle";
  message?: string;
  updatedAt: string;
}

export interface ProgressEntry extends ProgressState {
  id: string;
}

export interface ProgressSnapshot {
  entries: ProgressEntry[];
}

export interface ProgressStoreOptions {
  dataDir?: string;
  workerId?: string;
}

export interface StageOutcome {
  status: "done" | "cancelled" | "error";
  message?: string;
  discovered?: number;
  captured?: number;
}

export function assertCatalogStageComplete(label: string, outcome: StageOutcome): asserts outcome is StageOutcome & { discovered: number; captured: number } {
  if (outcome.status !== "done") {
    throw new Error(`${label}: ${outcome.status}${outcome.message ? ` ${outcome.message}` : ""}`);
  }
  if (!Number.isSafeInteger(outcome.discovered) || !Number.isSafeInteger(outcome.captured)) {
    throw new Error(`${label}: stage did not return auditable counts`);
  }
  if (outcome.captured !== outcome.discovered) {
    throw new Error(`${label}: captured ${outcome.captured}/${outcome.discovered}`);
  }
}

export interface CatalogArtifactCounts {
  screens?: number;
  uiElements?: number;
  flows?: number;
}

export interface CatalogRepairPhases {
  screens: boolean;
  uiElements: boolean;
  flows: boolean;
}

export type CatalogRepairPhase = keyof CatalogRepairPhases;

export function catalogRepairPlan(repair?: CatalogRepairPhases): CatalogRepairPhases {
  return repair ? { ...repair } : { screens: true, uiElements: true, flows: true };
}

export function markCatalogPhaseComplete(
  repair: CatalogRepairPhases,
  phase: CatalogRepairPhase,
): CatalogRepairPhases {
  return { ...repair, [phase]: false };
}

export function planCatalogRepair(input: {
  expected: CatalogArtifactCounts;
  persisted: Required<CatalogArtifactCounts>;
  invalidFlowReferences: number;
}): CatalogRepairPhases {
  const missing = (expected: number | undefined, persisted: number) => expected === undefined || persisted < expected;
  return {
    screens: missing(input.expected.screens, input.persisted.screens),
    uiElements: missing(input.expected.uiElements, input.persisted.uiElements),
    flows: missing(input.expected.flows, input.persisted.flows) || input.invalidFlowReferences > 0,
  };
}

export function parseCatalogLogCounts(lines: readonly string[]): CatalogArtifactCounts {
  const counts: CatalogArtifactCounts = {};
  const keepMax = (key: keyof CatalogArtifactCounts, value: number) => {
    counts[key] = Math.max(counts[key] ?? 0, value);
  };
  for (const line of lines) {
    let match = line.match(/Imported (\d+) screens image\(s\)/);
    if (match) keepMax("screens", Number(match[1]));
    match = line.match(/Captured \d+\/(\d+) (screens|UI elements) image\(s\)/);
    if (match) keepMax(match[2] === "screens" ? "screens" : "uiElements", Number(match[1]));
    match = line.match(/selected (\d+) of \d+ UI elements/i);
    if (match) keepMax("uiElements", Number(match[1]));
    match = line.match(/Imported \d+\/(\d+) flow\(s\)/);
    if (match) keepMax("flows", Number(match[1]));
  }
  return counts;
}

export function catalogCaptureTarget(tab: "screens" | "ui-elements", shown: number, selected: number | null): number {
  if (tab === "ui-elements" && selected !== null) return selected;
  return shown;
}

export function shouldRunCatalogJob(
  repairOnly: boolean,
  job: { status: string; repair?: CatalogRepairPhases },
): boolean {
  return job.status === "pending" && (!repairOnly || job.repair !== undefined);
}

export function summarizeCatalogIntegrityState(
  jobs: ReadonlyArray<{ status: string; repair?: CatalogRepairPhases }>,
  queuedJobs: number,
  invalidFlowReferences = 0,
): { remainingRepairJobs: number; failedJobs: number; clean: boolean } {
  const remainingRepairJobs = jobs.filter((job) => job.repair !== undefined).length;
  const failedJobs = jobs.filter((job) => job.status === "failed").length;
  return {
    remainingRepairJobs,
    failedJobs,
    clean: remainingRepairJobs === 0 && failedJobs === 0 && queuedJobs === 0 && invalidFlowReferences === 0,
  };
}

const progressStages = new Set<ProgressState["stage"]>(["crawl", "caption", "synthesize", "smart-crawl"]);
const progressStatuses = new Set<ProgressState["status"]>(["running", "done", "error", "cancelled", "idle"]);

function storeDataDir(options: ProgressStoreOptions): string {
  return options.dataDir ?? process.env.DATA_DIR ?? "data";
}

function progressScope(workerId: string | undefined): string {
  const normalized = (workerId?.trim() || "default")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return normalized || "default";
}

function progressEntry(value: unknown, fallbackId?: string): ProgressEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const id = typeof item.id === "string" && item.id ? item.id : fallbackId;
  if (!id || typeof item.stage !== "string" || !progressStages.has(item.stage as ProgressState["stage"])) return null;
  if (typeof item.app !== "string" || !item.app) return null;
  if (!Number.isSafeInteger(item.done) || Number(item.done) < 0) return null;
  if (!Number.isSafeInteger(item.total) || Number(item.total) < 0) return null;
  if (typeof item.status !== "string" || !progressStatuses.has(item.status as ProgressState["status"])) return null;
  if (typeof item.updatedAt !== "string" || !item.updatedAt) return null;
  if (item.message !== undefined && typeof item.message !== "string") return null;
  return {
    id,
    stage: item.stage as ProgressState["stage"],
    app: item.app,
    done: Number(item.done),
    total: Number(item.total),
    status: item.status as ProgressState["status"],
    ...(typeof item.message === "string" ? { message: item.message } : {}),
    updatedAt: item.updatedAt,
  };
}

function readEntry(path: string, fallbackId?: string): ProgressEntry | null {
  try {
    return progressEntry(JSON.parse(readFileSync(path, "utf8")), fallbackId);
  } catch {
    return null;
  }
}

export function writeProgress(
  state: Omit<ProgressState, "updatedAt">,
  options: ProgressStoreOptions = {},
): void {
  const scope = progressScope(options.workerId ?? process.env.WORKER_ID);
  const directory = join(storeDataDir(options), "progress");
  mkdirSync(directory, { recursive: true });
  const target = join(directory, `${scope}.json`);
  const temporary = join(directory, `.${scope}.${process.pid}.${randomUUID()}.tmp`);
  const entry: ProgressEntry = { ...state, id: `worker:${scope}`, updatedAt: new Date().toISOString() };
  writeFileSync(temporary, JSON.stringify(entry));
  renameSync(temporary, target);
}

export function readProgress(options: ProgressStoreOptions = {}): ProgressSnapshot {
  const dataDir = storeDataDir(options);
  const directory = join(dataDir, "progress");
  const entries = existsSync(directory)
    ? readdirSync(directory)
      .filter((name) => name.endsWith(".json"))
      .map((name) => readEntry(join(directory, name)))
      .filter((entry): entry is ProgressEntry => entry !== null)
      .sort((left, right) => left.id.localeCompare(right.id))
    : [];
  if (entries.length) return { entries };

  const legacy = readEntry(join(dataDir, "progress.json"), "worker:legacy");
  return { entries: legacy ? [legacy] : [] };
}

// Cooperative cancellation: the pipeline process and the vite dev server are separate
// processes, so a flag file (not an in-memory signal) is the only thing they share.
export function requestCancel(): void {
  writeFileSync(CANCEL_PATH, "");
}

export function isCancelRequested(): boolean {
  return existsSync(CANCEL_PATH);
}

export function clearCancel(): void {
  rmSync(CANCEL_PATH, { force: true });
}
