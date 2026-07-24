# App Knowledge Design-System Extraction

Date: 2026-07-24  
Status: Approved for implementation

## Problem

App Knowledge job `2` successfully analyzed 610 unique 15Five web screens, but
the final synthesis request timed out before a revision was saved.

The current service expands 754 flow-step records that point back to those
screens into full duplicate analysis objects. The final provider request
therefore contains 1,364 analysis objects, about 4.61 MB of analysis JSON, plus
144 flows. The Antigravity browser provider has a six-minute call timeout. When
that call fails, `completeGeneration` is never reached, snapshot `1` retains no
revision, and the current App Knowledge review UI has no Design language or
Components result to display.

All 610 UI-element records are quarantined because their images are not verified
isolated component captures. They must not be treated as trusted components.

## Goal

Produce and persist a useful draft design system for the existing 15Five
snapshot by reusing the 610 completed screen analyses without recrawling images
or repeating per-screen analysis.

The persisted revision must populate the existing canonical
`componentCandidates` and `designLanguage` fields so the current App Knowledge
review UI can display the result.

## Non-goals

- Reanalyzing source images.
- Requiring another Mobbin or Antigravity login.
- Synthesizing the 144 flows in this pass.
- Producing complete product, BA, or PM knowledge in this pass.
- Treating full-page UI-element captures as verified components.
- Creating a parallel design-system storage model or a second review UI.
- Fixing taxonomy or confidence calibration in the per-screen analyzer.

## Approaches Considered

### Retry the existing request with a longer timeout

This is the smallest code change, but it preserves the 4.61 MB duplicated
payload and single point of failure. It also cannot resume partial synthesis.
This approach is rejected.

### Deterministic local aggregation

The service could count repeated themes, layout phrases, icons, and imagery
without another model call. This would be fast and inexpensive, but it would
produce phrase frequencies rather than a coherent design language or reusable
component candidates. This approach is rejected as the primary extractor.

### Hierarchical design-system synthesis

The service will compact the completed screen analyses, partition them into
bounded chunks, synthesize and persist a design-system fragment for each chunk,
then merge only those fragments. This is the selected approach because it
removes duplicate flow payloads, bounds each provider call, supports resume,
and preserves the existing review contract.

## Architecture

### Design-system fragment

Introduce an internal, validated fragment containing:

- `componentCandidates`
- `designLanguage`
- the source evidence IDs cited by every claim

The design-language categories remain the canonical categories already used by
`AppKnowledgeSnapshot`:

- color
- typography
- spacing
- radius
- border
- effects
- layout
- iconography
- imagery
- responsive
- content
- interaction

Component outputs remain candidates with `needs_review` status because the
evidence consists of full-page screenshots.

### Compact screen signal

Each completed screen analysis is converted to a smaller provider input that
keeps only design-relevant fields:

- evidence ID
- normalized product-area and page-type labels
- viewport and theme
- visual hierarchy
- layout and content patterns
- imagery and icons
- interaction patterns
- visible states
- accessibility observations

Visible text, purpose, intent, friction, available actions, system feedback, and
uncertain-state prose are excluded from design-system synthesis unless a later
requirement demonstrates that a category needs them.

Flow-step duplicates are never expanded into additional analysis objects.
Quarantined UI-element records are not included.

### Chunk planner

Compact signals are grouped by product area, page type, and theme so related
screens are synthesized together. The planner then creates deterministic chunks
bounded by serialized byte size rather than relying only on screen count.

The implementation will expose the byte ceiling as an internal dependency for
tests while using one production default. A single oversized signal fails with
a sanitized validation error rather than silently exceeding the provider
budget.

Deterministic ordering and boundaries are required so an interrupted job can
identify and reuse the same chunks.

### Durable chunk results

Add a job-scoped synthesis-chunk store keyed by:

- job ID
- source SHA-256
- prompt version
- provider model
- chunk identity

Each row records status, attempt count, sanitized error code, and validated
fragment JSON. Completed rows are reused when the same job resumes. Source,
prompt, or provider changes produce different identities and cannot reuse stale
fragments.

The existing 610 per-screen evidence rows remain the source of truth. Chunk
storage is an aggregation cache, not a replacement for evidence storage.

### Merge

The final provider request contains only the validated fragment outputs and the
complete set of allowed screen evidence IDs. It does not contain the original
610 analyses, flow-step copies, flow metadata, or images.

The merge prompt must:

