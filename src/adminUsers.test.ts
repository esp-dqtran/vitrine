import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import pg from "pg";
import { applyMigrations } from "./migrations.ts";

const TEST_URL = "postgres://postgres:postgres@localhost:5432/astryx_test";
process.env.DATABASE_URL = TEST_URL;

async function postgresAvailable(): Promise<boolean> {
  const client = new pg.Client({ connectionString: TEST_URL });
  try {
    await client.connect();
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}

const skip = (await postgresAvailable()) ? undefined : "Postgres test database unavailable";
const db = await import("./db.ts");
const {
  decodeAdminUserCursor,
  listAdminUsersPage,
  setAdminUserActive,
} = await import("./adminUsers.ts");

after(async () => db.closePool());
before(async () => { if (!skip) await applyMigrations(db.pool); });

beforeEach(async () => {
  if (skip) return;
  await db.query("DELETE FROM users WHERE email LIKE 'admin-users-%@example.com'");
});

async function seedUser(input: {
  email: string;
  role?: "admin" | "user";
  active?: boolean;
  createdAt?: string;
  pro?: boolean;
}): Promise<number> {
  const result = await db.query<{ id: number }>(
    `INSERT INTO users (email, role, active, created_at)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [input.email, input.role ?? "user", input.active ?? true, input.createdAt ?? "2026-07-19T00:00:00.000Z"],
  );
  const id = result.rows[0].id;
  if (input.pro) await db.query("INSERT INTO subscriptions (user_id, status) VALUES ($1, 'active')", [id]);
  return id;
}

test("paginates users in stable newest-first order", { skip }, async () => {
  for (let index = 0; index < 35; index += 1) {
    await seedUser({
      email: `admin-users-page-${index}@example.com`,
      createdAt: new Date(Date.UTC(2026, 6, 1, 0, index)).toISOString(),
    });
  }

  const first = await listAdminUsersPage({ limit: 30, query: "admin-users-page-", filter: "all" });
  assert.equal(first.users.length, 30);
  assert.equal(first.total, 35);
  assert.ok(first.nextCursor);

  const second = await listAdminUsersPage({ limit: 30, cursor: first.nextCursor!, query: "admin-users-page-", filter: "all" });
  assert.equal(second.users.length, 5);
  assert.equal(second.nextCursor, null);
  assert.equal(new Set([...first.users, ...second.users].map((user) => user.id)).size, 35);
});

test("applies search and account filters before counting", { skip }, async () => {
  await seedUser({ email: "admin-users-admin@example.com", role: "admin" });
  await seedUser({ email: "admin-users-pro@example.com", pro: true });
  await seedUser({ email: "admin-users-free@example.com" });
  await seedUser({ email: "admin-users-disabled@example.com", active: false });

  assert.equal((await listAdminUsersPage({ query: "admin-users-pro@", filter: "pro" })).total, 1);
  assert.equal((await listAdminUsersPage({ query: "admin-users-", filter: "admin" })).users.every((user) => user.role === "admin"), true);
  assert.equal((await listAdminUsersPage({ query: "admin-users-", filter: "disabled" })).users.every((user) => !user.active), true);
});

test("rejects malformed cursors", () => {
  assert.throws(() => decodeAdminUserCursor("not-a-cursor"), /Invalid user cursor/);
});

test("disables an account and revokes its sessions atomically", { skip }, async () => {
  const adminId = await seedUser({ email: "admin-users-actor@example.com", role: "admin" });
  const userId = await seedUser({ email: "admin-users-target@example.com" });
  await db.query(
    "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 day')",
    [userId, `admin-users-token-${userId}`],
  );

  const result = await setAdminUserActive({ actorUserId: adminId, userId, active: false });
  assert.equal(result.status, "updated");
  if (result.status === "updated") assert.equal(result.user.active, false);
  const sessions = await db.query("SELECT revoked_at, revoked_reason FROM sessions WHERE user_id = $1", [userId]);
  assert.ok(sessions.rows[0].revoked_at);
  assert.equal(sessions.rows[0].revoked_reason, "account_disabled");
});

test("enables a disabled account", { skip }, async () => {
  const adminId = await seedUser({ email: "admin-users-enable-actor@example.com", role: "admin" });
  const userId = await seedUser({ email: "admin-users-enable-target@example.com", active: false });
  const result = await setAdminUserActive({ actorUserId: adminId, userId, active: true });
  assert.equal(result.status, "updated");
  if (result.status === "updated") assert.equal(result.user.active, true);
});

test("does not allow an administrator to disable itself", { skip }, async () => {
  const adminId = await seedUser({ email: "admin-users-self@example.com", role: "admin" });
  assert.deepEqual(await setAdminUserActive({ actorUserId: adminId, userId: adminId, active: false }), {
    status: "forbidden", reason: "self_disable",
  });
});

test("does not disable the last active administrator", { skip }, async () => {
  const adminId = await seedUser({ email: "admin-users-last@example.com", role: "admin" });
  const otherAdmins = await db.query<{ id: number }>(
    "UPDATE users SET active = false WHERE role = 'admin' AND id <> $1 AND active = true RETURNING id",
    [adminId],
  );
  try {
    assert.deepEqual(await setAdminUserActive({ actorUserId: 999_999, userId: adminId, active: false }), {
      status: "forbidden", reason: "last_active_admin",
    });
  } finally {
    if (otherAdmins.rows.length) {
      await db.query("UPDATE users SET active = true WHERE id = ANY($1::int[])", [otherAdmins.rows.map(({ id }) => id)]);
    }
  }
});
