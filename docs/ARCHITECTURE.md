# Astryx architecture

Goal: extract design systems from application screenshots at scale — many apps,
hundreds of screens per app, observable and controllable from the Vitrine UI.

This doc describes the current architecture, where it stops scaling, and a
staged path forward. Each stage has an explicit trigger — don't build a stage
before its trigger fires.

## Current runtime

```
Vitrine ──HTTP──▶ API ───────────────▶ PostgreSQL 17
                   │                       ▲
                   └──RabbitMQ jobs──▶ import worker
                                         │
                                         └──Playwright──▶ Mobbin

Compose startup: postgres healthy ──▶ migrate completes ──▶ API + import worker
```

PostgreSQL is the only relational source of truth. The API and import worker
perform a read-only migration-head assertion before they start; ordinary query
paths never create or alter schema. RabbitMQ is transport, not durable product
state. The import worker consumes at `prefetch(1)` because a Mobbin profile must
have one serial browser owner. Captured media is still under `data/images/**`;
moving it to durable object storage is a separate production gate.

Schema changes are forward-only SQL files in `migrations/`. The dedicated
`migrate` service takes a PostgreSQL advisory lock, verifies the immutable
SHA-256 ledger, and applies each pending file and ledger row in one transaction.
See `docs/operations/database.md` for backup, restore, rollout, and recovery.

What already scales fine:
- **Crawling.** One-shot per app, 4 concurrent tabs, resumable (`INSERT OR IGNORE`
  + skip-if-exists), multi-app via `crawlMany`. Bound by one Mobbin login — that's
  a hard constraint (persistent profile = one process), not a real bottleneck.
- **Idempotency.** Every stage checkpoints to PostgreSQL/disk and resumes where it
  left off. This is the property that makes everything below cheap to add —
  preserve it in every change.

## The bottleneck: captioning

443 Linear screens × ~45–60s per browser round-trip ÷ 3 tabs ≈ **2+ hours**,
with logout risk, fragile selectors, and a ceiling of a few tabs before the
chat provider throttles. This is stage-limiting for every app we add.

## Stage 1 — API captioning (trigger: already fired)

Swap the caption/synthesize transport from browser automation to the Anthropic
API. `ChatSession.ask(prompt, filePath?)` is already the seam — add an `api`
provider implementing the same interface with the SDK (`@anthropic-ai/sdk`,
vision via base64 image blocks). Keep the browser providers as the free
fallback; provider stays a CLI flag.

Two modes:
- **Interactive** (`messages.create`, ~20 concurrent via `runPool`): 443 screens
  in ~10 minutes.
- **Batch** (`messages.batches.create`, 50% price, completes within ~1h,
  results keyed by `custom_id` = image id): the default for full-app runs.
  Fits the existing progress model — poll `processing_status`, write
  `progress.json` from `request_counts`.

Model: `claude-opus-4-8` (vision, 1M context). Rough cost per 450-screen app:
~2.5k input + ~1k output tokens per image ≈ 1.1M in / 0.45M out ≈ **$17
interactive, ~$8 batch**. (Cheaper tiers exist; that's a per-run flag, not an
architecture decision.)

Synthesis moves to the API too and gets **structured outputs**
(`output_config.format` with a JSON schema): instead of a markdown doc, emit
`{ colors: [...], typography: [...], spacing: [...], components: [...] }`.
That turns the deliverable from prose into data — it can render in Vitrine,
diff across app versions, and compile into `@astryxdesign` theme tokens.
Keep writing the markdown as a render of the JSON, not the source of truth.

Synthesis stays a sequential rolling merge (each batch needs the previous
doc). If it ever dominates wall-clock: map-reduce — summarize chunks in
parallel, merge the summaries. Trigger: synthesis > 15 min per app.

## Historical proposal: jobs table + worker

This section records the original local-only proposal. It is superseded by the
current PostgreSQL + RabbitMQ runtime described above.

```sql
CREATE TABLE jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,              -- crawl | caption | synthesize
  payload TEXT NOT NULL,           -- JSON: app, url, provider, limit...
  status TEXT NOT NULL DEFAULT 'queued',  -- queued|running|done|error|cancelled
  done INTEGER DEFAULT 0, total INTEGER DEFAULT 0,
  message TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT
);
```

