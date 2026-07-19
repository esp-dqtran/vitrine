# Fail-Closed Catalog Import Design

## Goal

Make every Mobbin catalog import fail closed: an app may be marked `done` only when its Screens, UI Elements, Flows, flow-step evidence, and stored media match the auditable Mobbin totals for that app and platform.

## Required behavior

- Process the three stages in order: Screens, UI Elements, then Flows.
- Stop the current app at the first incomplete or errored stage.
- Mark only that app `failed`; do not stop the worker pool.
- Preserve completed repair phases as `false`.
- Keep the failing phase and every unattempted later phase as `true`.
- Advance the worker to its next queued app after recording the failure.
- Never convert a partial selection, partial discovery, swallowed ingestion error, or invalid evidence reference into a successful stage.

## Source totals

Mobbin's displayed `Showing N` count is the expected count for every stage.

- Screens compare unique captured screen records with the displayed screen total.
- UI Elements compare unique captured element records with the displayed UI-element total. The selected-card count is diagnostic only and must never replace the displayed total.
- Flows read the displayed flow total before scrolling. The stage compares that total with persisted Mobbin flow IDs, including flows downloaded during the current pass. Counting only rows encountered by the virtualized scroller is insufficient.

If Mobbin does not expose a valid integer total for a stage, that stage fails as unauditable.

## Stage outcomes

Every stage returns a `StageOutcome` containing `status`, `discovered`, and `captured`.

- `discovered` is always Mobbin's displayed total.
- `captured` is the number of distinct expected artifacts proven present after ingestion.
- `status` is `done` only when `captured === discovered`.
- Cancellation remains distinct from failure and must never be reported as success.

The existing `assertCatalogStageComplete` boundary remains authoritative in `scripts/catalog-import.ts`. It stops the app immediately when a stage returns `error`, omits auditable counts, or reports unequal counts.

## Error handling

Transient database saturation may use the existing bounded retry policy. After retry exhaustion, the error propagates and fails the app.

Download, extraction, validation, object-upload, image-attachment, and flow-persistence errors must not be logged and discarded. A row-level download failure may be recorded for diagnostics, but the stage must still return incomplete. Persistence errors must reject the stage immediately after bounded retries.

## Persisted-data gate

Before setting an app job to `done`, the importer performs a final read from PostgreSQL for the same app and platform. The gate verifies:

- persisted Screens are at least the verified Mobbin screen total;
- persisted UI Elements are at least the verified Mobbin UI-element total;
- persisted Flows are at least the verified Mobbin flow total;
- every flow-step evidence ID resolves to an image row;
- every Screen, UI Element, and flow-step image counted toward completeness has valid stored-object metadata.

Any mismatch throws before `job.repair` is deleted. The job is saved as `failed` with the remaining repair phases intact.

Counts may be greater than Mobbin's current total because older catalog versions can retain evidence. Completeness therefore requires `persisted >= expected`; the per-pass capture stage still requires exact equality with the current Mobbin total.

## State transitions

For a new job, repair starts as:

```json
{"screens":true,"uiElements":true,"flows":true}
```

Each phase flips to `false` only after its stage returns exact auditable counts. The final persisted-data gate then validates all completed phases together and recomputes repair flags if storage does not match those stage results. Examples:

- Screens fail: all three flags remain `true`.
- UI Elements fail after Screens pass: `screens` is `false`; `uiElements` and `flows` remain `true`.
- Flows fail after earlier stages pass: only `flows` remains `true`.
- Final persisted-data gate fails: recompute repair flags from expected and persisted counts, preserving any invalid-flow-reference failure as `flows: true`.

Only a fully verified app deletes `repair` and becomes `done`.

## Implementation boundaries

- `src/progress.ts`: make capture targets and repair planning reflect Mobbin totals without selection-based downgrades.
- `src/bulkDownload.ts`: use displayed totals for Screens, UI Elements, and Flows; propagate ingestion failures; report exact stage coverage.
- `scripts/catalog-import.ts`: run the final persisted-data gate before setting `done` and preserve fail-closed repair state.
- A shared catalog-verification module should own persisted count and invalid-reference queries so the importer and `scripts/verify-catalog-import.ts` cannot drift.

No crawler supervisor, worker-pool shutdown, per-app cross-system transaction, or unrelated Vitrine UI change is included.

## Testing

Implementation follows test-driven development. Regression coverage must prove:

- selecting 136 of 144 UI Elements returns an incomplete `136/144` stage;
- discovering fewer flow rows than Mobbin's displayed total fails the flow stage;
- a per-flow ingestion failure retries only when transient and rejects after exhaustion;
- missing auditable totals fail the stage;
- the final persisted-data gate rejects missing Screens, UI Elements, Flows, evidence images, and stored-object metadata;
- job state preserves the correct repair flags after failure;
- one failed app does not prevent the worker loop from considering its next job;
- a complete app reaches `done` only after the persisted-data gate passes.

Focused tests run before the complete repository test suite and TypeScript build.

## Existing-data handling

This change prevents future false successes. Existing catalog state is reconciled by the current verification/repair tooling after deployment. Apps with stale failed state but complete live data can be normalized by the verifier; apps with real gaps remain queued for their exact repair phases.
