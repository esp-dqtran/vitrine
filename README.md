# Astryx

Astryx crawls Mobbin app screenshots, runs them through an AI pipeline (caption → synthesize), and reconstructs a browsable design system per app — screens, UI elements, flows, and versioned design-system snapshots, scoped per platform (iOS / Android / Web).

This README is written so an agent (or a new contributor) can get the app running end to end without prior context.

## Architecture

- **Frontend** (`src/vitrine/`): React + Vite SPA.
- **API** (`services/api/`): Express service backing the frontend — auth, jobs, versions, exports, media.
- **Discover** (`services/discover/`): queue consumer for catalog discovery.
- **Import worker** (`services/import-worker/`): queue consumer that runs Playwright crawls against Mobbin and writes images/flows to the DB + object storage.
- **Database**: Postgres. Production/dev both point at **Supabase** by default (see below) — a local Postgres container is defined in `docker-compose.yml` but not required.
- **Object storage**: S3-compatible (`src/objectStore.ts`). Local dev defaults to a MinIO container; production uses real S3.
- **Queue**: RabbitMQ, connects the API/discover/import-worker services.

## Prerequisites

- Node.js 22+
- Docker + Docker Compose (for Postgres/RabbitMQ/MinIO and the containerized services)
- A Supabase project (or willingness to use the local Postgres container instead)

## 1. Install dependencies

```bash
npm install
```

## 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in at minimum:

