import { createHmac, timingSafeEqual } from "node:crypto";

export type SitesSort = "latest" | "popular";

export type SitesCursor =
  | {
      v: 1;
      sort: "latest";
      snapshotAt: string;
      updatedAt: string;
      siteId: number;
    }
  | {
      v: 1;
      sort: "popular";
      snapshotAt: string;
      updatedAt: string;
      popularity: number;
      siteId: number;
    };

interface SitesCursorEnvelope {
  payload: SitesCursor;
  signature: string;
}

const MAX_CURSOR_LENGTH = 2_048;

export class SitesCursorError extends RangeError {
  constructor(message = "invalid Sites cursor") {
    super(message);
    this.name = "SitesCursorError";
  }
}

function checkedSecret(secret: string): string {
  if (typeof secret !== "string" || Buffer.byteLength(secret) < 32) {
    throw new SitesCursorError();
  }
  return secret;
}

function signature(payload: SitesCursor, secret: string): string {
  return createHmac("sha256", checkedSecret(secret))
    .update(JSON.stringify(payload))
    .digest("base64url");
}

function canonicalIso(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function validPayload(value: unknown, expectedSort: SitesSort): value is SitesCursor {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  const expectedKeys = expectedSort === "popular"
    ? ["popularity", "siteId", "snapshotAt", "sort", "updatedAt", "v"]
    : ["siteId", "snapshotAt", "sort", "updatedAt", "v"];
  if (Object.keys(item).sort().join("\0") !== expectedKeys.join("\0")) return false;
  const snapshotTimestamp = Date.parse(String(item.snapshotAt));
  const updatedTimestamp = Date.parse(String(item.updatedAt));
  const validBase = item.v === 1
    && item.sort === expectedSort
    && (item.sort === "latest" || item.sort === "popular")
    && canonicalIso(item.snapshotAt)
    && canonicalIso(item.updatedAt)
    && updatedTimestamp <= snapshotTimestamp
    && Number.isSafeInteger(item.siteId)
    && Number(item.siteId) > 0;
  return validBase && (
    item.sort !== "popular"
    || (typeof item.popularity === "number"
      && Number.isSafeInteger(item.popularity)
      && item.popularity >= 0
      && item.popularity <= 2_147_483_647)
  );
}

export function encodeSitesCursor(cursor: SitesCursor, secret: string): string {
  if (!validPayload(cursor, cursor.sort)) throw new SitesCursorError();
  const envelope: SitesCursorEnvelope = {
    payload: cursor,
    signature: signature(cursor, secret),
  };
  const encoded = Buffer.from(JSON.stringify(envelope), "utf8").toString("base64url");
  if (encoded.length > MAX_CURSOR_LENGTH) throw new SitesCursorError();
  return encoded;
}

export function decodeSitesCursor(
  value: string,
  expectedSort: SitesSort,
  secret: string,
): SitesCursor {
  checkedSecret(secret);
  if (value.length > MAX_CURSOR_LENGTH || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new SitesCursorError();
  }
  const bytes = Buffer.from(value, "base64url");
  if (bytes.toString("base64url") !== value) throw new SitesCursorError();
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new SitesCursorError();
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new SitesCursorError();
  }
  const envelope = parsed as Record<string, unknown>;
  if (Object.keys(envelope).sort().join("\0") !== "payload\0signature") {
    throw new SitesCursorError();
  }
  if (!validPayload(envelope.payload, expectedSort)
    || typeof envelope.signature !== "string"
    || !/^[A-Za-z0-9_-]{43}$/.test(envelope.signature)) {
    throw new SitesCursorError();
  }
  const expected = Buffer.from(signature(envelope.payload, secret), "utf8");
  const actual = Buffer.from(envelope.signature, "utf8");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new SitesCursorError();
  }
  return envelope.payload;
}
