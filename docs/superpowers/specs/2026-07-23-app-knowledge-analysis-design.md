# App Knowledge Analysis Design

## Summary

Astryx will turn captured Screens and ordered Flows into one evidence-backed,
versioned App Knowledge Model per app, platform, and capture version. The model
will render three consistent views for Designer, Developer, and BA/PO/PM users.

The first release uses strict evidence mode:

- Screens and Flow-step images are eligible evidence.
- UI Element records that fail semantic validation are quarantined.
- Full-page captures may produce component candidates, but not trusted component
  definitions.
- Generated analysis remains a draft until a human reviewer approves it.

The first complete validation target is 15five Web. Catalog-wide analysis is
blocked until that pilot passes the acceptance gate in this document.

## Goals

- Analyze each unique visual evidence item once and reuse the result.
- Preserve ordered Flow context instead of treating Flow steps as unrelated
  screenshots.
- Produce one canonical knowledge model rather than three independent,
  potentially contradictory analyses.
- Require evidence citations for every observed or inferred claim.
- Expose uncertainty, skipped evidence, failures, and source drift.
- Support durable, resumable, cancellable, and retryable jobs.
- Provide useful role-specific outputs without presenting screenshot-derived
  assumptions as source-code or business-logic truth.

## Non-goals

- Repairing or segmenting the existing Mobbin UI Element corpus.
- Inferring hidden backend behavior, authorization rules, analytics, hover
  behavior, responsiveness, or uncaptured states as observed facts.
- Generating production-ready application code directly from screenshots.
- Automatically publishing generated analysis.
- Starting a catalog-wide analysis run before the 15five pilot is reviewed.
- Replacing existing Flow Feature Documents or Design System snapshots.

## Approved Decisions

1. One shared App Knowledge Model produces all role-specific views.
2. Strict evidence mode excludes semantically invalid UI Element records.
3. Generated analysis requires human review before publication.
4. The implementation generalizes the existing Feature Document analysis
   engine instead of extending the browser-based caption command or creating a
   separate analysis stack.

## Current-system Findings

Astryx already contains most of the required primitives:

- `src/screenAnalysis.ts` defines structured visible screen observations.
- `src/designSystem.ts` models evidence-backed tokens, components, flows, and
  rules.
- `src/featureDocument.ts` defines claim kinds, allowlisted citations, ordered
  Flow analysis, requirements, and acceptance criteria.
- `src/featureDocumentProvider.ts` provides deterministic JSON-oriented
  multimodal provider calls.
- `src/featureDocumentService.ts` provides verified object reads, bounded
  retries, durable step results, cancellation, resume, and source-drift
  protection.
- `src/caption.ts` and `src/synthesize.ts` are useful legacy references but are
  not the production execution path. The current caption selector includes all
  uncaptioned image kinds, and synthesis only consumes Screens.

The 15five Web pilot currently contains:

- 610 Screen records, with zero descriptions or completed analyses.
- 610 UI Element records whose inspected gallery sample contains full-page
  captures rather than isolated elements.
- 144 Flows in 41 categories.
- 754 valid ordered Flow evidence references pointing to 610 unique Flow-step
  images.
- Generic `Step N` labels for all Flow steps, with no Flow descriptions or
  tags.

## Architecture

Each analysis targets one `(app, platform, captureVersion)` tuple and creates an
immutable evidence manifest and source hash.

```text
Evidence manifest
  -> semantic and object-integrity quality gate
  -> unique evidence analysis
  -> app-level synthesis
  -> deterministic role projections
  -> draft review
  -> approved immutable revision
```

### Evidence Manifest

The manifest contains:

- App, platform, and capture-version identity.
- Screen image IDs and capture metadata.
- Flow identity, title, category, ordered step position, interaction metadata,
  and Flow-step image IDs.
- Image kind, stored-object metadata, and visual identity.
- Explicit eligibility or quarantine outcome with a stable reason code.
- A canonical SHA-256 source hash.

The manifest is immutable for the lifetime of a job. A changed source manifest
marks the job stale before saving.

### Quality Gate

The quality gate verifies:

- Referenced image and stored-object existence.
- Stored-object metadata and byte integrity.
- Supported raster content type and maximum size.
- Valid app, platform, capture-version, and Flow ownership.
- Valid Flow ordering and evidence references.
- Semantic compatibility between the image and its declared kind.
- Duplicate evidence identity.

