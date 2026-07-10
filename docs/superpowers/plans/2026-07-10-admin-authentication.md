# Admin Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Vitrine's fake sign-in with one environment-seeded administrator, Postgres-backed opaque sessions, server-enforced authorization, refresh persistence, and logout.

**Architecture:** Keep cryptography and Postgres session storage in focused modules, then apply one authentication middleware boundary inside the existing Express app. Route every Vitrine `/api/*` request through Express so development cannot bypass authentication, and connect the existing design-system SignIn/App surfaces through a small auth client and provider.

**Tech Stack:** TypeScript, Node `crypto` (`scrypt`, `randomBytes`, `timingSafeEqual`, SHA-256), Express 5, PostgreSQL 17, React 19, Vite 8, `@astryxdesign/core`, Node/tsx test runner.

---

## Execution note

`/Users/kai/works/eastplayers/Astryx` is not a Git repository, so worktrees and per-task commits are unavailable. Each task ends with a runnable verification checkpoint. If Git is initialized before execution, commit only the files named in the completed task.

## File map

- Create `src/authCrypto.ts` and `src/authCrypto.test.ts`: password hashing, verification, random session tokens, and token hashing.
- Modify `src/db.ts`: create `users` and `sessions` tables.
- Create `src/authStore.ts` and `src/authStore.test.ts`: seed admin and manage Postgres sessions.
- Create `src/gallery.ts` and `src/gallery.test.ts`: move the rich Vitrine app transformation out of Vite.
- Modify `services/api/src/app.ts` and `services/api/src/app.test.ts`: auth endpoints, cookie handling, middleware, authorization, protected routes, rich `/apps`, and progress cancellation.
- Modify `services/api/src/index.ts`: validate/seed admin before listening.
- Create `services/api/src/config.test.ts`: fail-closed environment parsing.
- Modify `vite.config.ts` and `src/viteConfig.test.ts`: remove database middleware and proxy every `/api` request.
- Create `.env.example`; modify `docker-compose.yml`: document and pass admin variables.
- Create `src/vitrine/authApi.ts`, `src/vitrine/authApi.test.ts`, and `src/vitrine/AuthProvider.tsx`: frontend session state and API calls.
- Modify `src/vitrine/main.tsx`, `src/vitrine/SignIn.tsx`, `src/vitrine/App.tsx`: real login, authenticated routing, admin identity, and logout.
- Create `src/vitrine/SignIn.test.tsx`: design-system login contract.
- Modify `package.json`: include all new TypeScript and TSX tests.

### Task 1: Password and session cryptography

**Files:**
- Create: `src/authCrypto.test.ts`
- Create: `src/authCrypto.ts`

- [ ] **Step 1: Write failing crypto tests**

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateSessionToken, hashPassword, hashSessionToken, verifyPassword } from "./authCrypto.ts";

test("hashes and verifies a password without retaining plaintext", async () => {
  const encoded = await hashPassword("correct horse battery staple");
  assert.equal(encoded.includes("correct horse battery staple"), false);
  assert.equal(await verifyPassword("correct horse battery staple", encoded), true);
  assert.equal(await verifyPassword("wrong password", encoded), false);
});

test("uses a unique salt for equal passwords", async () => {
  const first = await hashPassword("same secure password");
  const second = await hashPassword("same secure password");
  assert.notEqual(first, second);
});

test("generates opaque session tokens and stores only deterministic hashes", () => {
  const first = generateSessionToken();
  const second = generateSessionToken();
  assert.notEqual(first, second);
  assert.ok(first.length >= 43);
  assert.notEqual(hashSessionToken(first), first);
  assert.equal(hashSessionToken(first), hashSessionToken(first));
});
```

- [ ] **Step 2: Run the test and verify the module is missing**

Run: `node --experimental-strip-types --test src/authCrypto.test.ts`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/authCrypto.ts`.

- [ ] **Step 3: Implement the minimal native-crypto module**

