import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import { createApiApp } from "./app.ts";

const admin = { id: 1, email: "admin@example.com", role: "admin" as const };
const user = { id: 2, email: "user@example.com", role: "user" as const };
const publishedVersion = { id: 1, app: "linear", version_number: 1, label: "v1", source_url: null, status: "published" as const, notes: "", captured_at: "2026-07-10T00:00:00.000Z", submitted_at: null, published_at: "2026-07-10T01:00:00.000Z", screen_count: 1, analyzed_count: 1, component_count: 1, token_count: 1, flow_count: 0 };
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

test("downloads a complete editable Figma library and secondary exports", async (t) => {
  const snapshot = {
    app: "linear",
    generatedAt: "2026-07-10T00:00:00.000Z",
    tokens: [{ id: "accent", kind: "color" as const, name: "Accent", value: "#5E6AD2", role: "Primary", evidence: [7] }],
    components: [{ id: "button", name: "Button", category: "Actions", description: "Action", variants: [{ id: "primary", name: "Primary", description: "Filled", evidence: [7] }] }],
    flows: [],
  };
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => user,
    canAccessApp: async () => true,
    reserveExportOperation: async () => ({ status: "reserved" as const, used: 1, limit: 20 as const, resetAt: "2026-08-01T00:00:00.000Z" }),
    recordAccessEvent: async () => undefined,
    recordExport: async () => 1,
    getDesignSystem: async () => snapshot,
    getVersionDesignSystem: async () => ({ version: publishedVersion, snapshot, flows: [] }),
    getAppFlows: async () => [],
    appImages: async () => catalogImages,
    versionImages: async () => catalogImages,
  }));
  t.after(() => close(server));
  const headers = { cookie: "astryx_session=user", "content-type": "application/json" };
  const figma = await fetch(`${base}/design-systems/linear/exports`, {
    method: "POST", headers, body: JSON.stringify({ format: "figma", selection: { kind: "design-system" } }),
  });
  assert.equal(figma.status, 200);
  assert.equal(Buffer.from(await figma.arrayBuffer()).subarray(0, 2).toString(), "PK");
  assert.match(figma.headers.get("content-disposition") ?? "", /linear-figma-library\.zip/);
  assert.equal(figma.headers.get("content-type"), "application/zip");

  const json = await fetch(`${base}/design-systems/linear/exports`, {
    method: "POST", headers, body: JSON.stringify({ format: "json", selection: { kind: "component-family", id: "button" } }),
  });
  assert.equal(json.status, 200);
  assert.equal((await json.json()).components.length, 1);
  assert.equal((await fetch(`${base}/design-systems/linear/exports`, {
    method: "POST", headers, body: JSON.stringify({ format: "pdf", selection: { kind: "design-system" } }),
  })).status, 400);
});

test("serves evidence-backed search and 2-app comparison", async (t) => {
  const systems = [
    {
      app: "linear",
      generatedAt: "2026-07-10T00:00:00.000Z",
      tokens: [{ id: "accent", kind: "color" as const, name: "Accent", value: "#5E6AD2", role: "Primary", evidence: [7] }],
      components: [{ id: "button", name: "Button", category: "Actions", description: "Action", variants: [{ id: "primary", name: "Primary", description: "Filled", evidence: [7] }] }],
      flows: [],
    },
    {
      app: "airbnb",
      generatedAt: "2026-07-10T00:00:00.000Z",
      tokens: [{ id: "accent", kind: "color" as const, name: "Accent", value: "#FF385C", role: "Primary", evidence: [8] }],
      components: [],
      flows: [],
    },
  ];
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => user,
    canAccessApp: async () => true,
    allImages: async () => [{
      ...catalogImages[0],
      analysis: {
        description: "Toolbar with primary action",
        purpose: "Manage issues",
        pageType: "Workspace",
        productArea: "Issues",
        theme: "dark" as const,
        visibleStates: ["default"],
        componentNames: ["Button"],
      },
    }],
    listDesignSystems: async () => systems,
    listAppFlowSets: async () => [],
  }));
  t.after(() => close(server));

  const search = await fetch(`${base}/search?q=primary&kind=component`, { headers: { cookie: "astryx_session=user" } });
  assert.equal(search.status, 200);
  assert.equal((await search.json()).items[0].id, "component:linear:button");

  const compare = await fetch(`${base}/compare?apps=linear,airbnb`, { headers: { cookie: "astryx_session=user" } });
  assert.equal(compare.status, 200);
  assert.deepEqual((await compare.json()).foundations[0].values, ["#5E6AD2", "#FF385C"]);
  assert.equal((await fetch(`${base}/compare?apps=linear`, { headers: { cookie: "astryx_session=user" } })).status, 400);
});

