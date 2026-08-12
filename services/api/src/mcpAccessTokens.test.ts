import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import { test } from "node:test";
import { mcpTokenHash, newMcpAccessToken } from "../../../src/mcpTokenStore.ts";
import { createApiApp } from "./app.ts";

const user = { id: 7, email: "member@example.com", role: "user" as const };
const accessToken = {
  id: 4,
  label: "Flow MCP",
  prefix: "vtr_mcp_abcdefg",
  createdAt: "2026-08-12T00:00:00.000Z",
  expiresAt: "2026-11-10T00:00:00.000Z",
  lastUsedAt: null,
};

async function serve(app: ReturnType<typeof createApiApp>): Promise<{ base: string; server: Server }> {
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server did not listen");
  return { base: `http://127.0.0.1:${address.port}`, server };
}

test("MCP access tokens are distinct high-entropy credentials", () => {
  const first = newMcpAccessToken();
  const second = newMcpAccessToken();
  assert.match(first, /^vtr_mcp_[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first, second);
  assert.match(mcpTokenHash(first), /^[0-9a-f]{64}$/);
  assert.notEqual(mcpTokenHash(first), first);
});

test("members can list, create, and revoke only their Flow access tokens", async (t) => {
  const created: unknown[] = [];
  const revoked: unknown[] = [];
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async (token: string) => token === "browser-token" ? user : undefined,
    listMcpAccessTokens: async () => [accessToken],
    createMcpAccessToken: async (input: unknown) => {
      created.push(input);
      return { token: "vtr_mcp_secret-value", accessToken };
    },
    revokeMcpAccessToken: async (input: unknown) => {
      revoked.push(input);
      return true;
    },
  } as never));
  t.after(() => server.close());
  const headers = { authorization: "Bearer browser-token", "content-type": "application/json" };

  const list = await fetch(`${base}/auth/mcp-tokens`, { headers });
  assert.equal(list.status, 200);
  assert.deepEqual(await list.json(), { tokens: [accessToken] });

  const create = await fetch(`${base}/auth/mcp-tokens`, {
    method: "POST", headers, body: JSON.stringify({}),
  });
  assert.equal(create.status, 201);
  assert.deepEqual(await create.json(), { token: "vtr_mcp_secret-value", accessToken });
  assert.deepEqual(created, [{ userId: 7, label: undefined }]);

  const revoke = await fetch(`${base}/auth/mcp-tokens/4`, { method: "DELETE", headers });
  assert.equal(revoke.status, 204);
  assert.deepEqual(revoked, [{ userId: 7, tokenId: 4 }]);
  assert.equal((await fetch(`${base}/auth/mcp-tokens`)).status, 401);
});
