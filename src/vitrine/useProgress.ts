import { useEffect, useState } from 'react';
import type { Progress } from './types';

const POLL_MS = 1500;

export function useProgress() {
  const [progress, setProgress] = useState<Progress | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      fetch('/api/progress')
        .then((res) => (res.ok ? res.json() : null))
        .then((data: Progress | null) => {
          if (!cancelled) setProgress(data);
        })
        .catch(() => {});
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return progress;
}
