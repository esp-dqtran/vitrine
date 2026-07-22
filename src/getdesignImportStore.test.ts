import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { applyMigrations } from "./migrations.ts";
import type { DesignSystemSnapshot } from "./designSystem.ts";
import {
  getImportedCurrentDesignSystem,
  inspectGetDesignTarget,
  replaceImportedDesignSystem,
  rollbackImportedDesignSystem,
} from "./getdesignImportStore.ts";

const ADMIN_URL = "postgres://postgres:postgres@localhost:5432/postgres";
const TEST_URL = "postgres://postgres:postgres@localhost:5432/astryx_getdesign_test";
const pool = new pg.Pool({ connectionString: TEST_URL });
let skipReason: string | undefined;

const snapshot = (app: string, color: string): DesignSystemSnapshot => ({
  app, generatedAt: "2026-07-22T00:00:00.000Z", summary: `${app} system`,
  tokens: [{ id: "color-primary", kind: "color", name: "Primary", value: color, role: "Brand", evidence: [] }],
  components: [{ id: "button", name: "Button", category: "Actions", description: "Action", variants: [{ id: "button-default", name: "Default", description: "Default", evidence: [] }] }],
  flows: [], rules: [],
});

before(async () => {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  try { await admin.connect(); } catch { skipReason = "Postgres not running"; return; }
  try {
    await admin.query("CREATE DATABASE astryx_getdesign_test").catch((error: { code?: string }) => {
      if (error.code !== "42P04") throw error;
    });
  } finally { await admin.end(); }
  await applyMigrations(pool);
});

after(async () => pool.end());

async function reset(): Promise<void> {
  await pool.query("TRUNCATE design_system_import_history, design_systems, platforms, apps RESTART IDENTITY CASCADE");
}

test("replaces web atomically and creates only an approved missing platform", { skip: skipReason }, async () => {
  await reset();
  const app = await pool.query<{ id: number }>("INSERT INTO apps (name) VALUES ('tesla') RETURNING id");
  await pool.query("INSERT INTO platforms (app_id, name) VALUES ($1, 'ios')", [app.rows[0].id]);
  await pool.query("INSERT INTO design_systems (app_id, platform, snapshot) VALUES ($1, 'ios', $2::jsonb)", [app.rows[0].id, JSON.stringify(snapshot("tesla", "#111111"))]);

  const result = await replaceImportedDesignSystem(pool, {
    runId: "00000000-0000-4000-8000-000000000001", app: "tesla", platform: "web",
    sourceSlug: "tesla", sourceHash: "a".repeat(64), snapshot: snapshot("tesla", "#3e6ae1"),
    allowCreateWebPlatform: true,
  });

  assert.equal(result.createdPlatform, true);
  assert.equal((await getImportedCurrentDesignSystem(pool, "tesla", "web"))?.tokens[0].value, "#3e6ae1");
  assert.equal((await inspectGetDesignTarget(pool, { app: "tesla", platform: "web" })).webPlatformFound, true);
  const mobile = await pool.query<{ snapshot: DesignSystemSnapshot }>("SELECT snapshot FROM design_systems WHERE app_id = $1 AND platform = 'ios'", [app.rows[0].id]);
  assert.equal(mobile.rows[0].snapshot.tokens[0].value, "#111111");
});

test("rejects an unapproved missing web platform without mutation", { skip: skipReason }, async () => {
  await reset();
  await pool.query("INSERT INTO apps (name) VALUES ('linear')");
  await assert.rejects(() => replaceImportedDesignSystem(pool, {
    runId: "00000000-0000-4000-8000-000000000002", app: "linear", platform: "web",
    sourceSlug: "linear.app", sourceHash: "b".repeat(64), snapshot: snapshot("linear", "#5e6ad2"),
    allowCreateWebPlatform: false,
  }), /web platform is missing/);
  assert.equal((await pool.query("SELECT 1 FROM platforms")).rowCount, 0);
});

test("rollback restores prior web data and removes importer-created web platforms", { skip: skipReason }, async () => {
  await reset();
  const existing = await pool.query<{ id: number }>("INSERT INTO apps (name) VALUES ('linear') RETURNING id");
  await pool.query("INSERT INTO platforms (app_id, name) VALUES ($1, 'web')", [existing.rows[0].id]);
  await pool.query("INSERT INTO design_systems (app_id, platform, snapshot) VALUES ($1, 'web', $2::jsonb)", [existing.rows[0].id, JSON.stringify(snapshot("linear", "#111111"))]);
  await replaceImportedDesignSystem(pool, {
    runId: "00000000-0000-4000-8000-000000000003", app: "linear", platform: "web",
    sourceSlug: "linear.app", sourceHash: "c".repeat(64), snapshot: snapshot("linear", "#5e6ad2"), allowCreateWebPlatform: false,
  });
  await rollbackImportedDesignSystem(pool, "linear");
  const restored = await pool.query<{ snapshot: DesignSystemSnapshot; origin: string }>("SELECT snapshot, origin FROM design_systems WHERE app_id = $1 AND platform = 'web'", [existing.rows[0].id]);
  assert.equal(restored.rows[0].snapshot.tokens[0].value, "#111111");
  assert.equal(restored.rows[0].origin, "observed");

  const created = await pool.query<{ id: number }>("INSERT INTO apps (name) VALUES ('tesla') RETURNING id");
  await pool.query("INSERT INTO platforms (app_id, name) VALUES ($1, 'ios')", [created.rows[0].id]);
  await replaceImportedDesignSystem(pool, {
    runId: "00000000-0000-4000-8000-000000000004", app: "tesla", platform: "web",
    sourceSlug: "tesla", sourceHash: "d".repeat(64), snapshot: snapshot("tesla", "#3e6ae1"), allowCreateWebPlatform: true,
  });
  await rollbackImportedDesignSystem(pool, "tesla");
  assert.deepEqual((await pool.query<{ name: string }>("SELECT name FROM platforms WHERE app_id = $1 ORDER BY name", [created.rows[0].id])).rows.map(({ name }) => name), ["ios"]);
});