Strict evidence mode accepts Screens and Flow steps. A UI Element is eligible
only when it is demonstrably an isolated component capture. Invalid UI Elements
are quarantined with a visible reason and do not block the rest of the app.

### Visual Identity and Reuse

Objects are decoded to normalized pixels before hashing. Identical visuals are
analyzed once even when their file encoding or object identity differs.

Cache identity is:

```text
normalizedVisualHash + platform + promptVersion + providerModel
```

Near-duplicate images are not automatically merged. A small text, validation,
selection, or state difference may be product-significant.

### Evidence Analysis

Independent Screens use bounded parallelism. Ordered Flow steps are analyzed in
sequence within each Flow and receive the prior analyzed step as context.

Each evidence result records:

- Evidence ID and image ID.
- Visible UI and exact visible text.
- Purpose, page type, product area, theme, and viewport.
- Layout, content, imagery, icon, and interaction patterns.
- Visible states, available actions, and system feedback.
- Accessibility observations visible in the screenshot.
- Likely intent, friction, missing or uncertain states.
- Confidence and analysis provenance.

Visible facts remain separate from likely intent and uncertainty.

### App Synthesis

The synthesizer consumes:

- Eligible evidence results.
- Ordered Flow structure.
- Capture metadata and platform conventions.
- Coverage, quarantine, skip, and failure statistics.

It produces one `AppKnowledgeSnapshot`. The parser rejects unsupported claim
kinds, unknown evidence IDs, uncited observed or inferred claims, duplicate
identities, invalid confidence values, empty required sections, and trusted
component claims based only on quarantined evidence.

### Role Projections

Role projections are deterministic renderers over the approved or draft
snapshot. They do not make additional model calls.

- Designer: screen taxonomy, visual patterns, component candidates, observed
  state coverage, approximate design-language candidates, and user journeys.
- Developer: component structure, observed variants and states, screen
  dependencies, approximate token candidates, accessibility risks, and
  proposed implementation scaffolds.
- BA/PO/PM: capability map, actors, journeys, business-rule inferences,
  friction, requirements, acceptance-criteria drafts, risks, and open
  questions.

## Canonical App Knowledge Model

### Identity and Lifecycle

- App and platform.
- Capture version and source hash.
- Provider model and prompt version.
- Generated time.
- Draft, in-review, approved, superseded, or stale status.

### Coverage

- Eligible, analyzed, cached, quarantined, skipped, and failed evidence counts.
- Exact Flow reference coverage.
- Duplicate visual count.
- Coverage percentage by source kind and Flow.

### Screen Catalog

- Page type, product area, purpose, and viewport.
- Exact visible text.
- Theme and visual hierarchy.
- Layout, content, imagery, and interaction patterns.
- Visible states, actions, feedback, and accessibility observations.
- Evidence, confidence, and review status.

### Component Candidates

- Stable candidate identity, name, category, purpose, and anatomy.
- Observed properties, variants, states, and responsive evidence.
- Screen occurrences and optional visual regions.
- Associated design-language candidates.
- Confidence and candidate/reviewed/rejected status.

Screenshot-only candidates cannot become trusted components until confirmed by
valid UI Element evidence or a human reviewer.

### Design Language

- Approximate color, typography, spacing, radius, border, and effect candidates.
- Layout, icon, imagery, responsive, content, and interaction rules.
- Supporting evidence, confidence, occurrences, and review status.

Screenshot-derived numeric values remain explicitly approximate.

### Flows

- Original Flow identity, title, category, and order.
- Meaningful analyzed step labels.
- Actors, user goal, entry point, and completion point.
- Available actions, system feedback, friction, and uncertain states per step.
- Flow-level effective patterns, risks, inconsistencies, and open questions.

### Product Knowledge

- Capability map and feature relationships.
- User journeys and actor responsibilities.
- Requirement candidates with priority and preconditions.
- Acceptance-criteria drafts.
- Edge cases, dependencies, risks, success metrics, guardrails, analytics-event
  proposals, and open questions.

### Claims

All conclusions use:

```text
id + kind + text + evidenceIds + confidence
```

Claim kind is one of:

- `observed`: directly supported by visible evidence.
- `inferred`: a cautious interpretation supported by visible evidence.
- `proposed`: a recommendation, scaffold, metric, requirement, or design.
- `unknown`: information the evidence cannot establish.

Observed and inferred claims require one or more allowlisted evidence IDs.

## Persistence and Revision Lifecycle

The system stores:

