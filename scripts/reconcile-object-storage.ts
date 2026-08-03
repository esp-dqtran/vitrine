import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import pg from "pg";

import {
  objectInventoriesMatch,
  reconcileObjectInventories,
  type ObjectInventoryEntry,
} from "../src/objectInventoryReconcile.ts";
import { objectStoreConfigFromEnvironment } from "../src/objectStoreConfig.ts";

const FETCH_SIZE = 10_000;

async function* databaseInventory(client: pg.Client): AsyncIterable<ObjectInventoryEntry> {
  await client.query("BEGIN READ ONLY");
  let rowsRead = 0;
  try {
    await client.query(
      "DECLARE object_inventory NO SCROLL CURSOR FOR "
      + "SELECT object_key, byte_size FROM stored_objects ORDER BY object_key",
    );
    while (true) {
      const result = await client.query<{ object_key: string; byte_size: string }>(
        `FETCH FORWARD ${FETCH_SIZE} FROM object_inventory`,
      );
      if (result.rows.length === 0) break;
      for (const row of result.rows) {
        yield { key: row.object_key, byteSize: Number(row.byte_size) };
      }
      rowsRead += result.rows.length;
      if (rowsRead % 100_000 === 0) {
        console.error(JSON.stringify({ status: "running", database_objects: rowsRead }));
      }
    }
    await client.query("CLOSE object_inventory");
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

async function* bucketInventory(input: {
  client: S3Client;
  bucket: string;
  prefix: string;
}): AsyncIterable<ObjectInventoryEntry> {
  const physicalPrefix = input.prefix ? `${input.prefix}/` : "";
  let continuationToken: string | undefined;
  let objectsRead = 0;
  let nextProgress = 100_000;
  do {
    const output = await input.client.send(new ListObjectsV2Command({
      Bucket: input.bucket,
      Prefix: physicalPrefix,
      ...(continuationToken ? { ContinuationToken: continuationToken } : {}),
    }));
    for (const object of output.Contents ?? []) {
      if (!object.Key || object.Size === undefined) continue;
      if (!object.Key.startsWith(physicalPrefix)) throw new Error("bucket_inventory_prefix_invalid");
      const key = object.Key.slice(physicalPrefix.length);
      if (!key) continue;
      yield { key, byteSize: object.Size };
      objectsRead += 1;
      if (objectsRead >= nextProgress) {
        console.error(JSON.stringify({ status: "running", bucket_objects: objectsRead }));
        nextProgress += 100_000;
      }
    }
    if (!output.IsTruncated) break;
    if (!output.NextContinuationToken) throw new Error("bucket_inventory_continuation_missing");
    continuationToken = output.NextContinuationToken;
  } while (true);
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "inventory_reconciliation_failed";
  return /^[a-z_]+$/.test(message) ? message : "inventory_reconciliation_failed";
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
    const report = await reconcileObjectInventories(
      databaseInventory(database),
      bucketInventory({ client: storage, bucket: config.bucket, prefix: config.prefix }),
    );
    const matches = objectInventoriesMatch(report);
    console.log(JSON.stringify({ status: matches ? "ok" : "mismatch", ...report }));
    if (!matches) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ status: "error", error: safeError(error) }));
    process.exitCode = 1;
  } finally {
    await database.end().catch(() => undefined);
  }
}
