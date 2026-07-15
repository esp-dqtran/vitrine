import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, mkdtemp, rm, symlink, truncate, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import pg from "pg";

import {
  migrateLegacyMedia,
  PostgresMediaMigrationDatabase,
  selectPublishedPreviews,
  type MediaMigrationDatabase,
  type MediaMigrationRow,
  type PreviewSelection,
} from "./mediaMigration.ts";
import { LocalObjectStore, type ObjectMetadata, type ObjectStore } from "./objectStore.ts";
import { applyMigrations } from "./migrations.ts";

const png = (suffix = "fixture") => Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from(suffix),
]);
const sha = (body: Uint8Array) => createHash("sha256").update(body).digest("hex");

class FakeStore implements ObjectStore {
  objects = new Map<string, { metadata: ObjectMetadata; body: Buffer }>();
  puts = 0;
  active = 0;
  peak = 0;
  gate?: Promise<void>;

  async put(input: ObjectMetadata & { body: Uint8Array }) {
    this.puts += 1;
    this.active += 1;
    this.peak = Math.max(this.peak, this.active);
    await this.gate;
    this.active -= 1;
    const metadata = { key: input.key, sha256: input.sha256, byteSize: input.byteSize, contentType: input.contentType, accessClass: input.accessClass };
    this.objects.set(input.key, { metadata, body: Buffer.from(input.body) });
    return { created: true, metadata };
  }
  async head(key: string) { return this.objects.get(key)?.metadata; }
  async get(key: string) {
    const value = this.objects.get(key);
    if (!value) throw new Error("missing");
    return value;
  }
  async signedGetUrl() { return undefined; }
  async *list() { for (const value of this.objects.values()) yield value.metadata; }
  async delete(key: string) { return this.objects.delete(key); }
}

class FakeDatabase implements MediaMigrationDatabase {
  rows: MediaMigrationRow[] = [];
  attempts: number[] = [];
  completed: Array<{ imageId: number; metadata: ObjectMetadata }> = [];
  failures: Array<{ imageId: number; errorCode: string }> = [];
  previews: PreviewSelection[] = [];
  writtenPreviews: PreviewSelection[] = [];

  async migrationRows() { return this.rows; }
  async beginAttempt(row: MediaMigrationRow) { this.attempts.push(row.imageId); }
  async complete(row: MediaMigrationRow, metadata: ObjectMetadata) { this.completed.push({ imageId: row.imageId, metadata }); }
  async fail(row: MediaMigrationRow, errorCode: string) { this.failures.push({ imageId: row.imageId, errorCode }); }
  async previewCandidates() { return this.previews; }
  async replacePreviews(rows: PreviewSelection[]) { this.writtenPreviews = rows; }
}

async function fixture(run: (root: string, db: FakeDatabase, store: FakeStore) => Promise<void>) {
  const root = await mkdtemp(path.join(tmpdir(), "astryx-media-migration-"));
  const db = new FakeDatabase();
  const store = new FakeStore();
  try { await run(root, db, store); } finally { await rm(root, { recursive: true, force: true }); }
}

async function legacy(root: string, app: string, hash: string, extension: string, body = png()) {
  const directory = path.join(root, "images", app);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, `${hash}.${extension}`), body);
}

const row = (imageId = 7, hash = "0123456789abcdef"): MediaMigrationRow => ({
  imageId,
  app: "linear",
  legacyReference: `mobbin-bulk:${hash}`,
  objectKey: null,
  migrationStatus: null,
  migrationObjectKey: null,
});

test("dry-run is the default and performs no writes", async () => fixture(async (root, db, store) => {
  db.rows = [row()];
  await legacy(root, "linear", "0123456789abcdef", "png");
  const report = await migrateLegacyMedia({ dataDir: root, database: db, objectStore: store });
  assert.equal(report.mode, "dry-run");
  assert.equal(report.ready, 1);
  assert.equal(store.puts, 0);
  assert.deepEqual(db.attempts, []);
  assert.deepEqual(db.completed, []);
}));

