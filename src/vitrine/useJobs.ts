import { useCallback, useEffect, useState } from 'react';
import type { Job } from './types';
import type { Platform } from '../platformFromUrl';
import { submitImportJob } from './jobsApi';

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch('/api/jobs');
    if (!response.ok) throw new Error(`/api/jobs returned ${response.status}`);
    setJobs(await response.json());
    setError(null);
  }, []);

  useEffect(() => {
    refresh().catch((cause: Error) => setError(cause.message));
    const id = window.setInterval(() => {
      if (jobs.some((job) => job.status === 'queued' || job.status === 'running')) {
        refresh().catch((cause: Error) => setError(cause.message));
      }
    }, 1500);
    return () => window.clearInterval(id);
  }, [jobs, refresh]);

  const submitImport = async (name: string, url: string, platform: Platform) => {
    await submitImportJob(name, url, platform);
    await refresh();
  };

  const cancelJob = async (id: number) => {
    const response = await fetch(`/api/jobs/${id}/cancel`, { method: 'POST' });
    if (!response.ok) throw new Error(`Cancel returned ${response.status}`);
    await refresh();
  };

  return { jobs, error, refresh, submitImport, cancelJob };
}