```typescript
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const N = 2 ** 17;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const MAX_MEMORY = 256 * 1024 * 1024;

function derive(password: string, salt: Buffer, length: number, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, length, { N: n, r, p, maxmem: MAX_MEMORY }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, KEY_LENGTH, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, n, r, p, saltValue, keyValue] = encoded.split("$");
  if (algorithm !== "scrypt" || !n || !r || !p || !saltValue || !keyValue) return false;
  try {
    const expected = Buffer.from(keyValue, "base64url");
    const actual = await derive(password, Buffer.from(saltValue, "base64url"), expected.length, Number(n), Number(r), Number(p));
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
```

- [ ] **Step 4: Run the crypto tests**

Run: `node --experimental-strip-types --test src/authCrypto.test.ts`

Expected: 3 tests pass.

### Task 2: Postgres users, admin seed, and sessions

**Files:**
- Modify: `src/db.ts`
- Create: `src/authStore.test.ts`
- Create: `src/authStore.ts`

- [ ] **Step 1: Add auth tables to schema initialization**

Append these statements after the `jobs` table inside `ensureSchema`:

```sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
```

- [ ] **Step 2: Write failing Postgres session tests**

Use the existing `astryx_test` database setup pattern. The test must truncate auth tables and exercise real storage:

```typescript
import { after, test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

const ADMIN_URL = "postgres://postgres:postgres@localhost:5432/postgres";
const TEST_URL = "postgres://postgres:postgres@localhost:5432/astryx_test";

async function ensureTestDb(): Promise<string | undefined> {
  const client = new pg.Client({ connectionString: ADMIN_URL });
  try { await client.connect(); } catch { return "Postgres not running — docker compose up -d postgres"; }
  try { await client.query("CREATE DATABASE astryx_test"); }
  catch (error) { if ((error as { code?: string }).code !== "42P04") throw error; }
  finally { await client.end(); }
}

const skipReason = await ensureTestDb();
process.env.DATABASE_URL = TEST_URL;
after(async () => {
  if (!skipReason) await (await import("./db.ts")).closePool();
});

test("seeds one admin, authenticates, resolves a session, and logs out", { skip: skipReason }, async () => {
  const { query } = await import("./db.ts");
  const { authenticateUser, createSession, deleteSession, resolveSession, seedAdmin } = await import("./authStore.ts");
  await query("TRUNCATE sessions, users RESTART IDENTITY CASCADE");
  const admin = await seedAdmin("Admin@Example.com", "a sufficiently long admin password");
  assert.deepEqual(admin, { id: 1, email: "admin@example.com", role: "admin" });
  assert.equal((await authenticateUser("admin@example.com", "wrong password")), undefined);
  assert.deepEqual(await authenticateUser("ADMIN@example.com", "a sufficiently long admin password"), admin);
  const session = await createSession(admin.id);
  const stored = await query<{ token_hash: string }>("SELECT token_hash FROM sessions WHERE user_id = $1", [admin.id]);
  assert.notEqual(session.token, stored.rows[0].token_hash);
  assert.deepEqual(await resolveSession(session.token), admin);
  await deleteSession(session.token);
  assert.equal(await resolveSession(session.token), undefined);
});

test("reseeding rotates the password and invalidates existing sessions", { skip: skipReason }, async () => {
  const { query } = await import("./db.ts");
  const { authenticateUser, createSession, resolveSession, seedAdmin } = await import("./authStore.ts");
  await query("TRUNCATE sessions, users RESTART IDENTITY CASCADE");
  const admin = await seedAdmin("admin@example.com", "first sufficiently long password");
  const session = await createSession(admin.id);
  await seedAdmin("admin@example.com", "second sufficiently long password");
  assert.equal(await resolveSession(session.token), undefined);
  assert.equal(await authenticateUser("admin@example.com", "first sufficiently long password"), undefined);
  assert.ok(await authenticateUser("admin@example.com", "second sufficiently long password"));
});

test("expired and inactive-user sessions do not resolve", { skip: skipReason }, async () => {
  const { query } = await import("./db.ts");
  const { createSession, resolveSession, seedAdmin } = await import("./authStore.ts");
  await query("TRUNCATE sessions, users RESTART IDENTITY CASCADE");
  const admin = await seedAdmin("admin@example.com", "a sufficiently long admin password");
  const expired = await createSession(admin.id, new Date(Date.now() - 1_000));
  assert.equal(await resolveSession(expired.token), undefined);
  const active = await createSession(admin.id);
  await query("UPDATE users SET active = false WHERE id = $1", [admin.id]);
  assert.equal(await resolveSession(active.token), undefined);
});
```

