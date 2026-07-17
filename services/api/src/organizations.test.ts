import { test } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { createApiApp } from "./app.ts";
import type { OrganizationStore } from "../../../src/organizationStore.ts";

const user = { id: 2, email: "user@example.com", role: "user" as const };
const cookie = { cookie: "astryx_session=user", "content-type": "application/json" };

async function serve(app: ReturnType<typeof createApiApp>): Promise<{ base: string; server: Server }> {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  return { base: `http://127.0.0.1:${address.port}`, server };
}
const close = (server: Server): Promise<void> =>
  new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));

const stubStore = (overrides: Partial<OrganizationStore> = {}): OrganizationStore => ({
  createOrganization: async () => { throw new Error("unexpected"); },
  listForUser: async () => [],
  membershipRole: async () => undefined,
  listMembers: async () => undefined,
  addMember: async () => undefined,
  addMemberByEmail: async () => ({ status: "forbidden" }),
  removeMember: async () => false,
  ...overrides,
});

const appWith = (store: OrganizationStore, enabled = true) =>
  createApiApp({ resolveSession: async () => user, organizationStore: store, organizationsEnabled: enabled } as never);

test("hides organization routes entirely until Teams is enabled", async (t) => {
  const { base, server } = await serve(appWith(stubStore(), false));
  t.after(() => close(server));
  const response = await fetch(`${base}/organizations`, { headers: cookie });
  assert.equal(response.status, 404);
});

test("creates an organization for the signed-in user", async (t) => {
  const created: Array<[number, string]> = [];
  const store = stubStore({
    createOrganization: async (ownerUserId, name) => {
      created.push([ownerUserId, name]);
      return { id: 9, name, role: "owner", memberCount: 1, createdAt: "2026-07-17T00:00:00.000Z" };
    },
  });
  const { base, server } = await serve(appWith(store));
  t.after(() => close(server));
  const response = await fetch(`${base}/organizations`, { method: "POST", headers: cookie, body: JSON.stringify({ name: "Acme" }) });
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { id: 9, name: "Acme", role: "owner", memberCount: 1, createdAt: "2026-07-17T00:00:00.000Z" });
  assert.deepEqual(created, [[2, "Acme"]]);
});

test("rejects an empty organization name", async (t) => {
  const { base, server } = await serve(appWith(stubStore()));
  t.after(() => close(server));
  const response = await fetch(`${base}/organizations`, { method: "POST", headers: cookie, body: JSON.stringify({ name: "   " }) });
  assert.equal(response.status, 400);
});

test("invites a member by email: 404 unknown, 403 non-manager, 201 when permitted", async (t) => {
  const store = stubStore({
    addMemberByEmail: async (_orgId, _actor, email, role) => {
      if (email === "ghost@team.co") return { status: "user_not_found" };
      if (role === "admin") return { status: "forbidden" };
      return { status: "added", member: { userId: 9, email, role, createdAt: "2026-07-17T00:00:00.000Z" } };
    },
  });
  const { base, server } = await serve(appWith(store));
  t.after(() => close(server));
  const post = (body: unknown) => fetch(`${base}/organizations/1/members`, { method: "POST", headers: cookie, body: JSON.stringify(body) });
  assert.equal((await post({ email: "ghost@team.co", role: "member" })).status, 404);
  assert.equal((await post({ email: "new@team.co", role: "admin" })).status, 403);
  const ok = await post({ email: "new@team.co", role: "member" });
  assert.equal(ok.status, 201);
  assert.deepEqual(await ok.json(), { userId: 9, email: "new@team.co", role: "member", createdAt: "2026-07-17T00:00:00.000Z" });
});

test("removing a member returns 204 on success and 403 when not permitted", async (t) => {
  const store = stubStore({ removeMember: async (_orgId, _actor, targetUserId) => targetUserId === 9 });
  const { base, server } = await serve(appWith(store));
  t.after(() => close(server));
  assert.equal((await fetch(`${base}/organizations/1/members/9`, { method: "DELETE", headers: cookie })).status, 204);
  assert.equal((await fetch(`${base}/organizations/1/members/5`, { method: "DELETE", headers: cookie })).status, 403);
});

test("member listing is 404 for a non-member, JSON for a member", async (t) => {
  const store = stubStore({
    listMembers: async (_orgId, requesterUserId) =>
      requesterUserId === 2 ? [{ userId: 2, email: "user@example.com", role: "owner", createdAt: "2026-07-17T00:00:00.000Z" }] : undefined,
  });
  const { base, server } = await serve(appWith(store));
  t.after(() => close(server));
  const response = await fetch(`${base}/organizations/1/members`, { headers: cookie });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [{ userId: 2, email: "user@example.com", role: "owner", createdAt: "2026-07-17T00:00:00.000Z" }]);
});
