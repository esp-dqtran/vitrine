import assert from "node:assert/strict";
import test from "node:test";
import type { QueryResult } from "pg";
import {
  CategoryConflictError,
  CategoryNotFoundError,
  CategoryValidationError,
  createCategoryStore,
  parseCategoryInput,
} from "./categoryStore.ts";

const result = (rows: Record<string, unknown>[] = []): QueryResult<any> => ({
  rows,
  rowCount: rows.length,
  command: "SELECT",
  oid: 0,
  fields: [],
});

test("normalizes and validates Category input", () => {
  assert.deepEqual(
    parseCategoryInput({
      name: " Health & Fitness ",
      slug: "health-fitness",
    }),
    { name: "Health & Fitness", slug: "health-fitness" },
  );
  assert.throws(
    () => parseCategoryInput({ name: "", slug: "health" }),
    CategoryValidationError,
  );
  assert.throws(
    () => parseCategoryInput({ name: "Health", slug: "Health" }),
    CategoryValidationError,
  );
  assert.throws(
    () => parseCategoryInput({ name: "Health", slug: "health--fitness" }),
    CategoryValidationError,
  );
});

test("lists Categories in name order with distinct App counts", async () => {
  let sql = "";
  const store = createCategoryStore(
    async (text) => {
      sql = text;
      return result([
        { id: "2", name: "Business", slug: "business", app_count: "127" },
        { id: "7", name: "Productivity", slug: "productivity", app_count: "101" },
      ]);
    },
    async (work) => work(async () => result()),
  );

  assert.deepEqual(await store.list(), [
    { id: 2, name: "Business", slug: "business", appCount: 127 },
    { id: 7, name: "Productivity", slug: "productivity", appCount: 101 },
  ]);
  assert.match(sql, /COUNT\(DISTINCT ac\.app_id\)/);
  assert.match(sql, /ORDER BY lower\(c\.name\), c\.id/);
});

test("maps published Categories and excludes empty ones", async () => {
  let sql = "";
  const store = createCategoryStore(
    async (text) => {
      sql = text;
      return result([
        { id: 2, name: "Business", slug: "business", app_count: "12" },
      ]);
    },
    async (work) => work(async () => result()),
  );

  assert.deepEqual(await store.listPublished(), [
    { id: 2, name: "Business", slug: "business", appCount: 12 },
  ]);
  assert.match(sql, /published_at IS NOT NULL/);
  assert.match(sql, /HAVING COUNT\(DISTINCT published\.app_id\) > 0/);
});

test("creates a Category and maps uniqueness violations to a conflict", async () => {
  const createdStore = createCategoryStore(
    async () => result([{ id: "7", name: "Productivity", slug: "productivity" }]),
    async (work) => work(async () => result()),
  );
  assert.deepEqual(
    await createdStore.create({ name: " Productivity ", slug: "productivity" }),
    { id: 7, name: "Productivity", slug: "productivity" },
  );

  const conflictStore = createCategoryStore(
    async () => {
      throw Object.assign(new Error("duplicate"), { code: "23505" });
    },
    async (work) => work(async () => result()),
  );
  await assert.rejects(
    () => conflictStore.create({ name: "Productivity", slug: "productivity" }),
    CategoryConflictError,
  );
});

test("assignNames creates one normalized Category and one relationship", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const store = createCategoryStore(
    async () => result(),
    async (work) => work(async (sql, values) => {
      calls.push({ sql, values });
      if (/SELECT id, name, slug FROM categories/.test(sql)) return result([]);
      if (/INSERT INTO categories/.test(sql)) {
        return result([{ id: 7, name: "Productivity", slug: "productivity" }]);
      }
      return result();
    }),
  );

  assert.deepEqual(
    await store.assignNames(
      42,
      [" Productivity ", "productivity"],
      { replace: false },
    ),
    [{ id: 7, name: "Productivity", slug: "productivity" }],
  );
  assert.equal(
    calls.filter(({ sql }) => /INSERT INTO categories/.test(sql)).length,
    1,
  );
  const relationship = calls.find(({ sql }) => /INSERT INTO app_categories/.test(sql));
  assert.ok(relationship);
  assert.deepEqual(relationship.values, [42, [7]]);
});