- [ ] **Step 3: Run the session test and verify the store is missing**

Run: `node --experimental-strip-types --test src/authStore.test.ts`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/authStore.ts`.

- [ ] **Step 4: Implement the auth store**

```typescript
import { query } from "./db.ts";
import { generateSessionToken, hashPassword, hashSessionToken, verifyPassword } from "./authCrypto.ts";

export type UserRole = "admin" | "user";
export interface AuthUser { id: number; email: string; role: UserRole }
interface StoredUser extends AuthUser { password_hash: string; active: boolean }
const SESSION_MS = 12 * 60 * 60 * 1000;

const safeUser = ({ id, email, role }: AuthUser): AuthUser => ({ id, email, role });
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export async function seedAdmin(email: string, password: string): Promise<AuthUser> {
  const normalized = normalizeEmail(email);
  const passwordHash = await hashPassword(password);
  const result = await query<AuthUser>(
    `INSERT INTO users (email, password_hash, role, active, updated_at)
     VALUES ($1, $2, 'admin', true, now())
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash,
       role = 'admin', active = true, updated_at = now()
     RETURNING id, email, role`,
    [normalized, passwordHash]
  );
  const admin = result.rows[0];
  await query("DELETE FROM sessions WHERE user_id = $1", [admin.id]);
  return safeUser(admin);
}

export async function authenticateUser(email: string, password: string): Promise<AuthUser | undefined> {
  const result = await query<StoredUser>(
    "SELECT id, email, role, password_hash, active FROM users WHERE email = $1",
    [normalizeEmail(email)]
  );
  const user = result.rows[0];
  if (!user?.active || !(await verifyPassword(password, user.password_hash))) return undefined;
  return safeUser(user);
}

export async function createSession(userId: number, expiresAt = new Date(Date.now() + SESSION_MS)) {
  await query("DELETE FROM sessions WHERE expires_at <= now()");
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  await query("INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)", [userId, tokenHash, expiresAt]);
  return { token, expiresAt };
}

export async function resolveSession(token: string): Promise<AuthUser | undefined> {
  const tokenHash = hashSessionToken(token);
  const result = await query<AuthUser>(
    `SELECT u.id, u.email, u.role FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now() AND u.active = true`,
    [tokenHash]
  );
  if (!result.rows[0]) await query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
  return result.rows[0] ? safeUser(result.rows[0]) : undefined;
}

export async function deleteSession(token: string): Promise<void> {
  await query("DELETE FROM sessions WHERE token_hash = $1", [hashSessionToken(token)]);
}
```

- [ ] **Step 5: Run auth-store and existing database tests**

Run: `node --experimental-strip-types --test src/authStore.test.ts src/db.test.ts`

Expected: all auth-store and database tests pass when Postgres is running.

### Task 3: Move gallery transformation behind the API

**Files:**
- Create: `src/gallery.test.ts`
- Create: `src/gallery.ts`

- [ ] **Step 1: Write the failing gallery transformation test**

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGalleryApps } from "./gallery.ts";

test("groups images, preserves metadata, maps local media, and caps screens", () => {
  const images = Array.from({ length: 121 }, (_, index) => ({
    id: index + 1,
    app: "linear",
    platform: "web",
    image_url: index === 0 ? "mobbin-bulk:0123456789abcdef" : `https://cdn.example.com/${index}.png`,
    description: index === 0 ? "Login screen" : null,
  }));
  const [app] = buildGalleryApps(images);
  assert.equal(app.app, "Linear");
  assert.equal(app.cat, "Productivity");
  assert.equal(app.totalScreens, 121);
  assert.equal(app.screens.length, 120);
  assert.equal(app.screens[0].url, "/api/media/linear/0123456789abcdef");
  assert.equal(app.screens[0].description, "Login screen");
});
```

- [ ] **Step 2: Run the test and verify the module is missing**

Run: `node --experimental-strip-types --test src/gallery.test.ts`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/gallery.ts`.

