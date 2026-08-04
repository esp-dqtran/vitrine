import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import pg from "pg";

import { objectStoreConfigFromEnvironment } from "../src/objectStoreConfig.ts";

interface StoredObjectRow {
  object_key: string;
  sha256: string;
  byte_size: string;
  content_type: string;
  access_class: string;
}

interface ReferenceColumn {
  table_name: string;
  column_name: string;
}

const concurrency = Number(process.env.OBJECT_INVENTORY_REPAIR_CONCURRENCY ?? 48);
if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 128) {
  throw new Error("repair_concurrency_invalid");
}

function identifier(value: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new Error("database_identifier_invalid");
  return `"${value}"`;
}

function referencePredicates(columns: ReferenceColumn[], objectAlias: string): string {
  return columns.map(({ table_name: table, column_name: column }, index) =>
    `NOT EXISTS (SELECT 1 FROM ${identifier(table)} ref_${index} `
    + `WHERE ref_${index}.${identifier(column)} = ${objectAlias}.object_key)`).join("\nAND ");
}

function missing(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return value.name === "NotFound"
    || value.name === "NoSuchKey"
    || value.$metadata?.httpStatusCode === 404;
}

function prefixSummary(rows: StoredObjectRow[]): Array<{ prefix: string; objects: number; bytes: number }> {
  const summaries = new Map<string, { objects: number; bytes: number }>();
  for (const row of rows) {
    const prefix = row.object_key.split("/", 1)[0];
    const summary = summaries.get(prefix) ?? { objects: 0, bytes: 0 };
    summary.objects += 1;
    summary.bytes += Number(row.byte_size);
    summaries.set(prefix, summary);
  }
  return [...summaries.entries()]
    .map(([prefix, summary]) => ({ prefix, ...summary }))
    .sort((left, right) => right.bytes - left.bytes);
}

function storedObjectRows(value: unknown): StoredObjectRow[] {
  if (!Array.isArray(value)) throw new Error("repair_input_invalid");
  return value.map((row) => {
    if (!row || typeof row !== "object") throw new Error("repair_input_invalid");
    const item = row as Partial<StoredObjectRow>;
    if (typeof item.object_key !== "string"
      || typeof item.sha256 !== "string"
      || typeof item.byte_size !== "string"
      || typeof item.content_type !== "string"
      || typeof item.access_class !== "string") {
      throw new Error("repair_input_invalid");
    }
    return item as StoredObjectRow;
  }).sort((left, right) => left.object_key.localeCompare(right.object_key));
}

