import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import { createApiApp } from "./app.ts";

const admin = { id: 1, email: "admin@example.com", role: "admin" as const };
const user = { id: 2, email: "user@example.com", role: "user" as const };
const adminCookie = { cookie: "astryx_session=admin" };
const catalogImages = [
  {
    id: 7,
    app: "linear",
    platform: "web",
    image_url: "mobbin-bulk:0123456789abcdef",
    description: "Toolbar",
  },
];

test("uses the repository's free host API port", async () => {
  const appModule = await import("./app.ts");
  assert.equal((appModule as { DEFAULT_API_PORT?: number }).DEFAULT_API_PORT, 3010);
});

async function serve(app: ReturnType<typeof createApiApp>): Promise<{ base: string; server: Server }> {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  return { base: `http://127.0.0.1:${address.port}`, server };
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

test("rejects an invalid Mobbin import before creating a job", async (t) => {
  let created = false;
  const { base, server } = await serve(
    createApiApp({
      resolveSession: async () => admin,
      createJob: async () => {
        created = true;
        return 1;
      },
    })
  );
  t.after(() => close(server));
  const response = await fetch(`${base}/jobs`, {
    method: "POST",
    headers: { ...adminCookie, "content-type": "application/json" },
    body: JSON.stringify({ type: "import-app", name: "../linear", url: "http://example.com" }),
  });
  assert.equal(response.status, 400);
  assert.equal(created, false);
});

test("marks a created job error when RabbitMQ publication fails", async (t) => {
  const statuses: string[] = [];
  const { base, server } = await serve(
    createApiApp({
      resolveSession: async () => admin,
      createJob: async () => 42,
      publishJob: async () => {
        throw new Error("broker down");
      },
      setJobStatus: async (_id, status) => {
        statuses.push(status);
      },
    })
  );
  t.after(() => close(server));
  const response = await fetch(`${base}/jobs`, {
    method: "POST",
    headers: { ...adminCookie, "content-type": "application/json" },
    body: JSON.stringify({
      type: "import-app",
      name: "linear",
      url: "https://mobbin.com/apps/linear-web-00000000-0000-0000-0000-000000000000/version/screens",
    }),
  });
  assert.equal(response.status, 503);
  assert.deepEqual(statuses, ["error"]);
});

test("serves a hydrated structured design system", async (t) => {
  const { base, server } = await serve(
    createApiApp({
      resolveSession: async () => admin,
      getDesignSystem: async () => ({
        app: "linear",
        generatedAt: "2026-07-10T00:00:00.000Z",
        tokens: [
          {
            id: "color-primary",
            kind: "color",
            name: "Primary",
            value: "#5E6AD2",
            role: "primary action",
            evidence: [7],
          },
        ],
        components: [],
        flows: [],
      }),
      appImages: async () => [
        {
          id: 7,
          app: "linear",
          platform: "web",
          image_url: "mobbin-bulk:0123456789abcdef",
          description: "Toolbar",
        },
      ],
      getAppFlows: async () => [{
        id: "login",
        title: "Login",
        description: "Authenticate",
        tags: ["Authentication"],
        steps: [{ label: "Email", evidence: [7] }],
      }],
    })
  );
  t.after(() => close(server));

  const response = await fetch(`${base}/design-systems/linear`, { headers: adminCookie });
  assert.equal(response.status, 200);
  const snapshot = await response.json();
  assert.equal(snapshot.tokens[0].evidence[0].imageUrl, "/api/media/linear/0123456789abcdef");
  assert.equal(snapshot.flows[0].steps[0].label, "Email");
  assert.equal(snapshot.flows[0].steps[0].evidence[0].imageUrl, "/api/media/linear/0123456789abcdef");
  assert.match(response.headers.get("content-type") ?? "", /application\/json/);
});

test("returns 404 when an app has no structured design system", async (t) => {
  const { base, server } = await serve(
    createApiApp({ resolveSession: async () => admin, getDesignSystem: async () => undefined })
  );
  t.after(() => close(server));
  assert.equal(
    (await fetch(`${base}/design-systems/linear`, { headers: adminCookie })).status,
    404
  );
});

test("serves local bulk media", async (t) => {
  const dataDir = mkdtempSync(join(tmpdir(), "astryx-api-"));
  mkdirSync(join(dataDir, "images", "linear"), { recursive: true });
  writeFileSync(join(dataDir, "images", "linear", "0123456789abcdef.webp"), "image");
  const { base, server } = await serve(
    createApiApp({ dataDir, resolveSession: async () => admin })
  );
  t.after(async () => {
    await close(server);
    rmSync(dataDir, { recursive: true, force: true });
  });

  assert.equal(
    (await fetch(`${base}/media/linear/0123456789abcdef`, { headers: adminCookie })).status,
    200
  );
  assert.equal(
    (await fetch(`${base}/media/linear/not-a-hash`, { headers: adminCookie })).status,
    400
  );
});

test("binds signed design-system media to the entitled user and expiry", async (t) => {
  const dataDir = mkdtempSync(join(tmpdir(), "astryx-signed-media-"));
  mkdirSync(join(dataDir, "images", "linear"), { recursive: true });
  writeFileSync(join(dataDir, "images", "linear", "0123456789abcdef.webp"), "image");
  let nowSeconds = 1_000;
  const other = { id: 3, email: "other@example.com", role: "user" as const };
  const { base, server } = await serve(createApiApp({
    dataDir,
    mediaSigningSecret: "0123456789abcdef0123456789abcdef",
    nowSeconds: () => nowSeconds,
    resolveSession: async (token) => token === "owner" ? user : other,
    canAccessApp: async () => true,
    getDesignSystem: async () => ({
      app: "linear",
      generatedAt: "2026-07-10T00:00:00.000Z",
      tokens: [{ id: "color", kind: "color", name: "Color", value: "#000", role: "text", evidence: [7] }],
      components: [],
      flows: [],
    }),
    appImages: async () => catalogImages,
    getAppFlows: async () => [],
  }));
  t.after(async () => {
    await close(server);
    rmSync(dataDir, { recursive: true, force: true });
  });

  const snapshot = await (await fetch(`${base}/design-systems/linear`, {
    headers: { cookie: "astryx_session=owner" },
  })).json();
  const mediaUrl = snapshot.tokens[0].evidence[0].imageUrl as string;
  assert.match(mediaUrl, /\?expires=1300&token=/);
  assert.equal((await fetch(`${base}${mediaUrl.replace("/api", "")}`, {
    headers: { cookie: "astryx_session=owner" },
  })).status, 200);
  assert.equal((await fetch(`${base}${mediaUrl.replace("/api", "")}`, {
    headers: { cookie: "astryx_session=other" },
  })).status, 403);
  nowSeconds = 1_301;
  assert.equal((await fetch(`${base}${mediaUrl.replace("/api", "")}`, {
    headers: { cookie: "astryx_session=owner" },
  })).status, 410);
});

test("keeps health public and rejects private data without a session", async (t) => {
  const { base, server } = await serve(
    createApiApp({ resolveSession: async () => undefined })
  );
  t.after(() => close(server));

  assert.equal((await fetch(`${base}/health`)).status, 200);
  assert.equal((await fetch(`${base}/apps`)).status, 401);
  assert.equal((await fetch(`${base}/jobs`)).status, 401);
});

test("serves public catalog previews without exposing the admin gallery", async (t) => {
  const { base, server } = await serve(createApiApp({ allImages: async () => catalogImages }));
  t.after(() => close(server));
  const response = await fetch(`${base}/catalog`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.apps[0].previewScreens.length, 1);
  assert.doesNotMatch(JSON.stringify(body), /mobbin-bulk|image_url/);
});

test("serves only the first three public preview images", async (t) => {
  const dataDir = mkdtempSync(join(tmpdir(), "astryx-preview-"));
  mkdirSync(join(dataDir, "images", "linear"), { recursive: true });
  writeFileSync(join(dataDir, "images", "linear", "0123456789abcdef.webp"), "image");
  const appImages = async () => [
    ...catalogImages,
    { ...catalogImages[0], id: 8, image_url: "mobbin-bulk:1111111111111111" },
    { ...catalogImages[0], id: 9, image_url: "mobbin-bulk:2222222222222222" },
    { ...catalogImages[0], id: 10, image_url: "mobbin-bulk:3333333333333333" },
  ];
  const { base, server } = await serve(createApiApp({ dataDir, appImages }));
  t.after(async () => {
    await close(server);
    rmSync(dataDir, { recursive: true, force: true });
  });
  assert.equal((await fetch(`${base}/preview-media/linear/0123456789abcdef`)).status, 200);
  assert.equal((await fetch(`${base}/preview-media/linear/3333333333333333`)).status, 404);
});

test("gates customer app detail and unlocks a Free app", async (t) => {
  let unlocked = false;
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => user,
    allImages: async () => catalogImages,
    canAccessApp: async () => unlocked,
    unlockFreeApp: async () => {
      unlocked = true;
      return { status: "unlocked", remaining: 2 };
    },
  }));
  t.after(() => close(server));
  const locked = await fetch(`${base}/apps/linear`, { headers: { cookie: "astryx_session=user" } });
  assert.equal(locked.status, 403);
  assert.deepEqual(await locked.json(), { error: "Upgrade required", code: "upgrade_required" });
  const unlock = await fetch(`${base}/apps/linear/unlock`, {
    method: "POST",
    headers: { cookie: "astryx_session=user" },
  });
  assert.equal(unlock.status, 201);
  assert.equal((await fetch(`${base}/apps/linear`, { headers: { cookie: "astryx_session=user" } })).status, 200);
});