test("apply uploads stable full-SHA image key and completes in the database", async () => fixture(async (root, db, store) => {
  const body = png("stable");
  db.rows = [row(42)];
  await legacy(root, "linear", "0123456789abcdef", "png", body);
  const report = await migrateLegacyMedia({ dataDir: root, database: db, objectStore: store, apply: true });
  const key = `images/42/${sha(body)}.png`;
  assert.equal(report.migrated, 1);
  assert.deepEqual(db.attempts, [42]);
  assert.equal(db.completed[0].metadata.key, key);
  assert.equal((await store.head(key))?.sha256, sha(body));
}));

test("missing and ambiguous legacy files record stable error codes only", async () => fixture(async (root, db, store) => {
  db.rows = [row(1, "1111111111111111"), row(2, "2222222222222222")];
  await legacy(root, "linear", "2222222222222222", "png");
  await legacy(root, "linear", "2222222222222222", "webp", Buffer.concat([Buffer.from("RIFF0000WEBP"), Buffer.from("x")]));
  const report = await migrateLegacyMedia({ dataDir: root, database: db, objectStore: store, apply: true });
  assert.deepEqual([...db.failures].sort((left, right) => left.imageId - right.imageId), [
    { imageId: 1, errorCode: "LEGACY_FILE_MISSING" },
    { imageId: 2, errorCode: "LEGACY_FILE_AMBIGUOUS" },
  ]);
  assert.deepEqual(report.images.map(({ image_id, error_code }) => ({ image_id, error_code })), [
    { image_id: 1, error_code: "LEGACY_FILE_MISSING" },
    { image_id: 2, error_code: "LEGACY_FILE_AMBIGUOUS" },
  ]);
}));

test("rejects extension and magic MIME mismatches", async () => fixture(async (root, db, store) => {
  db.rows = [row()];
  await legacy(root, "linear", "0123456789abcdef", "png", Buffer.concat([Buffer.from("RIFF0000WEBP"), Buffer.from("x")]));
  await migrateLegacyMedia({ dataDir: root, database: db, objectStore: store, apply: true });
  assert.deepEqual(db.failures, [{ imageId: 7, errorCode: "IMAGE_TYPE_MISMATCH" }]);
  assert.equal(store.puts, 0);
}));

test("rejects legacy files larger than 64 MiB without reading or uploading them", async () => fixture(async (root, db, store) => {
  db.rows = [row()];
  await legacy(root, "linear", "0123456789abcdef", "png");
  await truncate(path.join(root, "images", "linear", "0123456789abcdef.png"), 64 * 1024 * 1024 + 1);
  await migrateLegacyMedia({ dataDir: root, database: db, objectStore: store, apply: true });
  assert.deepEqual(db.failures, [{ imageId: 7, errorCode: "IMAGE_TOO_LARGE" }]);
  assert.equal(store.puts, 0);
}));

test("rejects a legacy image symlink that escapes the app directory", async () => fixture(async (root, db, store) => {
  db.rows = [row()];
  const outside = path.join(root, "outside.png");
  await writeFile(outside, png("outside"));
  const directory = path.join(root, "images", "linear");
  await mkdir(directory, { recursive: true });
  await symlink(outside, path.join(directory, "0123456789abcdef.png"));
  await migrateLegacyMedia({ dataDir: root, database: db, objectStore: store, apply: true });
  assert.deepEqual(db.failures, [{ imageId: 7, errorCode: "LEGACY_PATH_UNSAFE" }]);
  assert.equal(store.puts, 0);
}));

