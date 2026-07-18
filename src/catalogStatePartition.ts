import { disambiguateCatalogSlugs, type CatalogIdentityJob } from "./catalogIdentity.ts";
import type { CatalogRepairPhases } from "./progress.ts";

export interface CatalogStateJob extends CatalogIdentityJob {
  appName: string;
  status: string;
  repair?: CatalogRepairPhases;
  verification?: unknown;
  error?: string;
  finishedAt?: string;
}

const jobKey = (job: CatalogIdentityJob) => `${job.mobbinId}\u0000${job.platform}`;

export function consolidateCatalogJobs(
  primary: readonly CatalogStateJob[],
  delegated: readonly CatalogStateJob[],
): CatalogStateJob[] {
  const authoritative = new Map(primary.map((job) => [jobKey(job), { ...job }]));
  for (const job of delegated) authoritative.set(jobKey(job), { ...job });

  const before = new Map([...authoritative].map(([key, job]) => [key, job.slug]));
  return disambiguateCatalogSlugs([...authoritative.values()]).map((job) => {
    if (job.slug === before.get(jobKey(job))) return job;
    const repaired = {
      ...job,
      status: "pending",
      repair: { screens: true, uiElements: true, flows: true },
    };
    delete repaired.verification;
    delete repaired.error;
    delete repaired.finishedAt;
    return repaired;
  });
}

export function partitionCatalogJobs(
  jobs: readonly CatalogStateJob[],
  workerCount: number,
): CatalogStateJob[][] {
  if (!Number.isSafeInteger(workerCount) || workerCount < 1) throw new Error("workerCount must be positive");
  const ordered = jobs
    .map((job, index) => ({ job, index }))
    .sort((left, right) => Number(right.job.repair != null) - Number(left.job.repair != null) || left.index - right.index)
    .map(({ job }) => job);
  const partitions = Array.from({ length: workerCount }, () => [] as CatalogStateJob[]);
  ordered.forEach((job, index) => partitions[index % workerCount]!.push(job));
  return partitions;
}
