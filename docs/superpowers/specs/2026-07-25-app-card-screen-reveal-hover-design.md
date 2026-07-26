# App Card Screen-Reveal Hover Design

## Goal

Replace the current Apps discovery card hover with a preview transition that reveals the next captured screen without changing card navigation, click behavior, or the underlying screen order.

## Interaction

- When a pointer enters an App card with at least two screens, the current preview scales down slightly and the next screen slides in from the right.
- The transition lasts approximately 420ms and uses the existing `cubic-bezier(.16, 1, .3, 1)` easing.
- The media surface lifts by 4px and receives a stronger shadow during hover.
- A small “Next screen” action fades into the lower-right corner.
- When the pointer leaves, the preview returns to the original active screen.
- Cards with only one screen use the lift and shadow treatment without a screen-reveal animation.

## Existing Behavior to Preserve

- Clicking the card opens the App.
- Keyboard activation with Enter or Space opens the App.
- Existing left and right arrow controls continue to change the active screen.
- Import and analysis status badges remain visible.
- The App identity, description, and progress copy do not move.

## Accessibility

- Keyboard focus exposes the action state without continuously sliding between screens.
- `prefers-reduced-motion: reduce` removes the animated travel and applies the final state immediately.
- The hover treatment remains limited to fine-pointer devices; touch interaction is unchanged.

## Implementation Boundary

- Keep the interaction inside `AppCard` and its existing CSS selectors.
- Render the active and next previews together only when a next screen exists.
- Use CSS transitions for the reveal; do not add another animation dependency.
- Reset hover state on pointer leave without mutating the user-selected active screen index.
- Display each screenshot in full with `object-fit: contain` instead of cropping it.
- Use a 32px preview inset so the complete screenshot is slightly smaller within the media surface.

## Verification

- Component rendering tests cover active and next preview layers.
- CSS boundary tests cover slide direction, duration, easing, single-screen fallback, fine-pointer scoping, and reduced-motion behavior.
- Existing Apps discovery tests and the production build must continue to pass.
