// Fallback card image for apps with no crawled Site to borrow from: the app's
// own first captured screen.
//
// Uses images.thumbnail_object_key, never images.object_key — the `images/`
// namespace is full-resolution screens behind the unlock paywall and the Worker
// deliberately refuses to serve it. Thumbnails are already public catalog media.
//
// The pick is the lowest-id screen per app rather than a random one: a card that
// changes picture on every backfill run churns caches for no benefit, and the
// first captured screen is usually the landing/home state.
//
//   dry run:  node --env-file-if-exists=.env --import tsx scripts/backfill-app-screen-previews.ts
//   apply:    ... scripts/backfill-app-screen-previews.ts --apply
import { closePool, query } from "../src/db.ts";

const apply = process.argv.includes("--apply");
const platformArgument = process.argv.indexOf("--platform");
const platform = platformArgument < 0 ? null : process.argv[platformArgument + 1] ?? null;
if (platform && !["web", "ios", "android"].includes(platform)) {
  throw new Error("--platform must be web, ios or android");
}

// Web screens are desktop captures and read best on a card; a phone screenshot
// is the fallback of last resort. Ordering the platforms makes the choice
// deterministic for apps that have several.
// Per-platform: each app-platform pair gets a capture from that platform, so
// the Android tab never shows an iOS screenshot.
// DISTINCT ON rather than a per-row subquery: images holds 1.2M rows and the
// correlated form times out.
const PLATFORM_MATCHES = `
SELECT DISTINCT ON (i.platform_id)
       i.platform_id AS id, p.name, i.thumbnail_object_key AS screen_key
FROM images i
JOIN platforms p ON p.id = i.platform_id
WHERE i.thumbnail_object_key IS NOT NULL
  AND p.preview_object_key IS NULL
  AND ($1::text IS NULL OR p.name = $1)
ORDER BY i.platform_id, i.id
`;

const MATCHES = `
SELECT a.id,
       a.name,
       (
         SELECT i.thumbnail_object_key
         FROM platforms p
         JOIN images i ON i.platform_id = p.id
         WHERE p.app_id = a.id
           AND i.thumbnail_object_key IS NOT NULL
           AND ($1::text IS NULL OR p.name = $1)
         ORDER BY CASE p.name WHEN 'web' THEN 0 WHEN 'ios' THEN 1 ELSE 2 END, i.id
         LIMIT 1
       ) AS screen_key
FROM apps a
WHERE a.preview_object_key IS NULL
`;

const { rows } = await query<{ id: number; name: string; screen_key: string | null }>(
  MATCHES,
  [platform],
);
const matched = rows.filter((row) => row.screen_key);
const platformRows = (await query<{
  id: number;
  name: string;
  app: string;
  screen_key: string | null;
}>(PLATFORM_MATCHES, [platform])).rows;
const platformMatched = platformRows.filter((row) => row.screen_key);

try {
  if (apply) {
    for (const row of matched) {
      await query(`UPDATE apps SET preview_object_key = $1 WHERE id = $2 AND preview_object_key IS NULL`, [
        row.screen_key,
        row.id,
      ]);
    }
    for (const row of platformMatched) {
      await query(
        `UPDATE platforms SET preview_object_key = $1 WHERE id = $2 AND preview_object_key IS NULL`,
        [row.screen_key, row.id],
      );
    }
  }
} finally {
  await closePool();
}

console.log(JSON.stringify({
  mode: apply ? "apply" : "dry-run",
  platform: platform ?? "all",
  apps: { examined: rows.length, matched: matched.length, withoutScreens: rows.length - matched.length },
  platforms: {
    examined: platformRows.length,
    matched: platformMatched.length,
    withoutScreens: platformRows.length - platformMatched.length,
  },
  examples: matched.slice(0, 5).map(({ name, screen_key }) => ({ name, screen_key })),
}, null, 2));
