import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { hashPassword } from "./authCrypto.ts";
import type { ObjectMetadata } from "./objectStore.ts";
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

after(async () => db.closePool());
before(async () => { if (!skip) await applyMigrations(db.pool); });

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

test("serializes the single Free collection allocation", { skip }, async () => {
  const { countUserCollections, createFreeCollection } = await import("./pricingStore.ts");
  const { userId } = await fixture();
  const created = await Promise.all([
    createFreeCollection(userId, "First"),
    createFreeCollection(userId, "Second"),
  ]);
  assert.equal(created.filter(Boolean).length, 1);
  assert.equal(await countUserCollections(userId), 1);
});

test("active Pro accesses every app and receives twenty monthly export reservations", { skip }, async () => {
  const {
    canAccessApp,
    countUserCollections,
    getAccountEntitlements,
    isProUser,
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
  assert.equal(await isProUser(userId), true);
  assert.equal(await countUserCollections(userId), 0);
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

test("creates an export before transactionally completing a stable retry", { skip }, async () => {
  const { completeExport, createExport, failExport } = await import("./pricingStore.ts");
  const { userId, apps } = await fixture();
  const exportId = await createExport(
    userId,
    apps[0],
    undefined,
    { kind: "design-system" },
    "json",
    "pricing-one-tokens.json",
  );
  const before = await db.query(
    "SELECT status, object_key, completed_at FROM exports WHERE id = $1",
    [exportId],
  );
  assert.deepEqual(before.rows[0], { status: "generating", object_key: null, completed_at: null });
  await failExport(exportId);

  const metadata: ObjectMetadata = {
    key: `exports/${exportId}/${"a".repeat(64)}.json`,
    sha256: "a".repeat(64),
    byteSize: 7,
    contentType: "application/json",
    accessClass: "protected",
  };
  await completeExport(exportId, metadata);
  await completeExport(exportId, metadata);

  const completed = await db.query(
    `SELECT e.status, e.object_key, e.completed_at IS NOT NULL AS completed,
            so.sha256, so.byte_size::int AS byte_size, so.content_type, so.access_class
     FROM exports e JOIN stored_objects so ON so.object_key = e.object_key WHERE e.id = $1`,
    [exportId],
  );
  assert.deepEqual(completed.rows[0], {
    status: "complete",
    object_key: metadata.key,
    completed: true,
    sha256: metadata.sha256,
    byte_size: metadata.byteSize,
    content_type: metadata.contentType,
    access_class: metadata.accessClass,
  });
});

test("does not complete an export with invalid object metadata", { skip }, async () => {
  const { completeExport, createExport } = await import("./pricingStore.ts");
  const { userId, apps } = await fixture();
  const exportId = await createExport(
    userId,
    apps[0],
    undefined,
    { kind: "design-system" },
    "json",
    "pricing-one-tokens.json",
  );
  await assert.rejects(() => completeExport(exportId, {
    key: `exports/${exportId}/${"a".repeat(64)}.json`,
    sha256: "wrong",
    byteSize: 7,
    contentType: "application/json",
    accessClass: "protected",
  }), /Invalid SHA-256/);
  const row = await db.query("SELECT status, object_key, completed_at FROM exports WHERE id = $1", [exportId]);
  assert.deepEqual(row.rows[0], { status: "generating", object_key: null, completed_at: null });
});

test("does not attach another export's otherwise valid object", { skip }, async () => {
  const { completeExport, createExport } = await import("./pricingStore.ts");
  const { userId, apps } = await fixture();
  const exportId = await createExport(userId, apps[0], undefined, { kind: "design-system" }, "json", "tokens.json");
  await assert.rejects(() => completeExport(exportId, {
    key: `exports/${exportId + 1}/${"a".repeat(64)}.json`,
    sha256: "a".repeat(64),
    byteSize: 7,
    contentType: "application/json",
    accessClass: "protected",
  }), /does not match export/i);
  const row = await db.query("SELECT status, object_key FROM exports WHERE id = $1", [exportId]);
  assert.deepEqual(row.rows[0], { status: "generating", object_key: null });
});

test("returns completed exports only to their owner or an active admin", { skip }, async () => {
  const { authorizedExportObject, completeExport, createExport } = await import("./pricingStore.ts");
  const { userId, apps } = await fixture();
  const password = await hashPassword("a sufficiently long pricing password");
  const other = await db.query<{ id: number }>(
    "INSERT INTO users (email, password_hash, role) VALUES ('pricing-other@example.com', $1, 'user') RETURNING id",
    [password],
  );
  const admin = await db.query<{ id: number }>(
    "INSERT INTO users (email, password_hash, role) VALUES ('pricing-admin@example.com', $1, 'admin') RETURNING id",
    [password],
  );
  const exportId = await createExport(userId, apps[0], undefined, { kind: "design-system" }, "json", "pricing-one-tokens.json");
  const metadata: ObjectMetadata = {
    key: `exports/${exportId}/${"b".repeat(64)}.json`, sha256: "b".repeat(64), byteSize: 9,
    contentType: "application/json", accessClass: "protected",
  };
  await completeExport(exportId, metadata);
  const expected = { metadata, filename: "pricing-one-tokens.json" };

  assert.deepEqual(await authorizedExportObject({ userId, exportId }), expected);
  assert.equal(await authorizedExportObject({ userId: other.rows[0].id, exportId }), undefined);
  assert.deepEqual(await authorizedExportObject({ userId: admin.rows[0].id, exportId }), expected);
  await db.query("UPDATE users SET active = false WHERE id = $1", [admin.rows[0].id]);
  assert.equal(await authorizedExportObject({ userId: admin.rows[0].id, exportId }), undefined);

  const generatingId = await createExport(userId, apps[0], undefined, { kind: "design-system" }, "json", "pending.json");
  assert.equal(await authorizedExportObject({ userId, exportId: generatingId }), undefined);
});

test("records stable feature keys and bounded event metadata", { skip }, async () => {
  const { recordAccessEvent } = await import("./pricingStore.ts");
  const { userId } = await fixture();

  await recordAccessEvent({
    userId,
    featureKey: "exports",
    action: "export-figma",
    outcome: "completed",
    metadata: { format: "figma" },
  });

  const result = await db.query(
    `SELECT feature_key, metadata FROM access_events
     WHERE user_id = $1 AND action = 'export-figma' ORDER BY id DESC LIMIT 1`,
    [userId],
  );
  assert.deepEqual(result.rows[0], { feature_key: "exports", metadata: { format: "figma" } });
});
