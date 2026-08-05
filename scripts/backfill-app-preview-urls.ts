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
       sv.preview_object_key AS preview_object_key
FROM apps a
JOIN LATERAL (
  SELECT sv.id AS vid
  FROM sites s
  JOIN site_versions sv ON sv.site_id = s.id
  JOIN stored_objects so ON so.object_key = sv.preview_object_key
  WHERE sv.status = 'ready'
    AND so.content_type LIKE 'image/%'
    AND regexp_replace(regexp_replace(lower(s.source_url), '^https?://(www\\.)?', ''), '[/?#].*$', '')
      = regexp_replace(regexp_replace(lower(a.website_url), '^https?://(www\\.)?', ''), '[/?#].*$', '')
  ORDER BY sv.created_at DESC
  LIMIT 1
) m ON TRUE
JOIN site_versions sv ON sv.id = m.vid
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
    console.log(`  ${String(row.name).slice(0, 44).padEnd(46)} -> ${row.preview_object_key}`);
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
