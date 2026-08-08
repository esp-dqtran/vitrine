#!/usr/bin/env bash
# Deploy the two things this repo ships:
#   web  -> Cloudflare Worker astryx-web
#   api  -> Docker container vitrines-api on the DigitalOcean droplet
#
# Usage:
#   scripts/deploy.sh [web|api|all] [--dry-run]
#
# `all` is the default release target. Releases are built from the current
# committed HEAD only; untracked files are deliberately excluded.
#
# The api path refuses to swap containers unless the release satisfies two
# preflights. Both correspond to outages that actually happened:
#
#   1. Migration parity. The API asserts at startup that every migration
#      recorded in the database is present on disk. A release built from a
#      commit that predates an applied migration crash-loops, AND so does the
#      container you would roll back to. Rollback is not a safety net here --
#      once the database moves forward, every older image is already broken.
#      So this is checked before the running container is touched.
#
#   2. Env values. APP_KNOWLEDGE_PROVIDER held a value the code no longer
#      accepted, which threw during module setup. Startup-time env parsing
#      turns a stale config line into an outage, so known-strict vars are
#      validated against the release before deploying.
set -euo pipefail

DROPLET="${DROPLET:-root@157.245.48.35}"
REMOTE_ROOT="${REMOTE_ROOT:-/opt/vitrines}"
ENV_FILE="${ENV_FILE:-$REMOTE_ROOT/current/api.env}"
CONTAINER="${CONTAINER:-vitrines-api}"
IMAGE="${IMAGE:-vitrines-api}"
PORT_BIND="${PORT_BIND:-127.0.0.1:3000:3000}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/health}"
PUBLIC_HEALTH="${PUBLIC_HEALTH:-https://api.vitrines.ai/health}"

cd "$(dirname "$0")/.."
say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
die() { printf '\n\033[31mFAILED: %s\033[0m\n' "$*" >&2; exit 1; }

require_clean_head() {
  git diff --quiet HEAD -- \
    || die "tracked changes are present. Commit or stash them before deploying so the release matches HEAD."
}

deploy_web() {
  local dry_run="${1:-}"
  say "Cloudflare: build + deploy astryx-web"
  npm run build
  if [ "$dry_run" = "--dry-run" ]; then
    npx wrangler deploy --dry-run --keep-vars
    return 0
  fi
  npx wrangler deploy --keep-vars
  # API_ORIGIN lives in the Cloudflare dashboard, not wrangler.jsonc.
  # --keep-vars is what stops a deploy from wiping it.
}

# Every migration the database says is applied must exist in the release.
preflight_migrations() {
  local release_dir="$1"
  say "Preflight: migration parity"
  local applied missing
  applied="$(node --env-file-if-exists=.env --experimental-strip-types -e '
    import("./src/db.ts").then(async (m) => {
      const r = await m.query("SELECT version FROM schema_migrations ORDER BY version");
      console.log(r.rows.map((x) => String(x.version).padStart(4, "0")).join("\n"));
      await m.closePool();
    }).catch((e) => { console.error(e.message); process.exit(1); });
  ')" || die "could not read applied migrations from the database"

  missing=""
  while read -r v; do
    [ -z "$v" ] && continue
    ls "$release_dir/migrations/${v}_"*.sql >/dev/null 2>&1 || missing="$missing $v"
  done <<< "$applied"

  if [ -n "$missing" ]; then
    printf 'Applied in the database but absent from this release:%s\n' "$missing" >&2
    die "migration parity — the API would crash-loop, and so would any rollback.
Commit the missing migration file(s), or build from a commit that contains them."
  fi
  echo "ok — $(wc -l <<< "$applied" | tr -d ' ') applied migrations all present"
}

# Vars the code parses strictly at startup. A bad value here is an outage,
# not a degraded feature, so check before swapping containers.
preflight_env() {
  say "Preflight: env values"
  local provider
  provider="$(ssh -o BatchMode=yes "$DROPLET" "grep '^APP_KNOWLEDGE_PROVIDER=' $ENV_FILE | cut -d= -f2-" || true)"
  case "$provider" in
    ""|"chatgpt-browser") echo "ok — APP_KNOWLEDGE_PROVIDER='$provider'" ;;
    *) die "APP_KNOWLEDGE_PROVIDER='$provider' is not a value the code accepts (want '' or chatgpt-browser)" ;;
  esac
}

