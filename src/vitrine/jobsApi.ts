import type { Platform } from '../platformFromUrl';

export async function submitImportJob(name: string, url: string, platform: Platform): Promise<void> {
  const response = await fetch('/api/jobs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'import-app', name, url, platform }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? `Import returned ${response.status}`);
}