- `DATABASE_URL` — a Postgres connection string. For Supabase, use the **pooler** connection string (session mode, port 5432), not the direct `db.<ref>.supabase.co` one — that host is IPv6-only and won't resolve on most local networks. Get it from Supabase → Project Settings → Database → Connection string → Connection pooling.
  ```
  DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
  ```
  To use local Postgres instead, leave `DATABASE_URL` unset — `docker-compose.yml` falls back to the bundled `postgres` container automatically.
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — bootstrap credentials for the initial admin account.
- The `STRIPE_*` and `MEDIA_SIGNING_SECRET` placeholders in `.env.example` are fine as-is for local dev (billing/media-signing aren't required to browse the app).
- `REFERRAL_CAMPAIGN_ID`, `REFERRAL_CAMPAIGN_START`, and `REFERRAL_CAMPAIGN_END` — the immutable campaign identifier and actual 90-day UTC launch window. Set these explicitly before staging or production deployment instead of relying on Compose defaults.

## 3. Run database migrations

`docker-compose`'s `migrate` service runs automatically before `api`/`import-worker` start (step 4) and reads `DATABASE_URL` from `.env` the same way they do — no manual step needed there.

To run migrations directly instead (e.g. before docker-compose, or against a DB not managed by compose):

```bash
DATABASE_URL="<your connection string>" npm run db:migrate
```

## 4. Start backend services

```bash
docker-compose up -d rabbitmq minio minio-init api import-worker
```

(Add `postgres` to that list only if you're using local Postgres instead of Supabase — `migrate` and `api`/`import-worker` will need `depends_on: postgres` added back in `docker-compose.yml`, or just run `docker-compose up postgres` separately before `migrate`.)

The API serves on `http://localhost:3010` by default (`API_HOST_PORT` in `.env` to change it).

## 5. Start the frontend

```bash
npm run dev
```

Opens on `http://localhost:5173`, proxying `/api` to the API service (`VITRINE_API_TARGET`, defaults to `http://127.0.0.1:3010`).

## Running tests

```bash
npm test
```

## Adaptive Hybrid Search rollout

Advanced Search combines PostgreSQL full-text retrieval with optional 1536-dimension semantic embeddings. Search documents are versioned independently from published catalog versions, and the existing deterministic search remains the rollback path.

Roll out in this order:

1. Confirm the target PostgreSQL server permits `CREATE EXTENSION vector`.
2. Apply migrations with `npm run db:migrate`, then verify with `npm run db:check` and `npm run db:verify`.
3. Deploy `search-index-worker` while both `ADVANCED_SEARCH_ENABLED=false` and `VITE_ADVANCED_SEARCH_ENABLED=false`.
4. Queue every published app/platform once with `npm run search:index:backfill`.
5. Wait until `search_index_queue` has no `queued` or `running` rows. Run `npm run search:verify-relevance` and `npm run search:benchmark` against the verification database.
6. Enable `ADVANCED_SEARCH_ENABLED=true` for the intended API cohort.
7. Build the frontend with `VITE_ADVANCED_SEARCH_ENABLED=true` only after the backend gates pass.

Configuration:

```dotenv
ADVANCED_SEARCH_ENABLED=false
VITE_ADVANCED_SEARCH_ENABLED=false
SEARCH_EMBEDDING_BASE_URL=https://api.openai.com/v1
SEARCH_EMBEDDING_API_KEY=
SEARCH_EMBEDDING_MODEL=text-embedding-3-small
SEARCH_INDEX_WORKER_ID=
```

The index worker runs even while the API flag is disabled. Without an embedding key, indexing and queries remain available in keyword-only degraded mode. The backfill is enqueue-only and safe to rerun because `(app_id, platform)` is the queue key.

For rollback, disable both flags and redeploy the API/frontend. This immediately routes `/search` back to deterministic catalog search and restores the existing Command Palette. Leave `search_documents` and the queue intact for diagnosis; they are not read while the backend flag is disabled.

## Autonomous app-flow discovery

Administrators can open an app's Intelligent crawler workspace, enter a public app URL, upload a shared Playwright storage state, and start a deep autonomous crawl. The parent run first builds a cited product dossier, then delegates bounded missions to concurrent discovery agents. Read missions may overlap; authentication and mutations use durable single-account leases. Complete high-confidence paths become ordered, evidence-backed Flows, while uncertain paths remain drafts with exact blockers.

Generate `CRAWL_SESSION_ENCRYPTION_KEY` with `openssl rand -base64 32` before uploading a session. Queue messages contain only the app slug and durable parent run ID; browser state, credentials, dossiers, and missions remain in encrypted/database-backed storage. See [Autonomous crawler operations](docs/operations/autonomous-crawler.md) for setup, safety controls, recovery, and acceptance procedures.

## Research Projects and Decision Canvas

Research Projects turn catalog evidence into a personal designer workspace. A designer starts with a research question, gathers entitled catalog screens or private screenshots, compares them in two to five ordered lanes, records a decision and rationale, generates an evidence-cited synthesis, and downloads an authenticated `DESIGN.md` handoff.

Enable both sides of the feature together:

```dotenv
RESEARCH_PROJECTS_ENABLED=true
VITE_RESEARCH_PROJECTS_ENABLED=true
```

AI synthesis is optional. Without the three provider variables below, projects, evidence, decisions, uploads, and Markdown export continue to work; only synthesis returns `503`.

```dotenv
RESEARCH_LLM_BASE_URL=https://api.openai.com/v1
RESEARCH_LLM_API_KEY=<secret>
RESEARCH_LLM_MODEL=<json-capable-model>
```

Synthesis is synchronous with a 60-second request limit and retries one invalid response. Every generated observation, difference, alternative, recommendation, and requirement must cite evidence selected in the project. Existing app entitlements remain authoritative. Private PNG, JPEG, and WebP uploads are owner-only, limited to 10 MiB each, stored as protected objects, and never added to the shared catalog.

Research activation metrics record only the user ID, action, numeric volume, and outcome. Questions, notes, filenames, image contents, generated text, and designer decisions are not written to analytics events.

## Flow-to-Feature-Document workspace for product managers

From an app's **Flows** tab, a product manager can turn one captured Flow into a living Feature Document. The setup preview pins the exact app, platform, version, ordered steps, and every source image before submission. Submission is blocked if any image is missing protected object storage or source metadata.

Generation runs as a durable import-worker job. It analyzes every ordered image with the configured multimodal provider, synthesizes one structured document, and streams progress to the workspace over SSE without interval polling. A stopped worker resumes completed image analyses instead of sending them again. If the pinned Flow changes during generation, the run becomes stale and cannot replace the current revision.

The result is editable as structured sections: overview, problem, actors, assumptions, scope, business rules, functional and non-functional requirements, acceptance criteria, edge cases, open questions, and an evidence appendix. Saves and regenerations create immutable revisions, so user edits remain available. The selected current revision can move through draft, in-review, and approved states, export to Markdown, or be shared through a revocable link that expires after seven days. Public shares are read-only and expose only that revision and its allowlisted evidence.

Feature Document generation uses the same server/worker-only provider configuration as Research Projects:

```dotenv
RESEARCH_LLM_BASE_URL=https://api.openai.com/v1
RESEARCH_LLM_API_KEY=<secret>
RESEARCH_LLM_MODEL=<multimodal-json-capable-model>
```

Pass these variables to the API/worker runtime, never to a `VITE_*` client variable. The provider receives every source image required by the pinned Flow. Application logs and analytics contain status, identifiers, counts, and outcomes only; they exclude prompts, image bytes, generated document content, credentials, and signed media URLs.

## Product flow documentation (`FLOW.md`) for product managers

Astryx reconstructs the same app three ways for three readers: designers export an editable design system (Figma/tokens), developers export tokens as code (CSS/Tailwind/JSON/React), and product managers export **`FLOW.md`** — the app's observed user flows as an ordered, evidence-cited Markdown doc, a PRD-ready reference.

The `FLOW.md` export renders every observed flow with a clickable index, then per-flow sections carrying category, tags, description, and a numbered user journey where each step names the screen(s) it was seen on. When the autonomous crawler recorded provenance, each flow also shows its verification status (`complete` / `uncertain` / `incomplete`), confidence, and source — so a PM can tell a verified flow from a draft.

PMs reach it from an app's **Flows** tab ("Export FLOW.md"); it is also available in the design-system export panel. Like all catalog exports it requires a Pro entitlement and counts against the export fair-use limit.

## Bulk-importing apps from Mobbin (optional, advanced)

`scripts/catalog-import.ts` is a standalone, resumable script that crawls Mobbin's full app catalog directly (outside the queue/worker system) — useful for large batch imports. It requires an authenticated Mobbin browser profile (Playwright persistent context) and a real S3 bucket; not needed to just run the app against existing data.

```bash
DATABASE_URL="<your connection string>" npx tsx scripts/catalog-import.ts
```

Run multiple in parallel with `WORKER_ID=2`, `WORKER_ID=3`, etc. — each worker needs its own browser profile directory and gets its own resumable state file (`data/catalog-import-state-<id>.json`).
