# Hierarchical Flow Data Migration Design

**Date:** 2026-07-27  
**Status:** Approved for planning  
**Scope:** Database schema and existing-data migration only

## Goal

Replace the aggregate JSONB flow storage with first-class app-flow rows and a
shared hierarchical `Flow` taxonomy. Migrate both current flows and historical
version snapshots. The application is not live, so the migration may replace
the old schema immediately without a compatibility or dual-write period.

Crawler discovery and TypeScript runtime updates are explicitly out of scope.
They will be implemented after the data migration.

## Existing Model

Current flows are stored as arrays of `DesignFlow` objects:

- `app_flows` has one row per `(app_id, platform)` and stores the array in
  `flows JSONB`.
- `app_flow_versions` has one row per `app_versions.id` and stores a historical
  array in `flows JSONB`.
- Each flow contains `id`, `title`, optional `category`, `description`, `tags`,
  `steps`, and optional `provenance` and `insights`.
- `DesignFlow.category` is a flow grouping such as `Settings` or `Account`. It
  is unrelated to the existing relational app `Category` entity, which
  classifies apps as Finance, Productivity, and similar catalog categories.

The inspected current dataset contains 105,378 current app flows. Of these,
87,733 have a category and 17,645 do not. The migration must derive hierarchy
without losing any current or historical flow object.

## Selected Architecture

### `flows`

`flows` stores the shared flow taxonomy:

| Column | Purpose |
| --- | --- |
| `id` | Surrogate primary key |
| `parent_id` | Nullable self-reference to `flows.id` |
| `name` | Deterministic display spelling |
| `normalized_name` | Exact normalized identity |
| `created_at` | Creation timestamp |

The self-reference permits arbitrary future depth. Existing data produces at
most two levels because it contains only `category` and `title`.

Two partial unique indexes enforce identity:

- Root flows are unique by `normalized_name` where `parent_id IS NULL`.
- Child flows are unique by `(parent_id, normalized_name)` where
  `parent_id IS NOT NULL`.

The same word may therefore exist once as a root and separately beneath
different parents. This is required because a title such as `Settings` can be a
top-level flow and can also be a child of another flow category.

### `app_flows`

`app_flows` becomes a row-per-flow table:

| Column | Purpose |
| --- | --- |
| `id` | Surrogate primary key |
| `app_id` | Owning app |
| `platform` | `ios`, `android`, or `web` scope |
| `source_flow_id` | Existing `DesignFlow.id` |
| `position` | Original JSON-array order |
| `title` | Original app-specific title |
| `source_category` | Original category spelling, nullable |
| `description` | Existing description |
| `tags` | Existing tags as JSONB |
| `steps` | Existing steps as JSONB |
| `provenance` | Existing provenance as JSONB, nullable |
| `insights` | Existing insights as JSONB, nullable |
| `updated_at` | Last update timestamp |

`(app_id, platform, source_flow_id)` is unique. Keeping the original category
and title on the app-flow row makes the migration lossless even when canonical
display spelling differs.

### `app_flow_mappings`

`app_flow_mappings` is the N-N junction between app-specific flow rows and
canonical `flows`:

- Primary key: `(app_flow_id, flow_id)`
- Both foreign keys cascade on deletion.

Each migrated app flow initially receives exactly one mapping. The N-N shape is
retained because future crawler logic may map one observed flow to multiple
canonical flows.

### Historical versions

The aggregate historical table is replaced by:

- `app_flow_versions`: one immutable row per flow inside an app version,
  containing `version_id`, `source_flow_id`, `position`, and the same preserved
  content fields as `app_flows`.
- `app_flow_version_mappings`: N-N mappings from historical flow rows to the
  same canonical `flows` table.

`(version_id, source_flow_id)` is unique. Historical rows do not reference the
mutable current `app_flows` row because a later current-flow update must not
change an older snapshot.

## Name Normalization and Hierarchy Rules

Normalization performs only:

1. Trim leading and trailing whitespace.
2. Collapse consecutive whitespace to one space.
3. Convert to lowercase for identity comparison.