async function missingFromBucket(input: {
  client: S3Client;
  bucket: string;
  prefix: string;
  candidates: StoredObjectRow[];
}): Promise<StoredObjectRow[]> {
  const absent: StoredObjectRow[] = [];
  let next = 0;
  let checked = 0;
  let nextProgress = 10_000;
  const workers = Array.from({ length: Math.min(concurrency, input.candidates.length) }, async () => {
    while (true) {
      const index = next;
      next += 1;
      const row = input.candidates[index];
      if (!row) return;
      const key = input.prefix ? `${input.prefix}/${row.object_key}` : row.object_key;
      try {
        await input.client.send(new HeadObjectCommand({ Bucket: input.bucket, Key: key }));
      } catch (error) {
        if (!missing(error)) throw error;
        absent.push(row);
      }
      checked += 1;
      if (checked >= nextProgress) {
        console.error(JSON.stringify({ status: "running", checked_objects: checked }));
        nextProgress += 10_000;
      }
    }
  });
  await Promise.all(workers);
  return absent.sort((left, right) => left.object_key.localeCompare(right.object_key));
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "inventory_repair_failed";
  return /^[a-z_]+$/.test(message) ? message : "inventory_repair_failed";
}

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error(JSON.stringify({ status: "error", error: "database_configuration_invalid" }));
  process.exitCode = 1;
} else {
  const database = new pg.Client({ connectionString: databaseUrl });
  try {
    const config = objectStoreConfigFromEnvironment(process.env);
    if (config.backend !== "s3") throw new Error("object_store_backend_invalid");
    const credentials = config.accessKeyId && config.secretAccessKey
      ? { credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey } }
      : {};
    const storage = new S3Client({
      region: config.region,
      ...(config.endpoint ? { endpoint: config.endpoint } : {}),
      forcePathStyle: config.forcePathStyle,
      ...credentials,
    });
    await database.connect();

    const references = await database.query<ReferenceColumn>(
      `SELECT conrelid::regclass::text AS table_name, attribute.attname AS column_name
       FROM pg_constraint constraint_row
       JOIN LATERAL unnest(constraint_row.conkey) WITH ORDINALITY AS key(attnum, ord) ON true
       JOIN pg_attribute attribute
         ON attribute.attrelid = constraint_row.conrelid AND attribute.attnum = key.attnum
       WHERE constraint_row.contype = 'f'
         AND constraint_row.confrelid = 'stored_objects'::regclass
         AND constraint_row.conrelid::regclass::text <> 'object_gc_marks'
       ORDER BY 1, 2`,
    );
    const predicates = referencePredicates(references.rows, "stored");
    const inputPath = process.env.OBJECT_INVENTORY_REPAIR_INPUT?.trim();
    const candidateRows = inputPath
      ? storedObjectRows(JSON.parse(await readFile(path.resolve(inputPath), "utf8")))
      : (await database.query<StoredObjectRow>(
          `SELECT stored.object_key, stored.sha256, stored.byte_size,
                  stored.content_type, stored.access_class
           FROM stored_objects stored
           WHERE ${predicates}
           ORDER BY stored.object_key`,
        )).rows;
    const firstPass = await missingFromBucket({
      client: storage,
      bucket: config.bucket,
      prefix: config.prefix,
      candidates: candidateRows,
    });
    const absent = process.env.OBJECT_INVENTORY_REPAIR_APPLY === "1"
      ? await missingFromBucket({
          client: storage,
          bucket: config.bucket,
          prefix: config.prefix,
          candidates: firstPass,
        })
      : firstPass;

    let deleted = 0;
    let backupPath: string | undefined;
    if (process.env.OBJECT_INVENTORY_REPAIR_APPLY === "1" && absent.length > 0) {
      const timestamp = new Date().toISOString().replaceAll(":", "-");
      backupPath = path.resolve(
        process.env.OBJECT_INVENTORY_REPAIR_BACKUP
          ?? `.codex-artifacts/r2-migration/missing-stored-objects-${timestamp}.json`,
      );
      await mkdir(path.dirname(backupPath), { recursive: true });
      await writeFile(backupPath, `${JSON.stringify(absent, null, 2)}\n`, { mode: 0o600 });

      await database.query("BEGIN");
      try {
        for (let start = 0; start < absent.length; start += 500) {
          const keys = absent.slice(start, start + 500).map(({ object_key }) => object_key);
          const result = await database.query(
            `DELETE FROM stored_objects stored
             WHERE stored.object_key = ANY($1::text[])
             RETURNING stored.object_key`,
            [keys],
          );
          deleted += result.rowCount ?? 0;
        }
        if (deleted !== absent.length) throw new Error("database_repair_race_detected");
        await database.query("COMMIT");
      } catch (error) {
        await database.query("ROLLBACK");
        throw error;
      }
    }

    console.log(JSON.stringify({
      status: "ok",
      mode: process.env.OBJECT_INVENTORY_REPAIR_APPLY === "1" ? "apply" : "dry-run",
      unreferenced_candidates: candidateRows.length,
      missing_unreferenced_objects: absent.length,
      missing_summary: prefixSummary(absent),
      deleted_objects: deleted,
      ...(backupPath ? { backup_path: backupPath } : {}),
    }));
  } catch (error) {
    console.error(JSON.stringify({ status: "error", error: safeError(error) }));
    process.exitCode = 1;
  } finally {
    await database.end().catch(() => undefined);
  }
}
