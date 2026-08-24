import { apiFetch } from './apiFetch.ts';

export interface McpAccessToken {
  id: number;
  label: string;
  prefix: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
}

export async function listMcpAccessTokens(): Promise<McpAccessToken[]> {
  const response = await apiFetch('/api/auth/mcp-tokens');
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? `Could not load Flow access tokens (${response.status})`);
  return body.tokens as McpAccessToken[];
}

export async function createMcpAccessToken(label?: string): Promise<{ token: string; accessToken: McpAccessToken }> {
  const normalizedLabel = label?.trim();
  const response = await apiFetch('/api/auth/mcp-tokens', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(normalizedLabel ? { label: normalizedLabel } : {}),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? `Could not create Flow access token (${response.status})`);
  return body as { token: string; accessToken: McpAccessToken };
}

export async function revokeMcpAccessToken(tokenId: number): Promise<void> {
  const response = await apiFetch(`/api/auth/mcp-tokens/${tokenId}`, { method: 'DELETE' });
  if (response.status === 204) return;
  const body = await response.json().catch(() => ({}));
  throw new Error(body.error ?? `Could not revoke Flow access token (${response.status})`);
}
