import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import test from "node:test";
import {
  decodeSitesCursor,
  encodeSitesCursor,
  SitesCursorError,
} from "./sitesCursor.ts";

const latest = {
  v: 1 as const,
  sort: "latest" as const,
  snapshotAt: "2026-07-29T04:00:00.000Z",
  updatedAt: "2026-07-29T03:00:00.000Z",
  siteId: 42,
};
const secret = "sites-cursor-test-secret-0123456789abcdef";
const wrongSecret = "sites-cursor-wrong-secret-0123456789abcdef";

function signedCursor(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify({
    payload,
    signature: createHmac("sha256", secret)
      .update(JSON.stringify(payload))
      .digest("base64url"),
  })).toString("base64url");
}

test("round-trips versioned latest and popular Site cursors", () => {
  const popular = { ...latest, sort: "popular" as const, popularity: 91 };
  assert.deepEqual(
    decodeSitesCursor(encodeSitesCursor(latest, secret), "latest", secret),
    latest,
  );
  assert.deepEqual(
    decodeSitesCursor(encodeSitesCursor(popular, secret), "popular", secret),
    popular,
  );
});

test("rejects mismatched, malformed, overlong, wrong-secret, and tampered Site cursors", () => {
  const encoded = encodeSitesCursor(latest, secret);
  assert.throws(
    () => decodeSitesCursor(encoded, "popular", secret),
    SitesCursorError,
  );
  assert.throws(() => decodeSitesCursor("***", "latest", secret), SitesCursorError);
  assert.throws(
    () => decodeSitesCursor("A".repeat(2_049), "latest", secret),
    SitesCursorError,
  );
  assert.throws(
    () => decodeSitesCursor(encoded, "latest", wrongSecret),
    SitesCursorError,
  );
  assert.throws(
    () => decodeSitesCursor(
      `${encoded.slice(0, -1)}${encoded.endsWith("A") ? "B" : "A"}`,
      "latest",
      secret,
    ),
    SitesCursorError,
  );

  const envelope = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  envelope.payload.siteId = 99;
  envelope.integrity = createHash("sha256")
    .update("astryx:sites-cursor:v1:")
    .update(JSON.stringify(envelope.payload))
    .digest("base64url");
  const recomputed = Buffer.from(JSON.stringify(envelope)).toString("base64url");
  assert.throws(
    () => decodeSitesCursor(recomputed, "latest", secret),
    SitesCursorError,
  );
});

test("rejects extra keys, impossible timestamps, and invalid popularity", () => {
  const signed = (payload: Record<string, unknown>, extraEnvelope = {}) => {
    const signature = createHash("sha256")
      .update("not-the-server-hmac")
      .update(JSON.stringify(payload))
      .digest("base64url");
    return Buffer.from(JSON.stringify({ payload, signature, ...extraEnvelope }))
      .toString("base64url");
  };
  for (const value of [
    signed({ ...latest, extra: true }),
    signed(latest, { extra: true }),
  ]) {
    assert.throws(
      () => decodeSitesCursor(value, "latest", secret),
      SitesCursorError,
    );
  }
  assert.throws(
    () => encodeSitesCursor({
      ...latest,
      updatedAt: "2026-07-29T05:00:00.000Z",
    }, secret),
    SitesCursorError,
  );
  assert.throws(
    () => encodeSitesCursor({
      ...latest,
      sort: "popular",
      popularity: -1,
    }, secret),
    SitesCursorError,
  );
  assert.throws(
    () => encodeSitesCursor({
      ...latest,
      sort: "popular",
      popularity: Number.POSITIVE_INFINITY,
    }, secret),
    SitesCursorError,
  );
});

test("rejects fractional and PostgreSQL int4-overflow popular cursor values", () => {
  for (const popularity of [1.5, 2_147_483_648]) {
    assert.throws(
      () => encodeSitesCursor({
        ...latest,
        sort: "popular",
        popularity,
      }, secret),
      SitesCursorError,
    );
    assert.throws(
      () => decodeSitesCursor(signedCursor({
        ...latest,
        sort: "popular",
        popularity,
      }), "popular", secret),
      SitesCursorError,
    );
  }
});
