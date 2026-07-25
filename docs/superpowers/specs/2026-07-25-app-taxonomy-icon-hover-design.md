# App Taxonomy Hover Preview Design

## Goal

Give each Apps discovery taxonomy group a preview suited to its content:
Categories show an app icon, Screens show a matching screen, UI Elements show
a stored component crop, and Flows show an animated sequence of flow steps.

## Interaction

- Hovering a taxonomy item lazily loads its preview and caches the result for
  subsequent hovers.
- Categories show the icon of the first matching published app.
- Screens show one matching published screen image.
- UI Elements show one matching published `ui_element` image.
- Flows animate through up to three ordered, published flow-step images.
- The preview appears below and to the right of the pointer.
- The preview follows pointer movement with the existing GSAP smoothing.
- The preview stays inside the viewport when the pointer approaches an edge.
- The preview fades and scales in and out, while reduced-motion users receive
  the same content without animated travel or Flow cycling.
- Leaving the taxonomy item hides the preview.
- If a facet has no matching media, no preview is shown.
- The preview remains non-interactive and is disabled for non-fine pointers.

## Public API

- Add one public, read-only facet-preview endpoint whose `group`, `value`, and
  `platform` inputs are restricted to the existing taxonomy allowlist.
- Resolve only media attached to the latest published app/platform version.
- Return an app label, preview kind, and at most three protected media URLs.
- Resolve every returned media URL through an app- and publication-scoped
  object lookup. Never return object keys, source paths, or private App detail.
- Keep the query bounded and perform no Apps-screen job polling.

## Implementation Boundary

- Keep the existing taxonomy buttons, filtering behavior, and GSAP lifecycle.
- Add a cached hover-preview loader rather than expanding the initial catalog
  page payload with every taxonomy preview.
- Render icon, screen, component, and Flow preview variants in the same
  non-interactive floating container.
- Do not alter app cards, category filtering, sorting, or mobile behavior.

## Verification

- Unit-test taxonomy input validation, latest-published scoping, output bounds,
  media authorization, and the missing-media case.
- Unit-test client caching and preview rendering for all four groups.
- Boundary-test that the hover preview retains GSAP cleanup and reduced-motion
  behavior.
- Verify pointer offsets and viewport clamping in the local Apps page.
- Verify Flow cycling and protected media in the browser without API errors.