test("keeps the old gallery and pipeline state admin-only", async (t) => {
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => user,
    allImages: async () => catalogImages,
    listJobs: async () => [],
  }));
  t.after(() => close(server));
  for (const path of ["/apps", "/images?app=linear", "/jobs", "/progress"]) {
    assert.equal((await fetch(`${base}${path}`, { headers: { cookie: "astryx_session=user" } })).status, 403);
  }
});

test("logs in with a secure cookie, resolves me, and logs out", async (t) => {
  let deletedToken: string | undefined;
  const { base, server } = await serve(
    createApiApp({
      authenticateUser: async (email, password) =>
        email === admin.email && password === "admin password" ? admin : undefined,
      createSession: async () => ({ token: "raw-session-token", expiresAt: new Date() }),
      resolveSession: async (token) => (token === "raw-session-token" ? admin : undefined),
      deleteSession: async (token) => {
        deletedToken = token;
      },
    })
  );
  t.after(() => close(server));

  const login = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: admin.email, password: "admin password" }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie") ?? "";
  assert.match(cookie, /astryx_session=raw-session-token/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Strict/i);

  const me = await fetch(`${base}/auth/me`, {
    headers: { cookie: "astryx_session=raw-session-token" },
  });
  assert.deepEqual(await me.json(), admin);

  const logout = await fetch(`${base}/auth/logout`, {
    method: "POST",
    headers: { cookie: "astryx_session=raw-session-token" },
  });
  assert.equal(logout.status, 204);
  assert.equal(deletedToken, "raw-session-token");
});

