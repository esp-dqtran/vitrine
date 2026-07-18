# Vitrine Astryx Component Migration Design

## Problem

Vitrine currently mixes `@astryxdesign/core` primitives with directly rendered HTML controls and locally styled reusable controls. Of 49 production TSX files under `src/vitrine`, 28 import Astryx components, while 28 render at least one native interactive control. The production source contains 98 directly rendered buttons, 25 inputs, 10 textareas, and 4 selects. Fifteen files mix both systems, and thirteen use native interactive controls without importing Astryx at all.

This produces inconsistent focus, disabled, loading, validation, spacing, and theme behavior. It also allows new one-off primitives to bypass the component system even when Astryx already supplies an equivalent.

## Goal

Make `@astryxdesign/core` the required source for reusable UI primitives throughout the production Vitrine frontend while preserving current user flows, responsive layouts, application behavior, and domain component boundaries.

The migration is complete when production Vitrine code no longer directly renders reusable interactive primitives for which Astryx has an equivalent, and an automated test prevents those primitives from returning.

## Scope

The migration covers production `.tsx` files under `src/vitrine`, excluding tests and stories. It includes public pages, authenticated catalog pages, research tools, administration, crawler operations, and the Research Project workspace.

The following reusable primitives must come from `@astryxdesign/core`:

- Actions: `Button`, `IconButton`, `ToggleButton`, or another purpose-specific Astryx action
- Text entry: `TextInput` and `TextArea`
- Selection: `Selector`, `CheckboxInput`, and related Astryx selection controls
- Uploads: `FileInput`
- Surfaces: `Card`, `ClickableCard`, `Dialog`, `AlertDialog`, and Astryx navigation components when the interaction matches their contract
- Content: `Heading`, `Text`, `Badge`, `EmptyState`, `Spinner`, and other available Astryx feedback primitives

Semantic structural HTML remains valid. Elements such as `main`, `section`, `article`, `aside`, `header`, `footer`, `nav`, `form`, `label`, lists, tables used for document structure, and non-interactive `div` or `span` containers do not need component wrappers.

## Component boundary

Product-specific composites remain local. Components such as `DecisionCanvas`, `EvidenceDrawer`, `EvidenceCard`, `ProjectInsightsPanel`, `AppCard`, `FlowViewer`, and `CommandPalette` express Astryx product behavior rather than generic design-system primitives. They will keep their current public APIs and responsibilities, but their internal reusable controls and surfaces will be assembled from `@astryxdesign/core`.

Framer Motion and GSAP remain allowed for animation. Recharts remains allowed for charts. These libraries provide specialized behavior rather than replacing Astryx UI primitives.

## Migration approach

The migration will be performed in focused batches rather than as a visual rewrite:

1. Add a source-level compliance test that scans production Vitrine TSX and reports directly rendered `button`, `input`, `textarea`, and `select` elements by file and line.
2. Migrate shared and low-level controls first, including search, navigation actions, filters, cards, lightboxes, and slide panels.
3. Migrate feature surfaces, including collections, flow documents, exports, versioning, settings, and curator review.
4. Migrate the Research Project and crawler-operation surfaces, preserving their existing async states, validation, file restrictions, disabled states, and responsive layout.
5. Migrate public Home, Pricing, and Sign In controls without changing their visual composition or motion behavior.
6. Remove obsolete local primitive style objects after their final consumers move to Astryx.
7. Turn the compliance inventory into a zero-exception guard for reusable interactive controls.

Direct component imports are preferred over a new local compatibility layer. Small local adapters are allowed only when an Astryx component's controlled-value contract cannot preserve an existing behavior directly; any adapter must wrap an Astryx primitive and exist for a documented behavior mismatch, not styling convenience.

## Behavior preservation

The refactor must preserve:

- Existing routes, navigation outcomes, API calls, and mutation ordering
- Keyboard activation, focus order, labels, accessible names, and dialog behavior
- Loading, disabled, empty, error, validation, and destructive-action states
- File type and size validation for private screenshot uploads
- Current responsive layouts at desktop, tablet, and phone widths
- Current animation and chart behavior
- Existing black-and-white theme tokens and user-selected theme mode

Where Astryx component defaults differ visually from a current one-off control, use documented component variants, sizes, and layout props first. Local layout styling may position or size the component, but must not recreate the primitive's border, state, or typography system.

## Error handling

This is a presentation-layer refactor. Existing error messages and async error handling remain in their owning feature components. Astryx status and validation props will display those states without changing when errors are produced or cleared.

Destructive controls retain their current confirmation behavior. If a current destructive action has no confirmation and the migration reveals an existing `AlertDialog` pattern for the same action class, adding confirmation is deferred because it would change behavior beyond this refactor.

## Compliance test

The test will parse production Vitrine TSX rather than use a fragile text search. It will fail when a JSX opening or self-closing element has one of these tag names:

- `button`
- `textarea`
- `select`
- `input`, except a narrowly documented browser-only input when no Astryx component can express the required platform behavior

The intended final state has no exceptions because Astryx core currently exports `Button`, `IconButton`, `TextInput`, `TextArea`, `Selector`, `CheckboxInput`, and `FileInput`. If implementation proves that a browser-only input cannot be replaced without losing required behavior, the exception must name the file, input type, and reason in the test rather than allowing a general bypass.

The guard does not ban native structural HTML or local product composites.

## Verification

- Run the compliance test before migration and confirm it fails with the current native-control inventory.
- Run focused component tests after each migration batch.
- Run all Vitrine tests after every feature-area batch.
- Run the repository TypeScript check and production Vite build.
- Verify the final compliance test reports no unapproved native interactive primitives.
- Inspect representative public, catalog, administration, crawler, and Research Project screens at desktop and phone widths.
- Confirm keyboard focus, disabled states, loading states, dialogs, selectors, text entry, uploads, and destructive actions remain usable.
- Compare representative pre- and post-migration screenshots at the same viewport and state to identify unintended layout or typography changes.

## Worktree safety

The current checkout contains unrelated and overlapping uncommitted changes. The migration must preserve them. Commits will stage only the files intentionally changed for each migration batch, and no reset, checkout, broad formatting rewrite, or blanket staging command will be used.

## Out of scope

- Redesigning Vitrine layouts, visual hierarchy, navigation, or content
- Replacing animation or chart libraries
- Changing APIs, database schemas, authentication, crawler behavior, or research workflows
- Creating a second local design system or generic wrapper library
- Expanding `@astryxdesign/core` itself unless a verified missing primitive blocks the migration
