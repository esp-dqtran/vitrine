import type { Job, JobPipeline } from './types.ts';

export function groupPipelines(jobs: Job[]): JobPipeline[] {
  const byParent = new Map<number, Job[]>();
  for (const job of jobs) {
    if (job.parent_id == null) continue;
    const siblings = byParent.get(job.parent_id) ?? [];
    siblings.push(job);
    byParent.set(job.parent_id, siblings);
  }

  const descend = (job: Job): Job[] => [
    job,
    ...(byParent.get(job.id) ?? [])
      .sort((a, b) => a.id - b.id)
      .flatMap(descend),
  ];

  return jobs
    .filter((job) => job.parent_id == null && job.type === 'import-app')
    .sort((a, b) => b.id - a.id)
    .map((root) => ({ root, stages: descend(root) }));
}
