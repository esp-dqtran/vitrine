import assert from "node:assert/strict";
import test from "node:test";

import {
  createOctoBaseClient,
  octobaseConfigFromEnv,
} from "./octobaseClient.ts";

function jwt(exp: number): string {
  return `header.${Buffer.from(JSON.stringify({ exp })).toString("base64url")}.signature`;
}

test("OctoBase configuration is disabled with Project documents", () => {
  assert.equal(octobaseConfigFromEnv({}), undefined);
  assert.equal(
    octobaseConfigFromEnv({ PROJECT_DOCUMENTS_ENABLED: "false" }),
    undefined,
  );
});

test("enabled OctoBase configuration requires service credentials", () => {
  assert.throws(
    () => octobaseConfigFromEnv({ PROJECT_DOCUMENTS_ENABLED: "true" }),
    /OCTOBASE_URL/,
  );
  assert.throws(
    () => octobaseConfigFromEnv({
      PROJECT_DOCUMENTS_ENABLED: "true",
      OCTOBASE_URL: "http://octobase:3000",
    }),
    /OCTOBASE_SERVICE_EMAIL/,
  );
});

test("creates a service user once then falls back to login", async () => {
  const payloadTypes: string[] = [];
  const request = async (_url: string | URL | Request, init?: RequestInit) => {
    const payload = JSON.parse(String(init?.body)) as { type: string };
    payloadTypes.push(payload.type);
    if (payload.type === "DebugCreateUser") {
      return new Response("", { status: 400 });
    }
    return Response.json({ token: jwt(2_000), refresh: "private" });
  };
  const client = createOctoBaseClient({
    url: "http://octobase:3000",
    serviceEmail: "service@example.test",
    servicePassword: "secret-password",
  }, { fetch: request, nowSeconds: () => 1_000 });

  await client.accessToken();
  await client.accessToken();

  assert.deepEqual(payloadTypes, ["DebugCreateUser", "DebugLoginUser"]);
});

test("refreshes cached tokens within sixty seconds of expiry", async () => {
  let now = 1_000;
  let loginCount = 0;
  const request = async (_url: string | URL | Request, init?: RequestInit) => {
    const payload = JSON.parse(String(init?.body)) as { type: string };
    if (payload.type === "DebugCreateUser") return new Response("", { status: 400 });
    loginCount += 1;
    return Response.json({ token: jwt(now + 120), refresh: "private" });
  };
  const client = createOctoBaseClient({
    url: "http://octobase:3000",
    serviceEmail: "service@example.test",
    servicePassword: "secret-password",
  }, { fetch: request, nowSeconds: () => now });

  await client.accessToken();
  now += 59;
  await client.accessToken();
  now += 2;
  await client.accessToken();

  assert.equal(loginCount, 2);
});

test("creates workspaces with the upstream raw JWT authorization contract", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const request = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/api/user/token")) {
      return Response.json({ token: jwt(2_000), refresh: "private" });
    }
    return Response.json({ id: "workspace-1" });
  };
  const client = createOctoBaseClient({
    url: "http://octobase:3000/",
    serviceEmail: "service@example.test",
    servicePassword: "secret-password",
  }, { fetch: request, nowSeconds: () => 1_000 });

  assert.equal(await client.createWorkspace(), "workspace-1");
  const workspace = calls.find(call => call.url.endsWith("/api/workspace"));
  const headers = new Headers(workspace?.init?.headers);
  assert.equal(headers.get("authorization"), jwt(2_000));
  assert.equal(headers.get("content-type"), "application/octet-stream");
  assert.equal(headers.get("content-length"), "0");
});

test("deletes workspaces with the same private authorization contract", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const request = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/api/user/token")) {
      return Response.json({ token: jwt(2_000), refresh: "private" });
    }
    return new Response(null, { status: 204 });
  };
  const client = createOctoBaseClient(
    {
      url: "http://octobase:3000",
      serviceEmail: "service@example.test",
      servicePassword: "secret-password",
    },
    { fetch: request, nowSeconds: () => 1_000 },
  );

  await client.deleteWorkspace("workspace/with spaces");

  const deletion = calls.find((call) =>
    call.url.includes("/api/workspace/workspace%2Fwith%20spaces"),
  );
  assert.equal(deletion?.init?.method, "DELETE");
  assert.equal(
    new Headers(deletion?.init?.headers).get("authorization"),
    jwt(2_000),
  );
});

test("public errors redact credentials and OctoBase response bodies", async () => {
  const request = async () =>
    new Response("database says secret-password", { status: 500 });
  const client = createOctoBaseClient({
    url: "http://octobase:3000",
    serviceEmail: "service@example.test",
    servicePassword: "secret-password",
  }, { fetch: request, nowSeconds: () => 1_000 });

  await assert.rejects(
    () => client.accessToken(),
    error => {
      const message = String(error);
      assert.doesNotMatch(message, /secret-password|database says/);
      assert.match(message, /OctoBase authentication failed/);
      return true;
    },
  );
});
