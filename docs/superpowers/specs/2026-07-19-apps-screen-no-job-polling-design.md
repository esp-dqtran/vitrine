# Apps Screen Without Job Polling

## Goal

The Apps screen must not request `GET /api/jobs`, either once or through polling.

## Design

- Remove the top-level `useJobs()` consumer from `App`.
- Render the Apps grid from persisted app data only; do not add synthetic queued or importing rows from job data.
- Keep import submission available by moving the existing `POST /api/jobs` request into a standalone API function that does not fetch the job list afterward.
- Leave job monitoring in crawler-specific/admin tooling outside the Apps screen unchanged.

## Error handling

The standalone import request preserves the current API error returned by `POST /api/jobs`, so the import dialog continues to show submission failures.

## Verification

- A regression test proves the Apps data path does not initiate `GET /api/jobs`.
- Existing import-dialog tests continue to pass.
- Type checking and the production frontend build pass.

## Out of scope

- Replacing crawler job polling with server-sent events or WebSockets.
- Changing worker, queue, or API job behavior.
- Displaying live queued/importing placeholders on the Apps grid.
