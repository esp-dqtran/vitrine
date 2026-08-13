import assert from "node:assert/strict";
import test from "node:test";
import {
  createPasswordResetToken,
  hashPasswordResetToken,
  validPasswordResetToken,
} from "./passwordResetToken.ts";

test("creates opaque, URL-safe password reset tokens and hashes them for storage", () => {
  const token = createPasswordResetToken();
  assert.equal(validPasswordResetToken(token), true);
  assert.match(hashPasswordResetToken(token), /^[a-f0-9]{64}$/);
  assert.notEqual(hashPasswordResetToken(token), token);
});

test("rejects malformed password reset tokens", () => {
  assert.equal(validPasswordResetToken(""), false);
  assert.equal(validPasswordResetToken("x".repeat(42)), false);
  assert.equal(validPasswordResetToken("+".repeat(43)), false);
});
