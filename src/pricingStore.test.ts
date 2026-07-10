import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { hashPassword } from "./authCrypto.ts";

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

after(async () => db.closePool());

beforeEach(async () => {
  if (skip) return;
  await db.query("DELETE FROM users WHERE email LIKE 'pricing-%@example.com'");
  await db.query("DELETE FROM apps WHERE name LIKE 'pricing-%'");
});

async function fixture(): Promise<{ userId: number; apps: string[] }> {
  const user = await db.query<{ id: number }>(
    "INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'user') RETURNING id",
    ["pricing-user@example.com", await hashPassword("a sufficiently long pricing password")],
  );
  const apps = ["pricing-one", "pricing-two", "pricing-three", "pricing-four"];
  for (const app of apps) await db.query("INSERT INTO apps (name) VALUES ($1)", [app]);
  return { userId: user.rows[0].id, apps };
}

test("unlocks exactly three Free apps and enforces app access", { skip }, async () => {
  const { canAccessApp, listFreeUnlocks, unlockFreeApp } = await import("./pricingStore.ts");
  const { userId, apps } = await fixture();

  assert.deepEqual(await unlockFreeApp(userId, apps[0]), { status: "unlocked", remaining: 2 });
  assert.deepEqual(await unlockFreeApp(userId, apps[0]), { status: "already_unlocked", remaining: 2 });
  await unlockFreeApp(userId, apps[1]);
  await unlockFreeApp(userId, apps[2]);
  assert.deepEqual(await unlockFreeApp(userId, apps[3]), { status: "limit_reached", remaining: 0 });
  assert.deepEqual(await listFreeUnlocks(userId), apps.slice(0, 3));
  assert.equal(await canAccessApp({ id: userId, role: "user" }, apps[0]), true);
  assert.equal(await canAccessApp({ id: userId, role: "user" }, apps[3]), false);
  assert.equal(await canAccessApp({ id: 999, role: "admin" }, apps[3]), true);
});

test("serializes concurrent Free unlock allocation", { skip }, async () => {
  const { listFreeUnlocks, unlockFreeApp } = await import("./pricingStore.ts");
  const { userId, apps } = await fixture();
  await Promise.all(apps.map((app) => unlockFreeApp(userId, app)));
  assert.equal((await listFreeUnlocks(userId)).length, 3);
});

test("active Pro accesses every app and receives twenty monthly export reservations", { skip }, async () => {
  const {
    canAccessApp,
    getAccountEntitlements,
    reserveExportOperation,
    upsertSubscription,
  } = await import("./pricingStore.ts");
  const { userId, apps } = await fixture();
  await upsertSubscription({
    userId,
    customerId: "cus_pricing",
    subscriptionId: "sub_pricing",
    priceId: "price_month",
    interval: "month",
    status: "active",
    periodStart: new Date("2026-07-01T00:00:00Z"),
    periodEnd: new Date("2026-08-01T00:00:00Z"),
    cancelAtPeriodEnd: false,
    graceExpiresAt: null,
  });

  assert.equal(await canAccessApp({ id: userId, role: "user" }, apps[3]), true);
  for (let used = 1; used <= 20; used++) {
    assert.deepEqual(await reserveExportOperation(userId, new Date("2026-07-10T00:00:00Z")), {
      status: "reserved",
      used,
      limit: 20,
      resetAt: "2026-08-01T00:00:00.000Z",
    });
  }
  assert.deepEqual(await reserveExportOperation(userId, new Date("2026-07-10T00:00:00Z")), {
    status: "limit_reached",
    used: 20,
    limit: 20,
    resetAt: "2026-08-01T00:00:00.000Z",
  });
  const view = await getAccountEntitlements(userId, new Date("2026-07-10T00:00:00Z"));
  assert.equal(view.plan, "pro");
  assert.deepEqual(view.exportUsage, {
    used: 20,
    limit: 20,
    resetAt: "2026-08-01T00:00:00.000Z",
  });
});
