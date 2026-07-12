# Astryx Free/Pro production-readiness matrix

Verified against source, tests, Docker Compose, and the local PostgreSQL/RabbitMQ runtime on 2026-07-12. This is a living release gate; `Complete` means implemented and directly verified, not merely planned.

Status: **Complete**, **Partial**, **Missing**, or **External**.

## Product and codebase reconciliation

| Requirement | Status | Current evidence | Remaining gate |
|---|---|---|---|
| Preserve evidence integrity and draft isolation | Partial | `app_versions`, `version_images`, immutable snapshots, publish blockers, and crawler evidence/lease tests exist | Full import/publish/failure browser acceptance and object-backed evidence |
| Free/Pro only | Complete | `src/pricing.ts`, pricing store/tests, and product UI expose only Free and Pro | Keep Team/Enterprise deferred in all new schemas and UI |
| Current-data inventory | Complete | Local runtime: 4 apps, 1,422 images/links, 2 published + 2 draft versions, 7 jobs, 2 users; media tree is 1,422 files/~758 MiB | Re-record immediately before each destructive-capable migration |
| Architecture reconciliation | Partial | Production design and database/object-storage plans exist | Reconcile `docs/ARCHITECTURE.md` after each implemented authority boundary |

## Database foundations

| Requirement | Status | Current evidence | Remaining gate |
|---|---|---|---|
| Ordered transactional migrations | Complete | `src/migrations.ts`, `migrations/0001_current_schema.sql`, checksum ledger, advisory lock, rollback tests | Keep future files immutable after release |
| No ordinary query-time DDL | Complete | DDL removed from `src/db.ts`; source-boundary test enforces it | Full suite after every later migration |
| Startup refuses stale schema | Complete | API/worker startup-order tests, read-only assertion, Compose migration gate | Complete-stack stale-schema smoke test |
| Empty install | Complete | Disposable verifier reaches migration head 1, creates expected 27 tables, rerun applies 0 | CI job |
| Existing-schema upgrade | Complete | 26-table synthetic fixture preserves counts, full row hashes, sequences, relationships, and published/draft image membership | Real local database comparison |
| Backup and restore | Partial | Recovery TDD implementation in progress | Live migrated-test restore, then real pre/post-migration restore evidence |
| Real local database migration | Missing | Real database intentionally remains unversioned while recovery is built | Backup, safe evidence, apply, compare, rerun, disposable restore |

## Durable object storage

| Requirement | Status | Current evidence | Remaining gate |
|---|---|---|---|
| Local/S3 object-store abstraction | Missing | Implementation plan: `docs/superpowers/plans/2026-07-12-astryx-object-storage.md` | Local adapter, S3 adapter, MinIO runtime |
| Captures/imports/exports/failure media off shared disk | Missing | Current writes traced to `crawlRun.ts`, `bulkDownload.ts`, `smartCrawler.ts`, and API export route | Move every write path behind object ownership |
| Protected signed access and explicit previews | Partial | Account-bound HMAC media routes exist; previews currently use first three image rows | S3 signing, explicit published preview rows, cross-app isolation |
| Resumable legacy migration | Missing | 1,293 `mobbin-bulk:` + 129 `capture:` rows; no duplicate keys | Dry-run/apply/resume, 1,422 checksum parity, rerun 0 |
| Safe orphan cleanup and object recovery | Missing | Design calls for two-pass mark/sweep | Dry-run-first GC, grace/recheck, bucket+DB restore drill |
| Worker secrets separate from media | Partial | Browser profiles remain filesystem/runtime inputs | Read-only secret mount contract and deployment verification |

## Customer identity lifecycle

| Requirement | Status | Current evidence | Remaining gate |
|---|---|---|---|
| Normalized sign-in and generic failure | Complete | `normalizeEmail`, hash verification, `/auth/login`, API/frontend tests | Distributed abuse limit and browser acceptance |
| Logout and secure production cookie | Partial | HttpOnly, SameSite=Strict, production Secure, logout route/tests | Explicit max-age/domain policy, trusted proxy, origin protection |
| `signed_in_elsewhere` | Complete | Two-session policy and explicit API state/tests | Friendly browser recovery acceptance |
| Self-service registration | Missing | No route/store/UI | Normalized unique email, neutral response, rate limits |
| Email verification | Missing | No token/store/SMTP contract | Hashed single-use expiring token and browser flow |
| Password reset/change | Missing | No route/store/UI | Neutral request, hashed token, expiry, reuse prevention, session revocation |
| Session list/revoke | Missing | Only create/resolve/delete current session | Safe device metadata, list, individual/all-other revocation |
| Account profile/deletion request | Missing | No account surface | Profile, auditable support-assisted deletion request, retention copy |
| Idempotent admin bootstrap | Missing | `seedAdmin()` currently rehashes password and deletes sessions at every API start | One-time bootstrap/explicit command with non-rotation test |

## Billing and customer experience

| Requirement | Status | Current evidence | Remaining gate |
|---|---|---|---|
| Stripe-authoritative entitlement | Complete | Signed webhook construction and subscription-event synchronization; redirects do not grant Pro | Test-clock/live test-mode lifecycle |
| Checkout and Portal backend | Complete | Monthly/yearly Checkout, active-user guard, Portal route | Frontend controls and browser acceptance |
| Duplicate webhook idempotency | Complete | `stripe_events` store and idempotent service path | Concurrent duplicate integration test |
| Out-of-order/delayed lifecycle | Partial | Past-due grace and ignored invoice behavior tested | Renewal, cancellation, unpaid fallback, delayed webhook reconciliation |
| Account billing UI | Missing | App fetches subscription data; no complete account/billing management surface | Plan/interval/dates/grace/failure/usage plus Checkout/Portal actions |
| Free unlock and export usage | Partial | Server enforcement and subscription JSON exist | Clear customer UI and complete browser journey |

