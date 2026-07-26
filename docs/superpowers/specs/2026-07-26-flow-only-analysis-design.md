# Flow-Only Analysis

## Goal

Make Flow analysis the only AI-analysis workflow on app detail pages.

Astryx will continue to publish captured Screens and UI Elements as visual references and will continue to display existing imported Design Systems such as Miro's GetDesign snapshot. It will no longer offer app-level App Knowledge analysis, analyze standalone screen/UI-element evidence, or generate Design Systems from screenshots.

## Product decisions

- Remove the `Analysis` tab from app detail.
- Keep `Screens`, `UI Elements`, `Flows`, `Design System`, `Export`, and `Review`.
- Keep imported and already-published Design Systems readable.
- Do not start new screen-analysis or image-derived Design System jobs.
- Do not delete historical App Knowledge jobs, revisions, or imported Design Systems.
- Put Flow-analysis status, actions, and results inside the `Flows` workspace.
- Analyze only ordered `flow_step` evidence. Standalone screen and UI-element images remain browseable but are not AI inputs.

## Flow-analysis result

Each analyzed Flow retains its existing identity, category, title, step order, and screenshot evidence. Where the captured evidence supports them, analysis adds:

- a concise purpose;
- tags;
- per-step interaction descriptions;
- per-step visible states;
- per-step system feedback;
- Flow-level feedback patterns;
- open questions;
- confidence, source, and review status.

The provider must not add, remove, merge, or reorder Flows or steps. Every inferred statement must remain connected to the Flow's captured step evidence.

## Architecture

### 1. Flow-only evidence preparation

Build a frozen manifest from the selected app, platform, and capture version, but include only evidence referenced by published or draft `DesignFlow.steps`.

Deduplicate identical images while preserving each Flow/step reference. Reject a job when the selected version has no ordered Flow evidence.

### 2. Step analysis

Reuse the current multimodal evidence analyzer for each unique Flow-step image. Provide its Flow title, category, step label, original interaction, previous-step context, and next-step position.

The result is private intermediate data. It is not saved as standalone screen App Knowledge and is not shown in an `Analysis` tab.

### 3. Flow synthesis

Reuse the existing ordered-Flow planner, byte-bounded chunking, strict parser, and `synthesizeFlows` provider call.

Synthesis must preserve all Flow and step IDs and their order. A failed chunk leaves the prior published Flow data unchanged and can be resumed without reanalyzing successful step evidence.

### 4. Persistence

Project the validated synthesis directly into `DesignFlow`:

- `description` receives the analyzed purpose;
- `tags` receives analyzed tags;
- each step gains an optional analysis object containing its inferred interaction, visible states, and system feedback without replacing its curator-authored label or interaction;
- `insights` stores feedback, open questions, confidence, source, review status, and cited evidence.

Persist the complete Flow set transactionally to the selected `app_flow_versions` row. When the selected version is the active draft/in-review version, update the matching `app_flows` working copy in the same transaction. Never partially overwrite a Flow set.

Historical App Knowledge tables remain untouched and read-only; no destructive migration is required.

### 5. API and job lifecycle

Replace the app-level App Knowledge start/regenerate controls with Flow-analysis endpoints scoped by app, platform, and version.

The job lifecycle remains resumable:

1. preparing;
2. analyzing Flow-step evidence;
3. synthesizing ordered Flows;
4. validating;
5. saving;
6. complete.

Progress counts refer only to unique Flow-step evidence and Flow synthesis chunks.

### 6. Flows UI

The Flow gallery remains the primary navigation. Add an admin-only analysis control/status area to the Flows workspace:

- `Analyze flows` when no result exists;
- progress and cancel while active;
- retry/resume for failed or interrupted jobs;
- `Regenerate` for a completed result.

The selected Flow viewer displays analyzed purpose, confidence, feedback, and open questions next to its ordered screenshots. Step-level interaction and visible feedback appear with the relevant step.

Normal users see only saved Flow insights. They do not see job controls or incomplete intermediate results.

## Removal scope

Remove:

- the app-detail `Analysis` section, tab, lazy/data dependency, and render branch;
- app-detail use of `AppKnowledgePanel`;
- UI entry points for starting, retrying, regenerating, or reviewing app-level App Knowledge;
- automatic jobs that select standalone `screen` or `ui_element` evidence;
- design-system chunk synthesis, merge, crop derivation, and automatic Design System seeding from the active analysis workflow.

Preserve:

- existing database tables and historical records;
- imported Design Systems and their rollback history;
- Design System rendering/export;
- screen/UI-element galleries and search metadata already stored;
- existing ordered Flow import/crawl behavior.

## Error handling

- No Flow evidence: show a compact `No captured flows to analyze` state.
- Some step images unavailable: do not synthesize the affected Flow; report the exact missing steps.
- Provider interruption: retain completed evidence results and chunks for resume.
- Invalid provider output: reject the chunk without changing stored Flows.
- Save conflict or version change: abort the transaction and require a fresh run against the new version.

## Verification

- Section dependency tests prove `analysis` is no longer a valid app-detail section.
- ScreenDetail tests prove the Analysis tab and `AppKnowledgePanel` are absent while Design System remains.
- Manifest tests prove only referenced `flow_step` evidence is selected.
- Provider tests prove standalone screens and UI elements are never submitted.
- Flow parser tests prove IDs and order cannot change.
- Persistence tests prove Flow updates are atomic and version-scoped.
- Flows UI tests cover start, progress, resume/retry, completed insights, empty state, and member/admin boundaries.
- Regression tests cover imported Design Systems, Screens, UI Elements, Flow browsing, Export, and Review.

## Success criteria

- App detail has no `Analysis` tab.
- Starting Flow analysis makes zero AI requests for standalone Screens or UI Elements.
- A successful run enriches every eligible Flow without changing its identity or step order.
- Flow insights are visible in the Flows tab and survive reload.
- Existing imported Design Systems, including Miro, are unchanged.
- An incomplete or failed run never replaces the stored Flow set.