One worker process (`npm run worker`) polls the table and runs jobs serially —
serial is correct, not a limitation: crawl needs the single Mobbin profile, and
caption/synthesize share one API budget. The vite server gains
`POST /api/jobs` (enqueue) and `GET /api/jobs` (list/status); cancel becomes
`UPDATE jobs SET status='cancelled'` checked between items — same cooperative
model as today, minus the flag file. Pipelines are just three rows enqueued
in order with a "skip if previous failed" check.

## Historical proposal: hosted product

Only if Astryx becomes a service (the SignIn page becomes real):

- **Postgres** replaces SQLite. This part has shipped; RabbitMQ remains the job
  transport and PostgreSQL stores job/product state.
- **S3/R2** replaces `data/images/**`; `/media` becomes signed URLs.
- **API server** (the vite middleware endpoints extracted into a small
  Fastify/Hono app) + N caption/synthesize workers, horizontally scalable —
  they're stateless once storage is remote. Crawl workers stay special:
  one per Mobbin account/profile, queue-sharded by account.
- **Embeddings** over `images.description` + component catalogs for
  cross-app search ("show me every app's segmented control") — this is the
  product moat the per-app markdown can't offer.

Do none of this before the trigger. Every Stage-3 piece has a Stage-1/2
equivalent that's one file instead of one service.

## Decisions (and their reversals)

| Decision | Why | Revisit when |
|---|---|---|
| API for caption/synthesize, browser as fallback | 10x+ throughput, no login babysitting, no selector rot | Cost becomes the constraint → batch API / cheaper tier |
| Playwright stays for crawling | Mobbin has no public API; login + virtualized grid require a real browser | Mobbin ships an API |
| PostgreSQL 17 + explicit migrations | Durable shared state and deterministic, auditable schema rollout | Revisit only for a demonstrated database constraint |
| RabbitMQ transport + PostgreSQL job state | Broker isolation without treating queue delivery as product truth | Revisit when cross-region delivery is required |
| Structured JSON as synthesis source of truth | Data > prose: renderable, diffable, compilable to theme tokens | — |
| Cooperative cancel (checked between items) | In-flight item finishes cleanly; every stage checkpoints ≤1 item of work | — |

## Update: Stage 2/3 queue split, taken early (overrides the table above)

The "jobs in a table, not a queue service" row below and the Stage 3 trigger
("a second user who isn't on this machine") were the plan — the project owner
explicitly chose to build the queue-service split now anyway, ahead of that
trigger. Recording why, so this doesn't read as an oversight later.

What actually shipped, and how it respects the constraint the table below is
protecting (one Mobbin login = one browser session, ever):

- **`services/api`** — customer/admin HTTP surface over PostgreSQL. It owns
  authentication, billing and entitlement enforcement, catalog reads, signed
  media authorization, pipeline mutations, and progress/job observation. It
  never launches Playwright.
- **`services/discover`** — a thin producer. `POST /trigger` publishes a
  single `{type: "discover-catalog"}` message to RabbitMQ. It does **not**
  run Playwright itself.
- **`services/import-worker`** — the only process that ever launches
  Playwright/holds the Mobbin login. Consumes `discover-catalog` and
  `import-app` jobs from one RabbitMQ queue at `prefetch(1)`. On
  `discover-catalog` it runs the same `discoverApps()` this doc's crawler
  section describes, then enqueues an `import-app` job per newly-found app;
  on `import-app` it runs `crawlBulkDownload()`. Concurrency is 1 by design —
  splitting "discover" and "import" into separate services does **not** mean
  two browser sessions; both still run serially through this one worker.

Infra: PostgreSQL 17 and RabbitMQ (`docker-compose.yml`), durable queue + a dead-letter queue
after 3 failed attempts (manual retry-count header, not a plugin). PostgreSQL is
the relational source of truth. S3/R2 has not shipped: `data/images/**` is still
mounted into `api` and `import-worker`, so production requires the object-storage
gate before horizontal or multi-host deployment.

What this buys over the jobs-table version: real process isolation (the API
can be down/redeployed without touching the worker), a broker UI for
observing queue depth/DLQ, and the on-ramp already in place if a second
Mobbin account/profile ever makes >1 worker useful. What it costs: Docker
Compose + RabbitMQ to run locally where `npm run crawl-bulk` used to be
enough, and `HEADLESS=true` in the worker means the first login for a new
profile still has to happen headed, locally, before that profile is mounted
into the container.

## Invariants to preserve in every change

