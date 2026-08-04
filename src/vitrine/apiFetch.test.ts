import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { apiFetch, clearAuthToken, getAuthToken, setAuthToken } from "./apiFetch.ts";

afterEach(() => clearAuthToken());

test("stores a token for the current frontend session", () => {
  assert.equal(getAuthToken(), null);
  setAuthToken("header.payload.signature");
  assert.equal(getAuthToken(), "header.payload.signature");
  clearAuthToken();
  assert.equal(getAuthToken(), null);
});

test("attaches Bearer auth to same-origin API requests", async (t) => {
  setAuthToken("header.payload.signature");
  const mockedFetch = t.mock.method(
    globalThis,
    "fetch",
    async (_input: string | URL | Request, init?: RequestInit) => {
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer header.payload.signature");
      assert.equal(new Headers(init?.headers).get("content-type"), "application/json");
      return new Response(null, { status: 204 });
    },
  );

  await apiFetch("/api/research-projects", { headers: { "content-type": "application/json" } });
  assert.equal(mockedFetch.mock.callCount(), 1);
});

test("never leaks the Bearer token to external or data URLs", async (t) => {
  setAuthToken("secret-token");
  const seen: Array<string | null> = [];
  t.mock.method(globalThis, "fetch", async (_input: string | URL | Request, init?: RequestInit) => {
    seen.push(new Headers(init?.headers).get("authorization"));
    return new Response(null, { status: 204 });
  });

  await apiFetch("https://objects.example/signed-preview");
  await apiFetch("data:text/plain,hello");
  assert.deepEqual(seen, [null, null]);
});
