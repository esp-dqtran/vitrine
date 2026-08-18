import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Platform } from "./platformFromUrl.ts";

export type FlowCatalogSort = "grouped";

interface FlowCursorKeyBase {
  exactMatch: 0 | 1;
  titleTermMatches: number;
  termMatches: number;
  other: 0 | 1;
  category: string;
  categoryId: string;
  title: string;
  flowId: string;
}

export interface FlowCatalogCursor {
  v: 3;
  sort: "grouped";
  platform: Platform;
  snapshotAt: string;
  identity: string;
  key: FlowCursorKeyBase;
}

const MAX_CURSOR_LENGTH = 2_048;
const INT4_MAX = 2_147_483_647;
const exactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean =>
  Object.keys(value).sort().join("\0") === [...expected].sort().join("\0");

export class FlowCatalogCursorError extends RangeError {
  constructor(message = "invalid Flow catalog cursor") {
    super(message);
    this.name = "FlowCatalogCursorError";
  }
}

function checkedSecret(secret: string): string {
  if (typeof secret !== "string" || Buffer.byteLength(secret) < 32) {
    throw new FlowCatalogCursorError();
  }
  return secret;
}

function canonicalIso(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function boundedText(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 120
    && value === value.toLowerCase();
}

function count(value: unknown, minimum: number): value is number {
  return Number.isSafeInteger(value)
    && Number(value) >= minimum
    && Number(value) <= INT4_MAX;
}

function bigintId(value: unknown, allowZero = false): value is string {
  const pattern = allowZero ? /^(?:0|[1-9]\d{0,18})$/ : /^[1-9]\d{0,18}$/;
  if (typeof value !== "string" || !pattern.test(value)) {
    return false;
  }
  try {
    return BigInt(value) <= 9_223_372_036_854_775_807n;
  } catch {
    return false;
  }
}

function validKey(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const key = value as Record<string, unknown>;
  const fields = [
    "category",
    "categoryId",
    "exactMatch",
    "flowId",
    "other",
    "termMatches",
    "title",
    "titleTermMatches",
  ];
  return exactKeys(key, fields)
    && (key.other === 0 || key.other === 1)
    && (key.exactMatch === 0 || key.exactMatch === 1)
    && count(key.titleTermMatches, 0)
    && count(key.termMatches, 0)
    && boundedText(key.category)
    && boundedText(key.title)
    && bigintId(key.categoryId, true)
    && bigintId(key.flowId);
}

function validPayload(
  value: unknown,
  expected: { sort: FlowCatalogSort; platform: Platform; identity: string },
): value is FlowCatalogCursor {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return exactKeys(item, ["identity", "key", "platform", "snapshotAt", "sort", "v"])
    && item.v === 3
    && item.sort === expected.sort
    && item.platform === expected.platform
    && item.identity === expected.identity
    && typeof item.identity === "string"
    && /^[A-Za-z0-9_-]{43}$/.test(item.identity)
    && canonicalIso(item.snapshotAt)
    && validKey(item.key);
}

function signature(payload: FlowCatalogCursor, secret: string): string {
  return createHmac("sha256", checkedSecret(secret))
    .update(JSON.stringify(payload))
    .digest("base64url");
}

export function flowCatalogQueryIdentity(input: {
  query?: string;
  flowCategories?: readonly string[];
  flowTypes?: readonly string[];
}): string {
  return createHash("sha256").update(JSON.stringify({
    query: input.query ?? "",
    flowCategories: [...(input.flowCategories ?? [])],
    flowTypes: [...(input.flowTypes ?? [])],
  })).digest("base64url");
}

export function encodeFlowCatalogCursor(
  cursor: FlowCatalogCursor,
  secret: string,
): string {
  if (!validPayload(cursor, {
    sort: cursor.sort,
    platform: cursor.platform,
    identity: cursor.identity,
  })) throw new FlowCatalogCursorError();
  const encoded = Buffer.from(JSON.stringify({
    payload: cursor,
    signature: signature(cursor, secret),
  }), "utf8").toString("base64url");
  if (encoded.length > MAX_CURSOR_LENGTH) throw new FlowCatalogCursorError();
  return encoded;
}

export function decodeFlowCatalogCursor(
  value: string,
  expected: { sort: FlowCatalogSort; platform: Platform; identity: string },
  secret: string,
): FlowCatalogCursor {
  checkedSecret(secret);
  if (typeof value !== "string"
    || value.length === 0
    || value.length > MAX_CURSOR_LENGTH
    || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new FlowCatalogCursorError();
  }
  const bytes = Buffer.from(value, "base64url");
  if (bytes.toString("base64url") !== value) throw new FlowCatalogCursorError();
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new FlowCatalogCursorError();
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new FlowCatalogCursorError();
  }
  const envelope = parsed as Record<string, unknown>;
  if (!exactKeys(envelope, ["payload", "signature"])
    || !validPayload(envelope.payload, expected)
    || typeof envelope.signature !== "string"
    || !/^[A-Za-z0-9_-]{43}$/.test(envelope.signature)) {
    throw new FlowCatalogCursorError();
  }
  const wanted = Buffer.from(signature(envelope.payload, secret));
  const actual = Buffer.from(envelope.signature);
  if (wanted.length !== actual.length || !timingSafeEqual(wanted, actual)) {
    throw new FlowCatalogCursorError();
  }
  return envelope.payload;
}
