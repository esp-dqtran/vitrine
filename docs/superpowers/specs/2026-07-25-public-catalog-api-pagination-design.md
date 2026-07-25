# Public Catalog API Pagination Design

## Goal

Make the public Apps catalog load reliably and quickly after all 1,192 apps and
1,787 app-platform versions are published, without changing the frontend
response shape, public access policy, cursor semantics, or zero-polling
contract.

## Current Failure

`GET /catalog` accepts `cursor` and `limit`, but calls `publishedImages()` before
using either value. `publishedImages()` selects every screen in every latest
published app version and uses a correlated latest-version subquery. The API
then groups and paginates the complete result in memory.

With no published versions this path was cheap. With every version published,
PostgreSQL exceeds the configured statement timeout, Express returns 500, and
an upstream proxy can surface the same failure as 502. `GET /catalog/stats`
uses the same correlated latest-version pattern and also times out.

The live catalog currently has no curated `app_preview_images`, so an optimized
route that reads only curated previews would return empty cards and would not
support category hover previews.

## Architecture

Replace the full-catalog read with a bounded database page:

1. Decode the opaque app-name cursor and clamp the requested limit to 1–24.
2. Select at most `limit + 1` published app names that have at least one
   published screen, ordered by canonical app name.
3. Use the extra name only to decide whether a next cursor exists.
4. For the selected page names, resolve the latest published version for each
   app and platform with a set-based `DISTINCT ON` query.
5. Aggregate total screen count and available platforms only for those latest
   versions.
6. Return at most three preview screens per app. Prefer curated preview ranks
   when present; otherwise fall back deterministically to the newest captured
   screens.
7. Build the existing `CatalogPage` JSON shape from those bounded records.

The API route will call one repository function that returns the bounded
catalog page data. It will no longer call `publishedImages()` or
`publishedPreviewImages()` for public catalog listing.

## Cursor and Ordering

The external cursor remains a base64url-encoded app name. App ordering remains
ascending by canonical app name. The database query uses `app.name > cursor`
and requests `limit + 1` names. The extra row is not returned; it proves that a
later page exists. The response cursor is encoded from the final returned app
name.

Invalid cursor bytes remain non-fatal and behave like the first page, matching
the current catalog builder.

## Response Compatibility

`GET /catalog` continues to return:

```ts
interface CatalogPage {
  apps: Array<{
    id: string;
    app: string;
    cat: string;
    accent: string;
    totalScreens: number;
    platforms: string[];
    previewScreens: CatalogScreen[];
    websiteUrl: string | null;
    iconUrl: string | null;
  }>;
  nextCursor: string | null;
}
```

No raw object keys, source image URLs, storage references, or admin-only
metadata are exposed. Preview media URLs continue to use public API routes.

## Preview Selection

For each app:

- Use curated `app_preview_images` in rank order when they exist.
- Fill any remaining slots, up to three, from captured screens in the latest
  published app-platform versions.
- Deduplicate by image ID.
- Order fallback screens by capture time descending and image ID descending so
  selection is stable.

This makes the current catalog usable immediately even though the published
dataset has no curated preview rows.

## Stats Query

Rewrite `catalogStats()` to:

1. Resolve latest published versions once with `DISTINCT ON (app_id, platform)`.
2. Join `version_images` and `images` once.
3. Aggregate distinct apps, screens, and UI elements without a correlated
   subquery.

The existing indexes on
`app_versions(app_id, platform, status, version_number DESC)` and
`version_images(version_id, image_id)` support this shape. No speculative
migration is required. If live `EXPLAIN ANALYZE` after implementation shows a
remaining index gap, add a narrowly justified migration before deployment.

## Error Handling

- Clamp invalid limits to the existing 1–24 range.
- Treat malformed cursors as the first page.
- Preserve Express error middleware behavior for genuine database failures.
- Do not add retries, polling, or a cache that could hide a consistently
  expensive query.
- The frontend retains its existing retry action and error message.

## Tests

Add coverage proving:

- The public route calls the bounded page dependency and does not call the
  legacy full-catalog readers.
- First and later pages preserve app-name cursor ordering and a maximum of 24
  apps.
- Captured screens fill preview slots when curated previews are absent.
- Curated previews remain preferred and duplicate images are removed.
- The response does not expose raw storage or source fields.
- The stats SQL uses one set-based latest-version relation and contains no
  correlated `MAX(latest.version_number)` lookup.
- Public `/catalog` and `/catalog/stats` remain accessible without a session.

Run focused gallery, database-boundary, API, and frontend tests, followed by
TypeScript checks and production builds.

## Runtime Verification

Rebuild and restart the local API container, then verify:

- `GET http://127.0.0.1:3010/catalog?limit=3` returns 200 within the API
  statement timeout.
- `GET http://127.0.0.1:3010/catalog/stats` returns 200.
- `http://127.0.0.1:5173/apps` renders app cards rather than loading or error
  state.
- A later cursor page returns different apps.
- Browser console contains no catalog request error.
- Hovering a taxonomy value with a matching loaded preview shows the GSAP
  image preview.

## Scope

This change optimizes the public Apps catalog and catalog stats paths. It does
not change Sites APIs, member-only app detail endpoints, background job
polling, publication workflow, or unrelated discovery toolbar work already
present in the checkout.
