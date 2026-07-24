# Automatic LLM Design-System Extraction Design

## Goal

Automatically analyze every successfully crawled app/platform version with the configured LLM and populate the existing **Design System** tab with evidence-backed tokens, components, component specimens, design rules, and enriched Flow journeys.

The first release is deliberately LLM-first. Values inferred from screenshots are useful working hypotheses, not claims about an application's original CSS or source design file. Every generated entity therefore carries evidence, confidence, provenance, and `needs_review` status.

## Product boundary

This work extends the existing app-detail **Design System** tab. It does not create another tab, another design-system viewer, or a parallel export format.

The release includes:

- automatic generation after a verified crawl completes;
- per-Screen LLM analysis;
- approximate color, typography, spacing, radius, border, and effect tokens;
- component families, variants, anatomy, states, and responsive behavior;
- normalized component bounding boxes and persisted component crops;
- layout, iconography, imagery, responsive, content, and interaction rules;
- ordered Flow enrichment without replacing crawled Flow evidence;
- resumable background jobs and existing App Knowledge revisions;
- projection into the existing `DesignSystemSnapshot`;
- progress and failure states inside the existing Design System tab;
- preservation of reviewed drafts and published snapshots.

The release does not:

- claim screenshot-inferred values are original CSS values;
- inspect an original application's DOM, computed styles, source code, or Figma file;
- promote generated entities directly to `reviewed`;
- make LLM extraction part of crawl success;
- replace the Screens, UI Elements, Flows, App Knowledge, Review, or Export surfaces;
- overwrite human-reviewed or published design-system data.

## Existing boundaries to reuse

The implementation reuses these current seams:

- `AppKnowledgeEvidenceAnalysis` for resumable per-image analysis;
- `AppKnowledgeDesignSystemChunk` for bounded synthesis;
- App Knowledge jobs, evidence records, chunks, snapshots, and immutable revisions;
- RabbitMQ `generate-app-knowledge` jobs;
- SSE App Knowledge progress;
- `DesignSystemSnapshot`, including tokens, components, Flows, rules, evidence, confidence, review status, occurrences, and reconstruction data;
- `DesignSystemPanel`, `useDesignSystem`, `designSystemStore`, Review, and Export;
- `design_systems` as the mutable curated working draft;
- `design_system_versions` as immutable published snapshots;
- object-backed image validation and storage.

## Lifecycle

### 1. Crawl completion

The post-crawl coordinator runs only after an app/platform capture version passes its existing Screens, UI Elements, and Flows verification gate.

It calls a shared `ensureAutomaticAppKnowledgeJob` service with the app, platform, capture version, source hash, configured model, and prompt version. The operation is idempotent. Repeated completion notifications, repair passes, worker restarts, and reconciler passes must resolve to the same active or completed generation when the source identity has not changed.

The durable App Knowledge job is committed before queue publication. Queue failure leaves the durable job recoverable. A reconciler republishes eligible queued jobs whose transport job is absent or no longer active.

Automatic jobs use a nullable requester plus an explicit `requestOrigin: "automatic"`. Manual, retry, and regeneration requests retain their authenticated actor and origin. Automatic generation does not impersonate an administrator.

Generated revisions created by automatic jobs may also have a null `createdBy`. User-authored revisions continue requiring a real user, and every review event continues requiring an authenticated actor. A database constraint enforces that only `authorType: "generated"` revisions may omit `createdBy`.

The crawl is complete before generation begins. Provider failure, cancellation, timeout, queue failure, or invalid output cannot change the crawl result.

### 2. Evidence preparation

The frozen evidence manifest remains the source-of-truth boundary. It allowlists image IDs and object metadata before an LLM request is made.

For v1:

- Screens are eligible for per-image analysis.
- Crawled Flow-step references remain attached to their original ordered Flows.
- Existing full-screen `ui_element` copies remain quarantined and cannot be treated as isolated component specimens.
- Flow images may reuse cached visual analysis, but their Flow identity and step order must not be deduplicated during journey synthesis.

### 3. Per-Screen analysis

The LLM returns the existing semantic screen analysis plus two structured candidate collections.

#### Token candidate

```json
{
  "kind": "color",
  "name": "Primary action",
  "value": "#F26B38",
  "role": "Primary buttons and important actions",
  "confidence": 0.82
}
```

