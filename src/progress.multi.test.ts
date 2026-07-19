import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readProgress, writeProgress, type ProgressState } from "./progress.ts";

function running(app: string): Omit<ProgressState, "updatedAt"> {
  return { stage: "crawl", app, done: 1, total: 4, status: "running", message: "Downloading" };
}

test("keeps concurrent worker progress isolated", () => {
  const root = mkdtempSync(join(tmpdir(), "astryx-progress-"));
  const previousCwd = process.cwd();
  const previousWorkerId = process.env.WORKER_ID;
  mkdirSync(join(root, "data"));

  try {
    process.chdir(root);
    process.env.WORKER_ID = "1";
    writeProgress(running("linear"));
    process.env.WORKER_ID = "2";
    writeProgress(running("notion"));

    assert.deepEqual(
      readProgress()?.entries.map(({ id, app }) => ({ id, app })),
      [
        { id: "worker:1", app: "linear" },
        { id: "worker:2", app: "notion" },
      ],
    );
    assert.deepEqual(readdirSync(join(root, "data", "progress")).sort(), ["1.json", "2.json"]);
  } finally {
    process.chdir(previousCwd);
    if (previousWorkerId === undefined) delete process.env.WORKER_ID;
    else process.env.WORKER_ID = previousWorkerId;
    rmSync(root, { recursive: true, force: true });
  }
});

test("uses legacy progress only until a scoped worker record exists", () => {
  const root = mkdtempSync(join(tmpdir(), "astryx-progress-"));
  const dataDir = join(root, "data");
  mkdirSync(dataDir);
  writeFileSync(join(dataDir, "progress.json"), JSON.stringify({
    ...running("legacy"),
    updatedAt: "2026-07-19T00:00:00.000Z",
  }));

  try {
    assert.deepEqual(readProgress({ dataDir }).entries.map(({ id, app }) => ({ id, app })), [
      { id: "worker:legacy", app: "legacy" },
    ]);

    writeProgress(running("figma"), { dataDir, workerId: "3" });
    writeFileSync(join(dataDir, "progress", "broken.json"), "{broken");
    assert.deepEqual(readProgress({ dataDir }).entries.map(({ id, app }) => ({ id, app })), [
      { id: "worker:3", app: "figma" },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
