import type { Platform } from '../platformFromUrl';
import { platformFromUrl } from '../platformFromUrl.ts';

export async function submitImportJob(name: string, url: string, platform: Platform): Promise<void> {
  return submitJob({ type: 'import-app', name, url, platform });
}

export async function submitUrlImport(url: string): Promise<void> {
  const mobbin = mobbinAppsImport(url);
  if (mobbin) {
    await submitImportJob(mobbin.name, mobbin.url, mobbin.platform);
    return;
  }
  await submitJob({ type: 'crawl-public-page', url });
}

async function submitJob(payload: Record<string, unknown>): Promise<void> {
  const response = await fetch('/api/jobs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? `Import returned ${response.status}`);
}

function mobbinAppsImport(raw: string): { name: string; url: string; platform: Platform } | undefined {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || !['mobbin.com', 'www.mobbin.com'].includes(url.hostname)) return undefined;
    const match = /^\/apps\/([^/]+)\/[^/]+\/screens\/?$/.exec(url.pathname);
    if (!match) return undefined;
    const slug = match[1];
    const identity = /^(.*)-(?:web|ios|android)-[0-9a-f-]{36}$/i.exec(slug)?.[1] ?? slug;
    const name = identity.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
    if (!name) return undefined;
    return { name, url: raw, platform: platformFromUrl(raw) };
  } catch {
    return undefined;
  }
}
