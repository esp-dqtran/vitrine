import type { ObjectMetadata, ObjectStore } from "./objectStore.ts";
import { validateObjectMetadata } from "./objectStore.ts";

interface QueryResult {
  rows: Record<string, unknown>[];
  rowCount: number | null;
}

interface QueryClient {
  query(sql: string, values?: readonly unknown[]): Promise<QueryResult>;
  release(): void;
}

interface QueryPool {
  query(sql: string, values?: readonly unknown[]): Promise<QueryResult>;
  connect(): Promise<QueryClient>;
}

export interface ObjectGcSnapshot {
  unreferenced: ObjectMetadata[];
  previousMarks: Map<string, Date>;
}

export interface ObjectGcDatabase {
  reconcileSnapshot(objects: readonly ObjectMetadata[], now: Date, apply: boolean): Promise<ObjectGcSnapshot>;
  referencedKeys(): Promise<Set<string>>;
  isReferenced(key: string): Promise<boolean>;
  clearMark(key: string): Promise<void>;
  removeUnreferenced(key: string): Promise<boolean>;
}

const REFERENCES_SQL = `
  SELECT object_key FROM images WHERE object_key IS NOT NULL
  UNION
  SELECT object_key FROM exports WHERE object_key IS NOT NULL
  UNION
  SELECT failure_object_key AS object_key
  FROM crawl_run_steps WHERE failure_object_key IS NOT NULL
  UNION
  SELECT rpi.private_object_key AS object_key
  FROM research_project_items rpi WHERE rpi.private_object_key IS NOT NULL`;

function metadataFromRow(row: Record<string, unknown>): ObjectMetadata {
  return {
    key: String(row.object_key),
    sha256: String(row.sha256),
    byteSize: Number(row.byte_size),
    contentType: row.content_type as ObjectMetadata["contentType"],
    accessClass: row.access_class as ObjectMetadata["accessClass"],
  };
}

function sameMetadata(left: ObjectMetadata, right: ObjectMetadata): boolean {
  return left.key === right.key
    && left.sha256 === right.sha256
    && left.byteSize === right.byteSize
    && left.contentType === right.contentType
    && left.accessClass === right.accessClass;
}

export class PostgresObjectGcDatabase implements ObjectGcDatabase {
  private readonly pool: QueryPool;

  constructor(pool: QueryPool) {
    this.pool = pool;
  }

