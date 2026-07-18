import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const PROGRESS_PATH = "data/progress.json";
const CANCEL_PATH = "data/cancel-requested";

export interface ProgressState {
  stage: "crawl" | "caption" | "synthesize" | "smart-crawl";
  app: string;
  done: number;
  total: number;
  status: "running" | "done" | "error" | "cancelled";
  message?: string;
  updatedAt: string;
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

export function writeProgress(state: Omit<ProgressState, "updatedAt">): void {
  writeFileSync(PROGRESS_PATH, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }));
}

export function readProgress(): ProgressState | null {
  if (!existsSync(PROGRESS_PATH)) return null;
  try {
    return JSON.parse(readFileSync(PROGRESS_PATH, "utf8"));
  } catch {
    return null; // mid-write or corrupted — the next poll picks up the next successful write
  }
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
