import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { consolidateCatalogJobs, partitionCatalogJobs, type CatalogStateJob } from "../src/catalogStatePartition.ts";

interface State { generatedAt: string; jobs: CatalogStateJob[] }

const statePath = (worker: number) => `data/catalog-import-state-${worker}.json`;
const logPath = (worker: number) => `data/logs/catalog-import-${worker}.log`;
const readState = (worker: number): State => JSON.parse(readFileSync(statePath(worker), "utf8")) as State;

const primary = [1, 2, 3, 4].flatMap((worker) => readState(worker).jobs);
const delegated = [5, 6].flatMap((worker) => readState(worker).jobs);
const expectedKeys = new Set(primary.map((job) => `${job.mobbinId}\u0000${job.platform}`));
const consolidated = consolidateCatalogJobs(primary, delegated);
const actualKeys = new Set(consolidated.map((job) => `${job.mobbinId}\u0000${job.platform}`));
const identityKeys = new Set(consolidated.map((job) => `${job.slug}\u0000${job.platform}`));
if (actualKeys.size !== expectedKeys.size || consolidated.length !== expectedKeys.size) {
  throw new Error(`Catalog consolidation changed job count: expected ${expectedKeys.size}, got ${consolidated.length}`);
}
if (identityKeys.size !== consolidated.length) throw new Error("Catalog still contains app/platform identity collisions");

const partitions = partitionCatalogJobs(consolidated, 6);
const generatedAt = new Date().toISOString();
const backupDir = `data/backups/catalog-repartition-${generatedAt.replace(/[:.]/g, "-")}`;
mkdirSync(`${backupDir}/logs`, { recursive: true });
for (const worker of [1, 2, 3, 4, 5, 6]) {
  copyFileSync(statePath(worker), `${backupDir}/catalog-import-state-${worker}.json`);
  if (existsSync(logPath(worker))) copyFileSync(logPath(worker), `${backupDir}/logs/catalog-import-${worker}.log`);
}
if (existsSync("data/catalog-import-delegation-5-6.json")) {
  copyFileSync("data/catalog-import-delegation-5-6.json", `${backupDir}/catalog-import-delegation-5-6.json`);
}

partitions.forEach((jobs, index) => {
  const path = statePath(index + 1);
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, `${JSON.stringify({ generatedAt, jobs }, null, 2)}\n`);
  renameSync(temporary, path);
});

console.log(JSON.stringify({
  backupDir,
  jobs: consolidated.length,
  partitions: partitions.map((jobs, index) => ({
    worker: index + 1,
    jobs: jobs.length,
    repairs: jobs.filter((job) => job.repair != null).length,
    pending: jobs.filter((job) => job.status === "pending").length,
    done: jobs.filter((job) => job.status === "done").length,
    failed: jobs.filter((job) => job.status === "failed").length,
  })),
}, null, 2));
