# Flow-to-Feature-Document Design

**Date:** 2026-07-22
**Status:** Approved design, pending written-spec review

## Purpose

Allow a product manager to open one existing Astryx Flow, analyze every ordered Flow image with the configured OpenAI-compatible provider, and create an editable, evidence-backed Feature Document.

The feature closes the gap between observing a reference product journey and defining implementable product work. Astryx remains the evidence authority; the model produces a draft that the product manager owns and can revise.

## Product outcome

The primary journey is:

1. Open an application Flow.
2. Start **Create Feature Document**.
3. Review the Flow, image count, evidence completeness, and optional focus instruction.
4. Run durable per-image analysis.
5. Synthesize the ordered observations into a validated Feature Document.
6. Inspect every claim against its source image.
7. Edit the draft without changing the captured Flow.
8. Regenerate into a new version without overwriting human edits.
9. Export or share the reviewed document.

## Scope

### Included

- One Feature Document generated from one existing application Flow.
- Every ordered Flow-step image included in analysis.
- An optional product-manager focus instruction.
- Durable asynchronous execution with progress, cancellation, retries, and worker recovery.
- Per-step structured visual analysis followed by document synthesis.
- A complete PRD-style document represented as validated structured data.
- Evidence citations on observations, inferences, and requirements.
- Explicit observed, inferred, proposed, and unknown classifications.
- Editable document content and revision history.
- Regeneration as a new revision.
- Source-Flow staleness detection.
- In-app reading and editing.
- Markdown export.
- A read-only share presentation using the same structured document model.

### Not included in the first slice

- Combining several Flows into one Feature Document.
- Generating a Feature Document from arbitrary uploaded images without a Flow.
- Jira, Linear, Confluence, Notion, or GitHub synchronization.
- Real-time multi-user editing.
- Stakeholder comments or threaded discussion.
- Automatic approval or publication without product-manager review.
- Treating inferred backend behavior as observed fact.
- Modifying a source Flow from inside a Feature Document.

## Product placement

The entry point belongs in the application **Flows** section beside the existing Flow documentation action. Opening **Create Feature Document** shows a setup panel containing:

- application, platform, Flow title, and description;
- ordered step and image counts;
- warnings for missing or unreadable images;
- an optional focus instruction;
- the expected analysis scope; and
- the primary **Analyze Flow** action.

An incomplete evidence manifest prevents submission. Astryx names every blocked Flow step and does not silently exclude an image.

## Generation progress

After submission, the interface presents durable progress rather than holding one browser request open. User-facing stages are:

1. Preparing evidence.
2. Analyzing image `n` of `total`.
3. Synthesizing requirements.
4. Validating citations.
5. Saving draft.

The user may leave the page and return without losing progress. Cancellation stops new provider work after the current bounded request completes. A retry resumes incomplete work and reuses valid per-step analyses from the same prompt version, source Flow revision, model, and focus instruction.

## Feature Document workspace

The completed job opens a dedicated workspace with:

- a navigable document outline;
- editable document content;
- a synchronized evidence panel showing cited Flow images;
- source status and generation metadata;
- revision history;
- regenerate, export, and share actions.

Selecting an evidence citation opens the matching image and Flow-step context. Editing document content never mutates the source Flow, image records, or design-system snapshot.

## Document contract

The canonical document is structured data. Markdown and the read-only share presentation are renderings of this model rather than separate editable authorities.

### 1. Executive summary

- Feature purpose.
- User value.
- Recommended direction.

### 2. Observed current Flow

- User goal.
- Entry point.
- Completion point.
- Ordered journey summary.
- Actors, systems, and visible states.

### 3. Flow analysis

- Effective patterns.
- Friction and usability issues.
- Missing states or transitions.
- Inconsistencies.
- Risks and assumptions.

### 4. Proposed feature

- Problem statement.
- Target users.
- Goals.
- Non-goals.
- Proposed behavior.
- Recommended user journey.

### 5. Requirements

- Functional requirements.
- Business rules.
- Permissions.
- Data requirements.
- Error and recovery behavior.

### 6. User stories and acceptance criteria

Each entry contains:

- user story;
- priority;
- preconditions;
- Given/When/Then acceptance criteria; and
- supporting evidence references.

### 7. Edge cases

The model explicitly considers empty, loading, partial, error, retry, cancellation, duplicate-action, stale-data, and permission states when evidence or reasonable product requirements support them.

### 8. Success measurement

- Product outcome metrics.
- Guardrail metrics.
- Suggested analytics events.

### 9. Dependencies and open questions

- Product dependencies.
- Technical dependencies.
- Unverified assumptions.
- Decisions still required.