test("assignNames rejects Category names that cannot form a slug", async () => {
  const store = createCategoryStore(
    async () => result(),
    async (work) => work(async (sql) =>
      /SELECT id, name, slug FROM categories/.test(sql) ? result([]) : result()
    ),
  );
  await assert.rejects(
    () => store.assignNames(42, ["你好"], { replace: false }),
    CategoryValidationError,
  );
});

test("replaceAppCategories removes stale relationships and inserts unique IDs", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const store = createCategoryStore(
    async () => result(),
    async (work) => work(async (sql, values) => {
      calls.push({ sql, values });
      if (/SELECT id\s+FROM categories/.test(sql)) {
        return result([{ id: 2 }, { id: 7 }]);
      }
      return result();
    }),
  );

  await store.replaceAppCategories(42, [7, 2, 7]);

  const deletion = calls.find(({ sql }) => /DELETE FROM app_categories/.test(sql));
  const insertion = calls.find(({ sql }) => /INSERT INTO app_categories/.test(sql));
  assert.ok(deletion);
  assert.ok(insertion);
  assert.match(deletion.sql, /category_id <> ALL\(\$2::integer\[\]\)/);
  assert.deepEqual(deletion.values, [42, [2, 7]]);
  assert.deepEqual(insertion.values, [42, [2, 7]]);
});

test("replaceAppCategories rejects a missing Category before changing relationships", async () => {
  const calls: string[] = [];
  const store = createCategoryStore(
    async () => result(),
    async (work) => work(async (sql) => {
      calls.push(sql);
      return /SELECT id\s+FROM categories/.test(sql)
        ? result([{ id: 2 }])
        : result();
    }),
  );
  await assert.rejects(
    () => store.replaceAppCategories(42, [2, 7]),
    CategoryNotFoundError,
  );
  assert.equal(calls.some((sql) => /DELETE FROM app_categories/.test(sql)), false);
});

test("removing a Category returns its affected App count", async () => {
  const calls: string[] = [];
  const store = createCategoryStore(
    async () => result(),
    async (work) => work(async (sql) => {
      calls.push(sql);
      if (/SELECT id, name, slug\s+FROM categories/.test(sql)) {
        return result([{ id: 7, name: "Productivity", slug: "productivity" }]);
      }
      if (/count\(\*\)/.test(sql)) return result([{ app_count: "101" }]);
      return result();
    }),
  );

  assert.deepEqual(await store.remove(7), {
    category: { id: 7, name: "Productivity", slug: "productivity" },
    removedAppCount: 101,
  });
  assert.match(calls[0], /FOR UPDATE/);
  assert.match(calls[2], /DELETE FROM categories/);
});

test("attach and detach require both parent entities", async () => {
  const missingStore = createCategoryStore(
    async () => result([{ app_id: null, category_id: 7 }]),
    async (work) => work(async () => result()),
  );
  await assert.rejects(
    () => missingStore.attach("missing", 7),
    CategoryNotFoundError,
  );

  const calls: string[] = [];
  const store = createCategoryStore(
    async (sql) => {
      calls.push(sql);
      return /SELECT/.test(sql)
        ? result([{ app_id: 42, category_id: 7 }])
        : result();
    },
    async (work) => work(async () => result()),
  );
  await store.attach("linear", 7);
  await store.detach("linear", 7);
  assert.equal(calls.some((sql) => /ON CONFLICT \(app_id, category_id\) DO NOTHING/.test(sql)), true);
  assert.equal(calls.some((sql) => /DELETE FROM app_categories/.test(sql)), true);
});
