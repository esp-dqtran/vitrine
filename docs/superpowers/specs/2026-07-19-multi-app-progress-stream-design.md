# Multi-App Progress Stream — Design

Date: 2026-07-19

Status: Approved conversational design; awaiting written-spec review

## Product Decision

Astryx will show concurrent crawl progress as one live row per active worker/app. Progress updates will be pushed from the API with Server-Sent Events (SSE); the browser will not poll on an interval.

The first implementation keeps the repository's file-backed progress boundary but removes the current write race by giving every worker its own progress file. The API owns aggregation and streaming, so the browser contract can later remain stable if persistence moves to PostgreSQL.

## Problem

`writeProgress` currently writes every update to `data/progress.json`. Six catalog-import workers are running concurrently with distinct `WORKER_ID` values, so they overwrite one another. `/api/progress` and `ProgressBanner` can therefore show only the most recent writer, not the set of apps actually crawling.

`useProgress` compounds this limitation by fetching `/api/progress` every 1.5 seconds even when nothing changes.

## Goals

- Show every concurrently active crawl as a separate progress row.
- Preserve a stable worker identity as the worker moves from one app to the next.
- Push an initial snapshot and subsequent changes without interval polling.
- Preserve the current stage, app, count, status, message, and update time semantics.
- Keep the existing admin-only access boundary.
- Preserve the single-worker experience for crawl, caption, synthesis, and smart-crawl commands.
- Avoid interrupting or restarting the six crawlers that are already running.
- Keep the API response independent from file persistence so PostgreSQL can replace it later.

## Non-Goals

- Moving progress persistence to PostgreSQL in this slice.
- Adding WebSockets or bidirectional real-time infrastructure.
- Replacing durable job/run state with ephemeral progress state.
- Adding per-worker pause, resume, retry, or cancellation.
- Parsing worker logs or process tables to reconstruct progress.
- Restarting the currently running catalog-import workers.

## User Experience

When at least one progress entry is active, the Apps screen shows one progress container with:

- A summary such as `6 apps crawling`.
- The existing cancellation action, labeled `Cancel all` because the current cancellation flag is shared.
- One row per worker, sorted with running entries first and then by most recent update.
- The app name, human-readable stage, optional message, and progress bar in each row.
- An indeterminate bar when a running entry has no known total.
- Error and cancelled styling consistent with the current banner.

Entries with `done` or `idle` status do not render. When no visible entries remain, the container disappears.

The browser retains the last valid snapshot during a temporary stream disconnect. `EventSource` reconnects automatically. A reconnect receives a fresh complete snapshot before later incremental notifications.

## Progress Contract

The frontend and API use an aggregate snapshot rather than exposing storage details:

```ts
interface ProgressEntry {
  id: string;
  stage: 'crawl' | 'caption' | 'synthesize' | 'smart-crawl';
  app: string;
  done: number;
  total: number;
  status: 'running' | 'done' | 'error' | 'cancelled' | 'idle';
  message?: string;
  updatedAt: string;
}

interface ProgressSnapshot {
  entries: ProgressEntry[];
}
```

`id` is a stable, server-generated storage identity. Catalog workers use `worker:<WORKER_ID>`. Commands without a worker identifier use `worker:default`.

The snapshot is complete. Each SSE progress event replaces frontend state instead of requiring client-side patching or deletion logic.

## Persistence

`writeProgress` resolves a worker scope from `WORKER_ID`, falling back to `default`. It writes one JSON document per scope under `data/progress/`.

Scope values are normalized to a narrow filename-safe identifier. Writes use a temporary file in the same directory followed by an atomic rename, preventing readers from observing partial JSON.

The progress store exposes three responsibilities:

1. Write one scoped entry.
2. Read and validate the complete snapshot.
3. Subscribe to snapshot changes.

Malformed files are ignored rather than breaking the entire snapshot. A later valid write restores that worker automatically.

The existing `data/progress.json` is supported as a legacy fallback only while no scoped progress files exist. This keeps the current six old-code workers visible as one last-writer entry without pretending the API can reconstruct their other five states. The workers must all restart on the new code before the UI can show all six rows.