- [ ] **Step 3: Implement the shared gallery builder**

Move `APP_META`, fallback accents, and the 120-screen cap from `vite.config.ts` into `src/gallery.ts` and export:

```typescript
import type { CrawledImage } from "./db.ts";
import { publicImageUrl } from "./imageSource.ts";

const APP_META: Record<string, { label: string; cat: string; accent: string }> = {
  linear: { label: "Linear", cat: "Productivity", accent: "#5E6AD2" },
  airbnb: { label: "Airbnb", cat: "Travel", accent: "#FF5A5F" },
};
const FALLBACK_ACCENTS = ["#3b6ef6", "#0e9f6e", "#e0518a", "#f0763b", "#7c3aed", "#0891b2"];
const MAX_SCREENS_PER_APP = 120;

function appMeta(app: string) {
  if (APP_META[app]) return APP_META[app];
  const hue = [...app].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return { label: app[0].toUpperCase() + app.slice(1), cat: "Design inspiration", accent: FALLBACK_ACCENTS[hue % FALLBACK_ACCENTS.length] };
}

export function buildGalleryApps(images: CrawledImage[]) {
  const byApp = new Map<string, CrawledImage[]>();
  for (const image of images) byApp.set(image.app, [...(byApp.get(image.app) ?? []), image]);
  return [...byApp.entries()].map(([app, appImages]) => {
    const meta = appMeta(app);
    return {
      id: app,
      app: meta.label,
      cat: meta.cat,
      accent: meta.accent,
      totalScreens: appImages.length,
      screens: appImages.slice(0, MAX_SCREENS_PER_APP).map((image) => ({
        type: "Screen",
        platform: image.platform,
        description: image.description,
        url: publicImageUrl(app, image.image_url),
      })),
    };
  });
}
```

- [ ] **Step 4: Run the gallery test**

Run: `node --experimental-strip-types --test src/gallery.test.ts`

Expected: 1 test passes.

### Task 4: Enforce authentication and authorization in Express

**Files:**
- Modify: `services/api/src/app.test.ts`
- Modify: `services/api/src/app.ts`

- [ ] **Step 1: Add failing API authentication tests**

Extend the app test dependencies with safe fakes and cover public, authenticated, and admin-only behavior:

```typescript
const admin = { id: 1, email: "admin@example.com", role: "admin" as const };
const user = { id: 2, email: "user@example.com", role: "user" as const };

test("keeps health public and rejects private data without a session", async (t) => {
  const { base, server } = await serve(createApiApp({ resolveSession: async () => undefined }));
  t.after(() => close(server));
  assert.equal((await fetch(`${base}/health`)).status, 200);
  assert.equal((await fetch(`${base}/apps`)).status, 401);
  assert.equal((await fetch(`${base}/jobs`)).status, 401);
});

test("logs in with a secure cookie, resolves me, and logs out", async (t) => {
  let deletedToken: string | undefined;
  const { base, server } = await serve(createApiApp({
    authenticateUser: async (email, password) => email === admin.email && password === "admin password" ? admin : undefined,
    createSession: async () => ({ token: "raw-session-token", expiresAt: new Date() }),
    resolveSession: async (token) => token === "raw-session-token" ? admin : undefined,
    deleteSession: async (token) => { deletedToken = token; },
  }));
  t.after(() => close(server));
  const login = await fetch(`${base}/auth/login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: admin.email, password: "admin password" }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie") ?? "";
  assert.match(cookie, /astryx_session=raw-session-token/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Strict/i);
  const me = await fetch(`${base}/auth/me`, { headers: { cookie: "astryx_session=raw-session-token" } });
  assert.deepEqual(await me.json(), admin);
  const logout = await fetch(`${base}/auth/logout`, { method: "POST", headers: { cookie: "astryx_session=raw-session-token" } });
  assert.equal(logout.status, 204);
  assert.equal(deletedToken, "raw-session-token");
});