test("existing object metadata mismatch fails without overwriting", async () => fixture(async (root, db, store) => {
  const body = png("same-key");
  db.rows = [row()];
  await legacy(root, "linear", "0123456789abcdef", "png", body);
  const key = `images/7/${sha(body)}.png`;
  store.objects.set(key, { metadata: { key, sha256: "f".repeat(64), byteSize: body.length, contentType: "image/png", accessClass: "protected" }, body });
  await migrateLegacyMedia({ dataDir: root, database: db, objectStore: store, apply: true });
  assert.deepEqual(db.failures, [{ imageId: 7, errorCode: "EXISTING_OBJECT_MISMATCH" }]);
  assert.equal(store.puts, 0);
}));

test("an interrupted upload resumes from matching object head and completes without reupload", async () => fixture(async (root, db, store) => {
  const body = png("resume");
  const pending = { ...row(), migrationStatus: "pending" as const };
  db.rows = [pending];
  await legacy(root, "linear", "0123456789abcdef", "png", body);
  const key = `images/7/${sha(body)}.png`;
  const metadata: ObjectMetadata = { key, sha256: sha(body), byteSize: body.length, contentType: "image/png", accessClass: "protected" };
  store.objects.set(key, { metadata, body });
  await migrateLegacyMedia({ dataDir: root, database: db, objectStore: store, apply: true });
  assert.equal(store.puts, 0);
  assert.equal(db.completed.length, 1);
}));

test("a failed row retries and can complete", async () => fixture(async (root, db, store) => {
  db.rows = [{ ...row(), migrationStatus: "failed" }];
  await legacy(root, "linear", "0123456789abcdef", "png");
  await migrateLegacyMedia({ dataDir: root, database: db, objectStore: store, apply: true });
  assert.deepEqual(db.attempts, [7]);
  assert.equal(db.completed.length, 1);
}));

test("complete rows are skipped only after a fresh matching object head", async () => fixture(async (root, db, store) => {
  const body = png("complete");
  const key = `images/7/${sha(body)}.png`;
  db.rows = [{ ...row(), objectKey: key, migrationStatus: "complete", migrationObjectKey: key }];
  await legacy(root, "linear", "0123456789abcdef", "png", body);
  const metadata: ObjectMetadata = { key, sha256: sha(body), byteSize: body.length, contentType: "image/png", accessClass: "protected" };
  store.objects.set(key, { metadata, body });
  const report = await migrateLegacyMedia({ dataDir: root, database: db, objectStore: store, apply: true });
  assert.equal(report.skipped, 1);
  assert.deepEqual(db.attempts, []);

  store.objects.set(key, { metadata: { ...metadata, sha256: "e".repeat(64) }, body });
  const mismatch = await migrateLegacyMedia({ dataDir: root, database: db, objectStore: store, apply: true });
  assert.equal(mismatch.failed, 1);
  assert.equal(mismatch.images[0].error_code, "EXISTING_OBJECT_MISMATCH");
}));

test("first apply and completed rerun produce the same ordered evidence hash", async () => fixture(async (root, db, store) => {
  const body = png("stable-evidence");
  await legacy(root, "linear", "0123456789abcdef", "png", body);
  db.rows = [row()];
  const first = await migrateLegacyMedia({ dataDir: root, database: db, objectStore: store, apply: true });
  const key = `images/7/${sha(body)}.png`;
  db.rows = [{ ...row(), objectKey: key, migrationStatus: "complete", migrationObjectKey: key }];
  const second = await migrateLegacyMedia({ dataDir: root, database: db, objectStore: store, apply: true });
  assert.equal(first.migrated, 1);
  assert.equal(second.skipped, 1);
  assert.equal(first.evidence_sha256, second.evidence_sha256);
}));

test("apply work is bounded by configured concurrency", async () => fixture(async (root, db, store) => {
  db.rows = Array.from({ length: 6 }, (_, index) => row(index + 1, String(index + 1).padStart(16, "0")));
  for (const candidate of db.rows) await legacy(root, "linear", candidate.legacyReference.slice(-16), "png", png(String(candidate.imageId)));
  let release!: () => void;
  store.gate = new Promise<void>((resolve) => { release = resolve; });
  const migration = migrateLegacyMedia({ dataDir: root, database: db, objectStore: store, apply: true, concurrency: 2 });
  while (store.peak < 2) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(store.peak, 2);
  release();
  await migration;
  assert.ok(store.peak <= 2);
}));

