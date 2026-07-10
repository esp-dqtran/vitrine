import { test } from "node:test";
import assert from "node:assert/strict";
import { createDistinctValueLimiter, createFixedWindowLimiter, ipPrefix } from "./rateLimit.ts";

test("blocks fixed-window requests after the configured limit", () => {
  let now = 0;
  const limiter = createFixedWindowLimiter({ limit: 2, windowMs: 60_000, now: () => now });
  assert.deepEqual(limiter.check("user:1"), { allowed: true });
  assert.deepEqual(limiter.check("user:1"), { allowed: true });
  assert.deepEqual(limiter.check("user:1"), { allowed: false, retryAfterSeconds: 60 });
  now = 60_001;
  assert.deepEqual(limiter.check("user:1"), { allowed: true });
});

test("counts distinct app traversal but not revisits", () => {
  const limiter = createDistinctValueLimiter({ limit: 2, windowMs: 60_000, now: () => 0 });
  assert.deepEqual(limiter.check("user:1", "linear"), { allowed: true });
  assert.deepEqual(limiter.check("user:1", "linear"), { allowed: true });
  assert.deepEqual(limiter.check("user:1", "airbnb"), { allowed: true });
  assert.deepEqual(limiter.check("user:1", "notion"), { allowed: false, retryAfterSeconds: 60 });
});

test("redacts IP addresses for audit storage", () => {
  assert.equal(ipPrefix("203.0.113.45"), "203.0.113.0/24");
  assert.equal(ipPrefix("::ffff:203.0.113.45"), "203.0.113.0/24");
  assert.equal(ipPrefix("2001:0db8:85a3:0000:0000:8a2e:0370:7334"), "2001:0db8:85a3:0000::/64");
  assert.equal(ipPrefix("unknown"), "unknown");
});
