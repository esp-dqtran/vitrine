export interface UpdatedCatalogCursor {
  v: 1;
  sort: "updated";
  snapshotAt: string;
  updatedAt: string;
  appId: number;
}

export type CatalogSort = "latest" | "trending";

export type CatalogCursor =
  | {
      v: 2;
      sort: "latest";
      snapshotAt: string;
      updatedAt: string;
      appId: number;
    }
  | {
      v: 2;
      sort: "trending";
      snapshotAt: string;
      updatedAt: string;
      popularityScore: number;
      appId: number;
    };

export class CatalogCursorError extends RangeError {
  constructor(message = "invalid catalog cursor") {
    super(message);
    this.name = "CatalogCursorError";
  }
}

function canonicalIso(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

export function encodeUpdatedCatalogCursor(cursor: UpdatedCatalogCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeUpdatedCatalogCursor(value: string): UpdatedCatalogCursor {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new CatalogCursorError();
  const bytes = Buffer.from(value, "base64url");
  if (bytes.toString("base64url") !== value) throw new CatalogCursorError();

  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new CatalogCursorError();
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new CatalogCursorError();
  }

  const item = parsed as Record<string, unknown>;
  if (
    item.v !== 1
    || item.sort !== "updated"
    || !canonicalIso(item.snapshotAt)
    || !canonicalIso(item.updatedAt)
    || !Number.isSafeInteger(item.appId)
    || Number(item.appId) < 1
  ) {
    throw new CatalogCursorError();
  }
  return item as unknown as UpdatedCatalogCursor;
}

export function encodeCatalogCursor(cursor: CatalogCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCatalogCursor(
  value: string,
  expectedSort: CatalogSort,
): CatalogCursor {
  let legacy: UpdatedCatalogCursor | undefined;
  try {
    legacy = decodeUpdatedCatalogCursor(value);
  } catch {
    // Continue with the v2 parser.
  }
  if (legacy) {
    if (expectedSort !== "latest") throw new CatalogCursorError();
    return {
      v: 2,
      sort: "latest",
      snapshotAt: legacy.snapshotAt,
      updatedAt: legacy.updatedAt,
      appId: legacy.appId,
    };
  }
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new CatalogCursorError();
  const bytes = Buffer.from(value, "base64url");
  if (bytes.toString("base64url") !== value) throw new CatalogCursorError();
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new CatalogCursorError();
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new CatalogCursorError();
  }
  const item = parsed as Record<string, unknown>;
  const validBase = item.v === 2
    && item.sort === expectedSort
    && (item.sort === "latest" || item.sort === "trending")
    && canonicalIso(item.snapshotAt)
    && canonicalIso(item.updatedAt)
    && Number.isSafeInteger(item.appId)
    && Number(item.appId) > 0;
  const validMetric = item.sort !== "trending"
    || (Number.isSafeInteger(item.popularityScore) && Number(item.popularityScore) >= 0);
  if (!validBase || !validMetric) throw new CatalogCursorError();
  return item as unknown as CatalogCursor;
}