test("creates user-owned collections and edits item notes", async (t) => {
  const now = "2026-07-11T00:00:00.000Z";
  const collection = { id: 4, name: "Onboarding", description: "", created_at: now, updated_at: now, items: [] };
  let notes = "";
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => user,
    canAccessApp: async () => true,
    createCollection: async (_userId, name, description) => ({ ...collection, name, description: description ?? "" }),
    listCollections: async () => [{ ...collection, items: [] }],
    addCollectionItem: async (_userId, _collectionId, item) => ({
      id: 9,
      kind: item.kind,
      app: item.app,
      reference_id: item.referenceId,
      title: item.title,
      notes: item.notes,
      created_at: now,
      updated_at: now,
    }),
    updateCollectionItemNotes: async (_userId, _collectionId, _itemId, value) => {
      notes = value;
      return { id: 9, kind: "screen", app: "linear", reference_id: "7", title: "Workspace", notes, created_at: now, updated_at: now };
    },
    removeCollectionItem: async () => true,
    deleteCollection: async () => true,
  }));
  t.after(() => close(server));
  const headers = { cookie: "astryx_session=user", "content-type": "application/json" };

  const created = await fetch(`${base}/collections`, { method: "POST", headers, body: JSON.stringify({ name: "Onboarding" }) });
  assert.equal(created.status, 201);
  assert.equal((await created.json()).name, "Onboarding");
  assert.equal((await fetch(`${base}/collections`, { headers })).status, 200);

  const added = await fetch(`${base}/collections/4/items`, {
    method: "POST", headers,
    body: JSON.stringify({ kind: "screen", app: "linear", referenceId: "7", title: "Workspace", notes: "Reference" }),
  });
  assert.equal(added.status, 201);
  const patched = await fetch(`${base}/collections/4/items/9`, { method: "PATCH", headers, body: JSON.stringify({ notes: "Reuse hierarchy" }) });
  assert.equal(patched.status, 200);
  assert.equal(notes, "Reuse hierarchy");
  assert.equal((await fetch(`${base}/collections/4/items/9`, { method: "DELETE", headers })).status, 204);
  assert.equal((await fetch(`${base}/collections/4`, { method: "DELETE", headers })).status, 204);
});