Supported kinds are `color`, `typography`, `spacing`, `radius`, `border`, and `effect`.

Values are strings because the LLM may return compound observations such as `16px / 24px`, `600`, or `0 4px 12px rgba(...)`. The parser requires a non-empty value, known kind, role, and confidence from zero to one.

#### Component occurrence

```json
{
  "family": "Button",
  "variant": "Primary",
  "category": "Inputs",
  "purpose": "Triggers the primary action",
  "anatomy": ["container", "label", "optional icon"],
  "visibleStates": ["default"],
  "observedProperties": ["orange fill", "white label"],
  "region": {
    "x": 0.72,
    "y": 0.61,
    "width": 0.18,
    "height": 0.06
  },
  "confidence": 0.88
}
```

Coordinates use normalized top-left origin values. `x`, `y`, `width`, and `height` are finite numbers from zero to one, with positive width and height, and the region must remain within the source image.

The analysis also retains page type, product area, purpose, viewport, visible text, theme, visual hierarchy, layout, content, imagery, icons, interactions, visible states, available actions, feedback, accessibility observations, likely intent, friction, uncertainty, and overall confidence.

### 4. Component crop derivation

Astryx creates crops after validating the LLM region; the LLM never supplies crop bytes.

Validation requires:

- normalized coordinates within the source image;
- a positive crop that is at least 16 by 16 source pixels;
- rejection when both normalized width and height are at least `0.9`;
- an allowlisted source image and matching object metadata;
- successful raster decoding;
- a crop whose stored byte hash and metadata verify after writing.

A two-percent margin relative to the proposed region width and height is applied on each side and clamped to the source image boundary. Crops that fail validation do not remove their component occurrence. The occurrence remains evidence-backed and `needs_review`, but no specimen is shown.

Valid crops are content-addressed, stored once, and linked to:

- the source image ID;
- normalized source region;
- App Knowledge job and revision;
- component family and variant;
- provider model and prompt version.

Derived crops are distinct from the quarantined full-screen UI Element source copies. Re-running the same model/prompt against unchanged evidence must reuse an identical crop instead of creating another image object.

### 5. Bounded synthesis

Completed Screen analyses are compacted into byte-bounded design-system chunks. The compact signal includes token candidates and component occurrences in addition to the existing semantic observations.

Each chunk produces:

- consolidated token candidates;
- consolidated component families and variants;
- candidate rules;
- evidence references;
- confidence;
- unresolved conflicts.

The final merge:

- clusters semantically equivalent names;
- keeps materially different variants separate;
- retains differing candidate values rather than inventing false precision;
- limits every entity to allowlisted evidence;
- preserves confidence and LLM provenance;
- produces the existing `DesignSystemSnapshot` vocabulary.

No generated value is marked reviewed.

### 6. Ordered Flow enrichment

Raw crawled Flow IDs, categories, step order, and image evidence remain authoritative.

Flow synthesis operates on every ordered step:

1. reuse completed per-image visual analysis by image hash;
2. restore each image to every Flow occurrence in original order;
3. provide ordered step context to the LLM in bounded chunks when necessary;
4. validate that returned Flow IDs and step IDs match the allowlist;
5. enrich descriptions, tags, interactions, visible states, system feedback, journey purpose, and open questions;
6. never remove, reorder, or replace the original evidence arrays.

Duplicate visuals save analysis cost but do not collapse Flow journeys.

The projected `DesignFlow` gains optional LLM insights without changing its raw identity:

```json
{
  "insights": {
    "purpose": "Create and submit a weekly check-in",
    "feedback": ["Submission confirmation is shown"],
    "openQuestions": ["Behavior when a required answer is missing"],
    "confidence": 0.86,
    "reviewStatus": "needs_review",
    "source": "llm_inferred",
    "evidence": [1691108, 1691112]
  }
}
```

Step `label`, `interaction`, and `evidence` continue to use the crawled Flow as the authoritative base. LLM text may fill a missing interaction in the generated candidate, but it cannot replace a non-empty crawled value.

## Canonical generated result

The App Knowledge revision is the canonical generated artifact. It retains:

- identity and frozen source hash;
- coverage;
- Screen analyses;
- product knowledge;
- enriched Flows;
- LLM design-system candidates;
- generated crop provenance;
- provider model and prompt version.

