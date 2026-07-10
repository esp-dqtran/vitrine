import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  verifyPassword,
} from "./authCrypto.ts";

test("hashes and verifies a password without retaining plaintext", async () => {
  const encoded = await hashPassword("correct horse battery staple");
  assert.equal(encoded.includes("correct horse battery staple"), false);
  assert.equal(await verifyPassword("correct horse battery staple", encoded), true);
  assert.equal(await verifyPassword("wrong password", encoded), false);
});

test("uses a unique salt for equal passwords", async () => {
  const first = await hashPassword("same secure password");
  const second = await hashPassword("same secure password");
  assert.notEqual(first, second);
});

test("generates opaque session tokens and stores only deterministic hashes", () => {
  const first = generateSessionToken();
  const second = generateSessionToken();
  assert.notEqual(first, second);
  assert.ok(first.length >= 43);
  assert.notEqual(hashSessionToken(first), first);
  assert.equal(hashSessionToken(first), hashSessionToken(first));
});
