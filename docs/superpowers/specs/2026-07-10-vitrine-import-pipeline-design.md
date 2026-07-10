# Vitrine Import Pipeline Design

**Date:** 2026-07-10

## Goal

Allow a user to submit one Mobbin application from Vitrine and observe a durable end-to-end pipeline:

1. crawl its screenshots;
2. persist image metadata in Postgres;
3. caption only that application's uncaptured images through the configured browser-driven LLM provider;
4. synthesize a Markdown design-system document;
5. display pipeline status and the completed document in Vitrine.

This is the first vertical slice toward processing many applications. It must reuse the existing Postgres, RabbitMQ, worker, Playwright, and Vitrine seams without adding another orchestration mechanism.

## Scope

### Included

- A Vitrine form accepting a Mobbin app URL and application name.
- API validation and creation of an `import-app` job.
- Existing RabbitMQ delivery, retries, and dead-letter handling.
- The existing worker pipeline: `import-app` -> `caption-app` -> `synthesize-app`.
- Per-application caption selection.
- A job list that groups parent and child stages.
- Read-only retrieval and display of generated Markdown.
- Resolution and serving of bulk-downloaded screenshots referenced by the existing `mobbin-bulk:<hash>` storage scheme.
- Cooperative cancellation through the existing job endpoint.
- Focused automated tests and existing repository verification commands.

### Excluded

- Multiple RabbitMQ queues or horizontally scaled workers.
- Multiple Mobbin or LLM accounts.
- Object storage for screenshots or Markdown.
- Replacing browser-driven LLM sessions with an API provider.
- Real user authentication.
- Production hosting of Vitrine.
- Per-job numeric progress stored in Postgres.

These exclusions avoid speculative infrastructure while preserving a direct path to stage-specific queues and workers.

## Runtime Model

The first slice runs locally:

- Postgres and RabbitMQ run through Docker Compose.
- Vite, the API service, and the import worker run on the host.
- The worker reuses existing authenticated Mobbin and LLM browser profiles and may open visible Playwright windows.

The import worker remains the only process that launches Playwright. RabbitMQ `prefetch(1)` preserves serial access to the current single authenticated profile.

## Architecture

```text
Vitrine
  | POST /api/jobs
  v
API service
  | create job
  v
Postgres jobs ledger
  | publish job
  v
RabbitMQ mobbin-jobs
  |
  v
Import worker
  |-- crawl Mobbin screenshots
  |-- enqueue caption child
  |-- caption this app's images
  |-- enqueue synthesis child
  `-- write data/design-systems/<app>.md

Vitrine
  | GET /api/jobs
  | GET /api/design-systems/:app
  | GET /api/media/:app/:hash
  `-- render pipeline status and Markdown
```

Postgres is authoritative for durable job status. RabbitMQ transports work and retries failures; it is not the user-facing record of pipeline state. The existing `progress.json` remains the active worker's item counter while the system has one worker.

## API Design

### Create an import pipeline

Use the existing `POST /jobs` endpoint with:

```json
{
  "type": "import-app",
  "name": "linear",
  "url": "https://mobbin.com/apps/.../screens"
}
```

Validation rules:

- `type` must be `import-app` for the Vitrine form.
- `name` must be a non-empty lowercase slug containing letters, numbers, and hyphens.
- `url` must be an HTTPS URL on `mobbin.com` whose path identifies an application screens page.

The API creates the job first, then publishes it. If publication fails, it marks the job `error` with the broker error message and returns an error response. A job must not remain queued when it was never delivered.

### List jobs

Continue using `GET /jobs`. Vitrine reconstructs the pipeline tree from `id` and `parent_id` and displays the three stages in chronological order. The response already includes type, payload, status, message, and timestamps.

### Cancel a job

Continue using `POST /jobs/:id/cancel`.

- Queued jobs become cancelled and are skipped when consumed.
- Running jobs request cooperative cancellation through the current cancellation mechanism.
- Completed or failed jobs are returned unchanged.

Cancellation does not recursively rewrite completed child stages. With one serial worker, the active cancellation flag is unambiguous.

### Retrieve generated Markdown

Add `GET /design-systems/:app`.

- Validate `:app` using the same slug rule as job creation.
- Read `data/design-systems/<app>.md`.
- Return `text/markdown; charset=utf-8` when present.
- Return `404` when synthesis has not produced a document.
- Never accept path separators or decoded traversal segments.

### Resolve bulk-downloaded screenshots

Bulk crawling currently stores files under `data/images/<app>/<hash>.<ext>` and records `mobbin-bulk:<hash>` in Postgres. Captioning cannot `fetch()` that synthetic reference, and Vitrine cannot render it directly. Preserve the database representation for idempotency and add one shared resolver:

