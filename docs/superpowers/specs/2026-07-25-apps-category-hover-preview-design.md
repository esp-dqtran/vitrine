# Apps Category Hover Preview

## Goal

Give the Apps taxonomy a visual preview without changing filtering behavior. Hovering a taxonomy value reveals one representative screenshot from the already-loaded catalog and lets that preview follow the pointer smoothly.

## Scope

- Apply only to taxonomy values in `AppsDiscoveryPage`.
- Keep click-to-filter, iOS/Web switching, ordering, search, and pagination unchanged.
- Reuse the installed `gsap` package and already-loaded `App.screens` data.
- Add no API request, polling, persistence, or new dependency.

## Interaction

On a fine-pointer device, entering a taxonomy value selects the first loaded matching app that has a screen for the active platform. A single floating preview appears near the pointer with a short opacity-and-scale reveal. `gsap.quickTo()` updates its x/y position, while moving between taxonomy values crossfades the image without recreating the floating container. Leaving the taxonomy hides the preview.

The preview is decorative and does not intercept pointer input. Clicking a taxonomy value continues to apply or clear the existing filter.

## Image Selection

For each taxonomy value:

1. Use the current platform.
2. Search the already-loaded Apps in their existing order.
3. Select the first App matching that taxonomy value with a usable screen.
4. Use that screen URL and the App name as internal preview metadata.
5. Show no preview when no matching loaded screen exists.

## Accessibility and Responsive Behavior

- Enable the floating preview only for `(hover: hover) and (pointer: fine)`.
- Honor `prefers-reduced-motion`; show/hide immediately without cursor-follow motion.
- Keep taxonomy buttons keyboard-accessible and their current pressed semantics unchanged.
- Do not expose decorative preview content to assistive technology.
- Do not render the floating preview on touch-only devices.

## React and GSAP Lifecycle

A focused hook owns the preview element, pointer listeners, `gsap.quickTo()` setters, and reveal tween. It uses `gsap.matchMedia()` scoped to the taxonomy root and reverts all GSAP work and listeners on cleanup. `AppsDiscoveryPage` supplies preview metadata through data attributes or event callbacks without moving filtering state into the animation layer.

## Testing

- Unit-test deterministic taxonomy-to-preview selection for platform and missing-screen cases.
- Render-test that taxonomy values expose preview metadata without changing filter semantics.
- Boundary-test reduced-motion and fine-pointer setup/cleanup in the focused GSAP hook.
- Run the Apps discovery tests and production build.
