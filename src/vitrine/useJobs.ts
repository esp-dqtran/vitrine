import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from './apiFetch.ts';
import type { Job } from './types';

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await apiFetch('/api/jobs');
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

  const cancelJob = async (id: number) => {
    const response = await apiFetch(`/api/jobs/${id}/cancel`, { method: 'POST' });
    if (!response.ok) throw new Error(`Cancel returned ${response.status}`);
    await refresh();
  };

  return { jobs, error, refresh, cancelJob };
}
