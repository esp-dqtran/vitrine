import { test } from "node:test";
import assert from "node:assert/strict";
import { databasePoolOptions } from "./dbPoolConfig.ts";

test("database pool keeps the pg default when no cap is configured", () => {
  assert.deepEqual(databasePoolOptions({}), {});
});

test("database pool accepts a positive per-process connection cap", () => {
  assert.deepEqual(databasePoolOptions({ DATABASE_POOL_MAX: "1" }), { max: 1 });
  assert.deepEqual(databasePoolOptions({ DATABASE_POOL_MAX: "6" }), { max: 6 });
});

test("database pool rejects unsafe connection caps", () => {
  assert.throws(() => databasePoolOptions({ DATABASE_POOL_MAX: "0" }), /DATABASE_POOL_MAX/);
  assert.throws(() => databasePoolOptions({ DATABASE_POOL_MAX: "1.5" }), /DATABASE_POOL_MAX/);
  assert.throws(() => databasePoolOptions({ DATABASE_POOL_MAX: "many" }), /DATABASE_POOL_MAX/);
});