## Claim classification and evidence

Every substantive generated claim uses one of four classifications:

- **Observed:** directly visible in one or more supplied images or explicit Flow metadata.
- **Inferred:** a reasoned interpretation of observed evidence.
- **Proposed:** recommended future product behavior.
- **Unknown:** a fact requiring stakeholder, user-research, analytics, or technical confirmation.

Observed and inferred claims require one or more allowlisted evidence references. Requirements cite evidence when they respond to an observed or inferred finding. A proposed requirement may have no direct evidence only when it is clearly classified as proposed and its rationale identifies the finding or product objective it addresses.

Stable references use the source Flow-step and image identities, rendered in a readable form such as `FLOW-STEP-03` and `IMAGE-1842`. The server rejects citations that are absent from the submitted evidence manifest.

## AI analysis contract

Generation uses two controlled stages.

### Stage 1: Ordered image analysis

For each image attached to each ordered Flow step, Astryx sends:

- application and platform;
- Flow title and description;
- step number, label, description, and expected user action when available;
- the current image and its position within the step;
- the stable evidence identity;
- the optional focus instruction; and
- bounded context from the preceding step.

The provider returns structured data containing:

- visible interface and text;
- likely user intention;
- available actions;
- visible system feedback;
- friction or ambiguity;
- missing or uncertain states;
- accessibility observations;
- evidence identity; and
- confidence.

The prompt prohibits inventing interactions, backend behavior, permissions, business rules, or states that are not visible. Uncertain interpretations must be classified as inferred or unknown.

### Stage 2: Feature Document synthesis

Astryx sends the validated, ordered step analyses together with:

- source Flow metadata;
- the product-manager focus instruction;
- the required Feature Document schema;
- allowed evidence identities; and
- the observed/inferred/proposed/unknown rules.

The provider returns structured JSON. It does not return authoritative free-form Markdown.

## Validation and repair

Before persistence, the server validates:

- schema shape and required sections;
- source Flow and revision identity;
- ordered step coverage;
- evidence citation allowlist;
- citation requirements for observed and inferred claims;
- unique requirement and user-story identities;
- classification values; and
- bounded field and document sizes.

If validation fails, Astryx retries synthesis once with the exact machine-readable validation errors. If the repair response also fails, the job is marked failed. Administrators may inspect a redacted diagnostic containing stage, provider status, validation codes, and correlation identity. Ordinary users never receive provider credentials, signed image URLs, raw prompts, or raw provider responses.

## Persistence model

The implementation adds bounded entities with clear ownership:

- **Feature Document:** owner, source application, platform, source Flow identity, current revision, status, and timestamps.
- **Feature Document revision:** immutable generated or user-saved snapshot, structured content, source Flow revision, focus instruction, prompt version, provider/model identity, evidence-manifest checksum, author type, and timestamps.
- **Feature analysis job:** durable lifecycle, progress counters, cancellation state, retry metadata, structured failure code, and active revision target.
- **Feature step analysis:** job, ordered Flow step, image identity, prompt version, analysis result, confidence, status, and attempt count.
- **Share grant:** revocable read-only token metadata, document/revision target, expiry policy, and access timestamps.

The exact table and store names may follow the repository's existing migration and durable-job conventions, but the ownership and immutability boundaries above are required.

## Revision behavior

- Initial successful generation creates revision 1.
- User edits create a user-authored revision through explicit save.
- Regeneration always creates a new generated revision.
- Regeneration never overwrites a user-authored revision.
- The user can compare or restore an earlier revision without deleting history.
- A restored revision becomes a new current revision, preserving the original snapshot.
- The document records which revision was exported or shared.

If the source Flow revision or evidence manifest changes after generation, Astryx marks the document **Source changed**. The user may regenerate from the new source or explicitly retain the current document. Retention clears no history and records the acknowledged source mismatch.

## Security and privacy

- The server verifies application, Flow, version, image, and Feature Document authorization before building the evidence manifest.
- Image bytes are read server-side through the existing protected object-storage contract.
- The browser does not send storage keys or provider requests directly.
- Provider requests use the configured server-side OpenAI-compatible credentials.
- Short-lived signed URLs may be used only when the provider must fetch an image and the URL lifetime is bounded to the request window. Inline image bytes are preferred when supported within configured size limits.
- Logs and analytics exclude image bytes, raw prompts, generated document content, focus instructions, signed URLs, tokens, and credentials.
- Provider retention and data-processing behavior must be documented in deployment configuration before production enablement.
- Share grants expose only the selected Feature Document revision and its authorized evidence presentation. They do not grant general application or catalog access.

## Failure behavior

