import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import pg from "pg";
import { publishedSearchSource } from "./db.ts";
import { applyMigrations } from "./migrations.ts";
import { PostgresSearchIndexStore } from "./searchIndexStore.ts";
import type { SearchDocument } from "./searchTypes.ts";

const databaseUrl = process.env.SEARCH_INDEX_TEST_DATABASE_URL;
const skip = !databaseUrl
  ? "SEARCH_INDEX_TEST_DATABASE_URL is required for pgvector integration tests"
  : !/test/i.test(new URL(databaseUrl).pathname)
    ? "SEARCH_INDEX_TEST_DATABASE_URL must name a disposable test database"
    : false;

async function fixture() {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  await applyMigrations(pool);
  await pool.query("DELETE FROM search_index_queue");
  await pool.query("DELETE FROM search_documents");
  const name = `Search Store ${randomUUID()}`;
  const app = await pool.query<{ id: number }>(
    "INSERT INTO apps (name) VALUES ($1) RETURNING id",
    [name],
  );
  const appId = app.rows[0].id;
  const platform = await pool.query<{ id: number }>(
    "INSERT INTO platforms (app_id, name) VALUES ($1, 'web') RETURNING id",
    [appId],
  );
  const version = await pool.query<{ id: number }>(
    `INSERT INTO app_versions (
       app_id, version_number, label, status, platform, published_at
     ) VALUES ($1, 1, 'v1', 'published', 'web', now()) RETURNING id`,
    [appId],
  );
  return {
    pool,
    appId,
    platformId: platform.rows[0].id,
    versionId: version.rows[0].id,
    store: new PostgresSearchIndexStore(pool),
  };
}

test("loads one immutable published source with screens, UI elements, system, and flows", { skip }, async (t) => {
  const { pool, appId, platformId, versionId } = await fixture();
  t.after(() => pool.end());
  const images = await pool.query<{ id: number }>(
    `INSERT INTO images (platform_id, image_url, kind)
     VALUES ($1, 'https://cdn.test/screen.png', 'screen'),
            ($1, 'https://cdn.test/element.png', 'ui_element')
     RETURNING id`,
    [platformId],
  );
  await pool.query(
    `INSERT INTO version_images (version_id, image_id)
     SELECT $1, unnest($2::integer[])`,
    [versionId, images.rows.map(({ id }) => id)],
  );
  await pool.query(
    `INSERT INTO design_system_versions (version_id, snapshot)
     VALUES ($1, $2::jsonb)`,
    [versionId, JSON.stringify({
      app: "Fixture",
      generatedAt: "2026-07-23T00:00:00.000Z",
      tokens: [],
      components: [],
      flows: [],
    })],
  );
  await pool.query(
    `INSERT INTO app_flow_versions (version_id, flows)
     VALUES ($1, $2::jsonb)`,
    [versionId, JSON.stringify([{
      id: "sign-in",
      title: "Sign in",
      description: "",
      tags: [],
      steps: [],
    }])],
  );

  const source = await publishedSearchSource(appId, "web");
  assert.equal(source?.version.id, versionId);
  assert.deepEqual(source?.images.map(({ kind }) => kind), ["screen", "ui_element"]);
  assert.equal(source?.system?.app, "Fixture");
  assert.equal(source?.flows[0].id, "sign-in");
});

function document(
  appId: number,
  versionId: number,
  documentId: string,
): SearchDocument {
  return {
    documentId,
    indexVersion: 1,
    versionId,
    appId,
    appName: "Fixture",
    platform: "web",
    entityType: "screen",
    sourceId: documentId,
    title: documentId,
    description: "",
    aliases: [],
    visibleText: "",
    components: [],
    states: [],
    layoutPatterns: [],
    publishedAt: "2026-07-23T00:00:00.000Z",
    sourcePayload: {},
    searchText: documentId,
    sourceRevision: "revision",
  };
}

test("claims each app and platform once with skip locked", { skip }, async (t) => {
  const { pool, appId, store } = await fixture();
  t.after(() => pool.end());
  await store.enqueue(appId, "web");
  const first = await store.claim("worker-1");
  const second = await store.claim("worker-2");
  assert.equal(first?.appId, appId);
  assert.equal(second, null);
});

test("replaces one app-platform document set atomically", { skip }, async (t) => {
  const { pool, appId, versionId, store } = await fixture();
  t.after(() => pool.end());
  const firstDocuments = [
    document(appId, versionId, "screen:first"),
    document(appId, versionId, "screen:old"),
  ];
  const secondDocuments = [document(appId, versionId, "screen:second")];
  await store.replaceDocuments(
    { appId, platform: "web", indexVersion: 1 },
    firstDocuments,
  );
  await store.replaceDocuments(
    { appId, platform: "web", indexVersion: 1 },
    secondDocuments,
  );
  assert.deepEqual(
    (await store.documentsFor(appId, "web")).map(({ documentId }) => documentId),
    secondDocuments.map(({ documentId }) => documentId),
  );
});

test("requeues a failed job with bounded backoff and a sanitized error", { skip }, async (t) => {
  const { pool, appId, store } = await fixture();
  t.after(() => pool.end());
  await store.enqueue(appId, "web");
  const job = await store.claim("worker-1");
  assert.ok(job);
  await store.fail(job, new Error("https://secret.test/token abc"));
  const row = await pool.query<{
    status: string;
    attempts: number;
    last_error: string;
  }>(
    `SELECT status, attempts, last_error FROM search_index_queue
     WHERE app_id = $1 AND platform = 'web'`,
    [appId],
  );
  assert.equal(row.rows[0].status, "queued");
  assert.equal(row.rows[0].attempts, 1);
  assert.doesNotMatch(row.rows[0].last_error, /secret\.test/);
});
