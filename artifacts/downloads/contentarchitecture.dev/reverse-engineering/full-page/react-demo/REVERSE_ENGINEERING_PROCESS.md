# Evidence-first reverse-engineering process

The earlier process over-weighted stitched screenshots. That was enough to reproduce the page silhouette, but it missed viewport-relative layout and controls whose purpose is only visible through the DOM or interaction state. Use this process for every section before calling it reconstructed.

## 1. Establish the section boundary

- Record the section's direct DOM children, source order, IDs, classes, semantic roles, and accessible labels.
- Capture the section rectangle and each direct child's rectangle at the exact same viewport and density.
- Record whether height is fixed, content-driven, `vh`, `svh`, sticky, or scroll-linked. Never convert a viewport-relative section to a fixed pixel height from one screenshot.

Required viewports:

- `390 x 844` mobile
- `1024 x 768` breakpoint check
- `1159 x 863` tall desktop
- `1280 x 720` wide desktop

## 2. Inventory every interaction before implementation

For each section, enumerate:

- `button`, `a[href]`, `input`, `textarea`, `select`, `[role="button"]`, and elements with `aria-*` state
- hover, focus, pressed, expanded, selected, dragging, resizing, keyboard, and pointer-hold behavior
- sticky/fixed controls that visually overlap the section

Test one control at a time, capture the changed state, then restore the initial state. A control is not considered implemented because it looks present.

## 3. Record computed visual contracts

For readable content and controls, record:

- grid/flex tracks, gaps, padding, margin, alignment, and wrapping
- font family, size, weight, line height, letter spacing, and text balance
- colors, borders, radii, shadows, opacity, and stacking order
- local image/font/icon asset URLs and rendered crop

## 4. Build a component contract

Each reconstructed section must have a short contract covering structure, responsive geometry, content, assets, interaction states, accessibility state, and scroll behavior. Implementation starts only after those fields have source evidence.

## 5. Verify three independent layers

1. **DOM parity:** direct children and control inventory are accounted for.
2. **Behavior parity:** every captured state produces the same kind of state change.
3. **Visual parity:** equal-viewport source and implementation screenshots are placed in one side-by-side comparison.

Build success, HTTP 200, total document height, and a full-page contact sheet cannot replace these checks.

## 6. Block completion on missing behavior

`design-qa.md` remains `blocked` whenever a source control or P0/P1/P2 behavior is absent, even when the static screenshot is close. Only change it to `passed` after every section has cleared the DOM, behavior, and visual gates.

## Current first-section proof

- Equal-viewport comparison: `evidence/source-vs-implementation-hero-equal-viewport.png`
- Source and implementation: `1159 x 863`, density `1`
- Hero section rectangle: exact `1159 x 863` on both pages
- Scroll cue rectangle: exact `22 x 68` at `x=576.5`, `y=755` on both pages
- Source scroll destination: `1189.5px`
- Implementation scroll destination: `1194px` (4.5px difference from content rounding)
