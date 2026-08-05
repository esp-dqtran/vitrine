// Site cards show a still until hover. That still used to be the full-page
// screenshot (1440x7008, ~2.5MB) while the preview video is one 1440x900
// viewport, so hovering jumped to different content. Derive the poster from the
// video's own first meaningful frame instead: same framing, ~16KB.
//
// "Meaningful" matters — a good share of the captures start recording before the
// page has painted, so frame 0 is a blank body with a spinner. Pick the first
// candidate frame that actually has detail.
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import { closePool, query } from "../src/db.ts";
import { sitePreviewPosterObjectKey } from "../src/objectStore.ts";
import { createObjectStore, objectStoreConfigFromEnvironment } from "../src/objectStoreConfig.ts";
import { runPool } from "../src/pool.ts";

const run = promisify(execFile);

// Cards render ~320px wide; 640 covers 2x displays.
const POSTER_WIDTH = 640;
// Seconds to sample, in order. A capture that is still blank at 6s has nothing
// better to offer than its first frame.
const CANDIDATE_SECONDS = [0, 1, 2, 3, 4, 6];
// Mean per-channel standard deviation. A loading page (white body, thin nav) sits
// under 20; real content measures 40-110.
const MIN_DETAIL = 20;

const apply = process.argv.includes("--apply");
const refresh = process.argv.includes("--refresh");
const onlyKind = process.argv.includes("--images") ? "image/" : process.argv.includes("--videos") ? "video/" : null;
const objectStore = createObjectStore(objectStoreConfigFromEnvironment(process.env));

// The card frame is the shared 16/10 one, and a preview video is natively
// 1440x900 — the same shape — so a video poster needs no crop at all. An image
// preview is a whole page, so crop it to that frame from the top.
const CARD_HEIGHT = Math.round((POSTER_WIDTH * 10) / 16);

const source = await query<{
  version_id: number;
  name: string;
  preview_object_key: string;
  content_type: string;
}>(
  // sv.id is a bigint, which pg hands back as a string — cast it so the object
  // key builder gets the integer it requires.
  `SELECT sv.id::int AS version_id, s.name, sv.preview_object_key, so.content_type
   FROM site_versions sv
   JOIN sites s ON s.id = sv.site_id
   JOIN stored_objects so ON so.object_key = sv.preview_object_key
   WHERE sv.status = 'ready'
     AND ($1::boolean OR sv.poster_object_key IS NULL)
     AND ($2::text IS NULL OR so.content_type LIKE $2 || '%')
   ORDER BY sv.id`,
  [refresh, onlyKind],
);

interface Derived {
  versionId: number;
  name: string;
  seconds: number;
  detail: number;
  bytes: number;
  sourceBytes: number;
}

const derived: Derived[] = [];
const failures: Array<{ versionId: number; name: string; reason: string }> = [];
let completed = 0;

async function frameAt(videoPath: string, directory: string, seconds: number): Promise<Buffer | null> {
  const framePath = join(directory, `frame-${seconds}.png`);
  try {
    await run("ffmpeg", ["-y", "-v", "error", "-ss", String(seconds), "-i", videoPath, "-vframes", "1", framePath]);
    return await readFile(framePath);
  } catch {
    return null;
  }
}

async function detailOf(frame: Buffer): Promise<number> {
  const stats = await sharp(frame).stats();
  return stats.channels.reduce((total, channel) => total + channel.stdev, 0) / stats.channels.length;
}

async function store(versionId: number, body: Buffer): Promise<void> {
  if (!apply) return;
  const sha256 = createHash("sha256").update(body).digest("hex");
  const key = sitePreviewPosterObjectKey(versionId, sha256);
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
  await query(`UPDATE site_versions SET poster_object_key = $1 WHERE id = $2`, [key, versionId]);
}

try {
  await runPool(source.rows, [0, 1, 2, 3], async (_lane, row) => {
    const directory = await mkdtemp(join(tmpdir(), "site-poster-"));
    try {
      const original = await objectStore.get(row.preview_object_key);

      if (row.content_type.startsWith("image/")) {
        // A full-page capture: 2880x23386 and 3MB for one 320px card. Crop the
        // top to the card's shape, which is all `object-fit: cover` ever showed.
        const body = await sharp(original.body, { limitInputPixels: 512 * 1024 * 1024 })
          .resize(POSTER_WIDTH, CARD_HEIGHT, { fit: "cover", position: "top", withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer();
        await store(row.version_id, body);
        derived.push({
          versionId: row.version_id,
          name: row.name,
          seconds: 0,
          detail: 0,
          bytes: body.byteLength,
          sourceBytes: original.body.byteLength,
        });
        return;
      }

      const video = original;
      const videoPath = join(directory, "preview");
      await writeFile(videoPath, video.body);

      let chosen: { frame: Buffer; seconds: number; detail: number } | null = null;
      for (const seconds of CANDIDATE_SECONDS) {
        const frame = await frameAt(videoPath, directory, seconds);
        if (!frame) continue;
        const detail = await detailOf(frame);
        if (!chosen) chosen = { frame, seconds, detail };
        if (detail >= MIN_DETAIL) {
          chosen = { frame, seconds, detail };
          break;
        }
      }
      if (!chosen) throw new Error("No decodable frame");

      const body = await sharp(chosen.frame)
        .resize(POSTER_WIDTH, null, { withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
      await store(row.version_id, body);
      derived.push({
        versionId: row.version_id,
        name: row.name,
        seconds: chosen.seconds,
        detail: Math.round(chosen.detail),
        bytes: body.byteLength,
        sourceBytes: video.body.byteLength,
      });
    } catch (error) {
      failures.push({
        versionId: row.version_id,
        name: row.name,
        reason: error instanceof Error ? error.message.slice(0, 120) : "failed",
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
      completed += 1;
      if (completed % 25 === 0 || completed === source.rows.length) {
        console.error(`Site poster ${apply ? "derive" : "dry-run"} ${completed}/${source.rows.length}`);
      }
    }
  });
} finally {
  await closePool();
}

const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0);
const skippedBlankStart = derived.filter(({ seconds }) => seconds > 0);
console.log(JSON.stringify({
  mode: apply ? "apply" : "dry-run",
  examined: source.rows.length,
  derived: derived.length,
  failed: failures.length,
  // How many captures start on a page that had not painted yet.
  startedAfterBlankFrames: skippedBlankStart.length,
  posterMegabytes: Number((sum(derived.map(({ bytes }) => bytes)) / 1e6).toFixed(1)),
  averagePosterKilobytes: derived.length
    ? Math.round(sum(derived.map(({ bytes }) => bytes)) / derived.length / 1024)
    : 0,
  failures: failures.slice(0, 10),
}, null, 2));
