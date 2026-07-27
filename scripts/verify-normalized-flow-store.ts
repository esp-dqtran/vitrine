import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import pg from "pg";
import type { DesignFlow } from "../src/designSystem.ts";
import { applyMigrations } from "../src/migrations.ts";
import {
  mergeCurrentFlows,
  readCurrentFlows,
  readVersionFlows,
  replaceCurrentFlows,
  replaceVersionFlows,
} from "../src/normalizedFlowStore.ts";

const flow = (overrides: Partial<DesignFlow> = {}): DesignFlow => ({
  id: "checkout",
  title: "Checkout",
  description: "Complete a purchase",
  tags: ["commerce"],
  steps: [{ label: "Confirm order", evidence: [11] }],
  ...overrides,
});

const quotedIdentifier = (value: string): string =>
  `"${value.replaceAll('"', '""')}"`;

async function inTransaction<T>(
  pool: pg.Pool,
  work: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
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
}

export async function verifyNormalizedFlowStore(
  adminUrl = process.env.FLOW_IMPORT_TEST_ADMIN_URL,
): Promise<void> {
  if (!adminUrl) throw new Error("FLOW_IMPORT_TEST_ADMIN_URL is required");
  const databaseName = `astryx_flow_import_test_${randomUUID().replaceAll("-", "")}`;
  const maintenance = new pg.Pool({ connectionString: adminUrl });
  const databaseUrl = new URL(adminUrl);
  databaseUrl.pathname = `/${databaseName}`;
  const database = new pg.Pool({ connectionString: databaseUrl.toString() });

  try {
    await maintenance.query(`CREATE DATABASE ${quotedIdentifier(databaseName)}`);
    await applyMigrations(database);
    const seeded = await database.query<{
      app_one_id: number;
      app_two_id: number;
      version_id: number;
    }>(
      `WITH app_one AS (
         INSERT INTO apps (name) VALUES ('Flow Store One') RETURNING id
       ), app_two AS (
         INSERT INTO apps (name) VALUES ('Flow Store Two') RETURNING id
       ), platform_one AS (
         INSERT INTO platforms (app_id, name)
         SELECT id, 'web' FROM app_one
       ), platform_two AS (
         INSERT INTO platforms (app_id, name)
         SELECT id, 'web' FROM app_two
       ), version AS (
         INSERT INTO app_versions (app_id, platform, version_number, label, status)
         SELECT id, 'web', 1, 'v1', 'draft' FROM app_one RETURNING id
       )
       SELECT app_one.id AS app_one_id, app_two.id AS app_two_id,
         version.id AS version_id
       FROM app_one, app_two, version`,
    );
    const {
      app_one_id: appOneId,
      app_two_id: appTwoId,
      version_id: versionId,
    } = seeded.rows[0];
    const original = [
      flow({
        id: "standalone",
        title: "Onboarding",
        provenance: {
          autonomousRunId: "run-one",
          missionId: "mission-one",
          confidence: 0.95,
          sourceUrls: ["https://example.com/onboarding"],
          validationStatus: "complete",
        },
      }),
      flow({
        id: "child",
        title: "Create account",
        category: "Onboarding",
        insights: {
          purpose: "Register",
          feedback: [],
          openQuestions: [],
          confidence: 0.9,
          reviewStatus: "needs_review",
          source: "llm_inferred",
          evidence: [11],
        },
      }),
    ];

    await inTransaction(database, (client) => replaceCurrentFlows(client, {
      appId: appOneId,
      platform: "web",
      flows: original,
    }));
    assert.deepEqual(
      await inTransaction(database, (client) => readCurrentFlows(client, {
        appId: appOneId,
        platform: "web",
      })),
      original,
    );
    assert.equal(Number((await database.query(
      "SELECT count(*) FROM app_flow_mappings",
    )).rows[0].count), 2);

    await inTransaction(database, (client) => replaceCurrentFlows(client, {
      appId: appOneId,
      platform: "web",
      flows: [original[1], original[0]],
    }));
    assert.deepEqual(
      (await inTransaction(database, (client) => readCurrentFlows(client, {
        appId: appOneId,
        platform: "web",
      }))).map(({ id }) => id),
      ["child", "standalone"],
    );

    const merged = await inTransaction(database, (client) => mergeCurrentFlows(client, {
      appId: appOneId,
      platform: "web",
      flows: [
        flow({ id: "child", title: "Create profile", category: "Onboarding" }),
        flow({ id: "third", title: "Verify email", category: "Onboarding" }),
      ],
    }));
    assert.deepEqual(merged.map(({ id }) => id), ["child", "standalone", "third"]);
    assert.equal(merged[0].title, "Create profile");

    await inTransaction(database, (client) => replaceVersionFlows(client, {
      versionId,
      flows: merged,
    }));
    assert.deepEqual(
      await inTransaction(database, (client) => readVersionFlows(client, { versionId })),
      merged,
    );
    await inTransaction(database, (client) => replaceVersionFlows(client, {
      versionId,
      flows: [...merged].reverse(),
    }));
    assert.deepEqual(
      (await inTransaction(database, (client) =>
        readVersionFlows(client, { versionId }))).map(({ id }) => id),
      ["third", "standalone", "child"],
    );

    await inTransaction(database, (client) => replaceCurrentFlows(client, {
      appId: appOneId,
      platform: "web",
      flows: merged,
    }));
    const mappingBefore = await database.query<{
      source_flow_id: string;
      flow_id: number;
    }>(
      `SELECT af.source_flow_id, afm.flow_id
       FROM app_flows af
       JOIN app_flow_mappings afm ON afm.app_flow_id = af.id
       WHERE af.app_id = $1 AND af.platform = 'web'
       ORDER BY af.position`,
      [appOneId],
    );
    await inTransaction(database, (client) => replaceCurrentFlows(client, {
      appId: appOneId,
      platform: "web",
      flows: merged,
    }));
    assert.deepEqual((await database.query(
      `SELECT af.source_flow_id, afm.flow_id
       FROM app_flows af
       JOIN app_flow_mappings afm ON afm.app_flow_id = af.id
       WHERE af.app_id = $1 AND af.platform = 'web'
       ORDER BY af.position`,
      [appOneId],
    )).rows, mappingBefore.rows);

    const childBefore = mappingBefore.rows.find(({ source_flow_id }) =>
      source_flow_id === "child")!.flow_id;
    await inTransaction(database, (client) => mergeCurrentFlows(client, {
      appId: appOneId,
      platform: "web",
      flows: [flow({ id: "child", title: "Create profile", category: "Account" })],
    }));
    const childAfter = await database.query<{ flow_id: number }>(
      `SELECT afm.flow_id
       FROM app_flows af
       JOIN app_flow_mappings afm ON afm.app_flow_id = af.id
       WHERE af.app_id = $1 AND af.platform = 'web' AND af.source_flow_id = 'child'`,
      [appOneId],
    );
    assert.notEqual(Number(childAfter.rows[0].flow_id), Number(childBefore));

    await inTransaction(database, (client) => mergeCurrentFlows(client, {
      appId: appOneId,
      platform: "web",
      flows: [
        flow({ id: "billing-settings", title: "Settings", category: "Billing" }),
        flow({ id: "account-settings", title: "Settings", category: "Account" }),
      ],
    }));
    const settingsChildren = await database.query(
      `SELECT child.id
       FROM flows child JOIN flows parent ON parent.id = child.parent_id
       WHERE child.normalized_name = 'settings'
         AND parent.normalized_name IN ('billing', 'account')`,
    );
    assert.equal(settingsChildren.rowCount, 2);

    await Promise.all([
      inTransaction(database, (client) => replaceCurrentFlows(client, {
        appId: appOneId,
        platform: "ios",
        flows: [flow({ id: "shared-one", title: "First", category: "Shared Root" })],
      })),
      inTransaction(database, (client) => replaceCurrentFlows(client, {
        appId: appTwoId,
        platform: "web",
        flows: [flow({ id: "shared-two", title: "Second", category: " shared   root " })],
      })),
    ]);
    const sharedRoots = await database.query<{ name: string }>(
      "SELECT name FROM flows WHERE parent_id IS NULL AND normalized_name = 'shared root'",
    );
    assert.equal(sharedRoots.rowCount, 1);
    assert.equal(sharedRoots.rows[0].name, "Shared Root");

    const beforeFailure = await inTransaction(database, (client) =>
      readCurrentFlows(client, { appId: appTwoId, platform: "web" }));
    await database.query(
      `CREATE FUNCTION reject_test_flow_mapping() RETURNS trigger AS $$
       BEGIN
         RAISE EXCEPTION 'forced mapping failure';
       END;
       $$ LANGUAGE plpgsql;
       CREATE TRIGGER reject_test_flow_mapping
       BEFORE INSERT ON app_flow_mappings
       FOR EACH ROW EXECUTE FUNCTION reject_test_flow_mapping()`,
    );
    await assert.rejects(
      inTransaction(database, (client) => replaceCurrentFlows(client, {
        appId: appTwoId,
        platform: "web",
        flows: [flow({ id: "should-rollback", title: "Rollback" })],
      })),
      /forced mapping failure/,
    );
    assert.deepEqual(
      await inTransaction(database, (client) =>
        readCurrentFlows(client, { appId: appTwoId, platform: "web" })),
      beforeFailure,
    );
    await database.query("DROP TRIGGER reject_test_flow_mapping ON app_flow_mappings");
    await database.query("DROP FUNCTION reject_test_flow_mapping()");

    await inTransaction(database, (client) => replaceCurrentFlows(client, {
      appId: appOneId,
      platform: "web",
      flows: [],
    }));
    assert.deepEqual(
      await inTransaction(database, (client) =>
        readCurrentFlows(client, { appId: appOneId, platform: "web" })),
      [],
    );
    assert.equal(
      (await inTransaction(database, (client) =>
        readVersionFlows(client, { versionId }))).length,
      merged.length,
    );
  } finally {
    await database.end().catch(() => undefined);
    await maintenance.query(
      `DROP DATABASE IF EXISTS ${quotedIdentifier(databaseName)}`,
    );
    await maintenance.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyNormalizedFlowStore()
    .then(() => console.log(JSON.stringify({ normalizedFlowStore: "verified" })))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
