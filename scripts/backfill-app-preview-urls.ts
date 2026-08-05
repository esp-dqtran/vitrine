// Points apps.preview_object_key at the SAME stored image the Sites crawl
// already produced — one object, referenced by both the app and the site version.
//
// An app's website_url and the crawled site's source_url routinely disagree on
// the `www.` prefix and trailing slash, so this matches on bare hostname, not
// on canonical URL. Image previews only: some site captures are video/mp4,
// which an <img> cannot render and which would blank the card.
//
//   dry run:  node --env-file=.env --experimental-strip-types scripts/backfill-app-preview-urls.ts
//   apply:    ... scripts/backfill-app-preview-urls.ts --apply

import { query, closePool } from "../src/db.ts";

const apply = process.argv.includes("--apply");

const MATCHES = `
SELECT a.id,
       a.name,
       a.preview_object_key AS current_key,
       m.key                AS preview_object_key,
       m.source             AS source
FROM apps a
JOIN LATERAL (
  SELECT key, source FROM (
    -- Preferred: the version's own card preview, when it is an image.
    SELECT so.object_key AS key, 'preview' AS source, 0 AS rank, sv.created_at
    FROM sites s
    JOIN site_versions sv ON sv.site_id = s.id
    JOIN stored_objects so ON so.object_key = sv.preview_object_key
    WHERE sv.status = 'ready'
      AND so.content_type LIKE 'image/%'
      AND regexp_replace(regexp_replace(lower(s.source_url), '^https?://(www\\.)?', ''), '[/?#].*$', '')
        = regexp_replace(regexp_replace(lower(a.website_url), '^https?://(www\\.)?', ''), '[/?#].*$', '')
    UNION ALL
    -- Fallback: the full-page screenshot. site_versions.preview_object_key is
    -- often a scroll video, which an <img> cannot render, but the crawl also
    -- stores a real full-page capture and those are always images.
    SELECT so.object_key AS key, 'full_page' AS source, 1 AS rank, sv.created_at
    FROM sites s
    JOIN site_versions sv ON sv.site_id = s.id
    JOIN site_pages sp ON sp.version_id = sv.id
    JOIN stored_objects so ON so.object_key = sp.full_page_object_key
    WHERE sv.status = 'ready'
      AND so.content_type LIKE 'image/%'
      AND regexp_replace(regexp_replace(lower(s.source_url), '^https?://(www\\.)?', ''), '[/?#].*$', '')
        = regexp_replace(regexp_replace(lower(a.website_url), '^https?://(www\\.)?', ''), '[/?#].*$', '')
  ) candidates
  ORDER BY rank, created_at DESC, key
  LIMIT 1
) m ON TRUE
WHERE a.website_url IS NOT NULL
  -- App-store listings are not the product's site; a capture of one would show
  -- a store page rather than the app.
  AND a.website_url !~* '^https?://(www\\.)?(apps\\.apple\\.com|play\\.google\\.com)'
`;

async function main() {
  const { rows } = await query(MATCHES);
  const changed = rows.filter((r) => r.current_key !== r.preview_object_key);

  console.log(`apps matched to an image site capture: ${rows.length}`);
  console.log(`would change:                          ${changed.length}`);
  for (const row of changed.slice(0, 8)) {
    console.log(`  ${String(row.name).slice(0, 34).padEnd(36)} ${String(row.source).padEnd(10)} ${String(row.preview_object_key).slice(0, 48)}`);
  }
  if (changed.length > 8) console.log(`  … and ${changed.length - 8} more`);

  if (!apply) {
    console.log("\ndry run — pass --apply to write");
    await closePool();
    return;
  }

  let written = 0;
  for (const row of changed) {
    await query(`UPDATE apps SET preview_object_key = $1 WHERE id = $2`, [row.preview_object_key, row.id]);
    written++;
  }
  console.log(`\nupdated ${written} apps`);
  await closePool();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await closePool();
  process.exitCode = 1;
});
