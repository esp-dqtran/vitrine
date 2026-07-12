# Object storage operations

Astryx stores media and generated artifacts in object storage. PostgreSQL owns
authorization, object references, checksums, and migration state; the bucket or
local root owns bytes. Run commands from the repository root.

## Configuration

Development may use the local object-store adapter. Staging and production must
use the S3-compatible adapter with bucket-scoped credentials and a release
prefix:

```bash
OBJECT_STORE_BACKEND=s3
OBJECT_STORE_S3_BUCKET=astryx-media
OBJECT_STORE_S3_REGION=ap-southeast-1
OBJECT_STORE_S3_PREFIX=prod
```

Production must not use public ACLs or path-style HTTP endpoints. Credentials
come from the runtime secret manager or the platform credential chain; never log
the full object-store configuration.

## Migration

Object migration is dry-run by default:

```bash
DATABASE_URL="$DATABASE_URL" npm run storage:migrate
```

Apply requires an explicit opt-in:

```bash
MEDIA_MIGRATION_APPLY=1 DATABASE_URL="$DATABASE_URL" npm run storage:migrate
DATABASE_URL="$DATABASE_URL" npm run storage:verify
```

Do not delete the legacy `data/images` tree during the rollback window. Keep it
read-only and available until object parity has passed in the target runtime and
the rollback window expires.

## Backup

A PostgreSQL dump protects object metadata, ownership, previews, export links,
failure-artifact links, migration state, and checksums. It does not contain
object bytes.

Production object backups require all of the following:

- Bucket versioning enabled before traffic.
- Immutable daily bucket inventory for the protected prefix.
- Provider replication or an independent object backup for the same prefix.
- Recorded evidence hashes for the database dump, object inventory, and object
  backup generation.

Create backups behind one consistency point: stop writes or use an equivalent
barrier, record the object prefix and inventory generation time, copy or
replicate object bytes, then create the database dump and manifest. Keep the
database dump, object inventory, and object-backup evidence together in the
incident record.

## Retention

Lifecycle rules may remove only objects that are no longer referenced by
PostgreSQL. No lifecycle rule may delete an object while it is present in
`images.object_key`, `exports.object_key`, or
`crawl_run_steps.failure_object_key`.

Retention floors:

- Failure artifacts: 30 days after the crawl run reaches a terminal state.
- Completed exports: 7 days after export completion.
- Published evidence: keep while the app version exists.
- Logs: follow the observability retention policy.

Use garbage collection in dry-run mode first:

```bash
DATABASE_URL="$DATABASE_URL" npm run storage:gc
```

Apply mode requires `OBJECT_GC_APPLY=1` and deletes only objects that have been
unreferenced for the configured grace period and still pass an immediate
reference recheck:

```bash
OBJECT_GC_APPLY=1 OBJECT_GC_GRACE_DAYS=7 DATABASE_URL="$DATABASE_URL" npm run storage:gc
```

## Restore Drill

Never restore object bytes into the live prefix for a test. Use a disposable
database and a fresh bucket prefix or local root.

1. Restore the selected PostgreSQL dump into a database named
   `astryx_restore_test_*`.
2. Restore or copy the matching object backup into a fresh object prefix/root.
3. Point the verifier at the disposable database and restored object prefix.
4. Run database restore verification and object parity verification before any
   traffic can use the restored data.
5. Record the database checksum, object inventory hash, total object count,
   total bytes, and parity evidence hash.

Readiness must fail when a referenced object is missing or unreachable. The
failure shown to operators must be generic; do not expose signed URLs, object
store credentials, bucket hostnames, or local filesystem paths.

## Rollback

During rollback, the database remains the authorization authority. If the new
release fails after object migration, roll the application back while keeping the
legacy image tree read-only and the object prefix intact. Do not run object
garbage collection in apply mode until the rollback window has expired and
`storage:verify` succeeds against the active database.