  async reconcileSnapshot(objects: readonly ObjectMetadata[], now: Date, apply: boolean): Promise<ObjectGcSnapshot> {
    const client = await this.pool.connect();
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    try {
      const referenceRows = await client.query(REFERENCES_SQL);
      const references = new Set(referenceRows.rows.map(({ object_key }) => String(object_key)));
      const storedRows = await client.query(
        "SELECT object_key, sha256, byte_size, content_type, access_class FROM stored_objects",
      );
      const stored = new Map(storedRows.rows.map((row) => {
        const item = metadataFromRow(row);
        return [item.key, item] as const;
      }));
      const markRows = await client.query(
        "SELECT object_key, first_unreferenced_at FROM object_gc_marks",
      );
      const previousMarks = new Map(markRows.rows.map(({ object_key, first_unreferenced_at }) => [
        String(object_key), new Date(String(first_unreferenced_at)),
      ]));

      for (const object of objects) {
        validateObjectMetadata(object);
        const existing = stored.get(object.key);
        if (existing && !sameMetadata(existing, object)) throw new Error(`Object metadata mismatch: ${object.key}`);
      }
      const listedKeys = new Set(objects.map(({ key }) => key));
      const recoverableMissing = [...stored.values()].filter(({ key }) =>
        !listedKeys.has(key) && previousMarks.has(key) && !references.has(key));
      if ([...stored.keys()].some((key) =>
        !listedKeys.has(key) && !recoverableMissing.some((item) => item.key === key))) {
        throw new Error("Object list is incomplete");
      }
      const unreferenced = [
        ...objects.filter(({ key }) => !references.has(key)),
        ...recoverableMissing,
      ];

      if (apply) {
        for (const object of objects) {
          const result = await client.query(
            `INSERT INTO stored_objects (object_key, sha256, byte_size, content_type, access_class)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (object_key) DO UPDATE SET object_key = EXCLUDED.object_key
             WHERE stored_objects.sha256 = EXCLUDED.sha256
               AND stored_objects.byte_size = EXCLUDED.byte_size
               AND stored_objects.content_type = EXCLUDED.content_type
               AND stored_objects.access_class = EXCLUDED.access_class
             RETURNING object_key`,
            [object.key, object.sha256, object.byteSize, object.contentType, object.accessClass],
          );
          if (result.rowCount !== 1) throw new Error(`Object metadata mismatch: ${object.key}`);
        }
        await client.query(
          `DELETE FROM object_gc_marks mark WHERE EXISTS (
             SELECT 1 FROM (${REFERENCES_SQL}) referenced
             WHERE referenced.object_key = mark.object_key
           )`,
        );
        for (const { key } of unreferenced) {
          await client.query(
            `INSERT INTO object_gc_marks (object_key, first_unreferenced_at, last_confirmed_at)
             VALUES ($1, $2, $2)
             ON CONFLICT (object_key) DO UPDATE SET last_confirmed_at = EXCLUDED.last_confirmed_at`,
            [key, now],
          );
        }
      }
      await client.query("COMMIT");
      return { unreferenced, previousMarks };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async referencedKeys(): Promise<Set<string>> {
    const result = await this.pool.query(REFERENCES_SQL);
    return new Set(result.rows.map(({ object_key }) => String(object_key)));
  }

  async isReferenced(key: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT EXISTS (
         SELECT 1 FROM (${REFERENCES_SQL}) referenced WHERE referenced.object_key = $1
       ) AS referenced`,
      [key],
    );
    return result.rows[0]?.referenced === true;
  }

  async clearMark(key: string): Promise<void> {
    await this.pool.query("DELETE FROM object_gc_marks WHERE object_key = $1", [key]);
  }

  async removeUnreferenced(key: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM stored_objects object
       WHERE object.object_key = $1
         AND NOT EXISTS (
           SELECT 1 FROM (${REFERENCES_SQL}) referenced WHERE referenced.object_key = object.object_key
         )
       RETURNING object_key`,
      [key],
    );
    return result.rowCount === 1;
  }
}

export interface ObjectGcReport {
  mode: "dry-run" | "apply";
  listed_count: number;
  listed_bytes: number;
  unreferenced_count: number;
  unreferenced_bytes: number;
  keys: string[];
  marked_count: number;
  deleted_count: number;
  deleted_bytes: number;
  failed_count: number;
}

async function completeList(objectStore: ObjectStore, prefix: string): Promise<{
  objects: ObjectMetadata[];
  complete: boolean;
}> {
  const objects: ObjectMetadata[] = [];
  for await (const object of objectStore.list(prefix)) objects.push(object);
  return { objects, complete: true };
}

export async function runObjectGc(options: {
  objectStore: ObjectStore;
  database: ObjectGcDatabase;
  apply?: boolean;
  graceMs?: number;
  now?: Date;
  prefix?: string;
  listObjects?: () => Promise<{ objects: ObjectMetadata[]; complete: boolean }>;
}): Promise<ObjectGcReport> {
  const apply = options.apply === true;
  const now = options.now ?? new Date();
  const graceMs = options.graceMs ?? 7 * 86_400_000;
  const prefix = options.prefix ?? "";
  if (!Number.isFinite(graceMs) || graceMs < 0) throw new Error("GC grace period is invalid");

  const listing = await (options.listObjects?.() ?? completeList(options.objectStore, prefix));
  if (!listing.complete) throw new Error("Object list is incomplete");
  const seen = new Set<string>();
  for (const item of listing.objects) {
    validateObjectMetadata(item);
    if (!item.key.startsWith(prefix)) throw new Error(`Object prefix mismatch: ${item.key}`);
    if (seen.has(item.key)) throw new Error(`Duplicate object key: ${item.key}`);
    seen.add(item.key);
  }

  const snapshot = await options.database.reconcileSnapshot(listing.objects, now, apply);
  const previous = snapshot.previousMarks;
  const candidates = apply
    ? snapshot.unreferenced.filter(({ key }) => {
        const markedAt = previous.get(key);
        return markedAt !== undefined && now.getTime() - markedAt.getTime() >= graceMs;
      })
    : [];
  let deletedCount = 0;
  let deletedBytes = 0;
  let failedCount = 0;

  if (candidates.length > 0) {
    const freshReferences = await options.database.referencedKeys();
    for (const item of candidates) {
      if (freshReferences.has(item.key)) {
        await options.database.clearMark(item.key);
        continue;
      }
      if (await options.database.isReferenced(item.key)) {
        await options.database.clearMark(item.key);
        continue;
      }
      try {
        await options.objectStore.delete(item.key);
        if (await options.objectStore.head(item.key)) {
          failedCount += 1;
          continue;
        }
        if (!await options.database.removeUnreferenced(item.key)) {
          failedCount += 1;
          continue;
        }
        deletedCount += 1;
        deletedBytes += item.byteSize;
      } catch {
        failedCount += 1;
      }
    }
  }

  const keys = snapshot.unreferenced.map(({ key }) => key).sort();
  return {
    mode: apply ? "apply" : "dry-run",
    listed_count: listing.objects.length,
    listed_bytes: listing.objects.reduce((sum, item) => sum + item.byteSize, 0),
    unreferenced_count: snapshot.unreferenced.length,
    unreferenced_bytes: snapshot.unreferenced.reduce((sum, item) => sum + item.byteSize, 0),
    keys,
    marked_count: apply ? snapshot.unreferenced.filter(({ key }) => !previous.has(key)).length : 0,
    deleted_count: deletedCount,
    deleted_bytes: deletedBytes,
    failed_count: failedCount,
  };
}
