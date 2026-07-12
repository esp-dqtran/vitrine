import assert from "node:assert/strict";
import test from "node:test";

import type { ObjectMetadata, ObjectStore } from "./objectStore.ts";
import {
  PostgresObjectGcDatabase,
  runObjectGc,
  type ObjectGcDatabase,
  type ObjectGcSnapshot,
} from "./objectGc.ts";

const metadata = (key: string, byteSize = 10): ObjectMetadata => ({
  key,
  sha256: "a".repeat(64),
  byteSize,
  contentType: "image/png",
  accessClass: "protected",
});

class FakeDatabase implements ObjectGcDatabase {
  references = new Set<string>();
  marks = new Map<string, Date>();
  removed: string[] = [];
  events: string[] = [];
  failSnapshot = false;
  rereferenceOnCheck = new Set<string>();

  async reconcileSnapshot(objects: readonly ObjectMetadata[], now: Date, apply: boolean): Promise<ObjectGcSnapshot> {
    if (this.failSnapshot) throw new Error("database unavailable");
    const previousMarks = new Map(this.marks);
    const unreferenced = objects.filter(({ key }) => !this.references.has(key));
    if (apply) {
      for (const key of this.references) this.marks.delete(key);
      for (const { key } of unreferenced) {
        if (!this.marks.has(key)) this.marks.set(key, now);
      }
    }
    return { unreferenced, previousMarks };
  }

  async referencedKeys(): Promise<Set<string>> {
    this.events.push("fresh-scan");
    return new Set(this.references);
  }

  async isReferenced(key: string): Promise<boolean> {
    this.events.push(`recheck:${key}`);
    return this.references.has(key) || this.rereferenceOnCheck.has(key);
  }

  async clearMark(key: string): Promise<void> {
    this.marks.delete(key);
  }

  async removeUnreferenced(key: string): Promise<boolean> {
    this.events.push(`remove:${key}`);
    if (this.references.has(key)) return false;
    this.removed.push(key);
    this.marks.delete(key);
    return true;
  }
}

function fakeStore(objects: ObjectMetadata[], events: string[] = []): ObjectStore {
  const present = new Map(objects.map((item) => [item.key, item]));
  return {
    async *list(prefix = "") {
      for (const item of present.values()) if (item.key.startsWith(prefix)) yield item;
    },
    async delete(key) {
      events.push(`delete:${key}`);
      return present.delete(key);
    },
    async head(key) {
      events.push(`head:${key}`);
      return present.get(key);
    },
    async put() { throw new Error("unused"); },
    async get() { throw new Error("unused"); },
    async signedGetUrl() { throw new Error("unused"); },
  };
}

test("dry-run reports unreferenced objects without marking or deleting", async () => {
  const db = new FakeDatabase();
  const item = metadata("images/1/orphan.png", 17);

  const report = await runObjectGc({ objectStore: fakeStore([item]), database: db });

  assert.deepEqual(report, {
    mode: "dry-run", listed_count: 1, listed_bytes: 17,
    unreferenced_count: 1, unreferenced_bytes: 17,
    keys: [item.key], marked_count: 0, deleted_count: 0, deleted_bytes: 0, failed_count: 0,
  });
  assert.equal(db.marks.size, 0);
});

test("first apply pass marks an orphan but cannot delete it", async () => {
  const db = new FakeDatabase();
  const item = metadata("images/1/orphan.png");
  const now = new Date("2026-07-12T00:00:00Z");

  const report = await runObjectGc({ objectStore: fakeStore([item]), database: db, apply: true, now, graceMs: 1 });

  assert.equal(report.marked_count, 1);
  assert.equal(report.deleted_count, 0);
  assert.deepEqual(db.marks.get(item.key), now);
});

test("second fresh scan deletes a grace-aged orphan bytes-first", async () => {
  const db = new FakeDatabase();
  const item = metadata("exports/7/file.zip", 23);
  db.marks.set(item.key, new Date("2026-07-10T00:00:00Z"));
  const store = fakeStore([item], db.events);

  const report = await runObjectGc({
    objectStore: store, database: db, apply: true,
    now: new Date("2026-07-12T00:00:00Z"), graceMs: 86_400_000,
  });

  assert.equal(report.deleted_count, 1);
  assert.equal(report.deleted_bytes, 23);
  assert.deepEqual(db.events, ["fresh-scan", `recheck:${item.key}`, `delete:${item.key}`, `head:${item.key}`, `remove:${item.key}`]);
});

test("a re-reference clears its mark and prevents deletion", async () => {
  const db = new FakeDatabase();
  const item = metadata("images/2/live.png");
  db.marks.set(item.key, new Date("2026-07-10T00:00:00Z"));
  db.references.add(item.key);

  const report = await runObjectGc({
    objectStore: fakeStore([item]), database: db, apply: true,
    now: new Date("2026-07-12T00:00:00Z"), graceMs: 1,
  });

  assert.equal(report.deleted_count, 0);
  assert.equal(db.marks.has(item.key), false);
});