test("runs the admin draft-review-publish workflow and hides drafts from designers", async (t) => {
  const version = { id: 12, app: "linear", version_number: 2, label: "v2", source_url: null, status: "draft" as const, notes: "", captured_at: "2026-07-11T00:00:00.000Z", submitted_at: null, published_at: null, screen_count: 7, analyzed_count: 7, component_count: 2, token_count: 4, flow_count: 1 };
  let publishedOnly: boolean | undefined;
  const { base, server } = await serve(createApiApp({
    resolveSession: async (token) => token === "admin" ? admin : user,
    createAppVersion: async () => version,
    createJob: async () => 44,
    publishJob: async () => undefined,
    listAppVersions: async (_app, only) => { publishedOnly = only; return only ? [] : [version]; },
    getVersionPublicationBlockers: async () => [],
    submitAppVersionForReview: async () => ({ ...version, status: "in_review" as const }),
    publishAppVersion: async () => ({ ...version, status: "published" as const, published_at: "2026-07-11T01:00:00.000Z" }),
  }));
  t.after(() => close(server));
  const jsonHeaders = { ...adminCookie, "content-type": "application/json" };
  const created = await fetch(`${base}/apps/linear/versions`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ sourceUrl: "https://mobbin.com/apps/linear/version/screens" }) });
  assert.equal(created.status, 201);
  assert.equal((await created.json()).status, "draft");
  assert.equal((await fetch(`${base}/versions/12/blockers`, { headers: adminCookie })).status, 200);
  assert.equal((await fetch(`${base}/versions/12/submit`, { method: "POST", headers: adminCookie })).status, 200);
  assert.equal((await (await fetch(`${base}/versions/12/publish`, { method: "POST", headers: adminCookie })).json()).status, "published");

  const designerVersions = await fetch(`${base}/apps/linear/versions`, { headers: { cookie: "astryx_session=user" } });
  assert.equal(designerVersions.status, 200);
  assert.equal(publishedOnly, true);
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
  const signedSnapshot = {
    app: "linear",
    generatedAt: "2026-07-10T00:00:00.000Z",
    tokens: [{ id: "color", kind: "color" as const, name: "Color", value: "#000", role: "text", evidence: [7] }],
    components: [],
    flows: [],
  };
  const { base, server } = await serve(createApiApp({
    dataDir,
    mediaSigningSecret: "0123456789abcdef0123456789abcdef",
    nowSeconds: () => nowSeconds,
    resolveSession: async (token) => token === "owner" ? user : other,
    canAccessApp: async () => true,
    getDesignSystem: async () => signedSnapshot,
    getVersionDesignSystem: async () => ({ version: publishedVersion, snapshot: signedSnapshot, flows: [] }),
    appImages: async () => catalogImages,
    versionImages: async () => catalogImages,
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
    recordAccessEvent: async () => {},
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

test("accepts raw Stripe webhooks before JSON parsing", async (t) => {
  let received = "";
  const { base, server } = await serve(createApiApp({
    billing: {
      createCheckout: async () => ({ status: "already_subscribed" }),
      createPortal: async () => undefined,
      handleWebhook: async (body) => {
        received = body.toString();
        return "processed";
      },
    },
  }));
  t.after(() => close(server));
  const response = await fetch(`${base}/billing/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": "sig" },
    body: '{"id":"evt_1"}',
  });
  assert.equal(response.status, 200);
  assert.equal(received, '{"id":"evt_1"}');
});

test("creates Checkout and returns safe subscription state", async (t) => {
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => user,
    billing: {
      createCheckout: async (_user, interval) => ({ status: "created", url: `https://stripe/${interval}` }),
      createPortal: async () => ({ url: "https://stripe/portal" }),
      handleWebhook: async () => "processed",
    },
    getAccountEntitlements: async () => ({
      plan: "pro",
      subscription: {
        user_id: user.id,
        stripe_customer_id: "cus_secret",
        stripe_subscription_id: "sub_secret",
        stripe_price_id: "price_secret",
        billing_interval: "month",
        status: "active",
        current_period_start: "2026-07-01T00:00:00Z",
        current_period_end: "2026-08-01T00:00:00Z",
        cancel_at_period_end: false,
        grace_expires_at: null,
      },
      freeUnlocks: ["linear"],
      freeUnlocksRemaining: 2,
      exportUsage: { used: 1, limit: 20, resetAt: "2026-08-01T00:00:00Z" },
    }),
  }));
  t.after(() => close(server));
  const checkout = await fetch(`${base}/billing/checkout`, {
    method: "POST",
    headers: { cookie: "astryx_session=user", "content-type": "application/json" },
    body: JSON.stringify({ interval: "month" }),
  });
  assert.equal(checkout.status, 201);
  assert.deepEqual(await checkout.json(), { url: "https://stripe/month" });
  const subscription = await (await fetch(`${base}/billing/subscription`, {
    headers: { cookie: "astryx_session=user" },
  })).json();
  assert.equal(subscription.plan, "pro");
  assert.equal(subscription.interval, "month");
  assert.equal(subscription.stripe_customer_id, undefined);
});

