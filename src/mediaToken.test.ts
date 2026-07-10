import { test } from "node:test";
import assert from "node:assert/strict";
import { createMediaToken, verifyMediaToken } from "./mediaToken.ts";

test("binds media tokens to user, app, hash, and expiry", () => {
  const secret = "0123456789abcdef0123456789abcdef";
  const claims = { userId: 7, app: "linear", hash: "0123456789abcdef", expiresAt: 2_000_000_000 };
  const token = createMediaToken(secret, claims);
  assert.equal(verifyMediaToken(secret, token, claims, 1_999_999_999), true);
  assert.equal(verifyMediaToken(secret, token, { ...claims, userId: 8 }, 1_999_999_999), false);
  assert.equal(verifyMediaToken(secret, token, { ...claims, app: "airbnb" }, 1_999_999_999), false);
  assert.equal(verifyMediaToken(secret, `${token}x`, claims, 1_999_999_999), false);
  assert.equal(verifyMediaToken(secret, token, claims, 2_000_000_001), false);
});
