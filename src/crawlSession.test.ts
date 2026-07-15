import { randomBytes } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeSessionKey, decryptStorageState, encryptStorageState } from "./crawlSession.ts";

test("encrypts authenticated storage state with authenticated encryption", () => {
  const key = randomBytes(32).toString("base64");
  const state = {
    cookies: [{ name: "session", value: "secret", domain: "app.test", path: "/", expires: -1, httpOnly: true, secure: true, sameSite: "Lax" as const }],
    origins: [],
  };
  const encrypted = encryptStorageState(state, key);
  assert.match(encrypted, /^v1\./);
  assert.doesNotMatch(encrypted, /secret/);
  assert.deepEqual(decryptStorageState(encrypted, key), state);
  assert.throws(() => decryptStorageState(encrypted, randomBytes(32).toString("base64")), /authenticate|decrypt/i);
});

test("requires a canonical base64 key that decodes to exactly 32 bytes", () => {
  assert.equal(decodeSessionKey(randomBytes(32).toString("base64")).length, 32);
  assert.throws(() => decodeSessionKey("not-base64"), /base64.*32 bytes/i);
  assert.throws(() => decodeSessionKey(randomBytes(31).toString("base64")), /32 bytes/i);
});

test("rejects malformed and tampered encrypted session envelopes", () => {
  const key = randomBytes(32).toString("base64");
  assert.throws(() => decryptStorageState("v2.bad.bad.bad", key), /invalid encrypted crawl session/i);
  const encrypted = encryptStorageState({ cookies: [], origins: [] }, key);
  assert.throws(() => decryptStorageState(`${encrypted.slice(0, -1)}A`, key), /authenticate|decrypt/i);
});
