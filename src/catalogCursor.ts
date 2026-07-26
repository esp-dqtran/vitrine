export interface UpdatedCatalogCursor {
  v: 1;
  sort: "updated";
  snapshotAt: string;
  updatedAt: string;
  appId: number;
}

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
