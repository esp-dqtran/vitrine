import assert from "node:assert/strict";
import { test } from "node:test";
import pg from "pg";
import { applyMigrations } from "./migrations.ts";
import { createAutonomousStore } from "./autonomousStore.ts";
import type { AutonomousMission } from "./autonomousCrawler.ts";

const ADMIN_URL = "postgres://postgres:postgres@localhost:5432/postgres";
const TEST_URL = "postgres://postgres:postgres@localhost:5432/astryx_autonomous_store_test";

async function ensureTestDb(): Promise<string | undefined> {
  const client = new pg.Client({ connectionString: ADMIN_URL });
  try {
    await client.connect();
  } catch {
    return "Postgres not running — docker compose up -d postgres";
  }
  try {
    await client.query("CREATE DATABASE astryx_autonomous_store_test");
  } catch (error) {
    if ((error as { code?: string }).code !== "42P04") throw error;
  } finally {
    await client.end();
  }
  return undefined;
}

const skipReason = await ensureTestDb();

function readMission(missionKey: string): AutonomousMission {
  return {
    missionKey,
    goal: `Inspect ${missionKey}`,
    productArea: missionKey,
    mode: "read",
    prerequisites: [],
    budget: { actions: 20, recoveries: 2 },
  };
}

function mutateMission(missionKey: string): AutonomousMission {
  return { ...readMission(missionKey), goal: `Change ${missionKey}`, mode: "mutate" };
}

async function fixture(t: { after(fn: () => Promise<void>): void }) {
  const pool = new pg.Pool({ connectionString: TEST_URL });
  t.after(() => pool.end());
  await applyMigrations(pool);
  await pool.query(`
    TRUNCATE crawl_account_leases, crawl_transitions, crawl_states, crawl_missions, crawl_dossiers,
      crawl_repairs, crawl_run_steps, crawl_evidence, crawl_runs, crawl_plans,
      version_images, app_versions, app_flows, design_systems, jobs, platforms, images, apps
    RESTART IDENTITY CASCADE
  `);
  await pool.query(`
    INSERT INTO users (id, email, password_hash, role, active)
    VALUES (-301, 'autonomous-admin@example.com', 'hash', 'admin', true)
    ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, active = EXCLUDED.active
  `);
  const app = await pool.query<{ id: number }>("INSERT INTO apps (name) VALUES ('agent-app') RETURNING id");
  const version = await pool.query<{ id: number }>(
    `INSERT INTO app_versions (app_id, platform, version_number, label, status)
     VALUES ($1, 'web', 1, 'v1', 'draft') RETURNING id`,
    [app.rows[0].id],
  );
  const transaction = async <T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  };
  return {
    store: createAutonomousStore({ query: pool.query.bind(pool), withTransaction: transaction }),
    pool,
    versionId: version.rows[0].id,
  };
}

test("claims distinct read missions and serializes mutations", { skip: skipReason }, async (t) => {
  const { store, versionId } = await fixture(t);
  const parent = await store.createAutonomousRun({
    app: "agent-app",
    platform: "web",
    versionId,
    createdBy: -301,
    homepageUrl: "https://agent.test",
    allowAll: true,
  });
  await store.saveMissions(parent.id, [readMission("search"), readMission("settings"), mutateMission("delete")]);

  assert.equal((await store.claimMission(parent.id, "worker-a", new Date(), 30_000))?.mission_key, "search");
  assert.equal((await store.claimMission(parent.id, "worker-b", new Date(), 30_000))?.mission_key, "settings");
  const mutation = await store.claimMission(parent.id, "worker-c", new Date(), 30_000);
  assert.equal(mutation?.mission_key, "delete");
  assert.equal(await store.acquireAccountLease(parent.id, mutation!.id, "worker-c", "mutation", new Date(), 30_000), true);
  assert.equal(await store.acquireAccountLease(parent.id, mutation!.id, "worker-d", "mutation", new Date(), 30_000), false);
  await assert.rejects(
    () => store.heartbeatAccountLease(parent.id, "worker-d", "mutation", new Date(), 30_000),
    /worker/i,
  );
  await store.heartbeatAccountLease(parent.id, "worker-c", "mutation", new Date(), 30_000);
  await store.releaseAccountLease(parent.id, "worker-c", "mutation");
  assert.equal(await store.acquireAccountLease(parent.id, mutation!.id, "worker-d", "mutation", new Date(), 30_000), true);
});

test("reclaims an expired mission without stealing a live lease", { skip: skipReason }, async (t) => {
  const { store, versionId } = await fixture(t);
  const parent = await store.createAutonomousRun({
    app: "agent-app",
    platform: "web",
    versionId,
    createdBy: -301,
    homepageUrl: "https://agent.test",
    allowAll: true,
  });
  await store.saveMissions(parent.id, [readMission("search")]);

  const claimed = await store.claimMission(parent.id, "worker-a", new Date("2026-07-16T00:00:00Z"), 1_000);
  assert.ok(claimed);
  assert.equal(await store.claimMission(parent.id, "worker-b", new Date("2026-07-16T00:00:00.500Z"), 1_000), undefined);
  assert.equal(
    (await store.claimMission(parent.id, "worker-b", new Date("2026-07-16T00:00:02Z"), 1_000))?.id,
    claimed.id,
  );
});

