// App cards point at whatever image the Site crawl produced — for 228 apps that
// is the full-page screenshot, which is both multi-megabyte and the paid Site
// product. Derive a real card thumbnail into the public `thumbnails/` namespace
// so the card stops serving the original.
import { createHash } from "node:crypto";
import sharp from "sharp";
import { closePool, query } from "../src/db.ts";
import { appPreviewThumbnailObjectKey } from "../src/objectStore.ts";
import { createObjectStore, objectStoreConfigFromEnvironment } from "../src/objectStoreConfig.ts";
import { runPool } from "../src/pool.ts";

// Cards render at ~320px wide; 640 covers 2x displays. A site capture is the
// whole scrolled page — often 4000px tall — and the card only ever shows the
// top strip, so crop rather than scale: same visible result, a fraction of the
// bytes.
const CARD_WIDTH = 640;
const CARD_HEIGHT = 400;

const apply = process.argv.includes("--apply");
const objectStore = createObjectStore(objectStoreConfigFromEnvironment(process.env));
const source = await query<{ id: number; name: string; preview_object_key: string }>(
  `SELECT id, name, preview_object_key
   FROM apps
   WHERE preview_object_key IS NOT NULL
     AND split_part(preview_object_key, '/', 5) <> 'preview'
   ORDER BY id`,
);

const results: Array<{ id: number; name: string; bytes: number; from: number }> = [];
const failures: Array<{ id: number; name: string; reason: string }> = [];

try {
  await runPool(source.rows, [0, 1, 2, 3, 4, 5, 6, 7], async (_lane, row) => {
    try {
      const original = await objectStore.get(row.preview_object_key);
      const body = await sharp(original.body, { limitInputPixels: 512 * 1024 * 1024 })
        .resize(CARD_WIDTH, CARD_HEIGHT, { fit: "cover", position: "top", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
      const sha256 = createHash("sha256").update(body).digest("hex");
      const key = appPreviewThumbnailObjectKey(row.id, sha256);
      if (apply) {
        await objectStore.put({
          key,
          sha256,
          byteSize: body.byteLength,
          contentType: "image/webp",
          accessClass: "public-preview",
          body,
        });
        await query(
          `INSERT INTO stored_objects (object_key, sha256, byte_size, content_type, access_class)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (object_key) DO NOTHING`,
          [key, sha256, body.byteLength, "image/webp", "public-preview"],
        );
        await query(`UPDATE apps SET preview_object_key = $1 WHERE id = $2`, [key, row.id]);
      }
      results.push({ id: row.id, name: row.name, bytes: body.byteLength, from: original.body.byteLength });
    } catch (error) {
      failures.push({ id: row.id, name: row.name, reason: error instanceof Error ? error.message : "failed" });
    }
  });
} finally {
  await closePool();
}

const total = (values: number[]): number => values.reduce((sum, value) => sum + value, 0);
console.log(JSON.stringify({
  mode: apply ? "apply" : "dry-run",
  examined: source.rows.length,
  derived: results.length,
  failed: failures.length,
  originalMegabytes: Number((total(results.map((r) => r.from)) / 1e6).toFixed(1)),
  thumbnailMegabytes: Number((total(results.map((r) => r.bytes)) / 1e6).toFixed(1)),
  failures: failures.slice(0, 10),
}, null, 2));
