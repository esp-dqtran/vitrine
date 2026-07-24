# Unit-Only Database Test Design

## Goal

Make the Astryx test suite fully infrastructure-free. Tests must not connect to PostgreSQL, create databases, apply migrations to a database, mutate `DATABASE_URL`, or execute through the live `db.ts` singleton.

## Test Policy

The repository will have one test category: unit tests.

There will be no `test:integration` script or database-backed test path. `npm test` must run without PostgreSQL, pgvector, Docker, network services, or application database credentials.

Test files may use `pg` types to describe mock query results. They may not instantiate `pg.Client` or `pg.Pool`.

## Current Real-Infrastructure Tests

The current runtime PostgreSQL coverage includes tests for:

- admin-user listing and account state;
- authentication and sessions;
- App Knowledge storage;
- autonomous crawl storage;
- crawl storage;
- the database adapter;
- feature-document storage;
- feature-usage persistence;
- GetDesign import storage;
- media migration database integration;
- migration execution against PostgreSQL;
- pricing storage;
- referral storage;
- pgvector search indexing and search storage.

Tests that only import `pg` or `db.ts` types and already execute against local fakes are not database integration tests and remain in scope as unit tests.

## Architecture

Database-backed domain modules will expose a small dependency-injected implementation seam. The seam contains only the capabilities used by that module:

```ts
interface QueryExecutor {
  query<Row>(sql: string, params?: readonly unknown[]): Promise<{ rows: Row[]; rowCount?: number | null }>;
}

interface TransactionExecutor extends QueryExecutor {
  release?(): void;
}

interface DatabaseDependencies {
  query: QueryExecutor["query"];
  connect?(): Promise<TransactionExecutor>;
}
```

Exact interfaces may be narrower per module when that produces a clearer boundary.

Production exports keep their existing function signatures. They delegate to implementations constructed with the real `db.ts` query and pool adapters. Unit tests construct the same implementation with scripted in-memory dependencies.

Tests must assert observable behavior plus meaningful persistence contracts:

- SQL operation or operation class;
- bound parameters;
- row-to-domain mapping;
- transaction begin, commit, rollback, and release ordering;
- conflict and missing-row behavior;
- pagination and cursor behavior;
- session revocation and account safety rules;
- migration discovery, validation, ordering, locking, ledger writes, commit, and rollback.

Tests must not try to reproduce PostgreSQL itself. PostgreSQL parsing, extension availability, physical indexes, and actual lock behavior are outside the unit-test boundary.

## Migration Tests

Migration tests retain filesystem and orchestration coverage with recording fake clients:

- migration filename discovery and checksum validation;
- pending/applied state calculation;
- lock acquisition and release;
- migration execution order;
- ledger writes;
- transaction commit and rollback;
- unsafe target validation.

Tests whose only purpose is proving that PostgreSQL or pgvector accepts the SQL will be removed.

## Search and Vector Tests

Search indexing and search-store tests use fake query executors that return representative rows. Tests keep:

- embedding serialization and parameter binding;
- filters and paging;
- result mapping and ranking fields;
- degraded or empty outcomes;
- query failure propagation.

They do not create the `vector` extension, create HNSW indexes, or query a live pgvector database.

## Enforcement

Add a unit-test boundary test that scans test source files and fails on runtime infrastructure patterns:

- `new pg.Client`;
- `new pg.Pool`;
- runtime `import pg from "pg"` when used to open a connection;
- `process.env.DATABASE_URL =`;
- dynamic or value imports of `./db.ts` from tests;
- hard-coded PostgreSQL connection strings;
- database creation or destructive setup SQL in tests.

Type-only imports from `pg` and project modules remain allowed.

## Package Scripts

`npm test` remains the only required test command. It runs unit tests only.

Any existing `test:integration` script or documentation reference will be removed. No replacement integration command will be added.

## Verification

Completion requires:

1. the boundary test to fail against the current database-backed tests;
2. the boundary test to pass after conversion/removal;
3. focused unit tests for every changed store implementation;
4. `npm test` to pass with PostgreSQL stopped or unavailable;
5. `npm run build` to pass;
6. repository search to find no test-owned PostgreSQL client/pool, database URL mutation, or live database setup.

## Non-Goals

- Changing production database behavior or schema.
- Running migrations against any database during tests.
- Adding a replacement integration suite.
- Verifying PostgreSQL, pgvector, indexes, or physical query plans.
- Touching the configured Vitrine application database.