test("an immediate re-reference prevents deletion and clears the stale mark", async () => {
  const db = new FakeDatabase();
  const item = metadata("failures/1/a.json");
  db.marks.set(item.key, new Date("2026-07-10T00:00:00Z"));
  db.rereferenceOnCheck.add(item.key);

  const report = await runObjectGc({
    objectStore: fakeStore([item]), database: db, apply: true,
    now: new Date("2026-07-12T00:00:00Z"), graceMs: 1,
  });

  assert.equal(report.deleted_count, 0);
  assert.equal(db.marks.has(item.key), false);
});

test("failed byte deletion retains the mark for retry", async () => {
  const db = new FakeDatabase();
  const item = metadata("images/3/orphan.png");
  db.marks.set(item.key, new Date("2026-07-10T00:00:00Z"));
  const store = fakeStore([item]);
  store.delete = async () => { throw new Error("storage unavailable"); };

  const report = await runObjectGc({
    objectStore: store, database: db, apply: true,
    now: new Date("2026-07-12T00:00:00Z"), graceMs: 1,
  });

  assert.equal(report.failed_count, 1);
  assert.equal(db.marks.has(item.key), true);
  assert.equal(db.removed.length, 0);
});

test("a prefix mismatch prevents database changes and deletion", async () => {
  const db = new FakeDatabase();
  const item = metadata("exports/1/file.zip");

  await assert.rejects(
    runObjectGc({
      objectStore: fakeStore([]), database: db, apply: true, prefix: "images/",
      listObjects: async () => ({ objects: [item], complete: true }),
    }),
    /prefix mismatch/,
  );
  assert.equal(db.marks.size, 0);
});

test("a truncated list prevents database changes and deletion", async () => {
  const db = new FakeDatabase();

  await assert.rejects(
    runObjectGc({
      objectStore: fakeStore([]), database: db, apply: true,
      listObjects: async () => ({ objects: [metadata("images/1/a.png")], complete: false }),
    }),
    /incomplete/,
  );
  assert.equal(db.marks.size, 0);
});

test("a database failure prevents deletion", async () => {
  const db = new FakeDatabase();
  db.failSnapshot = true;
  let deletes = 0;
  const store = fakeStore([metadata("images/1/a.png")]);
  store.delete = async () => { deletes += 1; return true; };

  await assert.rejects(runObjectGc({ objectStore: store, database: db, apply: true }), /database unavailable/);
  assert.equal(deletes, 0);
});

test("PostgreSQL snapshot uses repeatable read and all durable reference columns", async () => {
  const calls: string[] = [];
  const client = {
    async query(sql: string) {
      calls.push(sql);
      if (sql.includes("FROM stored_objects")) return { rows: [], rowCount: 0 };
      if (sql.includes("FROM object_gc_marks")) return { rows: [], rowCount: 0 };
      if (sql.includes("AS object_key")) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 0 };
    },
    release() {},
  };
  const db = new PostgresObjectGcDatabase({
    async connect() { return client; },
    async query() { return { rows: [], rowCount: 0 }; },
  });

  await db.reconcileSnapshot([], new Date("2026-07-12T00:00:00Z"), false);

  assert.equal(calls[0], "BEGIN ISOLATION LEVEL REPEATABLE READ");
  const sql = calls.join("\n");
  assert.match(sql, /images[\s\S]*object_key/);
  assert.match(sql, /exports[\s\S]*object_key/);
  assert.match(sql, /crawl_run_steps[\s\S]*failure_object_key/);
  assert.equal(calls.at(-1), "COMMIT");
  assert.equal(calls.includes("ROLLBACK"), false);
});

test("PostgreSQL snapshot rejects a list missing database-tracked objects", async () => {
  const calls: string[] = [];
  const db = new PostgresObjectGcDatabase({
    async connect() {
      return {
        async query(sql: string) {
          calls.push(sql);
          if (sql.includes("FROM stored_objects")) return {
            rows: [{
              object_key: "images/9/missing.png", sha256: "a".repeat(64), byte_size: 10,
              content_type: "image/png", access_class: "protected",
            }],
            rowCount: 1,
          };
          return { rows: [], rowCount: 0 };
        },
        release() {},
      };
    },
    async query() { return { rows: [], rowCount: 0 }; },
  });

  await assert.rejects(
    db.reconcileSnapshot([], new Date("2026-07-12T00:00:00Z"), true),
    /incomplete/,
  );
  assert.equal(calls.at(-1), "ROLLBACK");
});

test("PostgreSQL snapshot resumes metadata cleanup for an already-marked absent object", async () => {
  const row = {
    object_key: "images/9/deleted.png", sha256: "a".repeat(64), byte_size: 10,
    content_type: "image/png", access_class: "protected",
  };
  const db = new PostgresObjectGcDatabase({
    async connect() {
      return {
        async query(sql: string) {
          if (sql.includes("FROM stored_objects")) return { rows: [row], rowCount: 1 };
          if (sql.includes("FROM object_gc_marks")) return {
            rows: [{ object_key: row.object_key, first_unreferenced_at: "2026-07-10T00:00:00Z" }],
            rowCount: 1,
          };
          return { rows: [], rowCount: 0 };
        },
        release() {},
      };
    },
    async query() { return { rows: [], rowCount: 0 }; },
  });

  const snapshot = await db.reconcileSnapshot([], new Date("2026-07-12T00:00:00Z"), false);

  assert.deepEqual(snapshot.unreferenced, [metadata(row.object_key)]);
});
