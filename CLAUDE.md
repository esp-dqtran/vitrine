# Deployment

This repo ships two **separate deployables** — a Cloudflare Worker ("Web") and a
Railway-hosted container ("API"). They are not the same service and are not
deployed together. Verified by reading `wrangler.jsonc`, `railway.json`,
`services/api/Dockerfile`, and `src/cloudflareFrontendWorker.ts` in full, and
cross-checked against `src/deployment.test.ts` (which asserts this exact
contract in code).

## Web — Cloudflare Worker `astryx-web`

- Build: `npm run build` (`vite build` → `dist/`)
- Deploy: `npm run deploy:cloudflare` → `npm run build && wrangler deploy --keep-vars`
- Dry run first: `npm run deploy:cloudflare:dry-run` → `npm run build && wrangler deploy --dry-run`
- Config: `wrangler.jsonc` — one flat config, **no** `env.staging`/`env.production` split.
- The worker (`src/cloudflareFrontendWorker.ts`) does two things:
  - Serves everything **except** `/api` and `/api/*` from the static `dist/` build (the `ASSETS` binding).
  - Reverse-proxies `/api/*` to `API_ORIGIN` (strips the `/api` prefix, forwards method/headers/body). `run_worker_first: ["/api", "/api/*"]` in `wrangler.jsonc` is what makes the Worker intercept these instead of the static-asset router.
  - If `API_ORIGIN` isn't set, it fails closed with a 503 (`{error: "API origin is not configured"}`) — it does not silently serve stale/wrong data.
  - Caches a small allowlist of public catalog GET paths at the edge (only `ok` responses, no `set-cookie`, `Cache-Control: public`).
- `API_ORIGIN` is **deliberately excluded** from `wrangler.jsonc` (asserted by `src/deployment.test.ts`) — it's a Cloudflare dashboard var/secret, and `--keep-vars` is what preserves it across redeploys. Local dev value lives in `.dev.vars` (`API_ORIGIN=http://127.0.0.1:3010`); template in `.dev.vars.example`.
- **There is no in-worker API logic.** `services/api/` code never runs inside this Worker — it's a thin proxy in front of a separately-hosted API.

## API — `services/api`, deployed on Railway

- `railway.json` (root): builds `services/api/Dockerfile` (Docker builder), runs a `preDeployCommand` **before every deploy**: `node --experimental-strip-types scripts/migrate.ts` (DB migrations), healthchecks `/ready` (real dependency checks — not `/health`, which is a static `{status:'ok'}`).
- `services/api/Dockerfile`: `node:22-slim`, `npm ci --omit=dev`, entrypoint `node --experimental-strip-types services/api/src/index.ts`, exposes port 3000.
- `services/api/package.json` has **no** `start`/`build`/`deploy` script of its own — the Dockerfile `CMD` is the source of truth for how it runs.
- Local alternatives (dev only, not production deploy mechanisms):
  - `docker-compose.yml` — same Dockerfile, plus a `migrate` service gating `api` via `depends_on: service_completed_successfully`.
  - `npm run service:api` → `node --env-file-if-exists=.env --import tsx services/api/src/index.ts` (no Docker).
- Required env vars (see `.env.example` / `docker-compose.yml` for the full local-dev list): `DATABASE_URL`, `RABBITMQ_URL`, `JWT_SIGNING_SECRET`/`JWT_ISSUER`/`JWT_AUDIENCE`, `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`/price IDs, `MEDIA_SIGNING_SECRET`, `CRAWL_SESSION_ENCRYPTION_KEY`, `APP_URL`, feature flags (`RESEARCH_PROJECTS_ENABLED`, `TEAMS_ENABLED`, `ADVANCED_SEARCH_ENABLED`), object-store (`OBJECT_STORE_S3_*`), etc. Production values are set in Railway's dashboard — none of this lives in the repo.

## Known gaps — do not assume these exist

- **No CI/CD**: no `.github` directory, no workflow files anywhere. `docs/production-readiness-matrix.md` self-reports this as `Missing`.
- **No documented Railway deploy trigger** — `railway.json` only configures how a deploy builds/runs once triggered; whether that's push-to-deploy or manual `railway up` is not specified anywhere in-repo.
- **No canary / staged-rollout infrastructure.** The closest analog is the manual Advanced Search feature-flag rollout documented in `README.md` (deploy with the flag off → backfill → verify → flip `ADVANCED_SEARCH_ENABLED` → rebuild frontend with `VITE_ADVANCED_SEARCH_ENABLED=true`) — that's an app-level feature flag, not an infra-level canary.
- **No `DEPLOY.md`/`RUNBOOK.md`** anywhere in the repo — everything above was reconstructed from `wrangler.jsonc`, `railway.json`, the Dockerfile, the Worker source, and `src/deployment.test.ts`.
- **No confirmed live production URL** for either service. `docs/production-readiness-matrix.md` explicitly states hosting credentials/domain/DNS are unverified and the project is "not yet production-ready." Any `api.vitrines.ai`-style hostname seen in test fixtures (`src/deployment.test.ts`) is example data, not a real configured endpoint — don't treat it as one.
- **No Terraform/Pulumi/IaC** — infra config lives only in `wrangler.jsonc` + `railway.json`.

When asked to "deploy," confirm with the user which of these two (or both) they mean, and whether they want the dry-run first — `deploy:cloudflare` and Railway's container deploy are independent actions with no single combined command.