- Missing or unreadable image: reject submission or fail the preparation stage with exact affected steps.
- Unsupported image or excessive size: return a stable validation code and remediation message.
- Provider timeout or temporary failure: retry with bounded backoff at the failed step.
- Provider refusal: record a non-secret refusal code and allow a user retry after changing the focus instruction.
- Invalid step analysis: retry that step without repeating successful steps.
- Invalid final synthesis: perform one validation-guided repair attempt.
- Worker interruption: reclaim the durable job and resume from persisted step analyses.
- Cancellation: preserve completed analyses for diagnostics and permitted resume, but do not publish a partial Feature Document.
- Source changed during generation: do not save the result as current; mark the job stale and offer regeneration against the latest source.
- Share revoked or expired: return a non-enumerating unavailable response.

No failure path publishes a partially validated Feature Document.

## Export and sharing

Markdown export includes:

- document title and generation metadata;
- all document sections in stable order;
- classifications and confidence where relevant;
- readable evidence references; and
- a source appendix mapping references to Flow steps and images.

The initial share experience is read-only. It presents the same structured revision with evidence navigation and a visible status of Draft, In review, Approved, or Superseded. Editing, commenting, external integrations, and approval automation remain outside the first slice.

## Status lifecycle

Feature Documents use explicit product-review states:

- **Draft:** editable working document.
- **In review:** frozen reviewed revision selected for stakeholder review.
- **Approved:** product-manager-approved revision.
- **Superseded:** an earlier approved or reviewed revision replaced by a newer approved revision.

Changing content after **In review** creates a new Draft revision. Approval is a human action and is never inferred from successful AI generation.

## Testing strategy

### Unit tests

- Evidence manifest preserves Flow order and includes every required image.
- Prompt builders include the correct context and never include secrets.
- Step-analysis and Feature Document schemas reject malformed output.
- Citation validation rejects unknown or missing required references.
- Classification validation distinguishes observed, inferred, proposed, and unknown content.
- Markdown rendering is deterministic and includes the evidence appendix.
- Revision operations preserve prior generated and user-authored content.
- Source-manifest checks mark stale documents correctly.

### API and store tests

- Users cannot analyze unauthorized Flows or images.
- Durable jobs transition through valid states only.
- Successful step analyses are reused only when source, model, prompt version, and focus instruction match.
- Retry, cancellation, lease recovery, and stale-source behavior preserve consistency.
- Regeneration creates a new revision and never overwrites edits.
- Share grants are scoped, revocable, expirable, and non-enumerable.
- Provider and validation failures return stable safe error codes.

### Browser acceptance

A signed-in entitled product manager can:

1. Open a Flow and start Feature Document generation.
2. See the correct total step and image count.
3. Leave and return while generation continues.
4. Open a completed structured document.
5. Select citations and inspect the matching images.
6. Edit and save the document.
7. Regenerate without losing the edited revision.
8. Detect a changed source Flow.
9. Export the selected revision as Markdown; and
10. create and revoke a read-only share presentation.

## Product success measures

- Median time from Flow selection to a reviewable Feature Document.
- Generation completion and validation-success rates.
- Percentage of observed and inferred claims with valid evidence.
- Percentage of requirements with acceptance criteria.
- Percentage of generated drafts edited, reviewed, approved, exported, or shared.
- Regeneration rate and reasons.
- Stakeholder review turnaround time.
- Number of unverified assumptions resolved before approval.

Analytics records identifiers, stage, counts, duration, outcome, and error codes only. It excludes Flow content, image content, prompts, focus instructions, generated text, and human edits.

## Implementation boundaries

The feature should extend existing Astryx seams rather than create a second product system:

- application Flow and evidence models remain the source authority;
- protected media and object storage remain the image-access boundary;
- the configured research synthesis provider is extended for multimodal structured calls or wrapped behind a focused Feature Document provider interface;
- the existing durable job conventions handle asynchronous progress and recovery;
- the Vitrine Flow surface owns the entry point;
- the new Feature Document workspace owns editing, revisions, export, and sharing; and
- existing `FLOW.md` and Research Project behavior remains unchanged.

Implementation work must preserve unrelated files in the dirty checkout, including the existing untracked `docs/design-extracts/` directory.

## Acceptance boundary

The feature is complete only when one real Flow with multiple ordered images can be processed end to end through the configured provider, saved as a validated structured draft, inspected against its evidence, manually edited, regenerated without losing edits, exported, and shared through a revocable read-only presentation.

Passing unit tests without a real multimodal provider run and authenticated browser verification does not satisfy this acceptance boundary. If provider credentials or an authorized Flow are unavailable, the final handoff must name that external blocker explicitly.