test("persists autonomous progress and resumes checkpointed missions after a pause", { skip: skipReason }, async (t) => {
  const { store, versionId } = await fixture(t);
  const parent = await store.createAutonomousRun({
    app: "agent-app",
    platform: "web",
    versionId,
    createdBy: -301,
    homepageUrl: "https://agent.test",
    allowAll: true,
  });
  const dossier = await store.saveDossier(parent.id, {
    app: "agent-app",
    purpose: "Test autonomous discovery",
    sources: [{ url: "https://agent.test/docs", title: "Docs", retrievedAt: "2026-07-16T00:00:00.000Z" }],
    claims: [{ text: "The app has settings", sourceUrls: ["https://agent.test/docs"], confidence: 0.9 }],
    roles: ["member"],
    capabilities: ["settings"],
    candidateFlows: [],
    openQuestions: [],
  });
  assert.equal(dossier.revision, 1);
  assert.equal((await store.latestDossier(parent.id))?.id, dossier.id);

  const [search, settings] = await store.saveMissions(parent.id, [readMission("search"), readMission("settings")]);
  const start = new Date("2026-07-16T00:00:00Z");
  const claimedSearch = await store.claimMission(parent.id, "worker-a", start, 1_000);
  assert.equal(claimedSearch?.id, search.id);
  await assert.rejects(
    () => store.heartbeatMission(search.id, "other-worker", new Date("2026-07-16T00:00:00.250Z"), 1_000),
    /worker/i,
  );
  await store.heartbeatMission(search.id, "worker-a", new Date("2026-07-16T00:00:00.500Z"), 1_000);
  await assert.rejects(() => store.finishMission(search.id, "other-worker", "succeeded", {}), /worker/i);
  await store.finishMission(search.id, "worker-a", "succeeded", { states: 1 });

  const state = await store.upsertState(parent.id, {
    stateKey: "settings-home",
    normalizedUrl: "https://agent.test/settings",
    label: "Settings",
    productArea: "Settings",
    accountStateVersion: 1,
    fingerprint: {
      domHash: "a".repeat(64),
      screenshotHash: "b".repeat(64),
      landmarks: ["Preferences"],
      title: "Settings",
    },
  });
  assert.equal((await store.upsertState(parent.id, { ...state, label: "Settings home" })).id, state.id);
  const transition = await store.recordTransition({
    runId: parent.id,
    missionId: search.id,
    destinationStateId: state.id,
    action: { type: "goto", url: "/settings" },
    mode: "read",
    outcome: "completed",
    confidence: 0.95,
  });
  assert.equal(transition.destination_state_id, state.id);

  const claimedSettings = await store.claimMission(parent.id, "worker-b", new Date("2026-07-16T00:00:01Z"), 30_000);
  assert.equal(claimedSettings?.id, settings.id);
  await store.requestPause(parent.id);
  assert.equal(await store.claimMission(parent.id, "worker-c", new Date("2026-07-16T00:00:02Z"), 30_000), undefined);
  await store.clearPause(parent.id);
  assert.equal(
    (await store.claimMission(parent.id, "worker-c", new Date("2026-07-16T00:00:02Z"), 30_000))?.id,
    settings.id,
  );

  const detail = await store.autonomousRunDetail(parent.id);
  assert.equal(detail?.dossier?.id, dossier.id);
  assert.equal(detail?.missions.length, 2);
  assert.equal(detail?.states.length, 1);
  assert.equal(detail?.transitions[0].id, transition.id);
});

test("merges validated flows under the autonomous target version", { skip: skipReason }, async (t) => {
  const { store, pool, versionId } = await fixture(t);
  const parent = await store.createAutonomousRun({
    app: "agent-app", platform: "web", versionId, createdBy: -301,
    homepageUrl: "https://agent.test", allowAll: true,
  });
  await pool.query(
    `INSERT INTO app_flows (app_id, platform, flows)
     SELECT id, 'web', $2::jsonb FROM apps WHERE name = $1`,
    ["agent-app", JSON.stringify([{ id: "manual", title: "Manual", description: "Keep", tags: [], steps: [] }])],
  );
  const merged = await store.saveAutonomousFlows(parent.id, [{
    id: "create-item", title: "Create item", description: "Create", tags: ["Items"],
    steps: [{ label: "Created", evidence: [10] }],
  }]);
  assert.deepEqual(merged.map(({ id }) => id), ["manual", "create-item"]);
  const stored = await pool.query<{ flows: Array<{ id: string }> }>(
    `SELECT af.flows FROM app_flows af JOIN apps a ON a.id = af.app_id
     WHERE a.name = 'agent-app' AND af.platform = 'web'`,
  );
  assert.deepEqual(stored.rows[0].flows.map(({ id }) => id), ["manual", "create-item"]);
});