- captioning resolves `mobbin-bulk:<hash>` to the existing local file and passes it directly to the browser upload;
- remote `https://` image URLs retain the existing temporary-download behavior;
- `GET /media/:app/:hash` validates the app slug and 16-character hexadecimal hash, resolves the matching PNG, JPEG, or WebP file, and serves it read-only;
- Vitrine maps a synthetic reference to `/api/media/<app>/<hash>` before rendering a screenshot.

Existing `mobbin-bulk:` rows remain valid; no data rewrite or duplicate image insertion is required.

For local development, Vite proxies `/api/jobs`, `/api/design-systems`, and `/api/media` to the API service on `localhost:3000`, stripping the `/api` prefix. The existing database-backed `/api/apps` gallery endpoint remains Vite middleware and is not proxied.

## Worker Pipeline

### Import stage

The existing `import-app` handler runs `crawlBulkDownload(url, name)`. Bulk crawling returns an explicit `done`, `cancelled`, or `error` outcome instead of returning `void`; only `done` creates and publishes a `caption-app` child with `parent_id` equal to the import job ID.

### Caption stage

Caption selection must be scoped by application name. The database query for uncaptured images accepts an optional app filter; the CLI may omit it to retain its current all-app behavior, while the worker always passes `job.name`.

The caption function returns an explicit outcome containing `done`, `cancelled`, or `error` plus an optional message. The CLI renders that outcome for the terminal. The worker creates and publishes a `synthesize-app` child only for `done`; it maps the other outcomes to the durable job status without advancing the pipeline.

### Synthesis stage

The existing rolling merge algorithm remains unchanged. It reads captioned images for the named app, writes after every batch, and resumes from `data/design-systems/<app>.md` after interruption. Like captioning, it returns an explicit outcome so a browser logout, cancellation, or incomplete reply cannot be recorded as a successful job.

## Vitrine Experience

Vitrine adds a compact import panel above the gallery:

- application name input;
- Mobbin screens URL input;
- submit button;
- inline validation and submission errors.

After submission, the jobs panel shows each import pipeline as a three-stage sequence:

- Import screenshots
- Caption screens
- Synthesize design system

Each stage shows queued, running, done, error, or cancelled. The panel polls while any stage is active. Error messages and cancellation controls appear on the affected stage.

When synthesis is done, Vitrine fetches the Markdown endpoint and displays the document in the existing application detail experience. Rendering may use the design-system package's existing Markdown component; no new Markdown dependency is introduced.

## Idempotency and Failure Handling

- Screenshot insertion keeps its existing skip-if-present behavior.
- Captioning only selects rows with a null description.
- Synthesis checkpoints after each batch.
- The queue retries a failed message three times and then dead-letters it.
- Thrown operational failures update the durable job to `error` before RabbitMQ retries them. Stage outcomes handled without a throw are mapped to `done`, `cancelled`, or `error` exactly once by the worker.
- Retried jobs may repeat completed calls, so every stage must remain safe to rerun.
- A failed stage never enqueues its successor.
- API publication failure is reflected in Postgres immediately.
- Browser login or selector failures surface through the job message.

## Scale Path

The first slice deliberately uses one queue and one worker. When throughput requires more concurrency:

1. split routing into discover, crawl, caption, and synthesis queues;
2. shard crawl workers by Mobbin account/profile, keeping one active browser owner per profile;
3. shard browser caption workers by provider profile;
4. move captioning to an LLM API when browser automation becomes the measured bottleneck;
5. add per-job `done` and `total` fields before running multiple active workers;
6. move files to object storage only when work spans multiple hosts.

The API contract, Postgres job tree, stage handlers, and Vitrine status model remain valid through these changes.

## Testing

Add focused tests for:

- valid and invalid import request payloads;
- broker publication failure marking the created job as `error`;
- per-app uncaptioned image selection;
- successful child-job creation and parent linkage;
- failed stages not creating successor jobs;
- valid Markdown retrieval, missing output, and traversal rejection;
- local bulk-image resolution, media retrieval, and invalid hash rejection;
- Vitrine job-tree grouping as a small pure function.

Final verification:

```sh
npm test
npx tsc --noEmit
npm run build
docker compose config --quiet
```

The manual acceptance path is: submit one Mobbin URL in Vitrine, watch all three stages reach `done`, open the generated design-system document, then resubmit the same app and confirm completed data is not duplicated.

## Success Criteria

- A user can start the complete pipeline from Vitrine without running a pipeline CLI command.
- The import, caption, and synthesis stages are durably visible as one parent/child job chain.
- Captioning an application does not process another application's images.
- A failed or cancelled stage does not advance the pipeline.
- Completed Markdown is retrievable and visible in Vitrine.
- The pipeline is safe to rerun for the same application.
- Existing tests, type checking, frontend build, and Compose validation pass.
