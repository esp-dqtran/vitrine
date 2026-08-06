-- Drops the adaptive search index and its ingest queues.
--
-- search_documents was a denormalized projection (951k rows / 1.25 GB, 32% of the
-- database) rebuilt from apps, screens, flows, and sites by the search-index-worker.
-- It held no source data: every row was derived, so dropping it loses nothing that
-- cannot be regenerated from the tables it projected from.
--
-- The embedding column was never populated (0 of 951,775 rows) and its HNSW index
-- never served a scan, so the pgvector dependency goes with it. The search feature
-- is being rebuilt from scratch; the projection modules (searchProjection.ts,
-- siteSearchProjection.ts) and the shared types are deliberately kept for reuse.

DROP TABLE IF EXISTS search_documents;
DROP TABLE IF EXISTS search_index_queue;
DROP TABLE IF EXISTS site_search_index_queue;