test("returns one generic login failure", async (t) => {
  const { base, server } = await serve(
    createApiApp({ authenticateUser: async () => undefined })
  );
  t.after(() => close(server));

  const response = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "missing@example.com", password: "wrong" }),
  });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Invalid email or password" });
});

test("explains when a normal-user session was evicted", async (t) => {
  const { base, server } = await serve(
    createApiApp({ resolveSessionState: async () => ({ status: "signed_in_elsewhere" }) })
  );
  t.after(() => close(server));
  const response = await fetch(`${base}/auth/me`, {
    headers: { cookie: "astryx_session=evicted" },
  });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: "Signed in on another device",
    code: "signed_in_elsewhere",
  });
});

test("rejects normal users and permits admins on pipeline creation", async (t) => {
  const userApp = await serve(createApiApp({ resolveSession: async () => user }));
  t.after(() => close(userApp.server));
  const denied = await fetch(`${userApp.base}/jobs`, {
    method: "POST",
    headers: { cookie: "astryx_session=user", "content-type": "application/json" },
    body: JSON.stringify({
      type: "import-app",
      name: "linear",
      url: "https://mobbin.com/apps/a/b/screens",
    }),
  });
  assert.equal(denied.status, 403);

  let created = false;
  const adminApp = await serve(
    createApiApp({
      resolveSession: async () => admin,
      createJob: async () => {
        created = true;
        return 9;
      },
      publishJob: async () => {},
    })
  );
  t.after(() => close(adminApp.server));
  const allowed = await fetch(`${adminApp.base}/jobs`, {
    method: "POST",
    headers: { cookie: "astryx_session=admin", "content-type": "application/json" },
    body: JSON.stringify({
      type: "import-app",
      name: "linear",
      url: "https://mobbin.com/apps/a/b/screens",
    }),
  });
  assert.equal(allowed.status, 201);
  assert.equal(created, true);
});
