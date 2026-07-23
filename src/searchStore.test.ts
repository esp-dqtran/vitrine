import assert from "node:assert/strict";
import { test } from "node:test";
import pg from "pg";
import { applyMigrations } from "./migrations.ts";
import { PostgresSearchIndexStore } from "./searchIndexStore.ts";
import { PostgresSearchStore, type SearchAccess } from "./searchStore.ts";
import { normalizeSearchRequest, type SearchDocument } from "./searchTypes.ts";

const databaseUrl = process.env.SEARCH_STORE_TEST_DATABASE_URL;
const skip = !databaseUrl
  ? "SEARCH_STORE_TEST_DATABASE_URL is required for pgvector integration tests"
  : !/test/i.test(new URL(databaseUrl).pathname)
    ? "SEARCH_STORE_TEST_DATABASE_URL must name a disposable test database"
    : false;

const queryVector = [1, ...Array(1535).fill(0)];
const access: SearchAccess = { publishedOnly: true };

async function addVersion(
  pool: pg.Pool,
  input: { app: string; platform: string; status: "published" | "draft" },
) {
  const app = await pool.query<{ id: number }>(
    "INSERT INTO apps (name) VALUES ($1) RETURNING id",
    [input.app],
  );
  await pool.query(
    "INSERT INTO platforms (app_id, name) VALUES ($1, $2)",
    [app.rows[0].id, input.platform],
  );
  const version = await pool.query<{ id: number }>(
    `INSERT INTO app_versions (
       app_id, version_number, label, status, platform, published_at
     ) VALUES ($1, 1, 'v1', $2, $3, CASE WHEN $2 = 'published' THEN now() END)
     RETURNING id`,
    [app.rows[0].id, input.status, input.platform],
  );
  return { appId: app.rows[0].id, versionId: version.rows[0].id };
}

function document(input: {
  appId: number;
  versionId: number;
  appName: string;
  platform: string;
  sourceId: string;
  title: string;
  description?: string;
  productArea?: string;
  components?: string[];
}): SearchDocument {
  return {
    documentId: input.sourceId,
    indexVersion: 1,
    versionId: input.versionId,
    appId: input.appId,
    appName: input.appName,
    platform: input.platform,
    entityType: input.sourceId.startsWith("app:") ? "app" : "screen",
    sourceId: input.sourceId,
    title: input.title,
    description: input.description ?? "",
    aliases: [],
    visibleText: "",
    ...(input.productArea ? { productArea: input.productArea } : {}),
    components: input.components ?? [],
    states: [],
    layoutPatterns: [],
    publishedAt: "2026-07-23T00:00:00.000Z",
    sourcePayload: {},
    searchText: [
      input.title,
      input.description,
      input.productArea,
      ...(input.components ?? []),
    ].filter(Boolean).join(" "),
    sourceRevision: input.sourceId,
  };
}

async function fixture() {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  await applyMigrations(pool);
  await pool.query("DELETE FROM apps");
  const index = new PostgresSearchIndexStore(pool);
  const linear = await addVersion(pool, {
    app: "Linear",
    platform: "web",
    status: "published",
  });
  const mobile = await addVersion(pool, {
    app: "Mobile Shop",
    platform: "ios",
    status: "published",
  });
  const secret = await addVersion(pool, {
    app: "Draft Secret",
    platform: "web",
    status: "draft",
  });
  const linearDocuments = [
    document({
      ...linear,
      appName: "Linear",
      platform: "web",
      sourceId: "app:linear:web",
      title: "Linear checkout",
      productArea: "Checkout",
      components: ["Modal"],
    }),
    document({
      ...linear,
      appName: "Linear",
      platform: "web",
      sourceId: "screen:cross",
      title: "Checkout summary",
      description: "Linear checkout confirmation",
      productArea: "Checkout",
      components: ["Modal"],
    }),
    document({
      ...linear,
      appName: "Linear",
      platform: "web",
      sourceId: "screen:semantic",
      title: "Order complete",
    }),
  ];
  await index.replaceDocuments(
    { ...linear, platform: "web", indexVersion: 1 },
    linearDocuments,
    linearDocuments.map(() => queryVector),
  );
  await index.replaceDocuments(
    { ...mobile, platform: "ios", indexVersion: 1 },
    [document({
      ...mobile,
      appName: "Mobile Shop",
      platform: "ios",
      sourceId: "screen:mobile",
      title: "Mobile checkout",
      productArea: "Checkout",
      components: ["Bottom sheet"],
    })],
    [queryVector],
  );
  await index.replaceDocuments(
    { ...secret, platform: "web", indexVersion: 1 },
    [document({
      ...secret,
      appName: "Draft Secret",
      platform: "web",
      sourceId: "app:draft-secret:web",
      title: "Draft Secret",
    })],
    [queryVector],
  );
  return {
    pool,
    store: new PostgresSearchStore(pool),
    publishedCount: 4,
  };
}

