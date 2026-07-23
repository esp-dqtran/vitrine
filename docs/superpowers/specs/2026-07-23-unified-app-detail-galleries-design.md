# Unified App Detail Galleries Design

## Goal

Make the Screens, UI Elements, and Flows tabs use the same section container, spacing, toolbar placement, grid rhythm, card interaction, loading boundary, and empty-state placement while preserving each tab's content and data behavior.

## Current State

- Screens and UI Elements share `ScreenDetail.renderEvidence`, but use different top padding from Flows.
- Screen filters live in `ReferenceDetailShell.tabControls`, while Flow search and the FLOW.md action live inside `FlowsPanel`.
- Screens and UI Elements render `ScreenGridCard` through `MediaGridCard`.
- Flows uses a separate outer wrapper and a separate hand-built `FlowCard`.
- Screens and UI Elements paginate through the section API. Flows loads one payload and progressively mounts 24 cards at a time.

## Chosen Approach

Create a small shared gallery presentation boundary rather than duplicating inline styles or building one highly generic data component.

### Shared section container

Add `ReferenceGallerySection`, responsible only for presentation:

- one outer section container for all three tabs;
- a consistent vertical gap;
- an optional toolbar row;
- a content slot;
- an optional load-more sentinel slot;
- stable hooks for focused boundary tests.

The component will not fetch, filter, paginate, group, or own section state.

### Shared grid container

Add `ReferenceGalleryGrid`, which owns the common CSS grid declaration and gap. Each consumer supplies its minimum card width:

- Screens: `280px`;
- UI Elements: `200px`;
- Flows: `220px`.

Different card widths remain intentional because the evidence aspect and information density differ, but the grid container and spacing stay identical.

### Toolbar placement

Move the Screens filter controls from `ReferenceDetailShell.tabControls` into the Screens `ReferenceGallerySection` toolbar. UI Elements uses the same section container without a toolbar. Flows places search and the FLOW.md action in the same toolbar slot.

The shell-level trailing count remains unchanged and continues to show the complete loaded count for the selected tab.

### Card visual language

Extend `MediaGridCard` with an optional title overlay. Existing Screens and UI Elements cards omit the title and remain visually unchanged.

Refactor `FlowCard` into a thin adapter over `MediaGridCard`:

- lead flow evidence remains the preview image;
- the flow title uses the shared optional title overlay;
- the step count uses the shared badge treatment;
- the accessible `Open <title> flow` action remains unchanged;
- missing or failed preview media uses the same fallback as Screens and UI Elements.

### Body spacing

Screens, UI Elements, and Flows use the same `ReferenceDetailShell` body padding: `32px 40px 72px`. Other sections retain their current padding.

## Data and Interaction Behavior

- Dedicated Screens, UI Elements, and Flows endpoints remain unchanged.
- Screens and UI Elements retain cursor pagination and their existing intersection sentinel.
- Flows retains one endpoint request and progressive mounting in batches of 24.
- Flow search continues filtering the complete loaded dataset before applying the visible-card limit.
- Opening screens, UI elements, flows, FLOW.md, and the lightbox keeps the current behavior.
- Platform/version cache keys and request lifecycles are not changed.

## Empty, Loading, and Error States

The existing shared parent loading and error states remain authoritative. Loaded empty states render inside the same gallery section content boundary, so the three tabs have consistent alignment without duplicating request-state logic.

## Testing

- Add focused markup tests proving Screens/UI Elements/Flows use the shared gallery section and grid hooks.
- Preserve the Flows tests for 24 initial cards and complete category totals.
- Add a FlowCard test proving it uses the shared media-card title, step badge, accessible label, and preview fallback contract.
- Run the full test suite and production build.
- Browser-check the three tabs on 15five:
  - identical content-shell inset and toolbar alignment;
  - UI Elements cursor pagination;
  - Flows 24-to-48 progressive rendering;
  - search finds a flow outside the first batch.

## Out of Scope

- API or database changes;
- changing tab names or information architecture;
- forcing identical card widths across unlike evidence types;
- redesigning Overview, Design System, Export, or Review;
- fixing the separate Apps-card navigation issue.