## API, browser, and dependency security

| Requirement | Status | Current evidence | Remaining gate |
|---|---|---|---|
| Route input validation/parameterized SQL | Partial | Major routes use bounded text/ID/slug checks; stores use parameters | Route-by-route schema audit and negative fuzz tests |
| Cookie mutation origin/CSRF protection | Missing | SameSite=Strict only | Same-origin `Origin` enforcement; Stripe webhook exemption |
| Production CORS | Missing | No explicit deny-by-default policy | Same-origin contract and hostile-origin tests |
| Security headers | Missing | Only `Cache-Control: no-store` is global | CSP, HSTS at TLS edge, nosniff, frame/referrer/permissions policies |
| Body/upload/export limits | Partial | Express defaults and export-selection count limits | Explicit JSON/raw byte limits, artifact/media byte ceilings, 413 tests |
| SSRF/path traversal | Partial | Mobbin URL allowlist and media slug/hash validation exist | Shared outbound URL policy, DNS/private-range protection, object-key tests |
| Safe errors/correlation IDs | Missing | Several routes return generic errors, but no global envelope/ID | Correlation middleware, safe 4xx/5xx handler, secret-redaction tests |
| Distributed rate limiting | Missing | `services/api/src/rateLimit.ts` is process-local | Redis/PostgreSQL-backed limiter and two-API verification |
| Secret-safe logging | Partial | Some crawler redaction exists | Structured logger and automated secret-canary test |
| Dependency/container scanning | Missing | No CI | Lock/container/SBOM/vulnerability jobs and release policy |

## Durable jobs and crawler

| Requirement | Status | Current evidence | Remaining gate |
|---|---|---|---|
| Durable DB job records | Partial | Pipeline creates/updates job rows; accepted API job can exist if publish fails | Transactional outbox so acceptance cannot lose publish intent |
| Persistent RabbitMQ delivery/DLQ | Partial | Durable queues/messages, prefetch 1, three attempts, DLQ | Backoff/TTL queues, explicit transient/permanent classes, DLQ admin APIs |
| Duplicate delivery safety | Partial | Capture and several stages are idempotent; republish-before-ack accepts duplicates | Whole-pipeline duplicate replay proof |
| Cancellation | Partial | Pipeline checks DB cancellation before start; crawler has durable cancellation | In-flight stage checks and no-advance/requeue live proof |
| Abandoned worker recovery | Partial | Durable crawl lease/heartbeat/interruption code exists | General job lease/reaper and worker-kill acceptance |
| Broker disconnect/shutdown | Partial | Supervisor restart intent and `closeQueue()` exist | Explicit error exit, in-flight drain/requeue, graceful signal tests |
| Intelligent crawler | Partial | Plans/runs/steps/evidence/repairs and canonical finalization are implemented | API/UI tasks, interruption drill, approved Atlassian browser acceptance |

## Observability and operations

| Requirement | Status | Current evidence | Remaining gate |
|---|---|---|---|
| Liveness/readiness/dependency health | Missing | `/health` returns static `{status:'ok'}` | Separate startup/live/ready checks for DB, broker, storage, worker heartbeat |
| Structured logs/correlation | Missing | Console text logs | JSON schema, request/job IDs, redaction, retention |
| Metrics/dashboard/alerts | Missing | None | API/DB/queue/DLQ/job/crawl/export/Stripe/media metrics and actionable alerts |
| Error tracking | Missing | None | Provider-neutral hook with safe context |
| Graceful shutdown | Missing | Queue close helper only | HTTP drain, consumer cancel, in-flight completion/requeue, pool close |

## Deployment, CI/CD, frontend, legal

| Requirement | Status | Current evidence | Remaining gate |
|---|---|---|---|
| Reproducible service images | Partial | API/discover/worker/migration Dockerfiles; migration image uses repaired `npm ci` lock | All images multi-stage, exact toolchain/digests, non-root, health/read-only checks |
| Production-like Compose/staging | Missing | PostgreSQL/RabbitMQ local dependencies only | Full frontend/API/worker/migration/storage/reverse-proxy stack and rollback |
| CI/CD | Missing | No `.github` workflow | Install, diff, TS, tests, builds, migration, containers, scans, browser smoke, staged deploy |
| Direct URL routing/code splitting | Missing | Frontend uses hash routing and eager imports | History fallback, route-level dynamic imports, error boundaries |
| Responsive/a11y/error/offline acceptance | Partial | Design-system components and rendered tests exist | Keyboard/focus/labels/contrast/responsive/offline browser matrix |
| Terms/Privacy/cookies/billing/support | Missing | Pricing copy exists; launch legal pages do not | Draft disclosures, support path, retention/deletion docs, counsel flags |
| Public deployment | External | No hosting credentials, domain, SMTP, Stripe test secrets, or DNS authority verified | Provider-neutral staging first; public deploy only with explicit credentials/authority |

## Release claim

Astryx is **not yet production-ready**. Database migration behavior is proven on disposable empty/upgrade databases, while backup/restore, the real database migration, object migration, full customer lifecycle, production security/operations, complete staging, and browser/recovery acceptance remain release blockers. The final claim must cite live evidence for every applicable gate from the launch brief.
