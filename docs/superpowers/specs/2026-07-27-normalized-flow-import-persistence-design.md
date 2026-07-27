# Normalized Flow Import Persistence Design

**Date:** 2026-07-27
**Status:** Approved for implementation planning
**Scope:** Future Apps crawl and import writes only

## Goal

Update every future Apps crawl and import path to persist `DesignFlow` data into
the normalized hierarchy introduced by migration 0034:

- shared canonical `flows` with parent and child relationships;
- row-per-flow `app_flows` for current app/platform state;
- N-N `app_flow_mappings`;
- row-per-flow `app_flow_versions` for immutable version snapshots; and
- N-N `app_flow_version_mappings`.

The existing database migration is complete. This work does not backfill,
re-migrate, or repair rows that migration 0034 already converted.

## Current Problem

The schema is normalized, but several future write paths still use the removed
aggregate contract:

```sql
INSERT INTO app_flows (..., flows) VALUES (..., $json_array)
```

Those paths include bulk/Mobbin import, planned and smart crawling, autonomous
crawling, App Knowledge flow analysis, version publication, API-reviewed Flow
updates, and catalog database import tooling. They will fail on the new schema
or bypass its hierarchy and mappings.

Some worker and verification reads also still expect an aggregate `flows`
column. They must use the normalized reader so a newly imported result can move
through verification, analysis, publication, and feature-document generation.

## Selected Architecture

Create one normalized Flow persistence boundary used by every future Apps flow
producer. It owns validation, hierarchy resolution, row persistence, mapping
replacement, ordering, and transaction behavior.

The boundary exposes three operations:

```typescript
replaceCurrentFlows(input: {
  appId: number;
  platform: Platform;
  flows: DesignFlow[];
}): Promise<void>

mergeCurrentFlows(input: {
  appId: number;
  platform: Platform;
  flows: DesignFlow[];
}): Promise<DesignFlow[]>

replaceVersionFlows(input: {
  versionId: number;
  flows: DesignFlow[];
}): Promise<void>
```

The operations accept an existing transaction client. Public wrappers may open
a transaction, but composed workflows such as App Knowledge analysis and
publication use the same client for all related writes.

### Why a central boundary

- The migration's hierarchy rules have one implementation.
- All producers receive identical validation and mapping behavior.
- Replace and merge semantics are explicit.
- A failure rolls back content rows and mappings together.
- Tests can prove the persistence contract once and separately prove that each
  producer delegates to it.

Inline SQL in every writer and database compatibility triggers are rejected
because they duplicate or hide the new model.

## Validation

Validate the complete incoming payload before the first mutation:

- `flows` must be an array.
- Every flow must have a non-empty source `id` and `title`.
- Source IDs must be unique within the incoming scope.
- `description` must be a string.
- `tags` and `steps` must be arrays.
- Optional `category` is either absent or a string.
- Optional `provenance` and `insights` must be JSON-serializable.
- The full payload must be JSON-serializable.

Invalid input fails the operation. It is never silently deduplicated or
partially persisted.

## Canonical Hierarchy Resolution

Use migration 0034's exact identity normalization:

1. Trim leading and trailing whitespace.
2. Collapse consecutive whitespace to one space.
3. Lowercase the result for identity comparison.

Do not apply fuzzy matching, synonym expansion, stemming, punctuation
rewriting, or AI classification.

For each incoming flow:

1. A non-empty category different from the title creates or reuses a root
   category and a child title beneath it. The app-specific row maps to the
   child.
2. A missing or empty category creates or reuses a root from the title.
3. A category equal to the title after normalization creates or reuses one
   root and never creates a self-reference.

Existing canonical names remain stable. A newly created canonical row uses the
incoming trimmed and whitespace-collapsed spelling. Future imports do not
rename shared taxonomy rows merely because a different app uses another
spelling.

Every app-flow or version-flow row written by this implementation receives
exactly one canonical mapping. The junction tables remain N-N for future
curator or classification features, but this importer does not infer multiple
mappings.

## Current Flow Operations

### Full replacement

`replaceCurrentFlows` is authoritative for one app/platform scope:

1. Lock the owning app row.
2. Validate all incoming flows.
3. Resolve canonical hierarchy rows.
4. Upsert `app_flows` by `(app_id, platform, source_flow_id)`.
5. Set `position` from the incoming array order.
6. Replace each affected row's canonical mapping.
7. Delete current rows in that app/platform scope whose source IDs are absent
   from the incoming list.

An empty list is valid and clears current rows for an app/platform that a
complete crawl proves is flowless.

This operation is used by complete Mobbin/bulk imports, reviewed API imports,
smart/planned crawl finalization, and other complete-snapshot producers.

### Partial merge

`mergeCurrentFlows` is used only by producers that intentionally return a
partial set, currently autonomous crawling:

1. Lock the owning app row.
2. Read the existing normalized rows in position order.
3. Replace existing flows with matching source IDs and append new IDs.
4. Persist the merged list using the same normalized replacement machinery.
5. Return the merged `DesignFlow[]`.

Flows absent from the partial payload remain unchanged.

## Version Flow Operations

`replaceVersionFlows` is authoritative for one `app_versions.id`:

1. Lock the app-version row.
2. Validate all incoming flows.
3. Resolve canonical hierarchy rows.
4. Upsert `app_flow_versions` by `(version_id, source_flow_id)`.
5. Preserve incoming order through `position`.
6. Replace each version row's mapping.
7. Delete version rows absent from the incoming list.

