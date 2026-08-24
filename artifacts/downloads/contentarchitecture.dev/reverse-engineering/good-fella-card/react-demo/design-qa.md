# Design QA: Exact Serve Robotics ASCII Reveal Card

## Comparison target

- Source truth: `http://localhost:4180/#pricing`
- Selected source node: `div#showcase > div.grid.grid-cols-1:nth-of-type(3) > a.group.block:nth-of-type(6)`
- React implementation: `http://localhost:4183/`
- Idle comparison: `comparison-serve-robotics-exact-idle-664.png` (source left, implementation right)
- Hover comparison: `comparison-serve-robotics-exact-hover-664.png` (source left, implementation right)

## Source recovery

- Recovered the exact React Server Component value referenced by the source card as `$e6`.
- The payload contains exactly 4,440 encoded luminance cells: 120 columns by 37 rows, with 64 levels.
- The local canvas now uses the source glyph ramp, level decoding, dark-background inversion, opacity curve, font measurement, aspect ratio, and device-pixel-ratio cap.
- The downloaded Serve Robotics image asset is used for the hover state.

## Normalization

- Browser viewport: 1512 x 834 CSS px for both renders at device-pixel ratio 2.
- Card rect in both renders: 664 x 405.3203125 CSS px.
- Canvas backing bitmap in both renders: 1328 x 747 pixels.
- Focused comparison crops: 664 x 406 pixels.

## Findings

No actionable P0, P1, or P2 mismatch remains inside the selected card boundary.

- ASCII image: passed. The cell positions, glyph choices, tonal structure, density, and responsive redraw match because both canvases use the same 4,440-cell source payload and rendering math.
- Fonts and typography: passed. Both use Geist Mono, uppercase treatment, matching weight and line height, and the same responsive title sizing.
- Spacing and layout: passed. Both use the same width, 16:9 media region, 12 px title gap, transparent root, square corners, and title footprint.
- Image asset: passed. The hover state uses the downloaded source asset with the same crop, scale, and object-fit behavior.
- Copy and metadata: passed. Title, canvas label, image alt text, destination URL, `_blank` target, and `noopener noreferrer` match.
- Interaction: passed. Idle canvas/image opacities are 1/0; hover opacities are 0/1; leaving restores 1/0. Both use a 500 ms ease-out crossfade.
- Runtime: passed. The local page reported zero console errors.
- Build: passed. Vite production build and all four Sites worker tests succeeded.

## Expected boundary difference

The faint repeating text visible behind the source card is rendered by a separate absolute canvas owned by the parent `#showcase` section. It is outside the selected anchor and is therefore not included in this standalone component. The card root remains transparent, preserving the original compositing behavior when placed over any parent surface.

## Responsive behavior

The card fills its container below 1024 px and uses the source two-column-width calculation above 1024 px. A ResizeObserver redraws the source cells at the rendered width with the same device-pixel-ratio cap of 2.

final result: passed
