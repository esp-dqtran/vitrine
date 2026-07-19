import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import pg from "pg";
import { applyMigrations } from "./migrations.ts";
import {
  featureKeyForLegacyAction,
  getFeatureUsageOverview,
  getUserFeatureUsage,
  isFeatureKey,
  parseUsageRange,
} from "./featureUsage.ts";

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
  if (!skip) await db.query("DELETE FROM users WHERE email LIKE 'feature-usage-%@example.com'");
});

async function seedUsageFixture() {
  const userOne = await db.query<{ id: number }>(
    "INSERT INTO users (email, role) VALUES ('feature-usage-one@example.com', 'user') RETURNING id",
  );
  const userTwo = await db.query<{ id: number }>(
    "INSERT INTO users (email, role) VALUES ('feature-usage-two@example.com', 'user') RETURNING id",
  );
  const admin = await db.query<{ id: number }>(
    "INSERT INTO users (email, role) VALUES ('feature-usage-admin@example.com', 'admin') RETURNING id",
  );
  const [one, two, internal] = [userOne.rows[0].id, userTwo.rows[0].id, admin.rows[0].id];
  await db.query(
    `INSERT INTO access_events (user_id, feature_key, action, volume, outcome, created_at) VALUES
      ($1, 'exports', 'export-figma', 2, 'completed', now() - interval '1 day'),
      ($2, 'exports', 'export-json', 1, 'completed', now() - interval '1 day'),
      ($1, 'search', 'catalog-search', 2, 'success', now()),
      ($1, NULL, 'export-css', 1, 'allowed', now()),
      ($1, NULL, 'protected-request', 20, 'success', now()),
      ($3, 'exports', 'export-figma', 10, 'completed', now()),
      ($2, 'search', 'catalog-search', 50, 'success', now() - interval '31 days')`,
    [one, two, internal],
  );
  return { one, two };
}

test("accepts only the declared feature taxonomy", () => {
  assert.equal(isFeatureKey("exports"), true);
  assert.equal(isFeatureKey("protected-request"), false);
});

test("normalizes supported ranges and rejects arbitrary windows", () => {
  assert.deepEqual(parseUsageRange("30d"), { key: "30d", days: 30 });
  assert.deepEqual(parseUsageRange(undefined), { key: "30d", days: 30 });
  assert.equal(parseUsageRange("365d"), undefined);
});

test("maps useful historical actions without counting generic requests", () => {
  assert.equal(featureKeyForLegacyAction("export-figma"), "exports");
  assert.equal(featureKeyForLegacyAction("research_project_created"), "research");
  assert.equal(featureKeyForLegacyAction("protected-request"), undefined);
});

test("aggregates member feature usage and excludes administrators", { skip }, async () => {
  const before = await getFeatureUsageOverview({ key: "30d", days: 30 });
  await seedUsageFixture();
  const result = await getFeatureUsageOverview({ key: "30d", days: 30 });
  const beforeExports = before.features.find(({ key }) => key === "exports")?.uses ?? 0;
  const beforeSearch = before.features.find(({ key }) => key === "search")?.uses ?? 0;
  const exports = result.features.find(({ key }) => key === "exports");
  const search = result.features.find(({ key }) => key === "search");
  assert.equal(result.summary.totalEvents - before.summary.totalEvents, 6);
  assert.equal(result.summary.uniqueUsers - before.summary.uniqueUsers, 2);
  assert.equal(exports?.uses, beforeExports + 4);
  assert.equal(search?.uses, beforeSearch + 2);
  assert.equal(result.daily.length, 30);
  assert.equal(
    result.daily.reduce((sum, day) => sum + day.uses, 0)
      - before.daily.reduce((sum, day) => sum + day.uses, 0),
    6,
  );
});

test("returns one user's breakdown and recent activity", { skip }, async () => {
  const { one } = await seedUsageFixture();
  const result = await getUserFeatureUsage(one, { key: "30d", days: 30 });
  assert.equal(result?.summary.totalEvents, 5);
  assert.ok(result?.summary.lastActiveAt);
  assert.equal(result?.features[0].key, "exports");
  assert.equal(result?.recentEvents[0].featureLabel.length > 0, true);
  assert.equal(result?.recentEvents.some(({ action }) => action === "protected-request"), false);
});

test("returns undefined for an unknown user", { skip }, async () => {
  assert.equal(await getUserFeatureUsage(999_999, { key: "30d", days: 30 }), undefined);
});