## Server-Pushed Updates

The API adds an admin-only `GET /progress/stream` SSE route.

On connection it:

1. Sets `Content-Type: text/event-stream`, disables response caching and proxy buffering, and flushes headers.
2. Sends one complete `progress` event immediately.
3. Subscribes to the progress store's file-change notifications.
4. Sends a replacement `progress` event whenever the snapshot changes.
5. Sends an SSE comment heartbeat periodically to keep idle proxies from closing the connection. The heartbeat does not read progress state.
6. Removes its store listener and heartbeat when the response closes.

The progress store uses `fs.watch` for the scoped progress directory. Notifications are briefly coalesced so one atomic write produces at most one snapshot broadcast. No timer reads progress files.

`GET /progress` remains available as a one-shot snapshot endpoint for diagnostics and compatibility, but `useProgress` no longer calls it repeatedly.

## Frontend Data Flow

`useProgress` creates one same-origin `EventSource('/api/progress/stream')` when mounted. It parses named `progress` events, validates the aggregate shape, and replaces local state.

The hook closes the EventSource on unmount. It does not create a timer or issue fallback polling requests. Native EventSource reconnection handles transient network loss and sends the authenticated same-origin session cookie.

`ProgressBanner` receives the aggregate snapshot, filters terminal hidden entries, calculates the active count, and renders one row per visible entry.

## Cancellation

`POST /progress/cancel` and the shared cancellation flag remain unchanged in this slice. Because the flag is global, the UI labels the action `Cancel all` and does not imply that an individual row can be cancelled.

Per-worker cancellation requires scoped cancellation state and a separate concurrency review. It is intentionally deferred.

## Error Handling

- A malformed progress file is excluded and does not terminate the SSE stream.
- A temporary watcher error leaves connected clients on their last valid snapshot and is reported server-side.
- Invalid SSE payloads are ignored by the frontend without clearing valid displayed progress.
- EventSource connection errors rely on native reconnection; the hook does not create its own retry timer.
- Finished workers may leave terminal files on disk. Terminal entries remain in the API snapshot but are filtered from the banner.

## Compatibility and Rollout

The implementation does not restart active catalog workers. While they run the old code, the legacy fallback continues to expose only the last writer, matching current behavior.

At the next coordinated worker restart:

1. Let each worker finish its current app and stop cleanly.
2. Start all workers on the new code so each publishes its scoped record.
3. Confirm `/api/progress` returns one entry per worker.
4. Confirm `/api/progress/stream` pushes changes without browser polling.
5. Remove the obsolete `data/progress.json` after all workers use scoped files.

No partial restart is used because the legacy fallback is intentionally disabled once scoped files exist; coordinated restart prevents a misleading mixed snapshot.

## Testing

### Progress store

- Two worker identities write without overwriting one another.
- The default worker remains compatible with single-process commands.
- Atomic writes produce valid snapshots.
- Malformed files are ignored while valid entries remain.
- Legacy `data/progress.json` is returned only when no scoped entries exist.
- File-change subscriptions emit a new complete snapshot and clean up correctly.

### API

- `/progress` returns the aggregate snapshot for an admin.
- `/progress/stream` rejects non-admin users.
- The SSE route sends an immediate complete event.
- A store notification sends the next complete event.
- Closing the client removes listeners and heartbeat resources.

### Frontend

- `useProgress` consumes EventSource events without `setInterval` or repeated fetches.
- The hook retains the last valid snapshot on connection errors and closes on unmount.
- The banner renders one row per active app and the correct active count.
- Done/idle entries are hidden; error/cancelled entries use the intended variants.
- The multi-app action is labeled `Cancel all`.

### Verification

- Run focused progress store, API, hook, and banner tests.
- Run the complete test suite.
- Run the production Vite build.
- Inspect the browser network panel to confirm one persistent SSE request and no recurring `/api/progress` requests.

## Success Criteria

- Six restarted catalog workers produce six independently visible progress rows.
- One worker's update cannot replace another worker's state.
- Progress changes appear through SSE without interval polling.
- Stream reconnects restore a complete current snapshot.
- The active six-worker crawl is not interrupted by implementation or rollout.
