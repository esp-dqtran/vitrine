import { useCallback, useEffect, useState } from 'react';
import type { Job } from './types';

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

  const submitImport = async (name: string, url: string) => {
    const response = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'import-app', name, url }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? `Import returned ${response.status}`);
    await refresh();
  };

  const cancelJob = async (id: number) => {
    const response = await fetch(`/api/jobs/${id}/cancel`, { method: 'POST' });
    if (!response.ok) throw new Error(`Cancel returned ${response.status}`);
    await refresh();
  };

  return { jobs, error, refresh, submitImport, cancelJob };
}
