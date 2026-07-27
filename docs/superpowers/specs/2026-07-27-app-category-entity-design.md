# Astryx App Category Entity Design

**Date:** 2026-07-27
**Status:** Approved

## Purpose

Replace the single `apps.category` text column with a first-class Category
entity and a many-to-many relationship between Apps and Categories.

The database model stays deliberately small. It records only Categories and
their App relationships. It does not store confidence, evidence, assignment
source, review state, ordering, or a primary Category.

## Approved decisions

- Category is a separate entity.
- Apps and Categories have a many-to-many relationship.
- The only new tables are `categories` and `app_categories`.
- Every Category has a stable numeric ID, display name, and URL-safe slug.
- All Categories assigned to an App are equal; there is no primary Category.
- The relationship stores no metadata beyond its two foreign keys.
- Deleting an App removes its Category relationships.
- Deleting a Category removes its App relationships.
- The existing 28 App Category values seed the Category table.
- This change applies only to App Categories. Site categories and styles,
  Screen metadata, Component categories, and Flow grouping are unchanged.

## Verified current state

The configured Astryx application database currently contains:

- 1,190 Apps.
- 1,190 categorized Apps.
- 28 distinct Category values.
- No empty Category values.
- No case or spelling variants among the 28 values.

The current schema stores one nullable Category string on `apps.category`.
Catalog queries, public facet previews, import persistence, search projection,
and Vitrine types read that string directly. Advanced Search already represents
App Category filters as arrays, so it can consume multiple Categories after the
data source changes.

## Database model

```sql
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
    CHECK (name = btrim(name) AND name <> ''),
  slug TEXT NOT NULL
    CHECK (
      slug = btrim(slug)
      AND slug = lower(slug)
      AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    )
);

CREATE UNIQUE INDEX categories_name_lower_unique
  ON categories (lower(name));

CREATE UNIQUE INDEX categories_slug_lower_unique
  ON categories (lower(slug));

CREATE TABLE app_categories (
  app_id INTEGER NOT NULL
    REFERENCES apps(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL
    REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (app_id, category_id)
);

CREATE INDEX app_categories_category_id_app_id_idx
  ON app_categories (category_id, app_id);
```

The composite primary key prevents duplicate assignments. Its leading
`app_id` supports loading Categories for an App. The reverse index supports
filtering Apps by Category and calculating Category counts.

No timestamps are added because the product does not currently need Category
history or relationship history.

## Category identity

- `id` is the database identity used by foreign keys.
- `name` is the human-readable label, such as `Health & Fitness`.
- `slug` is the stable URL and API identity, such as `health-fitness`.
- Category matching during migration and ingestion is case-insensitive.
- Category names and slugs are trimmed before persistence.
- The database rejects duplicate names or slugs that differ only by case.

Renaming a Category changes its display name without changing its ID or slug.
Changing a slug is an explicit management action because it may invalidate
saved URLs.

## Application data contract

App responses replace the single Category string with a Category array:

```typescript
interface Category {
  id: number;
  name: string;
  slug: string;
}

interface App {
  // Existing App fields.
  categories: Category[];
}
```

Categories are returned in case-insensitive name order. The order does not
carry product meaning.

An App may have zero, one, or multiple Categories. Consumers must render an
empty array safely and must not infer a primary Category from array position.

## Persistence behavior

When an import or application workflow has resolved Category names for an App,
the persistence boundary:

1. Resolves each normalized Category name to `categories.id`.
2. Creates a missing Category with its canonical slug when the calling workflow
   permits a new Category.
3. Inserts the `(app_id, category_id)` relationship with conflict-ignore
   semantics.
4. Replaces stale relationships only when the caller explicitly supplies the
   complete Category set for that App.

The database stores only the final relationship. Any process that decides which
Categories belong to an App remains outside these two tables.

## Read behavior

Catalog and App-detail queries aggregate Category records through
`app_categories`.

- Public Apps discovery filters by Category slug or ID.
- API responses return Category objects.
- Search documents continue to project Category names into
  `catalog_categories`.
- Category counts use `COUNT(DISTINCT app_id)` grouped by Category.
- Public facet previews join through `app_categories` rather than comparing
  `lower(apps.category)`.