test("report contains IDs, counts, and checksums but no database URL or absolute paths", async () => fixture(async (root, db, store) => {
  db.rows = [row()];
  await legacy(root, "linear", "0123456789abcdef", "png");
  const report = await migrateLegacyMedia({ dataDir: root, database: db, objectStore: store, databaseUrl: "postgres://secret@db/private" });
  const text = JSON.stringify(report);
  assert.match(text, /"image_id":7/);
  assert.match(text, /"evidence_sha256":"[0-9a-f]{64}"/);
  assert.equal(text.includes("postgres://"), false);
  assert.equal(text.includes(root), false);
}));

test("preview seeding uses only ranks 1-3 from latest published object-backed candidates", async () => {
  const db = new FakeDatabase();
  db.previews = [
    { appId: 1, versionId: 11, imageId: 101, rank: 1 },
    { appId: 1, versionId: 11, imageId: 102, rank: 2 },
    { appId: 1, versionId: 11, imageId: 103, rank: 3 },
  ];
  const dry = await selectPublishedPreviews(db, false);
  assert.deepEqual(dry, db.previews);
  assert.deepEqual(db.writtenPreviews, []);
  const applied = await selectPublishedPreviews(db, true);
  assert.deepEqual(applied, db.previews);
  assert.deepEqual(db.writtenPreviews, db.previews);
  assert.ok(applied.every(({ rank }) => rank >= 1 && rank <= 3));
});

test("PostgreSQL completion attaches object and state in one transaction", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const client = {
    async query(sql: string, values?: readonly unknown[]) {
      calls.push({ sql, values });
      return { rows: sql.includes("RETURNING object_key") ? [{ object_key: "key" }] : sql.includes("RETURNING id") ? [{ id: 7 }] : [], rowCount: 1 };
    },
    release() {},
  };
  const database = new PostgresMediaMigrationDatabase({
    query: client.query,
    async connect() { return client; },
  });
  const metadata: ObjectMetadata = {
    key: `images/7/${"a".repeat(64)}.png`, sha256: "a".repeat(64), byteSize: 12,
    contentType: "image/png", accessClass: "protected",
  };
  await database.complete(row(), metadata);
  assert.equal(calls[0].sql, "BEGIN");
  assert.match(calls[1].sql, /INSERT INTO stored_objects/);
  assert.match(calls[2].sql, /UPDATE images SET object_key/);
  assert.match(calls[3].sql, /media_migration_state/);
  assert.equal(calls.at(-1)?.sql, "COMMIT");
});

test("PostgreSQL migration scan retains failed migrated rows for repair", async () => {
  let sql = "";
  const database = new PostgresMediaMigrationDatabase({
    async query(statement: string) { sql = statement; return { rows: [], rowCount: 0 }; },
    async connect() { throw new Error("unused"); },
  });
  await database.migrationRows();
  assert.match(sql, /i\.object_key IS NULL OR m\.image_id IS NOT NULL/);
});

test("PostgreSQL preview candidates are object-backed ranks 1-3 from latest published versions", async () => {
  let sql = "";
  const database = new PostgresMediaMigrationDatabase({
    async query(statement: string) { sql = statement; return { rows: [], rowCount: 0 }; },
    async connect() { throw new Error("unused"); },
  });
  await database.previewCandidates();
  assert.match(sql, /status = 'published'/);
  assert.match(sql, /ORDER BY av\.app_id, av\.version_number DESC/);
  assert.match(sql, /i\.object_key IS NOT NULL/);
  assert.match(sql, /BETWEEN 1 AND 3/);
});