test("returns one generic login failure", async (t) => {
  const { base, server } = await serve(createApiApp({ authenticateUser: async () => undefined }));
  t.after(() => close(server));
  const response = await fetch(`${base}/auth/login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "missing@example.com", password: "wrong" }),
  });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Invalid email or password" });
});

test("rejects normal users and permits admins on pipeline creation", async (t) => {
  const userApp = await serve(createApiApp({ resolveSession: async () => user }));
  t.after(() => close(userApp.server));
  const denied = await fetch(`${userApp.base}/jobs`, {
    method: "POST", headers: { cookie: "astryx_session=user", "content-type": "application/json" },
    body: JSON.stringify({ type: "import-app", name: "linear", url: "https://mobbin.com/apps/a/b/screens" }),
  });
  assert.equal(denied.status, 403);

  let created = false;
  const adminApp = await serve(createApiApp({
    resolveSession: async () => admin,
    createJob: async () => { created = true; return 9; },
    publishJob: async () => {},
  }));
  t.after(() => close(adminApp.server));
  const allowed = await fetch(`${adminApp.base}/jobs`, {
    method: "POST", headers: { cookie: "astryx_session=admin", "content-type": "application/json" },
    body: JSON.stringify({ type: "import-app", name: "linear", url: "https://mobbin.com/apps/a/b/screens" }),
  });
  assert.equal(allowed.status, 201);
  assert.equal(created, true);
});
```

Update existing route tests to inject `resolveSession: async () => admin` and send `cookie: astryx_session=admin` for protected requests.

- [ ] **Step 2: Run API tests and verify authentication behavior is absent**

Run: `npx tsx --test services/api/src/app.test.ts`

Expected: FAIL because `createApiApp` has no authentication dependencies or protected routes.

- [ ] **Step 3: Add authentication dependencies and middleware**

Import `allImages`, `buildGalleryApps`, and auth-store functions. Extend `defaults` with `allImages`, `authenticateUser`, `createSession`, `resolveSession`, and `deleteSession`.

Add these helpers above `createApiApp`:

```typescript
const SESSION_COOKIE = "astryx_session";
const cookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

function cookieValue(header: string | undefined, name: string): string | undefined {
  for (const pair of header?.split(";") ?? []) {
    const [key, ...value] = pair.trim().split("=");
    if (key === name) {
      try { return decodeURIComponent(value.join("=")); }
      catch { return undefined; }
    }
  }
  return undefined;
}
```

Inside `createApiApp`, keep `/health` first. Then add no-store and public auth routes:

```typescript
app.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });

app.post("/auth/login", async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const user = await deps.authenticateUser(email, password);
  if (!user) return void res.status(401).json({ error: "Invalid email or password" });
  const session = await deps.createSession(user.id);
  res.cookie(SESSION_COOKIE, session.token, cookieOptions).json(user);
});

app.post("/auth/logout", async (req, res) => {
  const token = cookieValue(req.headers.cookie, SESSION_COOKIE);
  if (token) await deps.deleteSession(token);
  res.clearCookie(SESSION_COOKIE, cookieOptions).status(204).end();
});

app.use(async (req, res, next) => {
  const token = cookieValue(req.headers.cookie, SESSION_COOKIE);
  const user = token ? await deps.resolveSession(token) : undefined;
  if (!user) return void res.status(401).json({ error: "Authentication required" });
  res.locals.user = user;
  next();
});

const requireAdmin: import("express").RequestHandler = (_req, res, next) => {
  if (res.locals.user.role !== "admin") return void res.status(403).json({ error: "Admin access required" });
  next();
};

app.get("/auth/me", (_req, res) => res.json(res.locals.user));
```

- [ ] **Step 4: Protect and consolidate existing routes**

Replace `/apps` with:

```typescript
app.get("/apps", async (_req, res) => {
  res.json(buildGalleryApps(await deps.allImages()));
});
```

Keep authenticated GET routes after the authentication middleware. Add `requireAdmin` to `POST /jobs` and `POST /jobs/:id/cancel`:

```typescript
app.post("/jobs", requireAdmin, async (req, res) => {
```

```typescript
app.post("/jobs/:id/cancel", requireAdmin, async (req, res) => {
```

Add the protected progress cancellation route:

```typescript
app.post("/progress/cancel", requireAdmin, (_req, res) => {
  deps.requestCancel();
  res.status(204).end();
});
```

- [ ] **Step 5: Run API tests and type checking**

Run: `npx tsx --test services/api/src/app.test.ts && npx tsc --noEmit`

Expected: API tests pass and TypeScript exits 0.

### Task 5: Fail-closed startup, Compose variables, and one API proxy

**Files:**
- Create: `services/api/src/config.test.ts`
- Create: `services/api/src/config.ts`
- Modify: `services/api/src/index.ts`
- Modify: `vite.config.ts`
- Modify: `src/viteConfig.test.ts`
- Create: `.env.example`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Write failing admin-seed configuration tests**

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { adminSeedFromEnv } from "./config.ts";

test("requires valid admin seed variables", () => {
  assert.throws(() => adminSeedFromEnv({}), /ADMIN_EMAIL/);
  assert.throws(() => adminSeedFromEnv({ ADMIN_EMAIL: "admin@example.com" }), /ADMIN_PASSWORD/);
  assert.throws(() => adminSeedFromEnv({ ADMIN_EMAIL: "invalid", ADMIN_PASSWORD: "1234567890123456" }), /ADMIN_EMAIL/);
  assert.throws(() => adminSeedFromEnv({ ADMIN_EMAIL: "admin@example.com", ADMIN_PASSWORD: "too-short" }), /16 characters/);
});

test("normalizes a valid admin seed", () => {
  assert.deepEqual(
    adminSeedFromEnv({ ADMIN_EMAIL: " Admin@Example.com ", ADMIN_PASSWORD: "1234567890123456" }),
    { email: "admin@example.com", password: "1234567890123456" }
  );
});
```

- [ ] **Step 2: Run the config test and verify the module is missing**

Run: `node --experimental-strip-types --test services/api/src/config.test.ts`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `config.ts`.

- [ ] **Step 3: Implement configuration validation and seed before listen**

```typescript
export function adminSeedFromEnv(env: Record<string, string | undefined>) {
  const email = env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.ADMIN_PASSWORD;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("ADMIN_EMAIL must be a valid email address");
  if (!password) throw new Error("ADMIN_PASSWORD is required");
  if (password.length < 16) throw new Error("ADMIN_PASSWORD must contain at least 16 characters");
  return { email, password };
}
```

Change `services/api/src/index.ts` to:

```typescript
import { createApiApp, DEFAULT_API_PORT } from "./app.ts";
import { adminSeedFromEnv } from "./config.ts";
import { seedAdmin } from "../../../src/authStore.ts";

const PORT = Number(process.env.PORT ?? DEFAULT_API_PORT);
const seed = adminSeedFromEnv(process.env);
await seedAdmin(seed.email, seed.password);
createApiApp().listen(PORT, () => console.log(`[api] listening on :${PORT}`));
```

- [ ] **Step 4: Replace Vite middleware with one proxy**

Update `src/viteConfig.test.ts` to assert that `/api` is the only proxy key and targets `http://127.0.0.1:3010`.

Replace `vite.config.ts` with:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const API_TARGET = process.env.VITRINE_API_TARGET ?? "http://127.0.0.1:3010";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: API_TARGET,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
```

- [ ] **Step 5: Document and pass seed variables without defaults**

Create `.env.example`:

```dotenv
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace-with-a-long-random-password
```

Add to the Compose API environment:

```yaml
ADMIN_EMAIL: ${ADMIN_EMAIL:-}
ADMIN_PASSWORD: ${ADMIN_PASSWORD:-}
```

Empty variables preserve `docker compose config` validation while API startup remains fail-closed.

- [ ] **Step 6: Run config, proxy, type, and Compose checks**

Run: `node --experimental-strip-types --test services/api/src/config.test.ts src/viteConfig.test.ts && npx tsc --noEmit && docker compose config --quiet`

Expected: both tests pass, TypeScript exits 0, and Compose validation exits 0.

### Task 6: Connect real authentication to the design-system frontend

**Files:**
- Create: `src/vitrine/authApi.test.ts`
- Create: `src/vitrine/authApi.ts`
- Create: `src/vitrine/AuthProvider.tsx`
- Create: `src/vitrine/SignIn.test.tsx`
- Modify: `src/vitrine/main.tsx`
- Modify: `src/vitrine/SignIn.tsx`
- Modify: `src/vitrine/App.tsx`

- [ ] **Step 1: Write failing frontend API tests**

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { getCurrentUser, login, logout } from "./authApi.ts";

test("maps 401 me responses to no user", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ error: "Authentication required" }), { status: 401 }));
  assert.equal(await getCurrentUser(), null);
});

test("returns the safe user from login", async (t) => {
  const user = { id: 1, email: "admin@example.com", role: "admin" as const };
  t.mock.method(globalThis, "fetch", async (_input, init) => {
    assert.equal(init?.method, "POST");
    return new Response(JSON.stringify(user), { status: 200, headers: { "content-type": "application/json" } });
  });
  assert.deepEqual(await login("admin@example.com", "password"), user);
});

test("surfaces the generic login error and posts logout", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async (input) => {
    if (String(input).endsWith("/logout")) return new Response(null, { status: 204 });
    return new Response(JSON.stringify({ error: "Invalid email or password" }), { status: 401 });
  });
  await assert.rejects(login("admin@example.com", "wrong"), /Invalid email or password/);
  await logout();
  assert.equal(fetchMock.mock.callCount(), 2);
});
```

- [ ] **Step 2: Run the frontend API tests and verify the module is missing**

Run: `node --experimental-strip-types --test src/vitrine/authApi.test.ts`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `authApi.ts`.

- [ ] **Step 3: Implement the frontend auth API**

```typescript
export interface AuthUser { id: number; email: string; role: "admin" | "user" }

async function jsonOrError(response: Response): Promise<AuthUser> {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? `Authentication returned ${response.status}`);
  return body;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const response = await fetch("/api/auth/me");
  if (response.status === 401) return null;
  return jsonOrError(response);
}

export function login(email: string, password: string): Promise<AuthUser> {
  return fetch("/api/auth/login", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }),
  }).then(jsonOrError);
}

export async function logout(): Promise<void> {
  const response = await fetch("/api/auth/logout", { method: "POST" });
  if (!response.ok) throw new Error(`Logout returned ${response.status}`);
}
```

- [ ] **Step 4: Add the authentication provider**

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getCurrentUser, login as requestLogin, logout as requestLogout, type AuthUser } from "./authApi";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  authenticate(email: string, password: string): Promise<AuthUser>;
  completeLogin(user: AuthUser): void;
  logout(): Promise<void>;
}
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getCurrentUser().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);
  return (
    <AuthContext.Provider value={{
      user,
      loading,
      authenticate: requestLogin,
      completeLogin: setUser,
      logout: async () => { await requestLogout(); setUser(null); },
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
```

- [ ] **Step 5: Write a failing SignIn design contract test**

```tsx
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { SignIn } from "./SignIn.tsx";

test("renders only the real email/password authentication controls", () => {
  const html = renderToStaticMarkup(
    <SignIn
      authenticate={async () => ({ id: 1, email: "admin@example.com", role: "admin" })}
      onSignedIn={() => {}}
    />
  );
  assert.match(html, /Email/);
  assert.match(html, /Password/);
  assert.match(html, /Sign in/);
  assert.doesNotMatch(html, /Continue with Google/);
});
```

Run: `npx tsx --test src/vitrine/SignIn.test.tsx`

Expected: FAIL because the current SignIn still renders Google and does not accept `authenticate`.

- [ ] **Step 6: Wire Root and replace fake SignIn behavior**

Replace `main.tsx` root state with `AuthProvider` and `useAuth`:

```tsx
function Root() {
  const { user, loading, authenticate, completeLogin } = useAuth();
  if (loading) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}><Spinner size="lg" /></div>;
  return user ? <App /> : <SignIn authenticate={authenticate} onSignedIn={completeLogin} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode><AuthProvider><Root /></AuthProvider></StrictMode>
);
```

Change `SignIn` props to:

```typescript
import type { AuthUser } from "./authApi";
export function SignIn({ authenticate, onSignedIn }: {
  authenticate: (email: string, password: string) => Promise<AuthUser>;
  onSignedIn: (user: AuthUser) => void;
})
```

Replace the authentication state/effect/action with:

```typescript
const [authenticatedUser, setAuthenticatedUser] = useState<AuthUser | null>(null);

useEffect(() => {
  if (!success || !authenticatedUser) return;
  const timeout = setTimeout(() => onSignedIn(authenticatedUser), 1400);
  return () => clearTimeout(timeout);
}, [success, authenticatedUser, onSignedIn]);

const submitAction = async () => {
  if (!validate()) {
    setShakeNonce((nonce) => nonce + 1);
    return;
  }
  try {
    const user = await authenticate(email.trim(), password);
    setAuthenticatedUser(user);
    setSuccess(true);
  } catch {
    setPasswordStatus({ type: "error", message: "Invalid email or password" });
    setShakeNonce((nonce) => nonce + 1);
  }
};
```

Remove `wait`, `GoogleIcon`, `googleLoading`, `googleAction`, the Google button, divider, and signup prompt. Keep `SuccessPanel`, `@astryxdesign/core` fields/buttons, validation animation, and showcase unchanged.

- [ ] **Step 7: Show the admin identity and logout control**

In `App.tsx`, import `Button`, `Text`, and `useAuth`, then inside `App` create one reusable account control so logout remains available even when the gallery is empty or errors:

```tsx
const { user, logout } = useAuth();
const accountControls = (
  <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
    <Text type="supporting" color="secondary">{user?.email}</Text>
    <Button label="Log out" size="sm" variant="ghost" clickAction={logout} />
  </div>
);
```

Add `{accountControls}` to the right side of the populated sticky header row after `SearchBox`. Also add it at the top of the existing empty/error container before `PipelinePanel`, so an authenticated admin is never trapped without logout.

```tsx
{accountControls}
```

- [ ] **Step 8: Run frontend auth tests, type checking, and build**

Run: `node --experimental-strip-types --test src/vitrine/authApi.test.ts && npx tsx --test src/vitrine/SignIn.test.tsx src/vitrine/*.test.tsx && npx tsc --noEmit && npm run build`

Expected: frontend auth tests pass, all TSX tests pass, TypeScript exits 0, and Vite builds.

### Task 7: Full regression and browser acceptance

**Files:**
- Modify: `package.json`
- Verify: all files above

- [ ] **Step 1: Include new tests in the repository command**

Set the test script to:

```json
"test": "node --experimental-strip-types --test src/*.test.ts src/vitrine/*.test.ts services/api/src/*.test.ts services/import-worker/src/*.test.ts && tsx --test src/vitrine/*.test.tsx"
```

The existing glob already includes the new root and Vitrine `.test.ts` files; the TSX command includes the new SignIn test.

- [ ] **Step 2: Run all automated verification**

```sh
npm test
npx tsc --noEmit
npm run build
npm run build-storybook
docker compose config --quiet
```

Expected: all tests pass with zero failures, TypeScript exits 0, Vite and Storybook build, and Compose validates.

- [ ] **Step 3: Start a seeded local API and Vitrine**

Run in separate terminals:

```sh
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='local-testing-password-123' npm run service:api
npm run dev -- --host 127.0.0.1
```

Expected: API listens on 3010 only after printing no credential values; Vite listens on 5173.

- [ ] **Step 4: Verify the private API boundary**

Run without a cookie:

```sh
curl -i http://127.0.0.1:3010/health
curl -i http://127.0.0.1:3010/apps
```

Expected: health returns 200 and apps returns 401.

- [ ] **Step 5: Complete browser acceptance**

1. open Vitrine and confirm the loading state resolves to SignIn;
2. submit a wrong password and confirm the generic error;
3. sign in with `admin@example.com` and the explicit testing password;
4. confirm the admin email and Log out control render using `@astryxdesign/core`;
5. refresh and confirm the authenticated App remains;
6. open gallery, media, Markdown, and jobs;
7. submit then cancel a safe queued pipeline job with the worker paused;
8. log out and confirm Vitrine returns to SignIn;
9. confirm a direct private API request without the cookie returns 401.

- [ ] **Step 6: Record completion evidence**

Record exact test counts, build outputs, cookie flags, authenticated user response, the safe queued/cancelled job ID, and the final unauthenticated 401. Do not claim completion unless every automated check and browser acceptance step passes.
