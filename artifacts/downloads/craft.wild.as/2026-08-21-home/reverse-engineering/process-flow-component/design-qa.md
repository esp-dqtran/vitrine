# Design QA

## Comparison target

- Source visual truth: `evidence/source-desktop-1108x863.png`
- Implementation: `evidence/implementation-desktop-1108x863.png`
- Combined comparison: `evidence/comparison-desktop-1108x863.png`
- Viewport: `1108 × 863` CSS pixels at browser device-pixel ratio 2
- State: default animated process flow
- Source pixels: `1108 × 863`; implementation pixels: `1108 × 863`

## DOM and runtime evidence

The implementation was built and checked from the hydrated DOM, live CSS/computed styles, and recovered canvas JavaScript. The screenshot was used only as the final visual parity check.

Desktop source and implementation match on the component-relative measurements:

- Section: `1108 × 884.695px`
- Content: `996 × 688.695px`, `56px` horizontal gutter, `98px` top padding
- Heading: `302.078 × 78.344px`, `37.672px / 39.179px`, `-0.753px` tracking
- Description: `445.734 × 72.891px`, `15px / 24.3px`
- Flow: `996 × 332px`
- Steps: four `238.5px` columns with `14px` gaps

Mobile source and implementation DOM measurements match at `390 × 844`:

- Section: `390 × 808.547px`
- Content: `334 × 612.547px`, `28px` horizontal gutter, `98px` top padding
- Heading: `208.5 × 54.078px`, `26px / 27.04px`
- Flow: `334 × 111.328px`
- Steps: two `160px` columns with `14px` gaps

The Generate hover state matches the source: inactive steps resolve to `0.45` opacity, the active step remains `1`, the tracked pixel line resolves to `1`, and its tested transform snaps to `81px` on the 9px grid. Canvas bitmap sizing is DPR-correct (`1992 × 664` for a `996 × 332` CSS canvas).

## Required fidelity surfaces

- Fonts and typography: original Sneak regular/medium files; font sizes, weights, line heights, letter spacing, and wraps match the source DOM.
- Spacing and layout rhythm: component-relative desktop and mobile geometry matches the source measurements.
- Colors and tokens: source values retained (`#0a0a0a`, `#2a2a2a`, `#1c2541`, `#3b5bd9`, `#f5c518`, `#fafafa`).
- Image and asset fidelity: there are no image assets in the selected component; the helix is the recovered generative canvas and the fonts are local source assets.
- Copy and content: heading, description, four labels, and four descriptions match the hydrated DOM.

## Findings

No actionable P0, P1, or P2 differences remain. The animated helix is time-dependent, so individual cell positions differ between captures while its algorithm, palette, density, grid, and state transitions match.

The source comparison includes the page-level “View full site” link and global cursor/blob; these are intentionally absent because they are outside `section#process > div.wrap` and outside the extracted component boundary. The source section was also scrolled approximately `15px` above the viewport; geometry was compared relative to the section rather than treating that scroll offset as component padding.

## Comparison history

- Pass 1: no P0/P1/P2 visual mismatch after DOM-relative normalization; no visual fix loop required.

## Focused-region evidence

The full component remains readable at `1108 × 863`, so a second image crop was not needed. Typography, labels, copy wrapping, canvas cell size, and step alignment were also checked from exact DOM geometry and computed styles.

## Interaction and runtime checks

- Canvas animation is active and DPR-sized.
- Pointer displacement listeners are attached to the helix canvas.
- Step emphasis and cursor-tracking pixel line were exercised.
- Responsive two-column and four-column branches were exercised.
- Browser console: no errors or warnings.
- Production build: passed.
- Sites packaging tests: 4/4 passed.

final result: passed