test("PostgreSQL preview replacement removes stale generations atomically", async () => {
  const calls: string[] = [];
  const client = {
    async query(sql: string) { calls.push(sql); return { rows: [], rowCount: 1 }; },
    release() {},
  };
  const database = new PostgresMediaMigrationDatabase({
    async query() { return { rows: [], rowCount: 0 }; },
    async connect() { return client; },
  });
  await database.replacePreviews([{ appId: 1, versionId: 12, imageId: 7, rank: 1 }]);
  assert.equal(calls[0], "BEGIN");
  assert.equal(calls[1], "DELETE FROM app_preview_images");
  assert.match(calls[2], /INSERT INTO app_preview_images/);
  assert.equal(calls.at(-1), "COMMIT");
});

test("copied PostgreSQL fixture migrates once and reruns with zero uploads and identical evidence", async (t) => {
  const adminUrl = "postgres://postgres:postgres@localhost:5432/postgres";
  const admin = new pg.Client({ connectionString: adminUrl });
  try { await admin.connect(); } catch {
    t.skip("Postgres not running");
    return;
  }
  const databaseName = `astryx_media_migration_test_${randomBytes(8).toString("hex")}`;
  const target = new URL(adminUrl);
  target.pathname = `/${databaseName}`;
  const root = await mkdtemp(path.join(tmpdir(), "astryx-media-pg-"));
  let pool: pg.Pool | undefined;
  try {
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    pool = new pg.Pool({ connectionString: target.toString() });
    await applyMigrations(pool);
    const app = await pool.query<{ id: number }>("INSERT INTO apps (name) VALUES ('fixture') RETURNING id");
    const platform = await pool.query<{ id: number }>("INSERT INTO platforms (app_id, name) VALUES ($1, 'web') RETURNING id", [app.rows[0].id]);
    const image = await pool.query<{ id: number }>(
      "INSERT INTO images (platform_id, image_url, kind) VALUES ($1, 'mobbin-bulk:0123456789abcdef', 'screen') RETURNING id",
      [platform.rows[0].id],
    );
    const version = await pool.query<{ id: number }>(
      "INSERT INTO app_versions (app_id, version_number, label, status) VALUES ($1, 1, 'fixture', 'draft') RETURNING id",
      [app.rows[0].id],
    );
    await pool.query("INSERT INTO version_images (version_id, image_id) VALUES ($1, $2)", [version.rows[0].id, image.rows[0].id]);
    const body = png("postgres-fixture");
    await legacy(root, "fixture", "0123456789abcdef", "png", body);
    const database = new PostgresMediaMigrationDatabase({
      async query(sql, values) {
        const result = await pool!.query(sql, values ? [...values] : undefined);
        return { rows: result.rows, rowCount: result.rowCount };
      },
      async connect() {
        const client = await pool!.connect();
        return {
          async query(sql, values) {
            const result = await client.query(sql, values ? [...values] : undefined);
            return { rows: result.rows, rowCount: result.rowCount };
          },
          release: () => client.release(),
        };
      },
    });
    const store = new LocalObjectStore(path.join(root, "objects"));
    const first = await migrateLegacyMedia({ dataDir: root, database, objectStore: store, apply: true });
    const second = await migrateLegacyMedia({ dataDir: root, database, objectStore: store, apply: true });
    assert.equal(first.migrated, 1);
    assert.equal(second.migrated, 0);
    assert.equal(second.skipped, 1);
    assert.equal(first.evidence_sha256, second.evidence_sha256);
    const state = await pool.query<{ status: string; objects: string }>(
      `SELECT m.status, (SELECT count(*)::text FROM stored_objects) AS objects
       FROM media_migration_state m WHERE m.image_id = $1`,
      [image.rows[0].id],
    );
    assert.deepEqual(state.rows[0], { status: "complete", objects: "1" });
  } finally {
    if (pool) await pool.end();
    await admin.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await admin.end();
    await rm(root, { recursive: true, force: true });
  }
});
