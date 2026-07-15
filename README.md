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

## Autonomous app-flow discovery

Administrators can open an app's Intelligent crawler workspace, enter a public app URL, upload a shared Playwright storage state, and start a deep autonomous crawl. The parent run first builds a cited product dossier, then delegates bounded missions to concurrent discovery agents. Read missions may overlap; authentication and mutations use durable single-account leases. Complete high-confidence paths become ordered, evidence-backed Flows, while uncertain paths remain drafts with exact blockers.

Generate `CRAWL_SESSION_ENCRYPTION_KEY` with `openssl rand -base64 32` before uploading a session. Queue messages contain only the app slug and durable parent run ID; browser state, credentials, dossiers, and missions remain in encrypted/database-backed storage. See [Autonomous crawler operations](docs/operations/autonomous-crawler.md) for setup, safety controls, recovery, and acceptance procedures.

## Bulk-importing apps from Mobbin (optional, advanced)

`scripts/catalog-import.ts` is a standalone, resumable script that crawls Mobbin's full app catalog directly (outside the queue/worker system) — useful for large batch imports. It requires an authenticated Mobbin browser profile (Playwright persistent context) and a real S3 bucket; not needed to just run the app against existing data.

```bash
DATABASE_URL="<your connection string>" npx tsx scripts/catalog-import.ts
```

Run multiple in parallel with `WORKER_ID=2`, `WORKER_ID=3`, etc. — each worker needs its own browser profile directory and gets its own resumable state file (`data/catalog-import-state-<id>.json`).
