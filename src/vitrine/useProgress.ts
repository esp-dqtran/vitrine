import { useEffect, useState } from 'react';
import type { Progress, ProgressSnapshot } from './types';

export interface ProgressEventSource {
  addEventListener(type: string, listener: EventListener): void;
  close(): void;
}

type ProgressSourceFactory = (url: string) => ProgressEventSource;

const stages = new Set<Progress['stage']>(['crawl', 'caption', 'synthesize', 'smart-crawl']);
const statuses = new Set<Progress['status']>(['running', 'done', 'error', 'cancelled', 'idle']);

function isProgress(value: unknown): value is Progress {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string' && Boolean(item.id)
    && typeof item.stage === 'string' && stages.has(item.stage as Progress['stage'])
    && typeof item.app === 'string' && Boolean(item.app)
    && Number.isSafeInteger(item.done) && Number(item.done) >= 0
    && Number.isSafeInteger(item.total) && Number(item.total) >= 0
    && typeof item.status === 'string' && statuses.has(item.status as Progress['status'])
    && (item.message === undefined || typeof item.message === 'string')
    && typeof item.updatedAt === 'string' && Boolean(item.updatedAt);
}

function parseSnapshot(data: string): ProgressSnapshot | null {
  try {
    const value = JSON.parse(data) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const entries = (value as { entries?: unknown }).entries;
    return Array.isArray(entries) && entries.every(isProgress) ? { entries } : null;
  } catch {
    return null;
  }
}

export function subscribeToProgress(
  update: (snapshot: ProgressSnapshot) => void,
  createSource: ProgressSourceFactory = (url) => new EventSource(url),
): () => void {
  const source = createSource('/api/progress/stream');
  source.addEventListener('progress', ((event: MessageEvent<string>) => {
    const snapshot = parseSnapshot(event.data);
    if (snapshot) update(snapshot);
  }) as EventListener);
  return () => source.close();
}

export function useProgress() {
  const [snapshot, setSnapshot] = useState<ProgressSnapshot | null>(null);

  useEffect(() => subscribeToProgress(setSnapshot), []);

  return snapshot;
}
