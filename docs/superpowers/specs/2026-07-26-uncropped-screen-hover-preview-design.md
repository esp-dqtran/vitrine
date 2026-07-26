# Uncropped Screen Hover Preview

## Goal

When a user hovers a taxonomy option under **Screens** on the Apps page, show
the complete matching screen image rather than cropping it to the current
fixed landscape frame.

## Scope

- Change only Apps taxonomy previews whose preview kind is `screen`.
- Keep Category icons, UI Element previews, and Flow previews unchanged.
- Preserve the existing GSAP entrance motion, cursor offset, viewport
  clamping, reduced-motion behavior, lazy requests, and request cache.
- Do not change which screen candidate is selected in this work.

## Design

The facet-media endpoint will serve the original stored image for Screen
previews. Other preview kinds will continue using their existing thumbnail
media.

The Screen popover will derive its dimensions from the loaded image's natural
aspect ratio, scaled down to fit within `240px × 280px`, and use
`object-fit: contain`. This displays the entire image without distortion,
clipping, or unused fixed-frame space.

## Failure Behavior

If the original Screen image cannot be loaded, the preview remains hidden.
It does not fall back to a cropped thumbnail. Existing retry behavior remains
unchanged.

## Verification

- A focused route/store test proves Screen previews resolve original media.
- A focused rendering/style boundary test proves only Screen previews use
  the portrait frame and `object-fit: contain`.
- Existing Apps discovery and facet-preview tests remain green.
- The production build succeeds.
- Browser verification confirms a Screen hover displays the entire image and
  remains clamped inside the viewport.
