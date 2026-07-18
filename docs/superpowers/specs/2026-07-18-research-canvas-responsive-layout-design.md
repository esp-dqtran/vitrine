# Research Canvas Responsive Layout Design

## Problem

The Research Project workspace currently uses a fixed three-column grid: Evidence, Comparison lanes, and Designer decision. At narrow viewports, the browser clips the second and third columns without exposing horizontal scrolling, so most of the workspace is unreachable.

## Goal

Keep the existing desktop workspace intact while making every section reachable and readable on tablets and phones. The change must not add navigation state, alter research data, or change any API behavior.

## Responsive behavior

- Above 1100px, preserve the current three-column workspace: a 280px Evidence panel, a flexible Comparison lanes canvas, and a 320px Designer decision panel.
- At 1100px and below, stack the workspace in task order: Evidence, Comparison lanes, then Designer decision.
- On tablet widths, Comparison lanes may retain their existing horizontal lane scrolling within the full-width canvas.
- At 640px and below, stack lanes vertically so each alternative is visible without hidden horizontal content.
- Reduce page side padding at phone widths while retaining the existing spacing scale and visual tokens.
- Preserve the current heading, controls, data flow, focus order, and component boundaries.

## Implementation shape

Add semantic class names to the Research Project page, workspace grid, Decision Canvas, and lane collection. Express viewport behavior in the existing Vitrine stylesheet with two media queries. Continue using the existing components and CSS variables; do not introduce tabs, JavaScript viewport detection, component state, or a new dependency.

The DOM order already matches the intended responsive reading and keyboard order, so the layout can change entirely through CSS.

## Data flow and error handling

There are no data-flow or error-handling changes. Evidence, lane, and decision mutations continue through the existing actions and revision-conflict handling. Responsive behavior is presentational only.

## Verification

- Add a focused regression test for the responsive layout contract before changing the components and stylesheet.
- Run the Research Projects UI test suite, TypeScript checks, and the production build.
- Capture and inspect the same populated project at 1440px and 390px.
- At 1440px, verify the three-column layout remains visually equivalent to the current design.
- At 390px, verify Evidence, Comparison lanes, both alternatives, and Designer decision are reachable in normal vertical page flow with no clipped content or page-level horizontal overflow.

## Out of scope

- Mobile tabs or accordions
- Drag-and-drop lane interactions
- Redesigning Evidence, lane, or Designer decision content
- API, persistence, synthesis, or feature-flag changes