A deterministic projector converts the validated revision into `DesignSystemSnapshot`.

### Token projection

```json
{
  "id": "color.action.primary",
  "kind": "color",
  "name": "Primary action",
  "value": "#F26B38",
  "role": "Primary buttons and important actions",
  "evidence": [1690908, 1692247],
  "confidence": 0.82,
  "reviewStatus": "needs_review",
  "source": "llm_inferred",
  "responsiveViewports": ["desktop"]
}
```

### Component projection

Each family contains:

- stable ID, name, category, description, and purpose;
- anatomy;
- associated token IDs;
- responsive behavior;
- variants;
- observed properties and visible states;
- evidence image IDs;
- validated occurrences and crop references;
- confidence and `needs_review`.

`EvidenceOccurrence` gains an explicit `coordinateSpace: "normalized"` field. The projector never emits an ambiguous region unit.

It also gains an optional `cropImageId`. `imageId` always identifies the source Screen; `cropImageId` identifies the verified derived specimen. API hydration converts the crop ID into protected or signed media without exposing object-store keys.

### Rule projection

Rules retain the existing kinds: `layout`, `icon`, `imagery`, `responsive`, `content`, and `interaction`. Every rule has a stable ID, name, description, evidence, confidence, and `needs_review`.

## Curated draft and publication safety

`design_systems` remains the curated working copy shown to administrators.

When generation completes:

- an absent or structurally empty placeholder working copy is seeded automatically;
- an unreviewed automatically generated working copy for the same capture version may be replaced by a newer generation;
- a working copy containing human-reviewed entities or curator edits is never overwritten;
- a non-promoted generated candidate remains available in App Knowledge and Review for comparison and acceptance.

`design_system_versions` remains immutable after publication. Automatic generation cannot modify a published snapshot.

The working copy records its capture version, source App Knowledge revision, origin, and generation timestamp so replacement rules are deterministic.

## Existing Design System tab

The tab continues to use `DesignSystemPanel`. Its container adds generation context without changing the existing token, component, rule, evidence, export, and review renderers.

States are:

- **Queued** — generation is durable and waiting for a worker.
- **Analyzing** — show completed/total Screen evidence.
- **Synthesizing** — show completed design-system chunks.
- **Merging** — final validation and projection.
- **Saving** — revision, crops, and candidate persistence.
- **Draft ready** — show generated entities with `needs_review`.
- **Regenerating** — continue showing the previous snapshot with an update banner.
- **Partial** — show usable generated entities and exact missing-evidence coverage.
- **Failed** — preserve the crawl and previous snapshot; administrators can retry.
- **Stale** — evidence changed before save; administrators can regenerate.
- **Reviewed** — show the normal reviewed design system and exports.

The tab does not poll. It loads the current snapshot once and subscribes to the existing App Knowledge SSE stream while a relevant job is active. Completion invalidates the design-system cache and causes one fresh read.

## Error handling

- Provider unavailable: job fails safely; crawl and prior snapshot remain unchanged.
- Rate limited: stop new calls, preserve completed evidence and chunks, and allow resume.
- Invalid response: retry only the affected evidence, chunk, Flow segment, or merge.
- Invalid token: reject the token, record a bounded failure, and preserve other valid entities.
- Invalid region: keep the component occurrence without a crop and flag it for review.
- Missing object or metadata mismatch: fail only affected evidence and report coverage.
- Queue publication failure: leave a durable recoverable job for reconciliation.
- Source drift: mark the job stale and do not project or save the result.
- Cancellation: stop provider calls and retain completed work.
- Projection failure: retain the immutable App Knowledge revision and do not change the curated working copy.
- Working-copy conflict: retain the candidate and require curator comparison; never overwrite human work.

Provider errors shown to users are bounded and do not expose prompts, conversation contents, credentials, filesystem paths, or raw third-party responses.

## Data changes

A forward migration after the repository's current migration head adds:

- automatic/manual request origin and nullable requester support to App Knowledge jobs;
- nullable creator support for generated App Knowledge revisions, with user revisions still requiring a creator;
- working-copy provenance fields for capture version and source App Knowledge revision;
- persisted crop provenance linking derived objects to source images and normalized regions;
- uniqueness constraints for automatic generation identity and derived crops;
- indexes required by reconciliation and active-job lookup.

