import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const PROGRESS_PATH = "data/progress.json";
const CANCEL_PATH = "data/cancel-requested";

export interface ProgressState {
  stage: "crawl" | "caption" | "synthesize";
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
