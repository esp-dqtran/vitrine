# Visual Flow and Document Flow Modes

**Date:** 2026-07-26
**Status:** Approved wireframe; written specification awaiting user review

## Purpose

Make each Astryx Flow available in two synchronized representations:

- **Visual Flow** presents the ordered screenshots and prototype experience.
- **Document Flow** presents the same Flow as structured text.

These are sibling modes of one Flow. They are not separate Flow records, a
parent/child hierarchy, or two unrelated destinations.

## Product model

The stable hierarchy remains:

```text
App
└── Platform and version
    └── Category
        └── Flow
            ├── Visual Flow
            └── Document Flow
```

The category-to-Flow directory tree remains the primary navigation. Selecting
a Flow establishes one shared context: app, platform, version, Flow ID, title,
category, ordered steps, and selected step.

Switching modes changes only the right-pane representation of that selected
Flow.

## Terminology

- **Flow**: the source product journey and its stable identity.
- **Visual Flow**: the image-led representation of the Flow.
- **Document Flow**: the text-led representation of the Flow.
- **Feature Document**: an internal implementation term that may remain in the
  database, service, job, and revision code while the user-facing label becomes
  Document Flow.

Do not label the text mode merely `Document`; the full label is
`Document Flow`.

## Approaches considered

### 1. Sibling tabs within one selected Flow — selected

Use `Visual Flow` and `Document Flow` tabs in the selected Flow header. The
left Flow tree remains mounted and the right pane changes modes.

This preserves Flow context, makes the relationship between the two
representations explicit, and supports direct movement between a text step and
its source image.

### 2. Permanent split view — rejected

Showing images and text side by side would make cross-reference immediate, but
it would leave too little room for wide web screenshots and long structured
text. It would also translate poorly to smaller screens.

### 3. Separate pages or libraries — rejected

A separate Document library or unrelated document route would make Document
Flows difficult to rediscover from their source Flows and would duplicate
navigation concepts. A compatibility route may remain, but it is not the
canonical product entry point.

## Desktop information architecture

The app-detail `Flows` section is a two-column workspace:

```text
┌───────────────────────┬─────────────────────────────────────────────┐
│ Persistent Flow tree  │ Selected Flow header                        │
│                       │ [Visual Flow] [Document Flow]               │
│ Category              │                                             │
│ ├─ Flow A             │ Active mode content                         │
│ ├─ Flow B             │                                             │
│ └─ Flow C             │                                             │
└───────────────────────┴─────────────────────────────────────────────┘
```

When no Flow is selected, the right pane continues to show the grouped Flow
gallery. Selecting a Flow replaces that gallery with the selected Flow
workspace; it does not cover or unmount the left tree.

The selected Flow header contains:

- Flow title;
- category;
- step or screen count;
- `Visual Flow` and `Document Flow` mode tabs;
- mode-appropriate secondary actions;
- a close or back action that returns the right pane to the gallery.

## Visual Flow mode

Visual Flow preserves the current image-led behavior:

- ordered screenshot cards;
- step number and curator-authored label;
- `Screens` and `Prototype` submodes;
- previous and next navigation;
- source image actions already supported by the viewer;
- optional analyzed interaction and visible-feedback annotations.

`Screens` and `Prototype` are submodes of Visual Flow. They must not appear as
peers of Document Flow.

```text
Flow
├── Visual Flow
│   ├── Screens
│   └── Prototype
└── Document Flow
```

## Document Flow mode

Document Flow is the structured text rendering of the selected Flow. Its
primary reading order is:

1. **Overview** — concise purpose and user value.
2. **Trigger** — the visible entry point that starts the Flow.
3. **Ordered steps** — one text row per source Flow step.
4. **Outcome** — the visible completion point.
5. **Alternate and error paths** — supported exceptions, uncertainty, and
   missing states.

Each ordered text step contains:

- the same one-based step number used by Visual Flow;
- the source step label;
- a concise action or system-response description;
- evidence references;
- a `View visual step` action.