deploy_api() {
  local dry_run="${1:-}"
  local sha release stamp
  require_clean_head
  sha="$(git rev-parse --short=8 HEAD)"
  release="$REMOTE_ROOT/releases/$sha"
  say "API: deploying $sha to $DROPLET"

  [ -z "$(git status --porcelain migrations/)" ] \
    || echo "warning: uncommitted files under migrations/ will NOT be in this build"

  git archive --format=tar.gz -o "/tmp/vitrines-$sha.tar.gz" HEAD
  ssh -o BatchMode=yes "$DROPLET" "mkdir -p '$release'"
  scp -o BatchMode=yes "/tmp/vitrines-$sha.tar.gz" "$DROPLET:$REMOTE_ROOT/releases/"
  ssh -o BatchMode=yes "$DROPLET" "tar xzf '$REMOTE_ROOT/releases/vitrines-$sha.tar.gz' -C '$release'"
  rm -f "/tmp/vitrines-$sha.tar.gz"

  # Preflight against the extracted release, before anything running is touched.
  local tmp; tmp="$(mktemp -d)"
  mkdir -p "$tmp/migrations"
  ssh -o BatchMode=yes "$DROPLET" "ls '$release/migrations/'" \
    | while read -r f; do [ -n "$f" ] && touch "$tmp/migrations/$f"; done
  preflight_migrations "$tmp"
  rm -rf "$tmp"
  preflight_env

  if [ "$dry_run" = "--dry-run" ]; then
    say "dry run — release uploaded and preflights passed; not building or swapping"
    return 0
  fi

  say "Build image $IMAGE:$sha"
  ssh -o BatchMode=yes "$DROPLET" "cd '$release' && docker build -f services/api/Dockerfile -t '$IMAGE:$sha' ."

  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  say "Swap container (previous kept as $CONTAINER-rollback-$stamp)"
  ssh -o BatchMode=yes "$DROPLET" "
    docker stop '$CONTAINER' >/dev/null 2>&1 || true
    docker rename '$CONTAINER' '$CONTAINER-rollback-$stamp' 2>/dev/null || true
    docker run -d --name '$CONTAINER' --restart unless-stopped \
      --env-file '$ENV_FILE' -p '$PORT_BIND' '$IMAGE:$sha' >/dev/null
  "

  say "Health"
  local code=""
  for _ in $(seq 1 12); do
    sleep 5
    code="$(ssh -o BatchMode=yes "$DROPLET" "curl -s -o /dev/null -w '%{http_code}' --max-time 8 '$HEALTH_URL'" || echo 000)"
    [ "$code" = "200" ] && break
  done

  if [ "$code" != "200" ]; then
    ssh -o BatchMode=yes "$DROPLET" "docker logs '$CONTAINER' 2>&1 | tail -20" || true
    printf '\n\033[31mHealth check failed (%s).\033[0m\n' "$code" >&2
    printf 'Previous container is %s. It is only a valid rollback if it\n' "$CONTAINER-rollback-$stamp" >&2
    printf 'contains every applied migration — after a schema change it does not.\n' >&2
    die "deploy unhealthy — fix forward, do not assume rollback works"
  fi

  echo "local health 200"
  curl -s -o /dev/null -w "public %{http_code}\n" --max-time 15 "$PUBLIC_HEALTH" || true
  say "Deployed $IMAGE:$sha"
}

case "${1:-}" in
  "") require_clean_head; deploy_web; deploy_api ;;
  web) require_clean_head; deploy_web "${2:-}" ;;
  api) deploy_api "${2:-}" ;;
  all) require_clean_head; deploy_web "${2:-}"; deploy_api "${2:-}" ;;
  --help|-h) cat <<'USAGE'
Usage: scripts/deploy.sh [web|api|all] [--dry-run]

Targets:
  web  Build and deploy the Cloudflare Worker (astryx-web).
  api  Build and roll out the API container to the DigitalOcean droplet.
  all  Deploy web, then API. This is the default target.

Options:
  --dry-run  Validate the Worker deploy and API preflights without swapping
             the live API container. The API release archive is still sent to
             the droplet so migration parity can be checked.

Environment overrides:
  DROPLET, REMOTE_ROOT, ENV_FILE, CONTAINER, IMAGE, PORT_BIND, HEALTH_URL,
  and PUBLIC_HEALTH.
USAGE
  ;;
  *) die "usage: scripts/deploy.sh [web|api|all] [--dry-run]" ;;
esac
