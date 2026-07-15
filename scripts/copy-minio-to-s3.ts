// One-time: copies every object already in local MinIO to the real S3 bucket, preserving
// keys exactly (images.object_key/thumbnail_object_key need no DB changes — same key,
// new backend). Skips objects that already exist at the destination, so it's re-runnable.
import pg from "pg";
import { createObjectStore, objectStoreConfigFromEnvironment } from "../src/objectStoreConfig.ts";

// The AWS SDK's default credential provider chain reads AWS_PROFILE from the real process
// env, not from whatever object gets passed to objectStoreConfigFromEnvironment() below —
// it has to be set here, before any S3Client is constructed.
process.env.AWS_PROFILE = "vitrine-ai-prod";

const pool = new pg.Pool({ connectionString: "postgres://postgres:postgres@localhost:5432/astryx" });

const source = createObjectStore(objectStoreConfigFromEnvironment({
  OBJECT_STORE_BACKEND: "s3",
  OBJECT_STORE_S3_BUCKET: "astryx-media",
  OBJECT_STORE_S3_REGION: "us-east-1",
  OBJECT_STORE_S3_PREFIX: "local",
  OBJECT_STORE_S3_ENDPOINT: "http://localhost:9000",
  OBJECT_STORE_S3_FORCE_PATH_STYLE: "true",
  OBJECT_STORE_ACCESS_KEY_ID: "astryx-app",
  OBJECT_STORE_SECRET_ACCESS_KEY: "astryx-app-password-change-me",
}));

const dest = createObjectStore(objectStoreConfigFromEnvironment({
  OBJECT_STORE_BACKEND: "s3",
  OBJECT_STORE_S3_BUCKET: "vitrine-ai-prod",
  OBJECT_STORE_S3_REGION: "ap-southeast-1",
  OBJECT_STORE_S3_PREFIX: "prod",
}));

const { rows } = await pool.query<{ object_key: string; sha256: string; byte_size: string; content_type: string; access_class: string }>(
  "SELECT object_key, sha256, byte_size, content_type, access_class FROM stored_objects ORDER BY object_key"
);
console.log(`Copying ${rows.length} objects (${(rows.reduce((s, r) => s + Number(r.byte_size), 0) / 1024 / 1024).toFixed(1)} MB) to S3...`);

let copied = 0, skipped = 0, failed = 0;
const CONCURRENCY = 6;
let cursor = 0;
async function worker() {
  while (cursor < rows.length) {
    const row = rows[cursor++];
    try {
      if (await dest.head(row.object_key)) { skipped++; continue; }
      const { body } = await source.get(row.object_key);
      await dest.put({
        key: row.object_key,
        sha256: row.sha256,
        byteSize: Number(row.byte_size),
        contentType: row.content_type as never,
        accessClass: row.access_class as never,
        body,
      });
      copied++;
      if (copied % 200 === 0) console.log(`  ${copied} copied, ${skipped} skipped, ${failed} failed so far...`);
    } catch (error) {
      failed++;
      console.warn(`Failed to copy ${row.object_key}: ${error}`);
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`Done: ${copied} copied, ${skipped} already present, ${failed} failed.`);
await pool.end();