Observed, inferred, proposed, and unknown content must remain distinguishable.
The text mode must not present unsupported behavior as observed fact.

Document Flow can use the existing evidence-backed Feature Document revision
as its canonical content source. The initial UI should prioritize the five
sections above; deeper requirements, metrics, dependencies, and open questions
may remain available below the primary Flow narrative without interrupting it.

## Mode and step synchronization

Both modes share one selected step.

- Selecting a Visual Flow screenshot updates the canonical step.
- Selecting a Document Flow step updates the same canonical step.
- `View visual step` switches to Visual Flow and focuses that step.
- Switching from Visual Flow to Document Flow scrolls or focuses the
  corresponding text step.
- Switching modes with no selected step opens at the beginning.
- A selected step outside the current Flow's bounds is discarded safely.

The URL remains canonical and shareable. Extend the existing app-detail query
state with:

```text
flow=<flow-id>
step=<one-based-step>
flowView=visual|document
```

`flowView` defaults to `visual` when absent or invalid. Existing URLs without
the parameter remain valid.

## Data ownership and identity

Visual Flow continues to read from `DesignFlow`:

- `id`;
- `title`;
- `category`;
- `description`;
- `tags`;
- ordered `steps`;
- step evidence;
- optional analysis and insights.

Document Flow reads from the evidence-backed Feature Document associated with
the exact source tuple:

```text
app + platform + version + flowId
```

The displayed Document Flow revision must preserve:

- the source Flow snapshot;
- the evidence manifest;
- revision number and review status;
- generation focus and provider metadata;
- source-change detection.

A catalog Flow has at most one canonical catalog Document Flow. Revision
history represents changes to that Document Flow; revisions must not appear as
additional Flow tree entries.

Private documents may continue to exist internally, but they must not create
duplicate leaf nodes in the public Flow directory. Personal-document behavior
is outside this slice.

## Loading and API boundary

Flow browsing must not fetch full Document Flow content for every Flow.

The Flow list may include only a lightweight document summary:

- availability;
- current revision ID and number;
- review status;
- source-changed state;
- active generation state.

The full current revision loads lazily when the user selects Document Flow.
The source lookup is scoped by app, platform, version, and Flow ID so the UI
does not need to know a document ID before discovering the text mode.

The existing document-ID endpoint can remain for compatibility and public
share behavior remains unchanged. Canonical in-app discovery starts from the
Flow.

Avoid per-Flow network requests while rendering the tree or gallery. Summary
data must arrive in the existing Flow-section response or one batch request.

## Generation and revision lifecycle

When no Document Flow exists:

- normal users see a compact unavailable state;
- admins see `Generate Document Flow` when the source Flow has valid ordered
  evidence.

While generation is active, Document Flow shows durable job progress in the
right pane. It must not fail merely because the first revision has not been
created yet.

When ready:

- normal users read the current permitted revision;
- authorized editors may edit, save a new revision, submit for review,
  approve, compare, restore, regenerate, export, or create a read-only share;
- human edits always create a revision and are never overwritten by
  regeneration.

When the source Visual Flow changes, Document Flow shows a source-change
warning. The user may regenerate from the current images or explicitly retain
the current revision.

## Empty and error states

- **No selected Flow:** show the Flow gallery.
- **No Document Flow:** explain that the text representation is not available.
- **Missing step evidence:** identify the exact steps and disable generation.
- **Queued or running:** show progress, cancellation, and reconnect behavior.
- **Failed or interrupted:** preserve completed work and offer retry or resume.
- **Stale source:** show regeneration and retain-current choices.
- **Unauthorized catalog document:** preserve the existing upgrade boundary.
- **Invalid Flow or step URL:** keep the tree usable and return to a safe
  gallery or first-step state.

Visual Flow remains usable when Document Flow fails to load.

## Permissions

- All users who can access a Flow may view its available catalog Document Flow.
- Normal users do not see provider, retry, or incomplete-generation controls.
- Admins can generate and regenerate Document Flow.
- Editing, review transitions, export, and sharing retain existing document
  authorization rules.
- Public share URLs remain read-only and revision-pinned.