No existing migration is edited.

The exact table ownership follows current boundaries:

- App Knowledge tables own jobs, analyses, chunks, revisions, and generated candidates.
- object storage and image metadata own verified crop objects.
- `design_systems` owns the curated working copy.
- `design_system_versions` owns immutable published snapshots.

## API and worker changes

The existing manual App Knowledge endpoints remain available.

New internal application services are:

- `ensureAutomaticAppKnowledgeJob(target)`;
- `reconcileQueuedAppKnowledgeJobs()`;
- `projectAppKnowledgeDesignSystem(revision)`;
- `seedDesignSystemWorkingCopy(candidate)`;
- `deriveComponentCrops(occurrences)`.

The API exposes generation status with the Design System response for administrators. Non-admin users continue receiving published or entitled snapshots and never see unreviewed automatic candidates.

The import worker continues consuming `generate-app-knowledge`. Crawl workers only create durable work; they do not open browser LLM sessions or wait for analysis.

## Acceptance criteria

1. A verified crawl completion creates exactly one automatic App Knowledge job for an unchanged source identity.
2. The crawl is complete before the LLM job starts and remains complete when generation fails.
3. Repeated completion notifications and repair passes do not create duplicate work.
4. Every generated token, component variant, and rule has allowlisted evidence, confidence, `llm_inferred` provenance, and `needs_review`.
5. Every emitted region uses normalized coordinates and passes bounds validation.
6. Valid component occurrences produce verified, reusable crops; invalid regions produce no crop and do not discard the occurrence.
7. Existing full-screen UI Element copies remain quarantined.
8. Flow synthesis preserves every raw Flow ID, step order, and evidence array.
9. Duplicate Flow visuals reuse analysis without collapsing journeys.
10. A completed result projects into the existing `DesignSystemSnapshot` and appears in the existing Design System tab.
11. Regeneration displays the previous snapshot until the new candidate is valid.
12. Human-reviewed working copies and published snapshots are never overwritten.
13. A queue outage, provider rate limit, worker restart, or invalid response can resume without repeating completed evidence.
14. The Design System tab uses SSE during active generation and adds no interval polling.
15. Non-admin users never receive unreviewed candidates.

## Testing

### Domain tests

- parse every token kind and reject unsupported kinds;
- validate confidence and required evidence;
- validate normalized regions, bounds, minimum crop size, and full-screen rejection;
- allow component occurrences without a crop after region rejection;
- reject unknown evidence, Flow, and step IDs;
- preserve Flow step order and duplicate occurrences;
- project stable IDs and existing `DesignSystemSnapshot` fields deterministically.

### Service tests

- create one automatic job per unchanged source identity;
- create a new job when source hash, model, or prompt version changes;
- recover durable queued work after publication failure;
- resume incomplete evidence and chunks only;
- preserve crawl success for every generation failure;
- mark source drift stale before projection;
- content-address and reuse identical crops;
- avoid replacing curated or published content.

### API and UI tests

- expose automatic generation status only to administrators;
- render queued, analyzing, synthesizing, merging, saving, partial, failed, stale, draft, and reviewed states;
- retain the previous snapshot while regenerating;
- invalidate and reload once after SSE completion;
- perform no interval job polling;
- render component specimens only for validated crops;
- retain existing evidence links, review actions, and exports.

### Verification

- focused App Knowledge, design-system, queue, worker, API, and Vitrine tests;
- migration discovery, upgrade, idempotency, and current-head checks using the repository's approved test boundary;
- TypeScript validation;
- production Vite build;
- `git diff --check`;
- one controlled 15Five Web acceptance run before automatic catalog-wide enablement.

## Rollout

Automatic triggering is protected by an environment feature flag.

Rollout order:

1. enable manual LLM-first generation for 15Five Web;
2. verify tokens, components, bounding boxes, crops, Flow ordering, retry behavior, and tab states;
3. enable automatic triggering for a small allowlist of app/platform versions;
4. observe provider rate limits, latency, invalid-response rate, crop rejection rate, and queue recovery;
5. expand the allowlist only after the acceptance criteria remain stable;
6. enable all newly completed crawls;
7. backfill older completed versions through the same idempotent coordinator in bounded batches.

Catalog-wide enablement is not part of the first implementation change. It occurs only after the controlled acceptance and allowlist stages pass.
