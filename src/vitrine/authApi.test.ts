import { test } from "node:test";
import assert from "node:assert/strict";
import { getCurrentUser, login, logout, signup } from "./authApi.ts";
import { clearAuthToken, getAuthToken, setAuthToken } from "./apiFetch.ts";

test("maps 401 me responses to no user", async (t) => {
  setAuthToken("expired-token");
  t.after(clearAuthToken);
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(JSON.stringify({ error: "Authentication required" }), { status: 401 })
  );
  assert.equal(await getCurrentUser(), null);
});

test("maps a nullable me response to no user", async (t) => {
  setAuthToken("valid-token");
  t.after(clearAuthToken);
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response("null", {
        status: 200,
        headers: { "content-type": "application/json" },
      })
  );
  assert.equal(await getCurrentUser(), null);
});

test("returns the safe user from login", async (t) => {
  const user = { id: 1, email: "admin@example.com", role: "admin" as const };
  t.after(clearAuthToken);
  t.mock.method(
    globalThis,
    "fetch",
    async (_input: string | URL | Request, init?: RequestInit) => {
    assert.equal(init?.method, "POST");
    return new Response(JSON.stringify({
      user,
      token: "header.payload.signature",
      expiresAt: "2026-08-04T18:00:00.000Z",
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    }
  );
  assert.deepEqual(await login("admin@example.com", "password"), user);
  assert.equal(getAuthToken(), "header.payload.signature");
});

test("surfaces the generic login error and posts logout", async (t) => {
  setAuthToken("header.payload.signature");
  t.after(clearAuthToken);
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
  assert.equal(getAuthToken(), null);
});

test("includes a referral token only when creating an account", async (t) => {
  let body: unknown;
  t.after(clearAuthToken);
  t.mock.method(globalThis, "fetch", async (_input: string | URL | Request, init?: RequestInit) => {
    body = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({
      user: { id: 2, email: "new@example.com", role: "user" },
      token: "header.payload.signature",
      expiresAt: "2026-08-04T18:00:00.000Z",
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  await signup("new@example.com", "a long enough password", "r".repeat(48));
  assert.deepEqual(body, {
    email: "new@example.com",
    password: "a long enough password",
    referralToken: "r".repeat(48),
  });
});