## Responsive behavior

On desktop, the persistent tree and selected Flow pane remain side by side.

On smaller screens:

- the Flow tree moves into the existing drawer;
- the selected Flow occupies the page;
- the two mode tabs remain visible at the top;
- Document Flow step rows stack vertically;
- `View visual step` remains available;
- mode and step selection survive opening and closing the drawer.

## Accessibility

- Implement the mode switch as an accessible tab list with `Visual Flow` and
  `Document Flow` tabs and associated tab panels.
- Preserve native buttons and the existing nested-list semantics in the Flow
  directory.
- Expose the active Flow and active mode programmatically.
- Maintain visible keyboard focus in the tree, tabs, step rows, and actions.
- Announce generation progress and load failures without moving focus
  unexpectedly.
- `View visual step` must have an accessible name containing the step number or
  label.

## Compatibility and migration

- Existing Flow IDs, categories, order, and evidence remain unchanged.
- Existing app-detail URLs default to Visual Flow.
- Existing Feature Document records, immutable revisions, jobs, evidence
  analyses, and shares remain the backend foundation.
- The direct authenticated Feature Document route may redirect to the
  canonical app-detail Flow URL once its source identity is resolved.
- Public revision-pinned share routes remain independent and unchanged.
- Do not restore the retired mutable `FLOW.md` storage model.

## Component boundaries

Expected UI responsibilities:

- `FlowsPanel`
  - resolves the selected Flow and passes shared mode/step state.
- `FlowsWorkspace`
  - keeps the tree mounted;
  - switches the right pane between gallery and selected Flow workspace.
- selected Flow workspace
  - owns the shared header and accessible mode tabs.
- Visual Flow panel
  - owns screenshot and prototype presentation.
- Document Flow panel
  - owns lazy document loading, lifecycle states, text rendering, revisions,
    evidence links, and authorized actions.
- router and app-detail state
  - parse, validate, serialize, and preserve `flowView`.

Do not combine tree navigation, image rendering, document lifecycle, and route
serialization in one component.

## Verification

Focused tests must cover:

- a selected Flow shows `Visual Flow` and `Document Flow`;
- Visual Flow is the default for old URLs;
- switching modes preserves Flow and step selection;
- `View visual step` opens the matching image step;
- the left desktop tree stays mounted while either mode is active;
- mobile drawer behavior remains intact;
- Screens and Prototype remain nested inside Visual Flow;
- Document Flow loads lazily without one request per tree item;
- a newly generated document displays progress before its first revision;
- missing, running, ready, failed, stale, and unauthorized states;
- source identity includes app, platform, version, and Flow ID;
- revisions do not create duplicate Flow tree leaves;
- direct Feature Document compatibility and public shares;
- keyboard tabs, focus visibility, accessible labels, and live progress.

Regression verification must cover existing Flow grouping, search, directory
expansion, Flow gallery behavior, URL selection, screenshots, prototype mode,
Feature Document revision safety, export, and sharing.

## Acceptance criteria

- Every selected Flow has a visible `Visual Flow` and `Document Flow` mode
  switch.
- Both modes represent the same Flow identity and ordered steps.
- The left Flow tree remains available while viewing either mode.
- Visual Flow displays ordered images and retains Screens/Prototype behavior.
- Document Flow presents overview, trigger, ordered steps, outcome, and
  alternate/error paths.
- Users can move from a text step to its exact source image in one action.
- Mode and step state are shareable through the app-detail URL.
- Document Flow content loads only when needed.
- A generation without a first revision shows progress instead of an error.
- Source drift, permissions, revision history, evidence traceability, export,
  and sharing remain intact.
- No separate Document Flow tree, top-level document library, or parent Flow
  schema is introduced.

## Out of scope

- A top-level Documents library.
- Folder organization for Document Flows.
- Adding Document Flows to Research Projects.
- Multiple public Document Flows for one source Flow.
- Reorganizing imported Flow categories.
- Replacing revision-pinned public share pages.
- Restoring the legacy mutable `FLOW.md` feature.
