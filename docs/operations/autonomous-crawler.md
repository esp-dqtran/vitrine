# Autonomous crawler operations

The autonomous crawler extends Astryx's existing durable Playwright runner. Research and discovery agents propose bounded steps; only planned child runs execute browser actions and create evidence. The finalizer publishes only complete paths with verified object-backed screenshots.

## Configuration

Set these on both API and import-worker services:

- `CRAWL_SESSION_ENCRYPTION_KEY`: canonical base64 for exactly 32 random bytes (`openssl rand -base64 32`). Rotate only with a session re-upload; old ciphertext cannot be decrypted with the new key.
- `CRAWL_WORKER_ID`: stable identity for run and mission leases.
- `CRAWL_STALE_RUN_THRESHOLD_MS`: age after which interrupted planned child runs may be recovered.
- `CHAT_PROFILE_ROOT`: root containing authenticated provider profiles.
- `HEADLESS`: `true` in unattended environments; use `false` when establishing provider or app sessions.

Database migrations, RabbitMQ, object storage readiness, and the existing API/import-worker services must be healthy before accepting runs.

## Shared session upload

Use the Intelligent crawler workspace's Shared account session control. Upload Playwright `storageState` JSON for the administrator-provided test account. The API encrypts it with AES-256-GCM immediately and returns only session ID, state version, and update time. It never returns ciphertext or cookie values.

Use one disposable/shared account per app. Configure required credentials as worker environment variables and select only their names, such as `APP_TEST_EMAIL` and `APP_TEST_PASSWORD`. Queue payloads and API run views never contain their values. A refreshed upload increments the account-state version.

## Starting and controlling a run

Enter the public homepage, platform, provider, secret names, concurrency, and ceilings. The server accepts 1–8 discovery agents and bounded runtime, action, model-request, and storage limits.

`allow_all` permits declared mutations. It requires an explicit acknowledgement when a run is created and again when an interrupted run resumes. Without it, mutating missions are not scheduled. Even with it, only one mutation or authentication owner can hold the shared-account lease at a time.

Pause stops new mission claims and retains checkpoints. Resume republishes the same parent run ID. Cancel marks queued/running missions cancelled and releases account leases. Do not create a replacement parent merely because a worker restarted.

## Inspection and recovery

The run detail exposes the cited dossier, mission status/owner, state and transition counts, and exact draft blockers. Inspect database state when diagnosing a stalled run:

```sql
SELECT id, status, worker_id, heartbeat_at, pause_requested_at, cancel_requested_at
FROM crawl_runs WHERE id = :run_id;

SELECT id, mission_key, mode, status, worker_id, heartbeat_at, lease_expires_at, checkpoint
FROM crawl_missions WHERE run_id = :run_id ORDER BY priority DESC, id;

SELECT purpose, mission_id, worker_id, heartbeat_at, lease_expires_at
FROM crawl_account_leases WHERE run_id = :run_id;
```

Expired mission leases are reclaimable; completed missions, states, transitions, and evidence are append-only inputs to the resumed run. Infrastructure errors remain retryable through RabbitMQ's bounded delivery attempts. Ceiling exhaustion produces an `interrupted` parent with a structured partial summary, not a false success. Semantic terminal failures become `failed` only when no valid recovery or follow-up remains.

## Publication and object blockers

A Flow is automatically eligible only when its mission succeeded, its transition path is coherent and acyclic, every state has verified destination evidence, ownership matches the parent app/platform/version, and minimum confidence is at least `0.85`. Missing/corrupt objects, low confidence, incomplete missions, and incoherent paths stay as curator-reviewable drafts.

After validated Flows merge under the target version lock, screen analysis and design-system synthesis run. Existing version publication blockers still apply; the currently published version is never mutated when enrichment or blockers remain.

## Acceptance procedure

The deterministic acceptance test is safe for CI:

```bash
node --experimental-strip-types --test --test-concurrency=1 src/autonomousAcceptance.test.ts
```

For a live app, obtain explicit authorization for the URL and shared test account. Upload/refresh its session, start a deep three-agent run with acknowledged `allow_all`, record the parent ID and ceilings, and simulate one worker interruption. Verify the same parent resumes, mutation lease ownership never overlaps, every published step has retrievable object-backed evidence, and a second run creates neither duplicate Flow IDs nor cross-platform evidence. Save run IDs, dossier sources, lease transitions, coverage growth, draft blockers, duration, model requests, and object bytes in the operations handoff. Never store credentials, cookies, storage state, or secret values in source control or acceptance notes.
