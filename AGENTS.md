# Project working rules

## Product naming

- The product name is **Vitrines**, not Astryx.
- Use **Vitrines** in user-facing copy, product discussions, marketing, documentation, and new UI text.
- The repository directory may remain named `Astryx`; treat that as a filesystem path only, not the current product name.
- Do not rename existing files, symbols, environment variables, or infrastructure identifiers solely for this naming rule unless the user explicitly requests a migration.

## Superpowers skill policy

- Do not automatically invoke or follow any `superpowers:*` skill.
- Treat Superpowers skills as opt-in. Use one only when the user explicitly asks for that specific skill or explicitly requests the Superpowers workflow.
- For ordinary tasks, execute the request directly without adding Superpowers brainstorming, specification, planning, worktree, or subagent steps.

## Git branch and worktree policy

- Work directly on the `main` branch for this project.
- Do not create or switch to a feature branch unless the user explicitly requests one.
- Do not initialize, add, or use a Git worktree unless the user explicitly requests one.
- Before editing files, verify that the current branch is `main`. If it is not, switch to `main` only when the existing working-tree changes can be preserved safely; otherwise stop and tell the user.
- Do not commit or push automatically. Commit or push `main` only when the user requests it.

## Production deployment

Vitrines has two production release targets:

- **API**: Docker image `vitrines-api` on the DigitalOcean droplet at `root@157.245.48.35`.
- **Web**: Cloudflare Worker `astryx-web`, which serves the Vite frontend and proxies `/api/*` to the API.

Deployment is an explicit production action. Do not deploy, commit, or push merely because code was changed; do so only when the user explicitly asks. Before an authorized deployment, ensure the current branch is `main`, verify the intended changes, run proportionate tests, and commit the release. The deploy script refuses tracked working-tree changes so its `git archive HEAD` release exactly matches the commit being deployed. Untracked files are not included.

Use the package commands rather than hand-assembling SSH, Docker, or Wrangler commands:

```sh
# Both targets (default production release)
npm run deploy

# One target only
npm run deploy:api
npm run deploy:web

# Preflight without swapping the API container or publishing the Worker
npm run deploy:production:dry-run
```

`scripts/deploy.sh` is the release implementation. For the API it archives the committed source, checks migration parity and strict production env values, builds the image on the droplet, waits for local health, and preserves the previous container under a timestamped rollback name. For the Worker it builds the frontend then runs Wrangler with `--keep-vars`.

`API_ORIGIN` is a Cloudflare dashboard-managed production secret. Never deploy the Worker with bare `wrangler deploy`: always use `npm run deploy:web`, `npm run deploy:cloudflare`, or `wrangler deploy --keep-vars`, so that binding is retained. Do not print or copy production secrets such as `/opt/vitrines/current/api.env` into logs or source control.

After a successful release, verify the relevant public endpoints: `https://api.vitrines.ai/health`, `https://api.vitrines.ai/ready`, and `https://vitrines.ai`. If a deployment fails, retain the emitted failure/log evidence and fix forward; do not assume an older API image can safely roll back after database migrations have been applied.

### GitHub Actions pipeline

`.github/workflows/deploy-production.yml` is the production pipeline. Every push to `main` first runs `npm ci`, `npm test`, and `npm run build`; only then does it deploy. The release job is serialized under the `vitrines-production` concurrency group and uses the GitHub `production` Environment, so configure that Environment to allow only `main` and require approval if your GitHub plan supports it.

Store these values as **production Environment secrets**, never in the repository or workflow file:

- `VITRINES_SSH_PRIVATE_KEY`: deploy key permitted to SSH to `root@157.245.48.35`.
- `VITRINES_SSH_KNOWN_HOSTS`: pinned `known_hosts` line(s) for the production droplet. Do not replace this with `ssh-keyscan` in CI.
- `VITRINES_DATABASE_URL`: PostgreSQL URL used only by the API migration-parity preflight.
- `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`: a least-privilege token and account for deploying Worker `astryx-web`.

The workflow can be run manually with `all`, `api`, or `web`, and can run the corresponding dry-run path. A successful push to `main` is the authorization for this configured automation; agents must still not commit or push without the user's explicit request.
