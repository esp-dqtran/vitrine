# Admin Users Directory and Usage Analytics Design

## Goal

Make the admin Users surface useful for two jobs:

1. Manage a growing account directory without splitting administrators and members into separate visual groups.
2. Understand which product features people use most, both globally and for an individual account.

The implementation must preserve the existing member-first visual language, use Astryx design-system controls, and record only meaningful server-side product actions. It must not introduce session replay, keystroke capture, or content capture.

## User experience

### Unified directory

- Render all matching accounts in one continuous list ordered by `created_at DESC, id DESC`.
- Keep the role, plan, and active/disabled indicators on each row so removing group headings does not remove account context.
- Keep email search and the existing All, Administrators, Pro, Free, and Disabled filters.
- Search and filters are server-backed. A change to either resets the cursor and replaces the current results.
- Load 30 rows initially. An intersection sentinel requests the next cursor page when it approaches the viewport.
- Show a small loading row while fetching another page and an end-of-results message after the last page.
- Prevent duplicate requests and deduplicate rows by user ID when pages are appended.
- The count reads `N of total shown`, where `N` is the number currently rendered and `total` is the server count for the active query and filter.

### Account actions

- Add an Actions menu to every row.
- The menu has exactly one state-changing command:
  - Active account: `Disable account`
  - Disabled account: `Enable account`
- Disabling requires confirmation and names the target email.
- Enabling can run directly from the menu.
- While the request is pending, disable repeated actions for that row.
- On success, update the row in place and refetch the active directory query so counts remain correct.
- On failure, keep the old state and show an accessible inline error.
- The API must reject attempts to disable the signed-in administrator or the last active administrator.
- Disabling an account revokes all of that account's live sessions in the same transaction.

### Global usage insights

- Keep the right-side insights column and add two tabs: `Feature usage` and `Growth`.
- Default to `Feature usage`; Growth preserves the existing signup chart and metrics.
- Feature usage provides a 7-day, 30-day, and 90-day range selector, defaulting to 30 days.
- Show:
  - total tracked uses;
  - unique active users;
  - number of used features;
  - a daily usage trend;
  - ranked feature rows with use count, unique-user count, and share of tracked usage.
- Exclude administrator activity from product-adoption totals so internal use does not inflate the result.
- If no events exist in the range, explain that usage will appear after members use tracked features.

### Per-user usage drill-down

- Clicking a member's identity opens an accessible side drawer. The account Actions menu remains reserved for enable/disable only.
- The drawer shows email, role, plan, account state, last active time, total tracked uses, most-used features, and recent activity for the selected range.
- Recent activity uses human-readable feature and action labels. It never displays captured user-entered text or private content.
- Loading and error states stay inside the drawer so the directory remains usable.

## API contracts

### Paginated directory

`GET /users?limit=30&cursor=<opaque>&q=<email>&filter=<filter>`

Response:

```json
{
  "users": [],
  "nextCursor": "opaque-or-null",
  "total": 0
}
```

- `limit` is clamped to 1–50.
- The opaque cursor encodes the last row's `created_at` and `id`; clients do not inspect it.
- Query and filter parameters are applied before both pagination and total counting.
- Invalid filters or malformed cursors return `400`.
- The database query uses parameterized predicates and the stable `(created_at, id)` ordering.

### Account state

`PATCH /users/:id/active`

Request:

```json
{ "active": false }
```

Response: the updated admin-user row.

Errors:

- `400` for invalid IDs or payloads;
- `403` for self-disable or last-active-admin protection;
- `404` when the account does not exist.

The update and session revocation execute in one transaction.

### Global analytics

`GET /users/usage?range=30d`

Response:

```json
{
  "summary": {
    "totalEvents": 0,
    "uniqueUsers": 0,
    "usedFeatures": 0
  },
  "features": [
    {
      "key": "exports",
      "label": "Exports",
      "uses": 0,
      "uniqueUsers": 0,
      "share": 0
    }
  ],
  "daily": [{ "day": "2026-07-19", "uses": 0 }]
}
```

### Per-user analytics

`GET /users/:id/usage?range=30d`

Response:

```json
{
  "summary": {
    "totalEvents": 0,
    "lastActiveAt": null
  },
  "features": [],
  "recentEvents": []
}
```

