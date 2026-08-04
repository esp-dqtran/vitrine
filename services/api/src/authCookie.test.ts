import assert from "node:assert/strict";
import test from "node:test";

import { AUTH_COOKIE, cookieValue } from "./authCookie.ts";

test("reads the encoded Vitrines authentication cookie", () => {
  assert.equal(AUTH_COOKIE, "astryx_session");
  assert.equal(
    cookieValue("theme=dark; astryx_session=a%3Db; other=x", AUTH_COOKIE),
    "a=b",
  );
});

test("returns undefined for absent or malformed cookies", () => {
  assert.equal(cookieValue(undefined, AUTH_COOKIE), undefined);
  assert.equal(cookieValue("theme=dark", AUTH_COOKIE), undefined);
  assert.equal(
    cookieValue("astryx_session=%E0%A4%A", AUTH_COOKIE),
    undefined,
  );
});