There is no fuzzy matching, stemming, synonym mapping, or punctuation rewrite.
The canonical display `name` is the most frequent spelling after trimming and
collapsing whitespace, while preserving letter case. Ties are resolved
lexicographically so the result is deterministic. The app-flow row separately
retains the unmodified source title and category.

For each current or historical flow:

1. If `category` is non-empty and differs from `title` after normalization:
   - Create or reuse a root `Flow` from `category`.
   - Create or reuse a child `Flow` from `title` under that root.
   - Map the app-specific row to the child.
2. If `category` is absent or empty:
   - Create or reuse a root `Flow` from `title`.
   - Map the app-specific row directly to that root.
3. If normalized `category` equals normalized `title`:
   - Create or reuse one root `Flow`.
   - Map the app-specific row to it.
   - Do not create a self-reference.

Canonical names are shared globally across apps and platforms according to
these exact normalized identities.

## Transactional Migration

The migration uses replacement tables inside one transaction:

1. Lock the two legacy aggregate tables against writes.
2. Create replacement taxonomy, row, and mapping tables.
3. Expand current JSON arrays with `jsonb_array_elements(... WITH ORDINALITY)`.
4. Expand historical JSON arrays in the same way.
5. Calculate deterministic canonical spellings from the combined current and
   historical values.
6. Insert root flows, then child flows.
7. Insert current app-flow rows and their mappings.
8. Insert historical flow rows and their mappings.
9. Run all migration invariants.
10. Replace SQL triggers and preview-refresh functions that currently read
    `app_flow_versions.flows`.
11. Drop the aggregate tables and promote the replacement tables to their final
    names.
12. Commit.

Any failed invariant raises an exception before the old tables are dropped,
causing the transaction to roll back.

## Database Dependencies

The migration must update database-owned dependencies, even though application
logic remains out of scope:

- Recreate `app_flow_versions_search_queue` on row-level historical changes.
- Update public facet preview SQL to read `app_flow_versions.steps`, `title`,
  `description`, and `tags` directly rather than expanding an aggregate
  `flows` array.
- Preserve the existing search-enqueue behavior by resolving each historical
  row through its `version_id`.

Earlier migration files are not rewritten. A new forward migration performs
the replacement for existing and newly created databases.

## Validation and Failure Conditions

The transaction aborts unless all of these hold:

- Current row count equals the total number of elements in legacy
  `app_flows.flows`.
- Historical row count equals the total number of elements in legacy
  `app_flow_versions.flows`.
- Every migrated current and historical row has exactly one initial canonical
  mapping.
- No migrated row has an empty `source_flow_id` or title.
- No `flows` row references itself.
- Every child has an existing root parent.
- Reconstructed content fields equal the original JSON fields.
- Original array order is preserved by `position`.
- Existing relational app categories and app-category assignments are
  unchanged.

Duplicate source IDs within the same app/platform or version are treated as
invalid source data and abort the migration rather than being silently merged.

## Testing

Migration tests will cover:

- Categorized flow to root-plus-child mapping.
- The same normalized category and title shared across apps.
- The same title beneath different parents remaining distinct children.
- An uncategorized title becoming a root.
- A category equal to its title avoiding a self-cycle.
- Case and whitespace normalization without fuzzy merging.
- Current and historical content preservation, including optional fields.
- Original ordering through `position`.
- Duplicate source IDs and missing required fields causing rollback.
- Updated search trigger and public facet preview SQL using the row model.
- A full migration fixture proving the replacement tables no longer contain
  aggregate `flows` columns and the existing app `categories` tables are
  unchanged.

## Non-Goals

- Updating crawler extraction or Mobbin Search crawling.
- Updating TypeScript stores, APIs, or UI queries to use the new tables.
- Introducing fuzzy taxonomy matching or manual taxonomy administration.
- Mapping the new flow hierarchy to the existing app `Category` entity.
- Supporting reads from both the aggregate and normalized models.