- App cards and metadata render all assigned Category names where Category
  metadata is shown.

No consumer may select an arbitrary first relationship as a primary Category.

## Migration and rollout

Use an expand-and-contract rollout so the current application remains
compatible throughout deployment.

### Phase 1: expand and backfill

1. Create `categories` and `app_categories`.
2. Insert the 28 distinct trimmed values from `apps.category` with deterministic
   slugs.
3. Insert one `app_categories` row for every current App.
4. Keep `apps.category` temporarily.
5. Verify the backfill before deploying new readers.

Required live verification:

```text
categories                         = 28
apps                               = 1,190
app_categories                     = 1,190
categorized apps missing a join    = 0
duplicate app/category joins       = 0
```

### Phase 2: migrate application consumers

Update category reads and writes in these seams:

- App metadata persistence in `src/db.ts` and `src/publicPageStore.ts`.
- Catalog aggregation in `src/gallery.ts` and `src/publicCatalogStore.ts`.
- Public Category preview lookup in `src/publicFacetPreviewStore.ts`.
- Search projection and index persistence in `src/searchProjection.ts` and
  `src/searchIndexStore.ts`.
- Vitrine App types, discovery filtering, App detail metadata, and search
  filters under `src/vitrine`.
- Mobbin and public-page ingestion that currently writes `apps.category`.

During this phase, writes maintain the relationship tables. The legacy column
exists only for rollback compatibility and must not remain the source of truth.

### Phase 3: contract

After production verification:

1. Confirm every category-reading endpoint uses the relationship tables.
2. Confirm imports no longer write `apps.category`.
3. Rebuild or refresh search documents from the new Category relationships.
4. Drop `apps.category` in a later migration.
5. Re-run the catalog, search, and facet-count verification.

The legacy column is not dropped in the same rollout that introduces the new
read path.

## Category management behavior

The management surface needs only CRUD and relationship management:

- Create a Category.
- Rename a Category.
- Change a Category slug with an explicit warning.
- Delete a Category and its App relationships.
- Attach one or more Categories to an App.
- Remove a Category from an App.
- List Apps in a Category.
- Show the distinct App count for each Category.

No confidence, evidence, review, AI, merge, alias, retirement, or primary
Category behavior is part of this design.

## Error handling

- Duplicate normalized names or slugs return a conflict.
- Assigning a missing App or Category returns not found.
- Repeating an existing assignment succeeds without creating a duplicate.
- Removing a missing assignment is idempotent.
- Deleting a Category clearly reports the number of affected App relationships
  before confirmation in an administrative UI.
- An ingestion Category that cannot be normalized is rejected instead of
  creating a blank Category.

## Testing and verification

### Database

- Backfill all existing Category strings without loss.
- Enforce case-insensitive Category name and slug uniqueness.
- Prevent duplicate App-to-Category relationships.
- Cascade relationship deletion from both parent tables.
- Support multiple Categories on one App.
- Preserve Apps when a Category is deleted.

### Stores and API

- Return empty, single, and multiple Category arrays.
- Create and remove App-to-Category relationships.
- Aggregate deterministic Category arrays in catalog responses.
- Filter Apps through `app_categories`.
- Calculate distinct App counts per Category.

### Search and discovery

- Project every assigned Category into `catalog_categories`.
- Filter Apps carrying any selected Category.
- Preserve multi-value Category filters.
- Build public facet previews through the relationship table.
- Keep Category counts consistent between discovery and search.

### Migration acceptance

- The live database has 28 Categories after backfill.
- All 1,190 existing Apps retain their current Category relationship.
- No App becomes uncategorized because of the migration.
- Existing public catalog, App detail, Category filtering, and Advanced Search
  remain functional before the legacy column is removed.

## Out of scope

- Category hierarchy or parent Categories.
- Category ordering.
- Primary Categories.
- Assignment metadata.
- AI confidence or evidence.
- Review queues.
- Category aliases, merging, or retirement.
- Category history or audit logs.
- Site, Screen, Component, or Flow taxonomy changes.
- Copying Mobbin's Category-management interface.