test("exact title wins while cross-list matches beat semantic-only results", { skip }, async (t) => {
  const { pool, store } = await fixture();
  t.after(() => pool.end());
  const result = await store.search(
    normalizeSearchRequest({ q: "Linear checkout" }),
    queryVector,
    access,
  );
  assert.equal(result.items[0].sourceId, "app:linear:web");
  assert.ok(
    result.items.findIndex(({ sourceId }) => sourceId === "screen:cross")
      < result.items.findIndex(({ sourceId }) => sourceId === "screen:semantic"),
  );
});

test("uses AND across groups and OR within a group", { skip }, async (t) => {
  const { pool, store } = await fixture();
  t.after(() => pool.end());
  const result = await store.search(normalizeSearchRequest({
    platform: ["ios", "android"],
    productArea: ["Checkout"],
    component: ["Modal", "Bottom sheet"],
  }), undefined, access);
  assert.ok(result.items.length > 0);
  assert.ok(result.items.every((item) =>
    ["ios", "android"].includes(item.platform)
    && item.productArea === "Checkout"
    && item.components.some((component) => ["Modal", "Bottom sheet"].includes(component))));
});

test("excluded documents never affect facets or type counts", { skip }, async (t) => {
  const { pool, store, publishedCount } = await fixture();
  t.after(() => pool.end());
  const result = await store.search(normalizeSearchRequest({}), undefined, access);
  assert.equal(result.facets.app.some(({ value }) => value === "Draft Secret"), false);
  assert.equal(
    Object.values(result.typeCounts).reduce((sum, count) => sum + count, 0),
    publishedCount,
  );
});

test("rejects a cursor bound to different filters", { skip }, async (t) => {
  const { pool, store } = await fixture();
  t.after(() => pool.end());
  const first = await store.search(normalizeSearchRequest({
    platform: ["web"],
    limit: 1,
  }), undefined, access);
  assert.ok(first.nextCursor);
  await assert.rejects(
    () => store.search(normalizeSearchRequest({
      platform: ["ios"],
      cursor: first.nextCursor!,
      limit: 1,
    }), undefined, access),
    /search cursor does not match request/,
  );
});

test("suggestions use factual published taxonomy only", { skip }, async (t) => {
  const { pool, store } = await fixture();
  t.after(() => pool.end());
  assert.deepEqual(
    (await store.suggest("Lin", access)).map(({ value }) => value),
    ["Linear", "Linear checkout"],
  );
  assert.equal(
    (await store.suggest("Draft", access)).some(({ value }) => value === "Draft Secret"),
    false,
  );
});

test("related search excludes its authorized source document", { skip }, async (t) => {
  const { pool, store } = await fixture();
  t.after(() => pool.end());
  const result = await store.related("app:linear:web", access, 12);
  assert.equal(result.items.some(({ sourceId }) => sourceId === "app:linear:web"), false);
  assert.ok(result.items.some(({ sourceId }) => sourceId === "screen:cross"));
});