Historical version rows never reference mutable `app_flows` rows.

App Knowledge analysis replaces its version rows. If the selected version is
`draft` or `in_review`, it also replaces current rows for that app/platform in
the same transaction.

Publication copies the normalized current Flow content into normalized version
rows. It does not recreate an aggregate JSON array.

## Producer Integration

| Producer | Persistence behavior |
| --- | --- |
| `src/bulkDownload.ts` Mobbin Flow stage | Complete current replacement through `saveAppFlows` |
| `scripts/catalog-import.ts` | Uses the bulk stage; no independent Flow SQL |
| `services/import-worker/src/pipeline.ts` | Uses the bulk stage; no independent Flow SQL |
| `src/flows.ts` CLI manifest import | Complete current replacement |
| `src/smartCrawler.ts` | Complete current replacement |
| `src/crawlStore.ts::saveWorkerAppFlows` | Complete current replacement inside the locked run transaction |
| `src/autonomousStore.ts::saveAutonomousFlows` | Partial current merge |
| `src/db.ts::saveAnalyzedAppFlows` | Version replacement plus current replacement for active versions |
| `services/api/src/app.ts` reviewed Flow update | Complete current replacement |
| `src/db.ts::publishAppVersion` | Normalized version replacement |
| `scripts/merge-catalog-databases.ts` | Imports normalized rows and mappings through the central boundary |

Existing public function names may remain as narrow adapters where that avoids
unrelated call-site churn, but no adapter may write an aggregate `flows`
column.

## Reader and Verification Integration

New imports must remain usable throughout the active pipeline:

- Reconstruct `DesignFlow[]` from normalized rows ordered by `position`.
- Update import-worker feature-source manifests to use the normalized current
  or version reader.
- Update catalog verification to count row-per-flow records and validate step
  evidence directly.
- Verify every imported current and version row has a canonical mapping.
- Preserve the per-app verification gate for Screens, UI Elements, Flows, and
  referenced evidence.

This work does not redesign UI reads. It only updates the worker and
verification reads required to complete a new import.

## Concurrency and Transactions

- Current replacement and merge lock the owning `apps` row.
- Version replacement locks the owning `app_versions` row.
- Canonical rows use the existing partial unique indexes for conflict safety.
- Canonical creation performs insert-or-select behavior inside the transaction.
- Content rows and their mappings commit together.
- Duplicate writers serialize by app/platform or version rather than
  interleaving deletions and upserts.
- Any validation, SQL, mapping, or evidence-verification failure rolls back the
  whole operation.

Canonical taxonomy rows are not garbage-collected automatically. Historical
versions or other app mappings may still reference them, and retaining an
unreferenced taxonomy row is safer than deleting shared identity during an
import.

## Error Behavior

Errors identify the failed boundary without exposing payloads or credentials:

- invalid payload;
- duplicate source Flow ID;
- missing target app or version;
- app/version/platform scope mismatch;
- canonical hierarchy resolution failure;
- content or mapping persistence failure; or
- imported evidence verification failure.

Workers fail only the affected app/job according to the existing worker
isolation policy. One invalid app must not stop the remaining import pool.

## Testing

### Unit tests

- normalization and whitespace behavior;
- categorized root-plus-child resolution;
- uncategorized root resolution;
- category equal to title without a self-cycle;
- duplicate IDs and malformed payload rejection;
- stable canonical spelling; and
- deterministic input ordering.

### Disposable PostgreSQL integration tests

Run against a clearly named disposable database at migration head:

- full current replacement;
- partial current merge;
- empty authoritative replacement;
- stale-row deletion only in replacement mode;
- version replacement;
- idempotent repeated import;
- source ID remapped after title/category change;
- shared roots across apps;
- same child title beneath different parents;
- exactly one initial mapping per written row;
- concurrent canonical creation;
- transaction rollback on failure; and
- reconstructed `DesignFlow[]` content and order.

### Producer contract tests

Prove every listed producer delegates to the normalized boundary and that
active crawl/import code contains no writes to removed aggregate columns.

### Pipeline verification

- import-worker and API focused suites;
- catalog verification tests;
- migration verification remains green;
- TypeScript/build checks;
- full test suite; and
- one disposable new-import smoke test covering persistence, hierarchy,
  mappings, reconstruction, and evidence references.

## Non-Goals

- Re-running or editing migration 0034.
- Backfilling or repairing already migrated current or historical data.
- Crawling Mobbin Search or changing discovery behavior.
- Fuzzy taxonomy matching or AI-generated hierarchy.
- Curator-driven multi-mapping.
- Automatic deletion of unused canonical taxonomy rows.
- Mapping Flow taxonomy to the existing app `Category` entity.
- Redesigning Flow-tree UI, Design System, Export, or Review tabs.

## Completion Criteria

The work is complete when:

1. Every listed future Apps Flow producer writes only normalized rows and
   mappings.
2. Full replacement, partial merge, and version snapshot semantics are
   transactionally verified.
3. New imports reconstruct the original `DesignFlow[]` content and order.
4. Parent/child canonical mappings follow migration 0034's exact rules.
5. Active worker and catalog verification paths read the normalized model.
6. No active crawl/import write references the removed aggregate `flows`
   columns.
7. Disposable-database integration, focused services, full tests, and build
   verification pass.
