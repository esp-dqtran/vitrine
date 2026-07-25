# App Taxonomy Icon Hover Design

## Goal

Replace the Apps discovery taxonomy hover screen preview with the icon of a
matching app. Apply the behavior consistently to hover targets in Categories,
Screens, UI Elements, and Flows.

## Interaction

- Hovering a taxonomy item selects the first currently available app that
  matches that facet and has an `iconUrl`.
- The app icon appears below and to the right of the pointer.
- The icon follows pointer movement with the existing GSAP smoothing.
- The preview stays inside the viewport when the pointer approaches an edge.
- The preview fades and scales in and out, while reduced-motion users receive
  the same content without animated travel.
- Leaving the taxonomy item hides the preview.
- If no matching app has an icon, no preview is shown.
- The preview remains non-interactive and is disabled for non-fine pointers.

## Implementation Boundary

- Keep the existing taxonomy buttons, filtering behavior, and GSAP lifecycle.
- Change the facet-preview selection to return app icon metadata rather than a
  screen image.
- Update the hover preview component and styles for a compact rounded app icon.
- Do not alter app cards, category filtering, sorting, or mobile behavior.

## Verification

- Unit-test icon selection for every facet group and the missing-icon case.
- Boundary-test that the hover preview uses app icons and retains GSAP cleanup.
- Verify pointer offsets and viewport clamping in the local Apps page.