test("blocks catalog-wide traversal and records a redacted audit event", async (t) => {
  const events: Array<{ appSlug?: string; ipPrefix?: string; outcome: string }> = [];
  const images = [
    ...catalogImages,
    { ...catalogImages[0], id: 8, app: "notion", image_url: "mobbin-bulk:1111111111111111" },
  ];
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => user,
    canAccessApp: async () => true,
    allImages: async () => images,
    appTraversalLimit: 1,
    recordAccessEvent: async (event) => { events.push(event); },
  }));
  t.after(() => close(server));
  const headers = { cookie: "astryx_session=user" };
  assert.equal((await fetch(`${base}/apps/linear`, { headers })).status, 200);
  assert.equal((await fetch(`${base}/apps/linear`, { headers })).status, 200);
  const blocked = await fetch(`${base}/apps/notion`, { headers });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get("retry-after"), "600");
  assert.equal(events.at(-1)?.appSlug, "notion");
  assert.equal(events.at(-1)?.outcome, "blocked");
  assert.match(events.at(-1)?.ipPrefix ?? "", /\/24$/);
});

test("reserves a validated selected export for entitled Pro", async (t) => {
  let receivedUserId: number | undefined;
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => user,
    canAccessApp: async () => true,
    appImages: async () => catalogImages,
    recordAccessEvent: async () => {},
    reserveExportOperation: async (userId) => {
      receivedUserId = userId;
      return { status: "reserved", used: 1, limit: 20, resetAt: "2026-08-01T00:00:00Z" };
    },
  }));
  t.after(() => close(server));
  const response = await fetch(`${base}/apps/linear/exports/reservations`, {
    method: "POST",
    headers: { cookie: "astryx_session=user", "content-type": "application/json" },
    body: JSON.stringify({ kind: "screens", ids: [7] }),
  });
  assert.equal(response.status, 201);
  assert.equal(receivedUserId, user.id);
  assert.equal((await response.json()).status, "reserved");
});

test("rejects oversized or unavailable export reservations", async (t) => {
  let reserved = false;
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => user,
    canAccessApp: async () => false,
    reserveExportOperation: async () => {
      reserved = true;
      return { status: "not_pro", used: 0, limit: 20, resetAt: null };
    },
  }));
  t.after(() => close(server));
  const headers = { cookie: "astryx_session=user", "content-type": "application/json" };
  const invalid = await fetch(`${base}/apps/linear/exports/reservations`, {
    method: "POST",
    headers,
    body: JSON.stringify({ kind: "screens", ids: Array.from({ length: 11 }, (_, i) => i + 1) }),
  });
  assert.equal(invalid.status, 400);
  const locked = await fetch(`${base}/apps/linear/exports/reservations`, {
    method: "POST",
    headers,
    body: JSON.stringify({ kind: "component-family", id: "buttons" }),
  });
  assert.equal(locked.status, 403);
  assert.equal(reserved, false);
});

test("rejects component exports that do not belong to the app design system", async (t) => {
  let reserved = false;
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => user,
    canAccessApp: async () => true,
    getDesignSystem: async () => ({
      app: "linear",
      generatedAt: "2026-07-10T00:00:00Z",
      tokens: [],
      components: [],
      flows: [],
    }),
    recordAccessEvent: async () => {},
    reserveExportOperation: async () => {
      reserved = true;
      return { status: "reserved", used: 1, limit: 20, resetAt: "2026-08-01T00:00:00Z" };
    },
  }));
  t.after(() => close(server));
  const response = await fetch(`${base}/apps/linear/exports/reservations`, {
    method: "POST",
    headers: { cookie: "astryx_session=user", "content-type": "application/json" },
    body: JSON.stringify({ kind: "component-family", id: "buttons" }),
  });
  assert.equal(response.status, 400);
  assert.equal(reserved, false);
});
