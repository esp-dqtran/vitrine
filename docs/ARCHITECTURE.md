# Astryx — Scalable Architecture

Goal: extract design systems from application screenshots at scale — many apps,
hundreds of screens per app, observable and controllable from the Vitrine UI.

This doc describes the current architecture, where it stops scaling, and a
staged path forward. Each stage has an explicit trigger — don't build a stage
before its trigger fires.

## Current state (v0 — works today)

```
┌──────────┐   ┌───────────────┐   ┌──────────────────┐   ┌────────────────────┐
│  Mobbin  │──▶│ crawl         │──▶│ caption          │──▶│ synthesize         │
│ (web UI) │   │ Playwright    │   │ Playwright →     │   │ rolling batch merge │
└──────────┘   │ 4 tabs/app,   │   │ ChatGPT/Claude/  │   │ via same chat UI   │
               │ apps serial   │   │ Gemini web, 3 tabs│  └─────────┬──────────┘
               └──────┬────────┘   └────────┬─────────┘             │
                      ▼                     ▼                       ▼
               data/images/**        images.description    data/design-systems/<app>.md
                      └──────────── data/astryx.db (SQLite) ────────┘
                                            ▲
                              vite dev server (/api/apps, /api/progress,
                              /api/progress/cancel) ← Vitrine UI polls 1.5s
```

Cross-cutting: `data/progress.json` (single-slot progress), `data/cancel-requested`
(cooperative cancel flag), `pool.ts` (shared worker pool), `llmChat.ts`
(ChatSession abstraction over the three chat providers).

What already scales fine:
- **Crawling.** One-shot per app, 4 concurrent tabs, resumable (`INSERT OR IGNORE`
  + skip-if-exists), multi-app via `crawlMany`. Bound by one Mobbin login — that's
  a hard constraint (persistent profile = one process), not a real bottleneck.
- **Idempotency.** Every stage checkpoints to SQLite/disk and resumes where it
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

## Stage 2 — jobs table + worker (trigger: you want to start runs from the UI, or run crawl→caption→synthesize as one command)

Today the UI can only observe and cancel; starting a run means a terminal.
Replace the single-slot `progress.json` + flag file with a `jobs` table in the
existing SQLite db:

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

Enable SQLite WAL (`PRAGMA journal_mode=WAL`) so the worker (writer) and vite
server (reader) don't block each other. That's the entire "database migration"
at this stage.

## Stage 3 — hosted product (trigger: a second user who isn't on this machine)

Only if Astryx becomes a service (the SignIn page becomes real):

- **Postgres** replaces SQLite (same schema; `jobs` table becomes pg-boss or
  stays hand-rolled with `FOR UPDATE SKIP LOCKED`).
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
| SQLite + WAL, one worker | Zero infra; serial worker matches the real constraints (one Mobbin login, one API budget) | Second machine or second user |
| Jobs in a table, not a queue service | A table is inspectable, resumable, and 20 lines | >1 worker host needs `SKIP LOCKED` semantics → Postgres |
| Structured JSON as synthesis source of truth | Data > prose: renderable, diffable, compilable to theme tokens | — |
| Cooperative cancel (checked between items) | In-flight item finishes cleanly; every stage checkpoints ≤1 item of work | — |

## Update: Stage 2/3 queue split, taken early (overrides the table above)

The "jobs in a table, not a queue service" row below and the Stage 3 trigger
("a second user who isn't on this machine") were the plan — the project owner
explicitly chose to build the queue-service split now anyway, ahead of that
trigger. Recording why, so this doesn't read as an oversight later.

What actually shipped, and how it respects the constraint the table below is
protecting (one Mobbin login = one browser session, ever):

- **`services/api`** — read-only HTTP surface over the same SQLite db/progress
  file this doc describes (`/apps`, `/images`, `/progress`). No queue, no
  Playwright.
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

Infra: RabbitMQ (`docker-compose.yml`), durable queue + a dead-letter queue
after 3 failed attempts (manual retry-count header, not a plugin). No
Postgres/S3 — SQLite (`data/astryx.db`) and `data/images/**` are still the
source of truth, now mounted as a shared volume into `api` and
`import-worker` rather than read off local disk directly.

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
