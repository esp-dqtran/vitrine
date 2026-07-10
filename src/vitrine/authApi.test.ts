import { test } from "node:test";
import assert from "node:assert/strict";
import { getCurrentUser, login, logout } from "./authApi.ts";

test("maps 401 me responses to no user", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(JSON.stringify({ error: "Authentication required" }), { status: 401 })
  );
  assert.equal(await getCurrentUser(), null);
});

test("returns the safe user from login", async (t) => {
  const user = { id: 1, email: "admin@example.com", role: "admin" as const };
  t.mock.method(
    globalThis,
    "fetch",
    async (_input: string | URL | Request, init?: RequestInit) => {
    assert.equal(init?.method, "POST");
    return new Response(JSON.stringify(user), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    }
  );
  assert.deepEqual(await login("admin@example.com", "password"), user);
});

test("surfaces the generic login error and posts logout", async (t) => {
  const fetchMock = t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request) => {
    if (String(input).endsWith("/logout")) return new Response(null, { status: 204 });
    return new Response(JSON.stringify({ error: "Invalid email or password" }), { status: 401 });
    }
  );
  await assert.rejects(login("admin@example.com", "wrong"), /Invalid email or password/);
  await logout();
  assert.equal(fetchMock.mock.callCount(), 2);
});
