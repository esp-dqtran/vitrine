import { test } from "node:test";
import assert from "node:assert/strict";
import { bearerToken, webSocketBearerToken } from "./bearerAuth.ts";

test("extracts an exact Bearer token", () => {
  assert.equal(bearerToken("Bearer header.payload.signature"), "header.payload.signature");
});

test("extracts a browser WebSocket Bearer credential from subprotocols", () => {
  assert.equal(
    webSocketBearerToken("vitrines-bearer, header.payload.signature"),
    "header.payload.signature",
  );
  assert.equal(webSocketBearerToken("chat, other"), undefined);
  assert.equal(webSocketBearerToken("vitrines-bearer"), undefined);
});

test("rejects missing, malformed, and oversized authorization headers", () => {
  assert.equal(bearerToken(undefined), undefined);
  assert.equal(bearerToken("Basic credentials"), undefined);
  assert.equal(bearerToken("bearer token"), undefined);
  assert.equal(bearerToken("Bearer "), undefined);
  assert.equal(bearerToken("Bearer token with spaces"), undefined);
  assert.equal(bearerToken(`Bearer ${"x".repeat(8_193)}`), undefined);
});
