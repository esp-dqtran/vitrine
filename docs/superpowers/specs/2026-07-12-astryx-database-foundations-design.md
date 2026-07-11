# Astryx Database Foundations Design

**Date:** 2026-07-12

**Parent design:** `docs/superpowers/specs/2026-07-12-astryx-production-readiness-design.md`

**Goal:** Replace query-time schema mutation with explicit, ordered, transactional migrations while preserving the current Astryx database and proving empty install, in-place upgrade, backup, restore, and application startup safety.

## Scope

This slice implements workstreams A and B of the production brief:

- inventory and protect the current implementation and representative data;
- reconcile the database section of `docs/ARCHITECTURE.md` with live code;
- introduce an immutable migration history and explicit deployment commands;
- remove DDL from ordinary API, worker, CLI, and query execution;
- make API and worker startup reject missing or altered migrations;
- verify an empty database and an upgrade from the current unversioned schema;
- create and restore a realistic PostgreSQL backup;
- document forward recovery and release rollback constraints.

Object storage, new account schema, distributed job changes, crawler tables, and other later production schema are separate slices. They use the migration mechanism established here.

## Current database contract to preserve

The current `src/db.ts` runs one large `ensureSchema()` statement before every exported query or transaction. It creates and alters 21 tables covering apps, platforms, images, jobs, users, sessions, subscriptions, unlocks, Stripe events, export usage, access events, design systems, flows, app versions, version images, immutable snapshots, review issues, exports, collections, and collection items.

The live local PostgreSQL database inspected for this design contained:

| Record | Count |
|---|---:|
| Apps | 4 |
| Images | 1,422 |
| `mobbin-bulk:` image references | 1,293 |
| `capture:` image references | 129 |
| App versions | 4 |
| Published versions | 2 |
| Draft versions | 2 |
| Version-image links | 1,422 |
| Jobs | 7 |
| Users | 2 |
| Sessions | 1 |

The migration must preserve primary keys, sequence positions, image references, app/version relationships, published snapshots, drafts, job history, password hashes, session hashes, Stripe mappings, unlocks, usage, collections, and audit history. Tests and documentation never print real password hashes, session hashes, emails, or Stripe identifiers.

The legacy `data/astryx.db` SQLite file is retained as an archival input but is not the current database authority. The existing SQLite-to-PostgreSQL script remains available until the PostgreSQL upgrade and backup evidence has been accepted.

## Migration layout

Migration files live in `migrations/` and use a fixed numeric prefix:

```text
migrations/
  0001_current_schema.sql
```

The initial migration contains the current PostgreSQL schema and legacy catch-up logic that is presently embedded in `ensureSchema()`. It must work in both cases:

1. an empty PostgreSQL database;
2. the existing unversioned PostgreSQL schema with representative rows.

Later slices add new files and never edit an applied file. File names match `^[0-9]{4}_[a-z0-9_]+\.sql$`; numeric versions are unique and contiguous.

The runner creates only its own ledger before applying files:

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version integer PRIMARY KEY,
  name text NOT NULL UNIQUE,
  checksum text NOT NULL,
  execution_ms integer NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
