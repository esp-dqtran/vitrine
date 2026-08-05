# Deployment

This repo ships two **separate deployables** — a Cloudflare Worker ("Web") and
the `services/api` backend ("API"). They are not the same service and are not
deployed together.

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

## API — `services/api`

- **Not deployed on Railway** — `railway.json` was removed and is not coming back; don't reintroduce it or suggest `railway up`/Railway dashboard steps.
- **No deploy mechanism is currently configured in this repo.** There is no CI/CD, no other platform config (no Dockerfile-consuming host config, no Fly/Render/etc. files), and no documented manual process. If asked to deploy the API, say so plainly and ask the user how/where it should be deployed rather than assuming Railway or inventing a new target.
- `services/api/Dockerfile` still exists (`node:22-slim`, `npm ci --omit=dev`, entrypoint `node --experimental-strip-types services/api/src/index.ts`, exposes port 3000) and is still used for **local dev** via `docker-compose.yml` — this is unrelated to Railway and wasn't touched.
- `services/api/package.json` has **no** `start`/`build`/`deploy` script of its own — the Dockerfile `CMD` is the source of truth for how the container runs, wherever it ends up hosted.
- Local alternatives (dev only): `docker-compose.yml` (same Dockerfile, plus a `migrate` service gating `api` via `depends_on: service_completed_successfully`), or `npm run service:api` → `node --env-file-if-exists=.env --import tsx services/api/src/index.ts` (no Docker).
- Required env vars (see `.env.example` / `docker-compose.yml` for the full local-dev list): `DATABASE_URL`, `RABBITMQ_URL`, `JWT_SIGNING_SECRET`/`JWT_ISSUER`/`JWT_AUDIENCE`, `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`/price IDs, `MEDIA_SIGNING_SECRET`, `CRAWL_SESSION_ENCRYPTION_KEY`, `APP_URL`, feature flags (`RESEARCH_PROJECTS_ENABLED`, `TEAMS_ENABLED`, `ADVANCED_SEARCH_ENABLED`), object-store (`OBJECT_STORE_S3_*`), etc. Wherever the API ends up hosted, these need to be configured there — none of this lives in the repo.

## Known gaps — do not assume these exist

- **No CI/CD**: no `.github` directory, no workflow files anywhere. `docs/production-readiness-matrix.md` self-reports this as `Missing`.
- **No API deploy target at all** (see above) — this is a real gap, not just undocumented.
- **No canary / staged-rollout infrastructure.** The closest analog is the manual Advanced Search feature-flag rollout documented in `README.md` (deploy with the flag off → backfill → verify → flip `ADVANCED_SEARCH_ENABLED` → rebuild frontend with `VITE_ADVANCED_SEARCH_ENABLED=true`) — that's an app-level feature flag, not an infra-level canary.
- **No `DEPLOY.md`/`RUNBOOK.md`** anywhere in the repo.
- **No confirmed live production URL** for either service. `docs/production-readiness-matrix.md` explicitly states hosting credentials/domain/DNS are unverified and the project is "not yet production-ready." Any `api.vitrines.ai`-style hostname seen in test fixtures (`src/deployment.test.ts`) is example data, not a real configured endpoint — don't treat it as one.
- **No Terraform/Pulumi/IaC** — infra config lives only in `wrangler.jsonc`.

When asked to "deploy," confirm which of these two (or both) the user means. For the Web Worker, offer the dry-run first. For the API, there is currently nothing to run — ask where it should go instead of guessing.
