import { apiFetch } from './apiFetch.ts';
import type { ThreadsMarketingPost } from '../threadsMarketing.ts';

export interface ThreadsMarketingDashboard {
  configured: boolean;
  dailyTime: string | null;
  timeZone: string | null;
  posts: ThreadsMarketingPost[];
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, init);
  const body = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(body.error ?? `${path} returned ${response.status}`);
  return body as T;
}

export function fetchThreadsMarketingDashboard(): Promise<ThreadsMarketingDashboard> {
  return apiJson('/api/admin/threads-marketing');
}

export function publishThreadsPaletteNow(): Promise<ThreadsMarketingPost> {
  return apiJson('/api/admin/threads-marketing/posts', { method: 'POST' });
}

export function refreshThreadsMetrics(): Promise<ThreadsMarketingPost[]> {
  return apiJson('/api/admin/threads-marketing/insights', { method: 'POST' });
}
