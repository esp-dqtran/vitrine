# Apps Updated-At Keyset Pagination Design

Date: 2026-07-26

## Goal

Make Apps infinite scroll fast, stable, and globally correct when the default ordering is **Updated At, newest first**.

The gallery must not paginate alphabetically and then re-sort only the pages already loaded. Every page must come from one server-owned ordering:

```text
updatedAt DESC, appId DESC
```

The same ordering contract applies to the initial page and every load-more request.

## Current behavior and measured problem

- `useApps` requests 24 apps at a time.
- Admin `/api/apps` and member `/api/catalog` currently use app-name cursors.
- `AppsDiscoveryPage` defaults to `latest`, then `filterAndSortApps` re-sorts only the accumulated client subset by `lastCapturedAt`.
- The first two live admin pages therefore contained almost entirely A-prefixed apps even though the database's newest apps were spread across the alphabet.
- Appending a page can move newly received cards above already rendered cards.
- A naive global query using `MAX(images.created_at)` over every screen took about 7.35 seconds. Replacing `ORDER BY name` with that aggregate is not acceptable.
- The Apps screen already uses an `IntersectionObserver` and makes zero `GET /api/jobs` requests.

## Chosen approach

Use indexed server-side keyset pagination. Select the next 24 app identities in global Updated At order first, then run the existing bounded summary and preview work only for those selected apps.

Do not add a denormalized `apps.last_captured_at` column in this change. Indexed latest-screen lookups preserve the database as the source of truth and avoid trigger/backfill drift.

## Updated At definition

`updatedAt` means the newest captured screen included by the current access boundary as of the cursor's `snapshotAt`:

- Admin catalog: newest `images.created_at <= snapshotAt` for a screen belonging to the app.
- Member catalog: newest `version_images.captured_at <= snapshotAt` from the latest version for each platform whose `published_at <= snapshotAt`.

Both API responses expose this value as `lastCapturedAt`, and the App card continues to display that value.

## Database indexes

Add indexes that let PostgreSQL find the newest eligible screen without scanning all historical screens:

```sql
CREATE INDEX images_screen_platform_created_idx
ON images (platform_id, created_at DESC, id DESC)
WHERE kind = 'screen';

CREATE INDEX version_images_version_captured_idx
ON version_images (version_id, captured_at DESC, image_id DESC);

CREATE INDEX app_versions_published_snapshot_idx
ON app_versions (app_id, platform, published_at DESC, version_number DESC)
WHERE published_at IS NOT NULL;
```

The migration is additive and non-destructive.

## Page selection

### Admin

For each eligible app, use indexed lateral lookups to find the newest screen at or before `snapshotAt` across its platforms. A screen added after the session begins is ignored when later pages reconstruct the snapshot. Order eligible apps by:

```sql
updated_at DESC, app_id DESC
```

Apply the keyset cursor and select `limit + 1` app identities. Only those identities proceed into count, platform, and preview aggregation.

### Member

Resolve the latest version published at or before `snapshotAt` per app and platform using `published_at`, so a later publication cannot replace the version used by an active pagination session. Use the indexed `version_images` lookup to find the newest captured screen at or before the same snapshot, then select app identities using the same ordering and cursor contract.

Published screen counts use the maintained `app_versions.screen_count` values from the selected latest published versions. Available platforms come from selected versions whose screen count is positive. Preview selection remains bounded to the selected apps and a maximum of three previews per app.

## Cursor contract

The cursor is opaque to the client and base64url-encodes a versioned JSON payload:

```json
{
  "v": 1,
  "sort": "updated",
  "snapshotAt": "2026-07-26T04:00:00.000Z",
  "updatedAt": "2026-07-26T03:14:54.618Z",
  "appId": 123
}
```

- `snapshotAt` is created on the first request and reused by all later pages.
- Every page reconstructs each app's newest eligible row as of that snapshot; rows and publications after it are ignored.
- `updatedAt` and `appId` form the stable descending keyset.
- Invalid, mismatched, or unsupported cursors return `400`.
- The API never accepts a raw SQL field or direction from the client.

The snapshot boundary prevents a crawler update during scrolling from duplicating, skipping, or moving cards within the active pagination session. A refresh starts a new snapshot.

## API contract

Both endpoints accept:

```text
cursor=<opaque cursor>
limit=<bounded page size>
```

Updated At is the only server pagination order in this change and is therefore the default without a query parameter. The cursor still records `"sort": "updated"` so it cannot later be reused by an incompatible ordering.

Responses preserve their current shapes and add or consistently populate:

```json
{
  "lastCapturedAt": "2026-07-26T03:14:54.618Z",
  "nextCursor": "<opaque cursor or null>"
}
```

The admin total remains available. No `/api/jobs` read is introduced.

## Frontend behavior

- Initial and load-more requests use the server's default Updated At order.
- Updated-order pages are appended exactly as returned.
- When the existing `Latest` tab is active, the client does not re-sort accumulated pages.
- Duplicate IDs are still filtered defensively at the merge boundary.
- The observer continues to use the browser viewport and begins prefetching before the sentinel is visible.
- The existing `Most popular` tab continues to sort the currently loaded snapshot by screen count. Globally paginated popularity is a separate backend ordering and is not added here.

## App card loading skeleton

Add a non-interactive `AppCardSkeleton` that matches the real card geometry:

- media frame
- logo
- title
- description
- Updated At / screen-count metadata row

Use six skeleton cards for the empty initial grid and three appended skeleton cards for load more. The load-more skeletons stay inside the same responsive grid so card positions do not collapse while the request is pending.

The loading region exposes one status label, does not add focusable content, and honors reduced-motion preferences. The existing small load-more spinner is removed.

## Error handling

- Keep already loaded cards visible if a later page fails.
- Surface the load-more error without discarding the active cursor snapshot.
- A retry uses the same cursor and snapshot.
- A first-page failure continues to use the existing full-page retry state.
- Aborted or stale requests cannot overwrite the currently active pagination snapshot.

## Testing

### Database and API

- First page is globally ordered by `updatedAt DESC, appId DESC`.
- Equal timestamps use the app ID tie-breaker.
- Page two has no duplicate or missing IDs relative to page one.
- A row updated after `snapshotAt` does not destabilize the active pagination session.
- Member pagination includes only published evidence.
- Invalid cursors and sort mismatches return `400`.
- Public and admin responses populate `lastCapturedAt`.
- Query-shape tests require the new indexes and reject a full unbounded image aggregate before page selection.

### Frontend

- Default request uses Updated At ordering.
- Accumulated pages are appended without re-sorting.
- Duplicate app IDs are ignored.
- Stale responses are ignored.
- Initial loading renders six App card skeletons.
- Load more renders three appended skeletons and no spinner.
- The observer triggers one request near the viewport.
- Apps continues to make zero `GET /api/jobs` requests.

### Verification

- Focused database, API, Apps hook, discovery, and boundary tests.
- TypeScript check.
- Production build.
- Authenticated browser verification that:
  - the first page contains the true newest apps across the alphabet;
  - scrolling emits one cursor request;
  - loaded cards remain in descending Updated At order;
  - skeletons appear during the delayed request;
  - no `GET /api/jobs` request occurs.

## Out of scope

- Changing app-detail Flows data loading. That surface fetches its complete flow set once and only progressively renders cards in the browser.
- Adding background polling.
- Changing crawler/admin monitoring endpoints.
- Adding globally paginated Most popular ordering.
- Committing or pushing the current dirty worktree.