- Supported ranges are exactly `7d`, `30d`, and `90d`.
- Analytics endpoints are administrator-only.
- Unknown users return `404`.

## Event model

Reuse `access_events` as the durable analytics source.

- Add a nullable, indexed `feature_key` column for a stable product-feature taxonomy.
- Add `metadata JSONB NOT NULL DEFAULT '{}'` for bounded, non-sensitive event context.
- Keep `action`, `outcome`, `volume`, `app_slug`, `user_id`, and `created_at` for specific operations and aggregation.
- New event writes must use a known feature key. Unknown keys are rejected at the application boundary.
- Historical rows are included when their existing action maps cleanly to a feature; broad `protected-request` events are excluded from feature rankings.

Initial feature taxonomy:

| Feature key | Label | Meaningful server-side events |
| --- | --- | --- |
| `library` | App library | Member opens an app or screen detail |
| `search` | Search | Member completes a catalog search request |
| `collections` | Collections | Member creates a collection or saves/removes an item |
| `exports` | Exports | Member reserves or completes an export |
| `research` | Research projects | Member creates or materially updates a research project |
| `design_systems` | Design systems | Member opens or exports a generated design system |
| `flows` | Flows | Member opens or exports a product flow |
| `ai_analysis` | AI analysis | Member starts an AI-assisted analysis or synthesis operation |

Only successful or accepted product operations count toward feature rankings. Failures may remain in `access_events` for operational diagnosis but are excluded from adoption metrics.

## Frontend structure

- Replace the grouped `MemberDirectory` rendering with one semantic list.
- Replace the all-users fetch inside `useUsersGrowth` with a dedicated paginated directory hook. Growth remains independently fetchable.
- Add a usage-insights hook keyed by range.
- Add a per-user usage hook that activates only while the drawer is open.
- Keep search input local and debounce server requests by 250 ms. Filter changes apply immediately.
- Use `AbortController` or an equivalent request-generation guard so stale query results cannot overwrite newer ones.
- Use Astryx `TextInput`, `Selector`, `Button`, menu, dialog/drawer, badge, icon, and spinner primitives. No production native interactive controls are introduced.

## Accessibility and responsive behavior

- The list remains a semantic list; every Actions trigger has an accessible name containing the user's email.
- The infinite-scroll sentinel is supplemental. A keyboard-accessible `Load more` control remains available and shares the same request path.
- Announce appended result counts and action results through a polite live region.
- The disable confirmation traps focus and restores focus to the invoking row.
- The usage drawer has a labelled title, Escape dismissal, and focus restoration.
- At narrow widths, row metadata wraps without horizontal scrolling, Actions remains reachable, and the insights column follows the directory.

## Error handling

- Initial directory failure shows the existing retry state.
- Next-page failure keeps loaded users visible and offers `Try again` at the list footer.
- Analytics failure does not block directory management; the insights panel offers its own retry action.
- A per-user analytics failure stays inside the drawer.
- Enable/disable failures never optimistically change the account state.

## Testing and verification

- Store tests cover cursor ordering, email search, every filter, limit clamping, malformed cursors, and total counts.
- Account-state tests cover enable, disable, session revocation, self-disable rejection, last-active-admin rejection, and not-found behavior.
- Analytics store tests cover range boundaries, admin exclusion, stable feature aggregation, unique-user counts, shares, daily series, and historical-action mapping.
- API tests cover authorization, validation, response contracts, and error status mapping.
- Frontend model and component tests cover one continuous list, appended pages, deduplication, query reset, action labels, confirmation, usage tabs, empty states, and drawer content.
- The Astryx native-control compliance test must remain green.
- Browser verification covers desktop and 390 px layouts, search/filter reset, infinite loading, enable/disable confirmation, usage range changes, per-user drill-down, keyboard access, and console errors.
- Run focused tests, the full test suite, and the production build before completion.

## Out of scope

- Role changes, account deletion, invitations, impersonation, password reset, billing changes, session replay, click heatmaps, keystroke capture, and third-party analytics services.
- Real-time streaming dashboards; analytics are request-based aggregates over PostgreSQL.
- Custom date ranges in the first version.
