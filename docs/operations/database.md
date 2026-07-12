# Database operations

Astryx uses PostgreSQL 17 and forward-only SQL migrations. Application
processes assert that the database is current; only `db:migrate` changes the
schema. Run commands from the repository root.

## Required order

For local development:

```bash
docker compose up -d postgres rabbitmq
DATABASE_URL=postgres://postgres:postgres@localhost:5432/astryx npm run db:migrate
DATABASE_URL=postgres://postgres:postgres@localhost:5432/astryx npm run db:check
npm run dev
```

For staging and production, inject `DATABASE_URL` from the environment or
secret manager. Do not put credentials in image commands, logs, or release
metadata.

1. Stop writes or confirm the migration is backward-compatible with the
   currently running release.
2. Create a PostgreSQL 17 custom-format backup and verify its checksum.
3. Run exactly one migration job for the release.
4. Require `db:check` to succeed.
5. Start or roll the API and import worker.
6. Run health and data-invariant checks before resuming normal writes.

Compose encodes the same dependency: healthy PostgreSQL, then the one-shot
`migrate` service, then API and import worker. Never run migrations from every
application replica.

## Migration behavior

```bash
DATABASE_URL="$DATABASE_URL" npm run db:migrate
DATABASE_URL="$DATABASE_URL" npm run db:check
```

Success is JSON:

```json
{"status":"ok","appliedVersions":[1]}
{"status":"ok","current":true}
```

A safe rerun returns `"appliedVersions":[]`. The runner takes an advisory lock,
requires contiguous migration numbers, verifies every applied file's SHA-256
checksum, and commits a migration and ledger entry together. Never edit an
applied migration; add the next numbered file.

If a migration fails before commit, PostgreSQL rolls back that migration and
its ledger row. Correct the new, unapplied migration file, create another
backup, and rerun. If the ledger reports the version but the release fails,
do not rewrite or delete the ledger: ship a forward repair migration.

## Backup

Use the migration image in deployed environments so `pg_dump` major version
matches PostgreSQL 17:

```bash
export BACKUP_DIR=/secure/backups
export BACKUP_BASENAME="astryx-$(date -u +%Y%m%dT%H%M%SZ)"
DATABASE_URL="$DATABASE_URL" npm run db:backup
```

Optional variables are `RELEASE_ID` and `DB_TOOL_TIMEOUT_MS`. The basename may
contain only letters, digits, dot, underscore, and hyphen. The command refuses
to overwrite existing artifacts and publishes three files atomically:

- `<name>.dump` — PostgreSQL custom-format dump; published last as the commit marker.
- `<name>.dump.sha256` — raw SHA-256 digest.
- `<name>.dump.json` — allowlisted server version, migration head, table counts,
  core relationship counts, dump size, and checksum. It contains no URL or
  libpq credentials.

Success is one JSON object with `status: "ok"` and the three paths. Transfer the
three files together to immutable, encrypted storage and record retention and
restore-test status outside the application database.

## Restore verification

Restore verification is destructive only to a narrowly named disposable
database. The target must begin `astryx_restore_test_`, must not already exist,
and requires explicit opt-in:

```bash
RESTORE_TEST_ALLOW_DROP=1 npm run db:restore-verify -- \
  /secure/backups/astryx-20260712T083151Z.dump \
  postgres://restore_operator@database.internal:5432/astryx_restore_test_20260712
```

Prefer a credential source supported by libpq or an ephemeral restore account;
avoid putting a password in the target argument. The verifier checks the
sidecar and private-copy checksums before `pg_restore`, creates the database
from `template0`, compares migration head, all table counts, and core
relationships, then drops only the database it created. A successful result is
JSON with `status: "ok"`, checksum, head, counts, and relationships.

On checksum mismatch, stop. Do not restore, regenerate the sidecar, or bless the
artifact. Retrieve another immutable copy, compare it with the storage-system
checksum, and create a fresh backup if no trusted copy remains.

## Application rollback

Database migrations are forward-only. Deploy schema changes so the old and new
application releases can both operate during the rollback window: add nullable
columns/tables first, backfill separately, switch reads/writes in a later
release, and remove obsolete schema only after the old release can no longer be
rolled back. Rolling back application containers does not roll back the
database. If a forward migration is required, deploy it before rolling the
application back.

## Declared disaster restore

Do not restore over the damaged database.

1. Declare the incident, stop all writers, and preserve the damaged database
   for investigation.
2. Select the newest trusted dump whose checksum and disposable restore test
   both passed.
3. Provision a new empty PostgreSQL 17 database from `template0` with separate
   credentials and network policy.
4. Restore with PostgreSQL 17 `pg_restore --clean --if-exists --no-owner
   --no-acl --exit-on-error` into that empty database.
5. Run `db:check`, safe count/relationship/hash evidence, and application smoke
   tests against the restored database.
6. Rotate application credentials, switch `DATABASE_URL` through the deployment
   secret, roll API and worker, and monitor before reopening writes.
7. Record dump checksum, migration head, recovery point, validation output,
   approver, and cutover time in the incident log.

If the selected backup predates the current migration head, run the normal
migration job against the restored database after the restore and before the
application starts. Never downgrade the ledger to match an older binary.
