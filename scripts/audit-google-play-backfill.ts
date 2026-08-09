import { closePool, pool } from "../src/db.ts";

interface AuditResult {
  published_android_apps: number;
  verified_play_listings: number;
  imported_apps: number;
  imported_screenshots: number;
  unresolved_apps: number;
  verified_without_screenshots: number;
  over_eight: number;
  apps_missing_objects: number;
  apps_missing_thumbnails: number;
  bad_preview_categories: number;
  bad_card_counts: number;
  bad_card_order: number;
  verified_without_screenshot_apps: string[] | null;
  unresolved_app_names: string[] | null;
}

try {
  const result = await pool.query<AuditResult>(
    `WITH latest AS (
       SELECT DISTINCT ON (av.app_id) av.id version_id, av.app_id, av.source_url
       FROM app_versions av
       WHERE av.status = 'published' AND av.platform = 'android'
       ORDER BY av.app_id, av.version_number DESC
     ), base AS (
       SELECT latest.version_id, apps.name app,
         COALESCE(
           CASE WHEN latest.source_url ~ '^https://play\\.google\\.com/store/apps/details\\?[^#]*id='
             THEN latest.source_url END,
           CASE WHEN apps.website_url ~ '^https://play\\.google\\.com/store/apps/details\\?[^#]*id='
             THEN apps.website_url END
         ) listing
       FROM latest JOIN apps ON apps.id = latest.app_id
     ), stats AS (
       SELECT base.version_id, base.app, base.listing,
         COUNT(DISTINCT version_image.image_id)
           FILTER (WHERE image.image_url LIKE 'google-play:%')::int gp_count,
         COUNT(DISTINCT version_image.image_id)
           FILTER (WHERE image.image_url LIKE 'google-play:%' AND image.object_key IS NULL)::int missing_objects,
         COUNT(DISTINCT version_image.image_id)
           FILTER (WHERE image.image_url LIKE 'google-play:%' AND image.thumbnail_object_key IS NULL)::int missing_thumbnails,
         COUNT(DISTINCT assignment.image_id)
           FILTER (WHERE image.image_url LIKE 'google-play:%' AND pattern.slug = 'preview')::int preview_count,
         COUNT(DISTINCT card.image_id)
           FILTER (WHERE image.image_url LIKE 'google-play:%')::int card_count,
         BOOL_AND((substring(image.image_url from '([0-9]+)$'))::int = card.rank)
           FILTER (WHERE card.image_id IS NOT NULL AND image.image_url LIKE 'google-play:%') card_order_ok
       FROM base
       LEFT JOIN version_images version_image ON version_image.version_id = base.version_id
       LEFT JOIN images image ON image.id = version_image.image_id
       LEFT JOIN screen_pattern_assignments assignment ON assignment.image_id = image.id
       LEFT JOIN screen_patterns pattern ON pattern.id = assignment.screen_pattern_id
       LEFT JOIN app_preview_images card
         ON card.version_id = base.version_id AND card.image_id = image.id
       GROUP BY base.version_id, base.app, base.listing
     )
     SELECT
       COUNT(*)::int published_android_apps,
       COUNT(*) FILTER (WHERE listing IS NOT NULL)::int verified_play_listings,
       COUNT(*) FILTER (WHERE gp_count > 0)::int imported_apps,
       COALESCE(SUM(gp_count), 0)::int imported_screenshots,
       COUNT(*) FILTER (WHERE listing IS NULL)::int unresolved_apps,
       COUNT(*) FILTER (WHERE listing IS NOT NULL AND gp_count = 0)::int verified_without_screenshots,
       COUNT(*) FILTER (WHERE gp_count > 8)::int over_eight,
       COUNT(*) FILTER (WHERE missing_objects > 0)::int apps_missing_objects,
       COUNT(*) FILTER (WHERE missing_thumbnails > 0)::int apps_missing_thumbnails,
       COUNT(*) FILTER (WHERE gp_count > 0 AND preview_count <> gp_count)::int bad_preview_categories,
       COUNT(*) FILTER (WHERE gp_count > 0 AND card_count <> LEAST(3, gp_count))::int bad_card_counts,
       COUNT(*) FILTER (WHERE gp_count > 0 AND card_order_ok IS NOT TRUE)::int bad_card_order,
       ARRAY_AGG(app ORDER BY app) FILTER (WHERE listing IS NOT NULL AND gp_count = 0)
         verified_without_screenshot_apps,
       ARRAY_AGG(app ORDER BY app) FILTER (WHERE listing IS NULL) unresolved_app_names
     FROM stats`,
  );
  console.log(JSON.stringify(result.rows[0], null, 2));
} finally {
  await closePool();
}
