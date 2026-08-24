import assert from 'node:assert/strict';
import test from 'node:test';
import { createMcpAccessToken } from './mcpApi.ts';

test('creates a named MCP access token for the signed-in user', async (t) => {
  let request: { url: string; method?: string; body?: unknown } | undefined;
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    request = {
      url: String(input),
      method: init?.method,
      body: JSON.parse(String(init?.body)),
    };
    return Response.json({
      token: 'vtr_mcp_secret-value',
      accessToken: {
        id: 4,
        label: "Kai's Codex",
        prefix: 'vtr_mcp_abcdefg',
        createdAt: '2026-08-24T00:00:00.000Z',
        expiresAt: '2026-11-22T00:00:00.000Z',
        lastUsedAt: null,
      },
    }, { status: 201 });
  });

  const created = await createMcpAccessToken("Kai's Codex");

  assert.equal(created.accessToken.label, "Kai's Codex");
  assert.deepEqual(request, {
    url: '/api/auth/mcp-tokens',
    method: 'POST',
    body: { label: "Kai's Codex" },
  });
});
