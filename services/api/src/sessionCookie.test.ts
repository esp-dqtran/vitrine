import assert from "node:assert/strict";
import test from "node:test";

import { cookieValue, SESSION_COOKIE } from "./sessionCookie.ts";

test("reads the encoded Astryx session cookie", () => {
  assert.equal(SESSION_COOKIE, "astryx_session");
  assert.equal(
    cookieValue("theme=dark; astryx_session=a%3Db; other=x", SESSION_COOKIE),
    "a=b",
  );
});

test("returns undefined for absent or malformed cookies", () => {
  assert.equal(cookieValue(undefined, SESSION_COOKIE), undefined);
  assert.equal(cookieValue("theme=dark", SESSION_COOKIE), undefined);
  assert.equal(
    cookieValue("astryx_session=%E0%A4%A", SESSION_COOKIE),
    undefined,
  );
});
