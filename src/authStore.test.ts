import { after, test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { applyMigrations } from "./migrations.ts";

const ADMIN_URL = "postgres://postgres:postgres@localhost:5432/postgres";
const TEST_URL = "postgres://postgres:postgres@localhost:5432/astryx_test";

async function ensureTestDb(): Promise<string | undefined> {
  const client = new pg.Client({ connectionString: ADMIN_URL });
  try {
    await client.connect();
  } catch {
    return "Postgres not running — docker compose up -d postgres";
  }
  try {
    await client.query("CREATE DATABASE astryx_test");
  } catch (error) {
    if ((error as { code?: string }).code !== "42P04") throw error;
  } finally {
    await client.end();
  }
  const pool = new pg.Pool({ connectionString: TEST_URL });
  try {
    await applyMigrations(pool);
  } finally {
    await pool.end();
  }
  return undefined;
}

const skipReason = await ensureTestDb();
process.env.DATABASE_URL = TEST_URL;

after(async () => {
  if (!skipReason) await (await import("./db.ts")).closePool();
});

test("seeds one admin, authenticates, resolves a session, and logs out", { skip: skipReason }, async () => {
  const { query } = await import("./db.ts");
  const { authenticateUser, createSession, deleteSession, resolveSession, seedAdmin } =
    await import("./authStore.ts");
  await query("TRUNCATE sessions, users RESTART IDENTITY CASCADE");

  const admin = await seedAdmin("Admin@Example.com", "a sufficiently long admin password");
  assert.deepEqual(admin, { id: 1, email: "admin@example.com", role: "admin" });
  assert.equal(await authenticateUser("admin@example.com", "wrong password"), undefined);
  assert.deepEqual(
    await authenticateUser("ADMIN@example.com", "a sufficiently long admin password"),
    admin
  );

  const session = await createSession(admin.id);
  const stored = await query<{ token_hash: string }>(
    "SELECT token_hash FROM sessions WHERE user_id = $1",
    [admin.id]
  );
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

test("keeps two normal-user sessions and marks the oldest signed in elsewhere", { skip: skipReason }, async () => {
  const { query } = await import("./db.ts");
  const { hashPassword } = await import("./authCrypto.ts");
  const { createSession, resolveSessionState } = await import("./authStore.ts");
  await query("TRUNCATE sessions, users RESTART IDENTITY CASCADE");
  const inserted = await query<{ id: number }>(
    "INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'user') RETURNING id",
    ["user@example.com", await hashPassword("a sufficiently long user password")],
  );
  const first = await createSession(inserted.rows[0].id);
  const second = await createSession(inserted.rows[0].id);
  const third = await createSession(inserted.rows[0].id);
  assert.deepEqual(await resolveSessionState(first.token), { status: "signed_in_elsewhere" });
  assert.equal((await resolveSessionState(second.token)).status, "authenticated");
  assert.equal((await resolveSessionState(third.token)).status, "authenticated");
});