```

`schema_migrations` is infrastructure for the migration runner, not application schema mutation. The runner creates it in deployment mode only. Startup checks never create it.

## Runner behavior

`src/migrations.ts` owns migration discovery, validation, checksum calculation, application, and current-state assertion. It depends on a supplied PostgreSQL pool so unit tests can exercise decisions without importing the application pool.

`scripts/migrate.ts` is the deployment entry point. It:

1. validates `DATABASE_URL` and discovers migration files;
2. opens one dedicated connection;
3. takes a fixed session-level PostgreSQL advisory lock for Astryx migrations;
4. creates the migration ledger if absent;
5. reads applied versions and verifies name and SHA-256 checksum equality;
6. rejects gaps, unknown applied versions, changed files, or duplicate numbers;
7. applies each pending migration in numeric order, one transaction per file;
8. inserts the ledger row inside the same transaction;
9. logs version, name, duration, and outcome without SQL parameters or database credentials;
10. releases the connection and exits non-zero on any failure.

SQL files must not contain `BEGIN`, `COMMIT`, or `ROLLBACK`; the runner owns transaction boundaries. A failed statement rolls back both schema/data changes and the ledger insert for that version.

`scripts/check-migrations.ts` uses the read-only assertion path and exits non-zero when the ledger is absent, a migration is missing, a checksum changed, or a pending version exists.

Package scripts are explicit:

```json
{
  "db:migrate": "node --experimental-strip-types scripts/migrate.ts",
  "db:check": "node --experimental-strip-types scripts/check-migrations.ts",
  "db:verify": "node --experimental-strip-types scripts/verify-migrations.ts"
}
```

Migration and recovery entry points use erasable TypeScript supported by the pinned Node 22 runtime. The production migration image therefore does not retain the `tsx` development dependency.

## Application startup and query behavior

`src/db.ts` keeps the shared pool, parameterized `query()`, and `withTransaction()` helpers but removes `ensureSchema()` and all DDL. Importing the module may create the pool but does not create directories or mutate PostgreSQL.

API and worker entry points call `assertMigrationsCurrent()` before listening, consuming RabbitMQ messages, or marking readiness. They do not apply migrations. A schema mismatch logs a redacted startup error, exits non-zero, and never accepts traffic or jobs.

CLI commands that read or mutate PostgreSQL use the same query helpers. Their errors state that `npm run db:migrate` is required; they do not silently repair the database.

The API liveness endpoint is process-only. Readiness includes the migration assertion and a bounded `SELECT 1`. This slice adds the migration portion; later operations work adds complete dependency readiness.

## Initial migration strategy

`0001_current_schema.sql` is derived from the final current `ensureSchema()` statement, not the stale architecture document. It preserves these legacy behaviors:

- an old flat `images(app, platform, source_url, ...)` table is renamed and copied into normalized apps, platforms, and images before the temporary table is removed;
- existing normalized tables receive missing columns and constraints without losing rows;
- existing apps, images, design systems, flows, subscriptions, sessions, and jobs are not recreated with new IDs;
- initial app-version and version-image records are inserted only where no equivalent relationship exists;
- uniqueness and check constraints match current application assumptions;
- indexes cover the current session expiry, access event, version lookup, collection, and ownership paths.

The migration may use `CREATE TABLE IF NOT EXISTS`, guarded `ALTER TABLE`, `DO` blocks, and `ON CONFLICT DO NOTHING` because it must baseline the unversioned database. Repeatability after the first application is provided by the ledger. Schema verification after the migration ensures an accidentally incompatible pre-existing object does not pass merely because `IF NOT EXISTS` skipped creation.

No destructive type narrowing, column removal, ID reassignment, or table rewrite is permitted in this slice.

## Schema contract verification

`scripts/verify-migrations.ts` creates isolated temporary databases on a PostgreSQL server selected by `MIGRATION_TEST_DATABASE_URL`. The database name is generated by the script and validated before create/drop operations. The script refuses a URL without an explicit non-production opt-in marker such as `MIGRATION_TEST_ALLOW_DROP=1`.

It runs two scenarios:

### Empty install

1. create an empty temporary database;
2. run all migrations;
3. assert the migration ledger and expected schema objects;
4. run the application database tests against it;
5. run migrations again and prove a no-op;
6. drop the temporary database.

### Current-schema upgrade

1. create a second temporary database;
2. load a sanitized upgrade fixture representing the unversioned current schema;
3. insert representative apps, both image-reference kinds, a published version, a draft, version-image links, a user, session, subscription projection, job chain, export record, collection, and immutable snapshots;
4. record row counts, selected stable IDs, sequence maxima, referential queries, and SHA-256 hashes of non-secret JSON snapshots;
5. run all migrations;
6. assert the migration ledger, schema contract, counts, IDs, sequence advancement, relationships, and hashes;
7. run migrations again and prove a no-op;
8. drop the temporary database.

The fixture uses synthetic users and Stripe IDs. Live credentials or hashes are never copied into the repository.

## Existing local database upgrade

Before applying migrations to the current local database:

1. create a custom-format backup and SHA-256 sidecar;
2. record non-sensitive counts for all public tables;
3. record application/version/image/job relationships and maximum sequence values;
4. run the migration command once;
5. run the migration check and schema contract verifier;
6. compare pre/post counts and relationship queries;
7. run the full automated suite and production builds;
8. retain the backup until the complete production-readiness goal is accepted.

This is an in-place baseline operation. It records version `0001` only after the guarded migration and verification succeed.

## Backup and restore

`scripts/db-backup.ts` invokes PostgreSQL's `pg_dump` in custom format through a fixed argument array, never a shell-constructed command. Output paths are generated beneath an operator-selected backup directory. The script writes:

- the `.dump` file;
- a `.sha256` sidecar;
- a JSON manifest containing creation time, PostgreSQL server version, migration head, release identifier, non-sensitive table counts, dump byte size, and checksum.

The manifest never contains the database URL, usernames, emails, password/session hashes, Stripe IDs, or row contents.

`scripts/db-restore-verify.ts` requires an explicit disposable target URL and opt-in marker. It verifies the dump checksum, creates or empties only the validated disposable target, restores with `pg_restore`, runs `db:check`, compares manifest counts, verifies core relationships, and executes a read-only application smoke query.

The production container used for migration and recovery includes matching PostgreSQL client tools. Backup upload to object storage and scheduled retention are added by the object-storage and operations slices; this slice proves the artifact locally.

## Forward recovery and rollback

Astryx uses forward-only migrations. Application rollback selects the previous immutable image and is safe only while every new migration remains backward-compatible with that image.

Migration rules are:

- additive tables, nullable columns, indexes, and non-breaking constraints first;
- application code switches reads and writes in a later release;
- old columns or behaviors are removed only after the rollback window closes;
- large indexes use a dedicated operational migration strategy if transaction duration becomes unsafe;
- a bad migration is corrected by a new migration unless it failed inside its transaction and never committed;
- disaster restore is permitted only after stopping writers and recording the incident timeline.

The runbook documents three cases: failed uncommitted migration, committed backward-compatible migration with application rollback, and declared database disaster requiring snapshot restore and forward replay.

## Files and responsibilities

The implementation plan may refine exact line ranges but keeps these boundaries:

- `migrations/0001_current_schema.sql`: exact current schema and unversioned catch-up.
- `src/migrations.ts`: reusable discovery, checksum, apply, and assert logic.
- `src/migrations.test.ts`: file-order, checksum, mismatch, gap, transaction, and assertion tests.
- `scripts/migrate.ts`: deployment migration command.
- `scripts/check-migrations.ts`: read-only deployment/startup check command.
- `scripts/verify-migrations.ts`: empty and upgrade database harness.
- `scripts/db-backup.ts`: safe custom-format backup and manifest.
- `scripts/db-restore-verify.ts`: disposable restore verification.
- `tests/fixtures/current-schema-upgrade.sql`: sanitized representative unversioned schema and data.
- `src/db.ts`: pool and query helpers without DDL.
- `services/api/src/index.ts`: migration assertion before listen.
- `services/import-worker/src/index.ts`: migration assertion before queue consumption.
- `package.json`: explicit migration, check, verification, backup, and restore scripts.
- `docker-compose.yml`: one-shot migration service and application dependency gate for development/staging parity.
- `docs/ARCHITECTURE.md`: actual PostgreSQL migration and recovery contract.
- `docs/operations/database.md`: deploy, backup, restore, rollback, and forward-recovery commands.

## Error handling and observability

Migration command errors identify the version and safe error classification without printing SQL parameters or connection credentials. Checksum mismatches identify the version and expected/current digest. Lock contention waits for a bounded configurable duration and exits with a distinct code when another migration remains active.

Backup and restore commands delete incomplete output files, retain completed evidence, and exit non-zero on checksum, tool, restore, count, migration, or relationship failure. Every command emits a final JSON summary suitable for CI artifacts.

## Test-driven implementation order

1. Migration file discovery, naming, ordering, and checksum tests.
2. Ledger state and mismatch tests using injected PostgreSQL operations.
3. Transactional migration application and no-op rerun tests.
4. Extract the current schema into `0001_current_schema.sql`.
5. Remove query-time DDL and add startup assertion tests.
6. Empty database verification.
7. Sanitized current-schema upgrade fixture and preservation verification.
8. Backup manifest and checksum tests.
9. Restore verification against a disposable database.
10. In-place local backup, migration, comparison, full tests, and build verification.
11. Architecture and operations documentation reconciliation.

## Acceptance criteria

This slice is complete only when all of the following evidence exists:

- an empty PostgreSQL database migrates to head and passes the schema contract;
- the sanitized current-schema fixture upgrades without changed IDs, lost rows, broken references, or changed snapshot hashes;
- a second migration run applies zero files;
- an altered applied migration is rejected;
- a missing migration ledger or pending migration prevents API readiness and worker consumption;
- application query paths contain no `CREATE TABLE`, `ALTER TABLE`, `DROP TABLE`, or runtime schema bootstrap call;
- the current local database is backed up, migrated, and verified with its pre/post counts and relationships preserved;
- the realistic backup restores into a disposable database with matching checksum, migration head, counts, and smoke queries;
- the full Node and rendered React suites, TypeScript, frontend build, Storybook build, Compose validation, and `git diff --check` pass;
- the database architecture and operational commands match the implementation.

Passing unit tests alone is not sufficient. Empty install, upgrade, real local preservation, and backup/restore runtime evidence are mandatory.

## Risks and rollback

- **Guarded migration hides incompatible legacy schema:** explicit post-migration schema contract verification fails the rollout.
- **Migration file changes after application:** checksum verification prevents startup and deployment until the history is repaired deliberately.
- **Long-running DDL:** the first migration is exercised against the representative snapshot and the current local database before staging; later large changes require a separate operational design.
- **Accidental destructive test target:** verification and restore scripts require a generated database name plus an explicit destructive-test opt-in.
- **Dirty worktree collision:** implementation edits only the named database and startup files and never stages unrelated changes.
- **Failed local baseline migration:** the per-file transaction rolls back; if an unexpected committed change occurs, writers remain stopped and the verified pre-migration dump is restored into a new database before connection cutover.