- Immutable analysis jobs and manifests.
- Per-evidence analysis results and failures.
- Generated App Knowledge revisions.
- Deterministic role projections or their reproducible input revision.
- Human review decisions and edits.
- Current approved-revision pointer.

Generated revisions never overwrite human edits. Regeneration creates a new
revision. Approved revisions are immutable; a later approval supersedes the
previous approved revision.

## Job Lifecycle

Stages are:

1. `preparing`
2. `validating_evidence`
3. `analyzing`
4. `synthesizing`
5. `validating_output`
6. `saving`
7. `complete`

Jobs support:

- Durable queued, running, done, error, cancelled, and stale states.
- Cancellation between evidence items and before synthesis or saving.
- Resume from completed evidence results.
- Bounded retry for provider timeout, transient unavailability, and invalid
  structured output.
- Safe retry of failed evidence without reprocessing cached success.
- SSE progress events; the App screen does not poll.

## Product Experience

Each App detail page gains an Analysis tab.

### Analysis Header

The header shows:

- Capture version and source freshness.
- Provider and prompt version.
- Analysis and review status.
- Coverage, cache reuse, quarantine, skip, and failure counts.
- Start, cancel, resume, retry, regenerate, and review actions for admins.

### Role Views

A role switch displays Designer, Developer, or Product output. Every insight
shows:

- Claim kind.
- Confidence.
- Evidence links to the relevant Screen or Flow step.
- Review status.

Draft analysis is visible to admins. Ordinary users see only approved
revisions.

### Review

The existing Review workspace is extended to:

- Inspect evidence beside a claim.
- Approve, reject, or edit a claim.
- Confirm or reject component candidates and approximate tokens.
- Request regeneration.
- Approve the complete snapshot.

## Error Handling

- Missing or corrupt evidence receives a stable failure code.
- Unsupported image content or excessive size is rejected before provider use.
- Provider errors expose safe messages and never provider bodies, credentials,
  object keys, or local paths.
- Invalid structured output retries with the validation error, then fails
  explicitly.
- Partial coverage remains a draft and identifies missing evidence.
- Source drift marks the job stale and prevents saving or approval.
- Quarantined UI Elements remain visible as a data-quality issue without
  blocking Screen and Flow analysis.

## Authorization

- Admins can start, cancel, resume, retry, regenerate, review, and approve.
- Ordinary users can read approved role views for apps they are entitled to
  access.
- Draft analysis, job diagnostics, provider metadata, and review actions remain
  admin-only.
- Protected evidence continues through the existing authorized media path.

## Testing Strategy

### Unit

- Manifest canonicalization and hashing.
- Semantic eligibility and quarantine decisions.
- Normalized visual hashing and cache keys.
- Evidence-analysis and synthesis parsers.
- Citation allowlisting and claim-kind rules.
- Deterministic role projections.
- Safe provider error classification.

### Store and Service

- Job claim, progress, cancellation, resume, and retry.
- Cached-result reuse.
- Per-evidence failure persistence.
- Stale-source detection.
- Revision immutability and approval lifecycle.
- Concurrent job and idempotency behavior.

### API and Authorization

- Admin-only mutations.
- Approved-only customer reads.
- App-entitlement enforcement.
- SSE authorization and terminal events.
- Safe error responses.

### Vitrine

- Analysis status and coverage states.
- Designer, Developer, and Product projections.
- Evidence links and claim labels.
- Quarantine and partial-coverage display.
- Review actions and approved-only customer behavior.
- No interval polling.

## 15five Pilot Acceptance Gate

The pilot must prove:

- All 610 current UI Element records are quarantined.
- All 754 Flow references resolve to the correct 610 unique Flow-step images.
- Every eligible Screen and unique Flow image is analyzed, reused from cache,
  or explicitly failed; no evidence silently disappears.
- Zero unknown evidence citations exist.
- Every observed and inferred claim cites evidence.
- A repeated identical manifest reuses cached evidence results.
- Resume, cancellation, retry, source drift, authorization, and review paths
  pass automated tests.
- A reviewer checks representative screen classifications, five complete
  Flows, component candidates, and all three role views.
- The reviewer approves the pilot before catalog-wide queuing is exposed.

## Rollout

1. Implement and validate the 15five Web pilot.
2. Measure evidence volume, cache reuse, provider cost, duration, validation
   failure rate, and reviewer correction rate.
3. Adjust concurrency and prompt limits using measured results.
4. Enable explicit per-app analysis for additional admin-selected apps.
5. Expose catalog-wide queuing only after multiple representative app/platform
   pilots pass the same acceptance gates.
