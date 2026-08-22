import assert from "node:assert/strict";
import { test } from "node:test";

import { createJwtAuth, jwtAuthConfigFromEnv } from "./jwtAuth.ts";

const secret = "0123456789abcdef0123456789abcdef";
const user = { id: 42, email: "person@example.com", role: "user" as const };

test("issues and verifies a pinned, expiring JWT", async () => {
  let current = new Date("2026-08-04T00:00:00.000Z");
  const auth = createJwtAuth({
    secret,
    issuer: "https://vitrines.example",
    audience: "vitrines",
    ttlSeconds: 60,
    clockToleranceSeconds: 0,
    now: () => current,
  });
  const issued = await auth.issueAuthToken(user);
  assert.equal(issued.token.split(".").length, 3);
  assert.equal(issued.expiresAt.toISOString(), "2026-08-04T00:01:00.000Z");
  assert.deepEqual(await auth.verifyAuthToken(issued.token), user);

  current = new Date("2026-08-04T00:01:01.000Z");
  assert.equal(await auth.verifyAuthToken(issued.token), undefined);
});

test("rejects tampered tokens and tokens from another trust boundary", async () => {
  const primary = createJwtAuth({
    secret,
    issuer: "https://vitrines.example",
    audience: "vitrines",
  });
  const token = (await primary.issueAuthToken(user)).token;
  const [header, payload, signature] = token.split(".");
  const tampered = `${header}.${payload}.${signature.startsWith("a") ? "b" : "a"}${signature.slice(1)}`;
  assert.equal(await primary.verifyAuthToken(tampered), undefined);
  assert.equal(await createJwtAuth({
    secret,
    issuer: "https://other.example",
    audience: "vitrines",
  }).verifyAuthToken(token), undefined);
  assert.equal(await createJwtAuth({
    secret,
    issuer: "https://vitrines.example",
    audience: "other",
  }).verifyAuthToken(token), undefined);
});

test("requires production JWT configuration and applies stable defaults", () => {
  assert.throws(() => jwtAuthConfigFromEnv({}), /JWT_SIGNING_SECRET/);
  assert.throws(() => jwtAuthConfigFromEnv({ JWT_SIGNING_SECRET: "short" }), /32 characters/);
  assert.deepEqual(jwtAuthConfigFromEnv({
    JWT_SIGNING_SECRET: secret,
    APP_URL: "https://vitrines.example/",
  }), {
    secret,
    issuer: "https://vitrines.example",
    audience: "vitrines",
  });
});
