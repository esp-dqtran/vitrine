import { test } from "node:test";
import assert from "node:assert/strict";
import { adminSeedFromEnv } from "./config.ts";

test("requires valid admin seed variables", () => {
  assert.throws(() => adminSeedFromEnv({}), /ADMIN_EMAIL/);
  assert.throws(() => adminSeedFromEnv({ ADMIN_EMAIL: "admin@example.com" }), /ADMIN_PASSWORD/);
  assert.throws(
    () =>
      adminSeedFromEnv({
        ADMIN_EMAIL: "invalid",
        ADMIN_PASSWORD: "1234567890123456",
      }),
    /ADMIN_EMAIL/
  );
  assert.throws(
    () =>
      adminSeedFromEnv({
        ADMIN_EMAIL: "admin@example.com",
        ADMIN_PASSWORD: "too-short",
      }),
    /16 characters/
  );
});

test("normalizes a valid admin seed", () => {
  assert.deepEqual(
    adminSeedFromEnv({
      ADMIN_EMAIL: " Admin@Example.com ",
      ADMIN_PASSWORD: "1234567890123456",
    }),
    { email: "admin@example.com", password: "1234567890123456" }
  );
});
