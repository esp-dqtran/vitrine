-- 0078 dropped search_documents and its two ingest queues, but left behind the
-- triggers that feed them. Every write to apps, images, sites, site_versions,
-- site_pages, site_sections, app_versions or categories still fires a trigger
-- whose function inserts into the now-missing site_search_index_queue, so the
-- statement fails with:
--
--   relation "site_search_index_queue" does not exist
--
-- That takes down the Sites import (the crawl completes, then persistence
-- fails), catalog imports, and any backfill touching those tables. Drop the
-- triggers and their functions alongside the tables they fed.
DROP TRIGGER IF EXISTS apps_search_queue ON apps;
DROP TRIGGER IF EXISTS app_versions_search_queue ON app_versions;
DROP TRIGGER IF EXISTS app_flow_versions_search_queue ON app_flow_versions;
DROP TRIGGER IF EXISTS app_categories_search_queue ON app_categories;
DROP TRIGGER IF EXISTS categories_search_queue ON categories;
DROP TRIGGER IF EXISTS images_search_queue ON images;
DROP TRIGGER IF EXISTS version_images_search_queue ON version_images;
DROP TRIGGER IF EXISTS design_system_versions_search_queue ON design_system_versions;
DROP TRIGGER IF EXISTS sites_search_queue ON sites;
DROP TRIGGER IF EXISTS site_versions_search_queue ON site_versions;
DROP TRIGGER IF EXISTS site_pages_search_queue ON site_pages;
DROP TRIGGER IF EXISTS site_sections_search_queue ON site_sections;

DROP FUNCTION IF EXISTS enqueue_search_from_app();
DROP FUNCTION IF EXISTS enqueue_search_from_app_category();
DROP FUNCTION IF EXISTS enqueue_search_from_category();
DROP FUNCTION IF EXISTS enqueue_search_from_image();
DROP FUNCTION IF EXISTS enqueue_search_from_version();
DROP FUNCTION IF EXISTS enqueue_search_from_version_child();
DROP FUNCTION IF EXISTS enqueue_search_index(integer, text);
DROP FUNCTION IF EXISTS enqueue_site_search_from_content();
DROP FUNCTION IF EXISTS enqueue_site_search_from_site();
DROP FUNCTION IF EXISTS enqueue_site_search_from_version();
DROP FUNCTION IF EXISTS enqueue_site_search_index(bigint);