- deduplicate semantically equivalent claims;
- normalize phrasing without dropping evidence citations;
- keep claims separated by canonical design-language category;
- merge component variants conservatively;
- retain `needs_review` for component candidates;
- reject invented evidence IDs;
- return only the internal design-system result shape.

The merged result is validated before persistence.

### Canonical revision assembly

The provider is not asked to reproduce all screens. The service assembles the
canonical snapshot locally:

- `identity` comes from the claimed job and current source hash;
- `coverage` comes from the existing evidence manifest and records;
- `screens` are mapped deterministically from the 610 validated screen
  analyses, with stable IDs, empty claims, and `needs_review`;
- `componentCandidates` and `designLanguage` come from the merged design-system
  result;
- `flows` is empty for this pass;
- `productKnowledge` contains a minimal evidence-backed capability inventory
  derived deterministically from distinct product areas, while all other
  product arrays remain empty.

This keeps the current `AppKnowledgeSnapshot`, store, API, role projection, and
review-panel contracts intact without asking the model to emit unrelated
content.

The result is saved through the existing `completeGeneration` transaction. The
snapshot receives a generated draft revision and `current_revision_id` is
updated only after the entire result validates.

## Job and Resume Behavior

Job `2` will be retried through the normal job transport after deployment.
Completed evidence rows must be reused; no image-analysis calls should occur.

During a run:

1. Claim the job and validate source identity.
2. Load completed screen analyses.
3. Plan deterministic design-system chunks.
4. Reuse completed chunk results.
5. Run missing chunks with bounded concurrency.
6. Merge validated fragment results.
7. Recheck source identity.
8. Assemble and validate the canonical snapshot.
9. Persist the generated draft revision.

Cancellation and source-drift checks continue to apply between provider calls
and immediately before persistence.

## Error Handling

- Provider timeout, invalid output, and rate limiting are recorded per chunk.
- Provider failures expose only sanitized error codes to stored job state.
- A failed chunk prevents merge but preserves all completed chunks for resume.
- Merge failure preserves chunk results and leaves the snapshot revision
  unchanged.
- Invalid or invented evidence references fail validation before persistence.
- Source drift marks the job stale and prevents saving results generated from
  older evidence.
- The final job is `done` only after a draft revision has been committed.

## Database Changes

Add one migration for durable job synthesis chunks. The table must use foreign
keys and unique constraints to prevent duplicate chunk identities for a job.
JSON is stored only after fragment validation.

No existing App Knowledge table or column is removed or repurposed.

## Provider Contract

Extend the internal provider abstraction with two focused calls:

1. synthesize a design-system fragment from one compact chunk;
2. merge validated fragments into one design-system result.

Browser-backed providers continue using the same authenticated conversation and
JSON-only transport. Per-screen analysis and the existing full-snapshot
synthesis contract remain available for other callers until a separate
migration removes them.

## Testing

Implementation follows test-driven development.

Required tests:

- a 610-screen plus 754-duplicate fixture never sends duplicate flow analyses to
  the design-system provider;
- every serialized chunk stays within the configured byte ceiling;
- deterministic input produces deterministic chunk identities and boundaries;
- a completed chunk is reused after interruption;
- a failed chunk is retried without rerunning completed chunks;
- invalid fragment evidence IDs are rejected;
- merge input contains fragment results rather than raw screen analyses;
- deterministic screen assembly produces valid canonical screen records;
- the saved revision contains non-empty design-language claims and component
  candidates;
- the saved revision keeps `flows` empty for this design-system-first pass;
- quarantined UI elements do not become trusted components;
- cancellation, rate-limit, timeout, source-drift, and secret-redaction
  behavior remains intact;
- existing App Knowledge API and review-panel tests continue to pass.

## Live Verification

After code and migration verification:

1. Retry job `2` using the normal queue path.
2. Confirm zero per-screen image-analysis provider calls.
3. Observe bounded chunk progress and one compact merge request.
4. Confirm the job reaches `done`.
5. Confirm snapshot `1` has a generated draft revision.
6. Confirm `designLanguage` is non-empty across useful categories.
7. Confirm component candidates cite valid screen evidence and remain
   `needs_review`.
8. Open the existing App Knowledge review panel and verify Design language and
   Components render from the persisted revision.

## Success Criteria

- No recrawl or login is required.
- No provider request contains expanded duplicate flow-step analyses.
- No design-system provider payload exceeds the configured byte ceiling.
- An interrupted run can reuse completed chunk results.
- Job `2` finishes with a persisted draft revision.
- The review UI displays an evidence-backed design language and component
  candidates for 15Five.
- No flow or broad product synthesis is performed in this pass.
