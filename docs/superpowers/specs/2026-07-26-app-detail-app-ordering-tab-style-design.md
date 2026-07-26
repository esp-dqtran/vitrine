# App Detail App-Ordering Tab Style Design

## Goal

Make the App detail section tabs visually match the Apps screen's `App ordering` strip without sharing its component or copying any sorting behavior.

## Design

Keep the App detail navigation markup, active-section state, callbacks, and sliding indicator in `ReferenceDetailShell`. Add App-scoped detail-tab CSS, gated by `data-reference-detail='app'`, so the tabs match the Apps discovery ordering strip:

- 64px row height with the same compact 14px labels.
- 25px horizontal gap and content-sized tab widths.
- Secondary text for inactive tabs and primary text for hover, focus, and the active tab.
- A 2px primary underline with the same placement and rounded shape.
- Transparent button backgrounds in every state.
- Horizontal overflow at narrow widths.
- Reduced-motion behavior that removes indicator animation.

The detail page keeps its existing leading controls, trailing actions, accessible `tablist` and `tab` semantics, section routing, and content loading. The Apps discovery toolbar remains unchanged.

## Scope

- Update only App detail tab presentation; Site detail keeps its current styling.
- Preserve the current `ReferenceDetailShell` structure and `useSlidingIndicator` behavior.
- Do not reuse or modify `ReferenceDiscoveryToolbar`.
- Do not add Apps sorting, `Latest`, `Most popular`, or platform-filter behavior to App detail.
- Do not change section order, URL state, data fetching, galleries, or detail content.
- Preserve unrelated working-tree changes.

## Verification

- Focused style-boundary coverage compares the detail navigation's key visual rules with the Apps ordering strip.
- Existing `ReferenceDetailShell`, App detail, and Apps discovery tests pass.
- The production build succeeds.
- Browser QA confirms the detail tabs visually match the Apps ordering strip at desktop and mobile widths when an authenticated App detail route is available.
