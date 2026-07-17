# Catalog Database Repair Design

## Problem

The four `scripts/catalog-import.ts` workers were launched without `DATABASE_URL`. `src/db.ts` therefore connected them to the local PostgreSQL fallback, while the API and UI connect to Supabase through `.env`. The crawler state counts completed Mobbin app-platform jobs, but the admin UI groups screen rows from the API database by app slug. This left newly crawled catalog rows in local PostgreSQL and the UI fixed at the 254 apps already present in Supabase.

## Chosen repair

Gracefully drain the four workers, back up both databases, merge the crawler-owned relational slice from local PostgreSQL into Supabase by natural keys, and restart the workers with `.env` loaded. The merge is idempotent so it can be dry-run, applied once, and safely rerun for verification.

The merge copies only:

- app metadata (`apps`)
- app-platform identities (`platforms`)
- S3 object metadata referenced by images (`stored_objects`)
- screen, UI-element, and flow-step metadata (`images`)
- active draft membership and capture context (`app_versions`, `version_images`)
- legacy crawler flow sets (`app_flows`)

It does not modify users, sessions, subscriptions, billing, collections, exports, research projects, crawl orchestration records, or published versions. Existing Supabase rows win for non-null curated metadata. Local crawler images and flows are merged into each target app-platform's active draft; published versions remain unchanged.

## Data flow

1. Source pool reads the local PostgreSQL database.
2. Target pool connects to Supabase using `DATABASE_URL` from `.env`.
3. A preflight computes source/target counts and rejects identical source and target databases.
4. Each source app-platform is merged in one target transaction:
   - upsert app and platform by natural key;
   - upsert referenced object metadata by object key, rejecting metadata conflicts;
   - upsert images by `(platform_id, image_url)`;
   - ensure one active draft exists when needed;
   - attach images to that draft with capture metadata;
   - upsert the app-platform flow set.
5. Verification compares source natural keys with the target and reports any missing app-platform, image, object, or flow records.

## Failure handling

- Both databases receive timestamped custom-format `pg_dump` backups before mutation.
- Workers remain stopped during backup and merge.
- Every app-platform merge is transactional; a failure rolls back that app-platform only and stops the repair.
- Object-key metadata conflicts are fatal because silently repointing immutable S3 keys would corrupt media serving.
- The restart command must load `.env`; a preflight prints only whether `DATABASE_URL` is set, never its value.

## Verification

- A regression test proves the merge is idempotent and preserves existing target rows while adding missing crawler rows.
- Dry-run reports planned app-platform/image/object/flow counts without target writes.
- Post-merge verification reports zero missing source natural keys in Supabase.
- `/api/apps` returns the merged admin catalog count.
- All four restarted worker processes expose `DATABASE_URL=set` and connect away from `localhost:5432`.
- Worker logs resume from saved state without reprocessing completed jobs.