1. **Idempotent stages** — re-running any stage skips completed work.
2. **Checkpoint ≤ 1 item** — a crash never loses more than one screen/batch.
3. **UI observes through the db/files, never through the pipeline process** —
   the pipeline must run headless (cron, CI) with no UI attached.
4. **Provider is a seam** (`ChatSession`) — transport (browser vs API vs
   future local model) is a flag, never a rewrite.
5. **Evidence is immutable input to publication** — a crawl can finalize only
   from evidence pinned to the worker lease that produced it.
6. **Drafts never displace published data implicitly** — captured versions stay
   draft until the explicit review/publish transition updates catalog membership.
7. **One browser owner per profile** — queue depth may grow, but importing stays
   serial for each Mobbin profile.

## Free and Pro customer backend

Astryx now has a backend-only customer access layer. The current commercial
model has two plans:

- **Free:** permanently unlock up to 3 apps per account. Public catalog
  previews are available before an unlock. Exports are not included.
- **Pro:** $7/month or $70/year. Pro accounts can access every app and reserve
  up to 20 controlled exports per billing month.

The customer frontend, public registration, and generated export files are
deliberately outside this backend slice. Existing administrator workflows keep
using their current routes.

### HTTP contract

Public routes:

- `GET /catalog` — cursor-paginated app summaries, capped at 24 apps per page
  and 3 preview images per app.
- `GET /preview-media/:app/:hash` — serves only an app's public preview images.

Authenticated customer routes:

- `POST /apps/:app/unlock` — permanently consumes one of a Free account's
  three app slots. Concurrent requests are serialized by a database
  transaction so the cap cannot be exceeded.
- `GET /apps/:app` — cursor-paginated app detail, capped at 48 screens per
  page, after checking the account's entitlement.
- `GET /design-systems/:app` — returns entitled design-system data with
  customer media links rewritten to short-lived signed URLs.
- `GET /media/:app/:hash?expires=...&token=...` — validates the signature,
  expiry, user, app, image, and current entitlement before serving a protected
  image. Administrators may use this route without a signed query string.
- `POST /apps/:app/exports/reservations` — reserves one controlled export for
  a component family, a foundation category, or up to 10 selected screens.
- `GET /billing/subscription` — returns the account's safe billing and usage
  state without exposing Stripe object IDs.
- `POST /billing/checkout` — creates a Stripe Checkout Session for the
  server-selected monthly or yearly Pro Price.
- `POST /billing/portal` — creates a Stripe Customer Portal Session.

Administrator compatibility routes remain available to administrator
accounts only. In particular, `GET /apps`, `GET /images`, `GET /jobs`,
`GET /progress`, pipeline mutations, and unsigned `GET /media/...` are not
customer APIs.

### Stripe authority

`POST /billing/webhook` is registered before JSON parsing so Stripe receives
the unmodified request body for signature verification. Checkout completion is
not treated as an entitlement grant. Signed subscription webhooks are the
billing authority, and the API retrieves the latest Stripe subscription before
applying a state change to protect against out-of-order delivery. Processed
event IDs are stored for idempotency. A `past_due` subscription retains Pro
access for a 7-day grace period; a canceled, unpaid, or expired subscription
falls back to Free.

The API requires these values at startup:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRO_MONTHLY_PRICE_ID`
- `STRIPE_PRO_YEARLY_PRICE_ID`
- `APP_URL`
- `MEDIA_SIGNING_SECRET`

The Checkout and Portal endpoints return Stripe-hosted URLs; the future
frontend only needs to redirect to them.

### Persistence and abuse controls

The existing PostgreSQL database contains customer subscriptions, permanent
Free app unlocks, processed Stripe events, monthly export usage, and access
events.
Normal customer accounts are capped at two active sessions; signing in on a
third device revokes the oldest session. Administrator sessions are exempt.

Default limits are 300 requests per 5 minutes, 500 protected-media requests per
10 minutes, and traversal of 20 distinct apps per 10 minutes. Limits apply per
authenticated user or redacted client address, return
`verification_required` with `Retry-After`, and record blocked access events.
Administrators bypass these customer limits.

### Explicit follow-ons

1. Build the customer frontend against the routes above.
2. Add public registration and account verification; today customer rows must
   be provisioned through an existing trusted path.
3. Generate and deliver the reserved export artifacts. The current endpoint
   validates entitlement, scope, and monthly quota, but intentionally stops at
   the reservation boundary.
