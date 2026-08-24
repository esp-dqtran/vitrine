# Process Flow reverse engineering

Source: `https://craft.wild.as/#protocol`

Selected node: `section#process > div.wrap`

## DOM-first evidence

- Inspected the hydrated source node and copied its semantic text structure.
- Read the live CSS rules and computed styles rather than estimating from the screenshot.
- Recovered the original `procflow` canvas algorithm and its pointer/step state machine from the page JavaScript.
- Downloaded the source Sneak regular and medium fonts into `public/assets/fonts/`.
- Used desktop and mobile DOM geometry to recover the responsive contract.

## Measured contract

- Maximum content width: `1176px`.
- Gutters: `56px` desktop and `28px` below `680px`.
- Observed vertical section padding: `98px` on both captured viewports.
- Headline: `clamp(26px, 3.4vw, 46px)`, `1.04` line-height, `-0.02em` tracking.
- Flow canvas: `3 / 1` aspect ratio.
- Steps: four columns at `840px` and above; two columns below.
- At `1108 × 863`: content `996px`, canvas `996 × 332px`, steps `238.5px` wide.
- At `390 × 844`: content `334px`, canvas `334 × 111.33px`, steps `160px` wide.

## State machine

- Two strands flow left to right: blue begins chaotic and resolves into yellow.
- Yellow rungs are drawn on the resolved half.
- Pointer movement through the canvas repels the grid cells; they spring back on exit.
- Hovering one of the four step nodes emphasizes its quarter and fades the others.
- Fine-pointer step hover adds a 9px-snapped tracking pixel line.
- Rendering pauses while the canvas is outside the viewport.

## Extracted boundary

`src/components/ProcessFlowSection.jsx` is explicit React and does not use captured HTML, external scripts, or hotlinked assets. The source page's global cursor/blob and fixed “View full site” link are excluded because they are outside the selected DOM component.
